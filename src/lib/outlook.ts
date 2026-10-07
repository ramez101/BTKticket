import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

const GRAPH_SCOPE = 'openid profile offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite'
const TOKEN_ENCRYPTION_KEY = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY?.trim()

type MicrosoftTokenResponse = {
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
}

type OutlookConnection = {
  connected: boolean
  email: string | null
}

type OutlookAppointment = {
  reference: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  subject?: string | null
  agencyName: string
  date: string
  time: string
}

function getMicrosoftConfig() {
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim()
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim()
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim()

  if (!tenantId || !clientId || !clientSecret || !TOKEN_ENCRYPTION_KEY) return null
  return { tenantId, clientId, clientSecret }
}

export function isOutlookConfigured() {
  return Boolean(getMicrosoftConfig())
}

export function getMicrosoftRedirectUri(origin: string) {
  return process.env.MICROSOFT_REDIRECT_URI?.trim()
    || `${origin.replace(/\/$/, '')}/api/outlook/callback`
}

function encryptionKey() {
  if (!TOKEN_ENCRYPTION_KEY) throw new Error('MICROSOFT_TOKEN_ENCRYPTION_KEY manquant.')
  return createHash('sha256').update(TOKEN_ENCRYPTION_KEY).digest()
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decrypt(value: string) {
  const payload = Buffer.from(value, 'base64url')
  const iv = payload.subarray(0, 12)
  const tag = payload.subarray(12, 28)
  const encrypted = payload.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function sign(value: string) {
  return createHmac('sha256', encryptionKey()).update(value).digest('base64url')
}

export function createOutlookState(chargeId: number) {
  const payload = Buffer.from(JSON.stringify({ chargeId, expiresAt: Date.now() + 10 * 60 * 1000 })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyOutlookState(state: string) {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { chargeId?: unknown; expiresAt?: unknown }
    if (typeof parsed.chargeId !== 'number' || !Number.isInteger(parsed.chargeId) || typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) return null
    return { chargeId: parsed.chargeId }
  } catch {
    return null
  }
}

async function requestTokens(parameters: URLSearchParams) {
  const config = getMicrosoftConfig()
  if (!config) throw new Error('Microsoft Graph n’est pas configuré.')

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: parameters,
    cache: 'no-store',
  })
  const data = await response.json() as MicrosoftTokenResponse
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Autorisation Microsoft impossible.')
  }
  return data
}

export async function connectOutlookAccount(chargeId: number, code: string, redirectUri: string) {
  const config = getMicrosoftConfig()
  if (!config) throw new Error('Microsoft Graph n’est pas configuré.')

  const token = await requestTokens(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    scope: GRAPH_SCOPE,
  }))
  if (!token.refresh_token) throw new Error('Microsoft n’a pas fourni de jeton de renouvellement.')

  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  })
  const profile = await profileResponse.json() as { mail?: string | null; userPrincipalName?: string }
  if (!profileResponse.ok) throw new Error('Impossible de vérifier le compte Microsoft connecté.')
  const email = profile.mail || profile.userPrincipalName || null

  await prisma.charge.update({
    where: { id: chargeId },
    data: { outlookEmail: email, outlookRefreshToken: encrypt(token.refresh_token) },
  })
  return { email }
}

export async function getOutlookConnection(chargeId: number): Promise<OutlookConnection> {
  const row = await prisma.charge.findUnique({
    where: { id: chargeId },
    select: { outlookEmail: true, outlookRefreshToken: true },
  })
  return { connected: Boolean(row?.outlookRefreshToken), email: row?.outlookEmail ?? null }
}

async function getGraphAccessToken(chargeId: number) {
  const config = getMicrosoftConfig()
  if (!config) throw new Error('Microsoft Graph n’est pas configuré.')
  const row = await prisma.charge.findUnique({
    where: { id: chargeId },
    select: { outlookRefreshToken: true },
  })
  const storedRefreshToken = row?.outlookRefreshToken
  if (!storedRefreshToken) return null

  let refreshToken: string
  try {
    refreshToken = decrypt(storedRefreshToken)
  } catch {
    return null
  }

  try {
    const token = await requestTokens(new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: GRAPH_SCOPE,
    }))
    if (token.refresh_token) {
      await prisma.charge.update({
        where: { id: chargeId },
        data: { outlookRefreshToken: encrypt(token.refresh_token) },
      })
    }
    return token.access_token!
  } catch (error) {
    console.error('Microsoft Graph token refresh failed:', error)
    return null
  }
}

function utcDateTime(date: string, time: string, additionalMinutes = 0) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours - 1, minutes + additionalMinutes)).toISOString().replace(/\.000Z$/, '')
}

function appointmentDescription(input: OutlookAppointment) {
  return [
    `Référence : ${input.reference}`,
    `Client : ${input.customerName}`,
    `Téléphone : ${input.customerPhone}`,
    input.customerEmail ? `E-mail : ${input.customerEmail}` : '',
    input.subject ? `Objet : ${input.subject}` : '',
  ].filter(Boolean).join('\n')
}

export async function createOutlookEvent(chargeId: number, input: OutlookAppointment) {
  if (!isOutlookConfigured()) return { synced: false, reason: 'not_configured' as const }
  let accessToken: string | null
  try {
    accessToken = await getGraphAccessToken(chargeId)
  } catch (error) {
    console.error('Microsoft Graph event creation skipped:', error)
    return { synced: false, reason: 'provider_error' as const }
  }
  if (!accessToken) return { synced: false, reason: 'not_connected' as const }

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: `RDV BTK - ${input.customerName}`,
        body: { contentType: 'text', content: appointmentDescription(input) },
        start: { dateTime: utcDateTime(input.date, input.time), timeZone: 'UTC' },
        end: { dateTime: utcDateTime(input.date, input.time, 30), timeZone: 'UTC' },
        location: { displayName: input.agencyName },
        transactionId: `btk-${input.reference}`,
      }),
      cache: 'no-store',
    })
    const event = await response.json() as { id?: string; error?: { message?: string } }
    if (!response.ok || !event.id) {
      console.error('Microsoft Graph event creation failed:', event)
      return { synced: false, reason: 'provider_error' as const }
    }
    return { synced: true, eventId: event.id }
  } catch (error) {
    console.error('Microsoft Graph event creation failed:', error)
    return { synced: false, reason: 'provider_error' as const }
  }
}

export async function deleteOutlookEvent(chargeId: number, eventId: string | null | undefined) {
  if (!eventId) return { synced: false, reason: 'not_found' as const }
  if (!isOutlookConfigured()) return { synced: false, reason: 'not_configured' as const }
  let accessToken: string | null
  try {
    accessToken = await getGraphAccessToken(chargeId)
  } catch (error) {
    console.error('Microsoft Graph event deletion skipped:', error)
    return { synced: false, reason: 'provider_error' as const }
  }
  if (!accessToken) return { synced: false, reason: 'not_connected' as const }

  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (response.status === 204 || response.status === 404) return { synced: true }
    console.error('Microsoft Graph event deletion failed:', await response.text())
    return { synced: false, reason: 'provider_error' as const }
  } catch (error) {
    console.error('Microsoft Graph event deletion failed:', error)
    return { synced: false, reason: 'provider_error' as const }
  }
}
