import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ServiceWindow } from '@/lib/hours'

export type ChargeRecord = {
  id: number
  code: string
  name: string
  agencyId: number
  agencyCode: string
  agencyName: string
  city: string
  email: string | null
  phone: string | null
  isActive: boolean
  agencyActive: boolean
  createdAt: Date | string
  updatedAt: Date | string
  appointmentCount?: number
}

export type ChargeAvailabilityRecord = {
  id: number
  chargeId: number
  weekday: number
  enabled: boolean
  startTime: string
  endTime: string
  slotMinutes: number
}

export type AppointmentRecord = {
  id: number
  reference: string
  chargeId: number
  agencyId: number
  date: string
  time: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  subject: string | null
  outlookEventId?: string | null
  status: string
  createdAt: Date | string
}

export type AppointmentSlot = {
  time: string
  available: boolean
  reason?: string
  reasonCode?: 'BOOKED' | 'PAST' | 'BLOCKED' | 'CLOSED'
}

export type ChargeDayBlockRecord = {
  id: number
  chargeId: number
  date: string
  startTime: string | null
  endTime: string | null
  allDay: boolean
  label: string | null
  createdAt: Date | string
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_START_TIME = '08:30'
const DEFAULT_END_TIME = '16:00'
const DEFAULT_SLOT_MINUTES = 30

let appointmentTablesReady: Promise<void> | null = null

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function fromMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function normalizeAvailability(row: ChargeAvailabilityRecord): ChargeAvailabilityRecord {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    slotMinutes: Number(row.slotMinutes) || DEFAULT_SLOT_MINUTES,
  }
}

export function normalizeCharge(row: ChargeRecord) {
  return {
    ...row,
    isActive: Boolean(row.isActive),
    agencyActive: Boolean(row.agencyActive),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    appointmentCount: Number(row.appointmentCount ?? 0),
  }
}

export function normalizeAppointment(row: AppointmentRecord) {
  return {
    ...row,
    createdAt: toIso(row.createdAt),
  }
}

export function normalizeChargeDayBlock(row: ChargeDayBlockRecord) {
  return {
    ...row,
    allDay: Boolean(row.allDay),
    createdAt: toIso(row.createdAt),
  }
}

export function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value)
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function isTimeRangeValid(start: string, end: string) {
  return isValidTime(start) && isValidTime(end) && toMinutes(start) < toMinutes(end)
}

export function todayTunisDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

export function tunisMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hours = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minutes = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  return hours * 60 + minutes
}

/** Un client peut annuler uniquement avant l'heure exacte de son rendez-vous. */
export function isAppointmentCancellationExpired(date: string, time: string) {
  if (!isValidDate(date) || !isValidTime(time)) return true

  const today = todayTunisDate()
  return date < today || (date === today && toMinutes(time) <= tunisMinutesNow())
}

export function weekdayFromDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

export function isBusinessWeekday(weekday: number) {
  return weekday >= 1 && weekday <= 5
}

export function isWeekendDate(date: string) {
  return !isBusinessWeekday(weekdayFromDate(date))
}

export async function ensureAppointmentTables() {
  if (!appointmentTablesReady) {
    appointmentTablesReady = ensureAppointmentTablesOnce().catch(error => {
      appointmentTablesReady = null
      throw error
    })
  }

  await appointmentTablesReady
}

async function ensureAppointmentTablesOnce() {
  // Les tables sont creees par Prisma lors de l'installation (db:push).
  // Aucun DDL PostgreSQL ne doit etre execute a chaque requete applicative.
}

export async function ensureDefaultAvailability(chargeId: number) {
  await ensureAppointmentTables()

  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    await prisma.$executeRaw`
      INSERT INTO charge_availabilities (chargeId, weekday, enabled, startTime, endTime, slotMinutes)
      VALUES (${chargeId}, ${weekday}, ${weekday >= 1 && weekday <= 5}, ${DEFAULT_START_TIME}, ${DEFAULT_END_TIME}, ${DEFAULT_SLOT_MINUTES})
      ON DUPLICATE KEY UPDATE chargeId = VALUES(chargeId)
    `
  }

}

