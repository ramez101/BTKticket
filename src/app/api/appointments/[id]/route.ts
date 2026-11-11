import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppointmentRecord, normalizeAppointment } from '@/lib/appointments'
import { sendChargeAppointmentEmail } from '@/lib/mail'
import { deleteOutlookEvent } from '@/lib/outlook'
import { sendPushToTokens } from '@/lib/push'

export const dynamic = 'force-dynamic'

type ChargeAppointmentRecord = AppointmentRecord & {
  chargeName: string
  chargeEmail: string | null
  agencyName: string
  outlookEventId: string | null
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const appointmentId = parseInt(params.id, 10)
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json({ error: 'Id invalide' }, { status: 400 })
  }

  const row = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      charge: { select: { name: true, email: true } },
      agency: { select: { name: true } },
    },
  })
  const appointment: ChargeAppointmentRecord | null = row ? {
    ...row,
    chargeName: row.charge.name,
    chargeEmail: row.charge.email,
    agencyName: row.agency.name,
    outlookEventId: row.outlookEventId,
  } : null
  if (!appointment) {
    return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })
  }

  const pushTokens = (await prisma.pushSubscription.findMany({ where: { appointmentId }, select: { token: true } }))
    .map(item => item.token)
  await prisma.appointment.delete({ where: { id: appointmentId } })

  const outlook = await deleteOutlookEvent(appointment.chargeId, appointment.outlookEventId)
  const chargeEmail = await sendChargeAppointmentEmail({
    chargeEmail: appointment.chargeEmail,
    chargeName: appointment.chargeName,
    agencyName: appointment.agencyName,
    date: appointment.date,
    time: appointment.time,
    reference: appointment.reference,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    customerEmail: appointment.customerEmail,
    subject: appointment.subject,
  }, 'cancellation', { calendarInvite: !outlook.synced })

  const dateLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Tunis' })
    .format(new Date(`${appointment.date}T12:00:00Z`))
  const pushNotification = await sendPushToTokens(pushTokens, {
    title: 'Mise à jour de votre rendez-vous',
    body: `Votre rendez-vous BTK Easy du ${dateLabel} à ${appointment.time.replace(':', ' h ')} a été annulé. Consultez l'application pour réserver un nouveau créneau.`,
    data: { type: 'appointment-cancelled', appointmentId, reference: appointment.reference },
    priority: 'high',
    sound: 'default',
    channelId: 'appointments',
  })

  return NextResponse.json({ success: true, appointment: normalizeAppointment(appointment), chargeEmail, outlook, pushNotification })
}
