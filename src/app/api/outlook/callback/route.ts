import { NextRequest, NextResponse } from 'next/server'
import { ensureAppointmentTables } from '@/lib/appointments'
import { connectOutlookAccount, getMicrosoftRedirectUri, verifyOutlookState } from '@/lib/outlook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function dashboardRedirect(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/charge-dashboard', req.nextUrl.origin)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  await ensureAppointmentTables()
  const providerError = req.nextUrl.searchParams.get('error')
  const state = req.nextUrl.searchParams.get('state') || ''
  const verifiedState = verifyOutlookState(state)
  if (!verifiedState) return dashboardRedirect(req, { outlook: 'error', message: 'Lien Microsoft invalide ou expiré.' })
  if (providerError) {
    return dashboardRedirect(req, {
      outlook: 'error',
      chargeId: String(verifiedState.chargeId),
      message: req.nextUrl.searchParams.get('error_description') || 'Autorisation Microsoft refusée.',
    })
  }

  const code = req.nextUrl.searchParams.get('code')
  if (!code) return dashboardRedirect(req, { outlook: 'error', chargeId: String(verifiedState.chargeId), message: 'Code Microsoft manquant.' })

  try {
    await connectOutlookAccount(verifiedState.chargeId, code, getMicrosoftRedirectUri(req.nextUrl.origin))
    return dashboardRedirect(req, { outlook: 'connected', chargeId: String(verifiedState.chargeId) })
  } catch (error) {
    console.error('Microsoft Outlook callback failed:', error)
    return dashboardRedirect(req, {
      outlook: 'error',
      chargeId: String(verifiedState.chargeId),
      message: error instanceof Error ? error.message : 'Connexion Outlook impossible.',
    })
  }
}