export async function getCharges(publicOnly = false, agencyId?: number | null) {
  await ensureAppointmentTables()

  const publicFilter = publicOnly
    ? Prisma.sql`AND c.isActive = TRUE AND a.isActive = TRUE`
    : Prisma.empty
  const agencyFilter = agencyId
    ? Prisma.sql`AND c.agencyId = ${agencyId}`
    : Prisma.empty

  const rows = await prisma.$queryRaw<ChargeRecord[]>`
    SELECT
      c.id,
      c.code,
      c.name,
      c.agencyId,
      c.email,
      c.phone,
      c.isActive,
      c.createdAt,
      c.updatedAt,
      a.code AS agencyCode,
      a.name AS agencyName,
      a.city AS city,
      a.isActive AS agencyActive,
      COALESCE(SUM(CASE WHEN ap.status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS appointmentCount
    FROM charges c
    JOIN agencies a ON a.id = c.agencyId
    LEFT JOIN appointments ap ON ap.chargeId = c.id
    WHERE 1 = 1
    ${publicFilter}
    ${agencyFilter}
    GROUP BY c.id, a.id
    ORDER BY a.name ASC, c.name ASC
  `

  return rows.map(normalizeCharge)
}

export async function getCharge(chargeId: number, publicOnly = false) {
  await ensureAppointmentTables()

  const rows = await prisma.$queryRaw<ChargeRecord[]>`
    SELECT
      c.id,
      c.code,
      c.name,
      c.agencyId,
      c.email,
      c.phone,
      c.isActive,
      c.createdAt,
      c.updatedAt,
      a.code AS agencyCode,
      a.name AS agencyName,
      a.city AS city,
      a.isActive AS agencyActive,
      COALESCE(SUM(CASE WHEN ap.status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS appointmentCount
    FROM charges c
    JOIN agencies a ON a.id = c.agencyId
    LEFT JOIN appointments ap ON ap.chargeId = c.id
    WHERE c.id = ${chargeId}
    GROUP BY c.id, a.id
    LIMIT 1
  `

  const charge = rows[0] ? normalizeCharge(rows[0]) : null
  if (!charge) return null
  if (publicOnly && (!charge.isActive || !charge.agencyActive)) return null
  return charge
}

export async function getChargeAvailability(chargeId: number) {
  await ensureDefaultAvailability(chargeId)

  const rows = await prisma.$queryRaw<ChargeAvailabilityRecord[]>`
    SELECT id, chargeId, weekday, enabled, startTime, endTime, slotMinutes
    FROM charge_availabilities
    WHERE chargeId = ${chargeId}
      AND weekday BETWEEN 1 AND 5
    ORDER BY weekday ASC
  `

  return rows.map(normalizeAvailability)
}

export async function saveChargeAvailability(chargeId: number, availability: ChargeAvailabilityRecord[]) {
  await ensureDefaultAvailability(chargeId)

  await prisma.$executeRaw`
    UPDATE charge_availabilities
    SET enabled = FALSE
    WHERE chargeId = ${chargeId}
      AND weekday IN (0, 6)
  `

  for (const item of availability) {
    if (!isBusinessWeekday(item.weekday) || !isTimeRangeValid(item.startTime, item.endTime)) {
      throw new Error('Disponibilite invalide.')
    }

    const slotMinutes = Math.max(10, Math.min(240, Number(item.slotMinutes) || DEFAULT_SLOT_MINUTES))
    await prisma.$executeRaw`
      INSERT INTO charge_availabilities (chargeId, weekday, enabled, startTime, endTime, slotMinutes)
      VALUES (${chargeId}, ${item.weekday}, ${Boolean(item.enabled)}, ${item.startTime}, ${item.endTime}, ${slotMinutes})
      ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        startTime = VALUES(startTime),
        endTime = VALUES(endTime),
        slotMinutes = VALUES(slotMinutes)
    `
  }

  return getChargeAvailability(chargeId)
}

export async function getBookedTimes(chargeId: number, date: string) {
  await ensureAppointmentTables()
  const rows = await prisma.$queryRaw<{ time: string }[]>`
    SELECT time
    FROM appointments
    WHERE chargeId = ${chargeId}
      AND date = ${date}
      AND status = 'CONFIRMED'
  `

  return new Set(rows.map(row => row.time))
}

