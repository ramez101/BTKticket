import { randomInt } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  AppointmentRecord,
  buildSlots,
  ensureAppointmentTables,
  getBookedTimes,
  getCharge,
  getChargeAvailability,
  getChargeDayBlocks,
  getHoliday,
  isAppointmentCancellationExpired,
  isWeekendDate,
  isSlotAvailable,
  isValidDate,
  isValidTime,
  normalizeAppointment,
  todayTunisDate,
  weekdayFromDate,
} from '@/lib/appointments'
import { getServiceWindowForDate } from '@/lib/hours'
import { sendAppointmentConfirmationEmail, sendChargeAppointmentEmail } from '@/lib/mail'
import { createOutlookEvent, deleteOutlookEvent } from '@/lib/outlook'

export const dynamic = 'force-dynamic'

type CancellationAppointmentRecord = AppointmentRecord & {
  chargeName: string
  chargeEmail: string | null
  agencyName: string
  outlookEventId: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createReference() {
  return Array.from({ length: 5 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')
}

function getAppointmentBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured.replace(/\/$/, '')
  }
  return req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  await ensureAppointmentTables()

  const reference = cleanText(req.nextUrl.searchParams.get('reference')).toUpperCase()
  if (!/^[A-Z0-9]{5}$/.test(reference)) {
    return NextResponse.json({ error: 'Code RDV invalide' }, { status: 400 })
  }

  const row = await prisma.appointment.findUnique({
    where: { reference },
    include: {
      charge: { select: { name: true, email: true } },
      agency: { select: { name: true } },
    },
  })

  if (!row) {
    return NextResponse.json({ error: 'Rendez-vous introuvable pour ce code' }, { status: 404 })
  }

  const appointment: CancellationAppointmentRecord = {
    ...row,
    chargeName: row.charge.name,
    chargeEmail: row.charge.email,
    agencyName: row.agency.name,
    outlookEventId: row.outlookEventId,
  }
  if (isAppointmentCancellationExpired(appointment.date, appointment.time)) {
    return NextResponse.json(
      { error: "Ce code RDV a expiré : l'heure du rendez-vous est passée." },
      { status: 410 },
    )
  }

  return NextResponse.json({
    appointment: {
      ...normalizeAppointment(appointment),
      chargeName: appointment.chargeName,
    },
  })
}

export async function POST(req: NextRequest) {
  await ensureAppointmentTables()

  const body = await req.json()
  const chargeId = parseInt(String(body.chargeId || ''), 10)
  const date = cleanText(body.date)
  const time = cleanText(body.time)
  const customerName = cleanText(body.customerName)
  const customerPhone = cleanText(body.customerPhone)
  const customerEmail = cleanText(body.customerEmail) || null
  const subject = cleanText(body.subject) || null

  if (
    !Number.isFinite(chargeId) ||
    !isValidDate(date) ||
    !isValidTime(time) ||
    !customerName ||
    !customerPhone
  ) {
    return NextResponse.json({ error: 'Informations RDV incompletes' }, { status: 400 })
  }

  if (date < todayTunisDate()) {
    return NextResponse.json({ error: 'La date choisie est deja passee' }, { status: 400 })
  }

  const charge = await getCharge(chargeId, true)
  if (!charge) return NextResponse.json({ error: 'Charge indisponible' }, { status: 404 })

  const [availability, bookedTimes, holiday, serviceWindow, dayBlocks] = await Promise.all([
    getChargeAvailability(chargeId),
    getBookedTimes(chargeId, date),
    getHoliday(date),
    getServiceWindowForDate(date),
    getChargeDayBlocks(chargeId, date),
  ])
  const weekday = weekdayFromDate(date)
  const weekend = isWeekendDate(date)
  const dayAvailability = weekend ? null : availability.find(item => item.weekday === weekday) ?? null
  const blockedReason = holiday
    ? (holiday.label ? `Jour férié - ${holiday.label}` : 'Jour férié')
    : weekend ? 'Jour férié' : undefined
  const slots = buildSlots(dayAvailability, bookedTimes, date, blockedReason, { serviceWindow, dayBlocks })

  if (!isSlotAvailable(slots, time)) {
    return NextResponse.json({ error: 'Creneau indisponible' }, { status: 409 })
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const appointment = normalizeAppointment(await prisma.appointment.create({
        data: {
          reference: createReference(),
          chargeId: charge.id,
          agencyId: charge.agencyId,
          date,
          time,
          customerName,
          customerPhone,
          customerEmail,
          subject,
          status: 'CONFIRMED',
        },
      }))
      const outlook = await createOutlookEvent(charge.id, {
        reference: appointment.reference,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        subject: appointment.subject,
        agencyName: charge.agencyName,
        date: appointment.date,
        time: appointment.time,
      })
      if (outlook.synced) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { outlookEventId: outlook.eventId },
        })
      }
      const cancellationUrl = `${getAppointmentBaseUrl(req)}/rdv?cancel=${encodeURIComponent(appointment.reference)}`
      const email = await sendAppointmentConfirmationEmail({
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        chargeName: charge.name,
        agencyName: charge.agencyName,
        date: appointment.date,
        time: appointment.time,
        reference: appointment.reference,
        cancellationUrl,
      })
      const chargeEmail = outlook.synced ? { sent: true } : await sendChargeAppointmentEmail({
        chargeEmail: charge.email,
        chargeName: charge.name,
        agencyName: charge.agencyName,
        date: appointment.date,
        time: appointment.time,
        reference: appointment.reference,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        subject: appointment.subject,
      }, 'confirmation')

      return NextResponse.json({
        appointment,
        charge,
        email,
        chargeEmail,
        outlook,
      }, { status: 201 })
    } catch (error) {
      if (attempt === 5) console.error(error)
    }
  }

  return NextResponse.json({ error: 'Ce creneau vient d etre reserve' }, { status: 409 })
}

