import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAppointmentTables } from '@/lib/appointments'
import { createOutlookState, getMicrosoftRedirectUri, isOutlookConfigured } from '@/lib/outlook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await ensureAppointmentTables()
  const chargeId = Number(req.nextUrl.searchParams.get('chargeId'))
  if (!Number.isInteger(chargeId) || chargeId <= 0) {
    return NextResponse.json({ error: 'Charge invalide.' }, { status: 400 })
  }
  if (!isOutlookConfigured()) {
    return NextResponse.json({ error: 'Microsoft Graph non configure.' }, { status: 503 })
  }

  const charge = await prisma.charge.findUnique({ where: { id: chargeId }, select: { email: true } })
  if (!charge) return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })

  const tenantId = process.env.MICROSOFT_TENANT_ID!.trim()
  const clientId = process.env.MICROSOFT_CLIENT_ID!.trim()
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getMicrosoftRedirectUri(req.nextUrl.origin),
    response_mode: 'query',
    scope: 'openid profile offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Calendars.ReadWrite',
    state: createOutlookState(chargeId),
    prompt: 'select_account',
  })
  if (charge.email) params.set('login_hint', charge.email)

  return NextResponse.redirect(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params}`)
}
