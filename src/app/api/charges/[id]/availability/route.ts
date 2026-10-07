import { NextRequest, NextResponse } from 'next/server'
import {
  buildSlots,
  getBookedTimes,
  getCharge,
  getChargeAvailability,
  getChargeDayBlocks,
  getHoliday,
  isWeekendDate,
  isValidDate,
  todayTunisDate,
  weekdayFromDate,
} from '@/lib/appointments'
import { getServiceWindowForDate } from '@/lib/hours'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  const date = req.nextUrl.searchParams.get('date') || todayTunisDate()

  if (!Number.isFinite(chargeId) || !isValidDate(date)) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const charge = await getCharge(chargeId, true)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

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

  return NextResponse.json({
    charge,
    date,
    weekday,
    weekend,
    holiday,
    serviceWindow,
    available: slots.some(slot => slot.available),
    slots,
  })
}
