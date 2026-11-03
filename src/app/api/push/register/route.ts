import { NextRequest, NextResponse } from 'next/server'
import { isExpoPushToken, registerPushSubscription } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const ticketId = body.ticketId ? Number(body.ticketId) : null
  const appointmentId = body.appointmentId ? Number(body.appointmentId) : null

  if (!isExpoPushToken(token)) {
    return NextResponse.json({ error: 'Token push invalide' }, { status: 400 })
  }
  if (ticketId !== null && (!Number.isInteger(ticketId) || ticketId <= 0)) {
    return NextResponse.json({ error: 'Ticket invalide' }, { status: 400 })
  }
  if (appointmentId !== null && (!Number.isInteger(appointmentId) || appointmentId <= 0)) {
    return NextResponse.json({ error: 'Rendez-vous invalide' }, { status: 400 })
  }
  if (ticketId !== null && appointmentId !== null) {
    return NextResponse.json({ error: 'Une notification doit cibler un seul élément' }, { status: 400 })
  }

  await registerPushSubscription({
    token,
    platform: typeof body.platform === 'string' ? body.platform : null,
    ticketId,
    appointmentId,
  })

  return NextResponse.json({ ok: true })
}