export async function getHoliday(date: string) {
  const rows = await prisma.$queryRaw<{ id: number; date: string; label: string | null }[]>`
    SELECT id, date, label
    FROM holidays
    WHERE date = ${date}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getChargeDayBlocks(chargeId: number, date: string) {
  await ensureAppointmentTables()

  const rows = await prisma.$queryRaw<ChargeDayBlockRecord[]>`
    SELECT id, chargeId, date, startTime, endTime, allDay, label, createdAt
    FROM charge_day_blocks
    WHERE chargeId = ${chargeId}
      AND date = ${date}
    ORDER BY allDay DESC, (startTime IS NOT NULL) ASC, startTime ASC
  `

  return rows.map(normalizeChargeDayBlock)
}

function isLeaveBlock(block: ChargeDayBlockRecord) {
  return Boolean(block.allDay) && (block.label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('conge')
}

export async function getChargeLeaveBlocks(chargeId: number, fromDate = todayTunisDate()) {
  await ensureAppointmentTables()

  const rows = await prisma.$queryRaw<ChargeDayBlockRecord[]>`
    SELECT id, chargeId, date, startTime, endTime, allDay, label, createdAt
    FROM charge_day_blocks
    WHERE chargeId = ${chargeId}
      AND date >= ${fromDate}
      AND allDay = TRUE
    ORDER BY date ASC
  `

  return rows.map(normalizeChargeDayBlock).filter(isLeaveBlock)
}

export async function saveChargeDayBlocks(
  chargeId: number,
  date: string,
  blocks: Array<Partial<ChargeDayBlockRecord>>,
) {
  await ensureAppointmentTables()

  if (!isValidDate(date)) {
    throw new Error('Date invalide.')
  }

  await prisma.$transaction(async tx => {
    await tx.$executeRaw`
      DELETE FROM charge_day_blocks
      WHERE chargeId = ${chargeId}
        AND date = ${date}
    `

    for (const block of blocks) {
      const allDay = Boolean(block.allDay)
      const startTime = allDay ? null : block.startTime ?? null
      const endTime = allDay ? null : block.endTime ?? null
      const label = typeof block.label === 'string' && block.label.trim()
        ? block.label.trim().slice(0, 80)
        : allDay ? 'Jour desactive' : 'Indisponible'

      if (!allDay && (!startTime || !endTime || !isTimeRangeValid(startTime, endTime))) {
        throw new Error('Plage indisponible invalide.')
      }

      await tx.$executeRaw`
        INSERT INTO charge_day_blocks (chargeId, date, startTime, endTime, allDay, label)
        VALUES (${chargeId}, ${date}, ${startTime}, ${endTime}, ${allDay}, ${label})
      `
    }
  })

  return getChargeDayBlocks(chargeId, date)
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB
}

function getBlockingRule(
  blocks: ChargeDayBlockRecord[],
  start: number,
  end: number,
) {
  return blocks.find(block => {
    if (block.allDay) return true
    if (!block.startTime || !block.endTime || !isTimeRangeValid(block.startTime, block.endTime)) return false
    return rangesOverlap(start, end, toMinutes(block.startTime), toMinutes(block.endTime))
  })
}

export function buildSlots(
  availability: ChargeAvailabilityRecord | null,
  bookedTimes: Set<string>,
  date: string,
  blockedReason?: string,
  options: {
    serviceWindow?: Pick<ServiceWindow, 'startTime' | 'endTime'> | null
    dayBlocks?: ChargeDayBlockRecord[]
  } = {},
): AppointmentSlot[] {
  if (!availability?.enabled || !isTimeRangeValid(availability.startTime, availability.endTime)) {
    return []
  }

  const today = todayTunisDate()
  const dateIsPast = date < today
  const dateIsToday = date === today
  const nowMinutes = dateIsToday ? tunisMinutesNow() : 0
  const slotMinutes = Math.max(10, Math.min(240, Number(availability.slotMinutes) || DEFAULT_SLOT_MINUTES))
  const serviceWindow = options.serviceWindow
  const serviceWindowValid = serviceWindow && isTimeRangeValid(serviceWindow.startTime, serviceWindow.endTime)
  const start = Math.max(
    toMinutes(availability.startTime),
    serviceWindowValid ? toMinutes(serviceWindow.startTime) : 0,
  )
  const end = Math.min(
    toMinutes(availability.endTime),
    serviceWindowValid ? toMinutes(serviceWindow.endTime) : 24 * 60,
  )
  const slots: AppointmentSlot[] = []

  for (let current = start; current + slotMinutes <= end; current += slotMinutes) {
    const time = fromMinutes(current)
    const booked = bookedTimes.has(time)
    const past = dateIsPast || (dateIsToday && current <= nowMinutes)
    const dayBlock = getBlockingRule(options.dayBlocks ?? [], current, current + slotMinutes)
    const available = !blockedReason && !dayBlock && !booked && !past
    const reason = blockedReason
      ?? (dayBlock ? dayBlock.label || 'Indisponible' : booked ? 'Réservé' : past ? 'Passé' : undefined)
    const reasonCode = blockedReason
      ? 'CLOSED'
      : dayBlock
        ? 'BLOCKED'
        : booked
          ? 'BOOKED'
          : past
            ? 'PAST'
            : undefined

    slots.push({ time, available, reason, reasonCode })
  }

  return slots
}

export function isSlotAvailable(slots: AppointmentSlot[], time: string) {
  return slots.some(slot => slot.time === time && slot.available)
}