export async function DELETE(req: NextRequest) {
  await ensureAppointmentTables()

  let body: { reference?: unknown; code?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const reference = cleanText(body.reference ?? body.code).toUpperCase()
  if (!/^[A-Z0-9]{5}$/.test(reference)) {
    return NextResponse.json({ error: 'Code RDV invalide' }, { status: 400 })
  }

  const result = await prisma.$transaction(async tx => {
    const row = await tx.appointment.findUnique({
      where: { reference },
      include: {
        charge: { select: { name: true, email: true } },
        agency: { select: { name: true } },
      },
    })

    if (!row) return { kind: 'not-found' as const }
    const appointment: CancellationAppointmentRecord = {
      ...row,
      chargeName: row.charge.name,
      chargeEmail: row.charge.email,
      agencyName: row.agency.name,
      outlookEventId: row.outlookEventId,
    }
    if (isAppointmentCancellationExpired(appointment.date, appointment.time)) return { kind: 'expired' as const }

    await tx.appointment.delete({ where: { id: appointment.id } })
    return { kind: 'deleted' as const, appointment }
  })

  if (result.kind === 'not-found') {
    return NextResponse.json({ error: 'Rendez-vous introuvable pour ce code' }, { status: 404 })
  }
  if (result.kind === 'expired') {
    return NextResponse.json(
      { error: "Ce code RDV a expiré : l'heure du rendez-vous est passée." },
      { status: 410 },
    )
  }

  const outlook = await deleteOutlookEvent(result.appointment.chargeId, result.appointment.outlookEventId)
  const chargeEmail = outlook.synced ? { sent: true } : await sendChargeAppointmentEmail({
    chargeEmail: result.appointment.chargeEmail,
    chargeName: result.appointment.chargeName,
    agencyName: result.appointment.agencyName,
    date: result.appointment.date,
    time: result.appointment.time,
    reference: result.appointment.reference,
    customerName: result.appointment.customerName,
    customerPhone: result.appointment.customerPhone,
    customerEmail: result.appointment.customerEmail,
    subject: result.appointment.subject,
  }, 'cancellation')

  return NextResponse.json({
    success: true,
    appointment: normalizeAppointment(result.appointment),
    chargeEmail,
    outlook,
  })
}
