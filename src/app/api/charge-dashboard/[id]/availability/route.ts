import { NextRequest, NextResponse } from 'next/server'
import {
  buildSlots,
  getBookedTimes,
  getCharge,
  getChargeAvailability,
  getChargeDayBlocks,
  getHoliday,
  isValidDate,
  isWeekendDate,
  saveChargeAvailability,
  saveChargeDayBlocks,
  todayTunisDate,
  weekdayFromDate,
} from '@/lib/appointments'
import { getServiceWindowForDate } from '@/lib/hours'

export const dynamic = 'force-dynamic'

async function buildDayCalendar(chargeId: number, charge: Awaited<ReturnType<typeof getCharge>>, date: string) {
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
  const allDayBlocked = dayBlocks.some(block => block.allDay)
  const blockedReason = holiday
    ? (holiday.label ? `Jour férié - ${holiday.label}` : 'Jour férié')
    : weekend ? 'Jour férié' : undefined
  const slots = allDayBlocked ? [] : buildSlots(dayAvailability, bookedTimes, date, blockedReason, { serviceWindow, dayBlocks })

  return {
    charge,
    availability,
    date,
    weekday,
    weekend,
    holiday,
    serviceWindow,
    dayAvailability,
    dayBlocks,
    available: slots.some(slot => slot.available),
    slots,
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(chargeId, true)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const date = req.nextUrl.searchParams.get('date')
  if (date) {
    if (!isValidDate(date)) return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    return NextResponse.json(await buildDayCalendar(chargeId, charge, date))
  }

  const availability = await getChargeAvailability(chargeId)
  return NextResponse.json({ charge, availability })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(chargeId, true)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const body = await req.json()
  const date = typeof body.date === 'string' ? body.date : ''

  if (date) {
    if (!isValidDate(date) || date < todayTunisDate()) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    }

    try {
      await saveChargeDayBlocks(chargeId, date, Array.isArray(body.dayBlocks) ? body.dayBlocks : [])
      return NextResponse.json(await buildDayCalendar(chargeId, charge, date))
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Blocage invalide' }, { status: 400 })
    }
  }

  const availability = Array.isArray(body.availability) ? body.availability : []
  if (availability.length === 0) {
    return NextResponse.json({ error: 'Disponibilite manquante' }, { status: 400 })
  }

  try {
    const saved = await saveChargeAvailability(chargeId, availability)
    return NextResponse.json({ charge, availability: saved })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Disponibilite invalide' }, { status: 400 })
  }
}
