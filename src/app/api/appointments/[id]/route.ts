import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppointmentRecord, normalizeAppointment } from '@/lib/appointments'
import { sendChargeAppointmentEmail } from '@/lib/mail'
import { deleteOutlookEvent } from '@/lib/outlook'

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

  await prisma.appointment.delete({ where: { id: appointmentId } })

  const outlook = await deleteOutlookEvent(appointment.chargeId, appointment.outlookEventId)
  const chargeEmail = outlook.synced ? { sent: true } : await sendChargeAppointmentEmail({
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
  }, 'cancellation')

  return NextResponse.json({ success: true, appointment: normalizeAppointment(appointment), chargeEmail, outlook })
}
