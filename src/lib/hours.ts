import { prisma } from '@/lib/prisma'

export type ServiceHoursMode = 'service' | 'single-session' | 'ramadan'

export type ServiceHoursConfig = {
  key: string
  activeMode: ServiceHoursMode
  singleSessionStart: string
  singleSessionEnd: string
  singleSessionStartMonth: string | null
  singleSessionEndMonth: string | null
  ramadanEnabled: boolean
  ramadanMonth: string | null
  ramadanStartDate: string | null
  ramadanEndDate: string | null
  ramadanStartTime: string
  ramadanEndTime: string
  updatedAt?: string
}

type HolidayStatus = {
  id: number
  date: string
  label: string | null
} | null

export type ServiceStatus = {
  open: boolean
  message: string
  holiday: HolidayStatus
  mode?: ServiceHoursMode
  hours?: {
    label: string
    startTime: string
    endTime: string
  }
}

type ServiceHoursInput = Partial<Omit<ServiceHoursConfig, 'activeMode'> & {
  activeMode: unknown
}>

export type ServiceWindow = {
  mode: ServiceHoursMode
  label: string
  startTime: string
  endTime: string
}

export const SERVICE_START_TIME = '08:00'
export const SERVICE_END_TIME = '16:30'

export const DEFAULT_SERVICE_HOURS: ServiceHoursConfig = {
  key: 'default',
  activeMode: 'service',
  singleSessionStart: SERVICE_START_TIME,
  singleSessionEnd: SERVICE_END_TIME,
  singleSessionStartMonth: null,
  singleSessionEndMonth: null,
  ramadanEnabled: false,
  ramadanMonth: null,
  ramadanStartDate: null,
  ramadanEndDate: null,
  ramadanStartTime: SERVICE_START_TIME,
  ramadanEndTime: '14:00',
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
let serviceHoursTableReady: Promise<void> | null = null
let serviceStatusCache: { date: string; cachedAt: number; status: ServiceStatus } | null = null

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value)
}

function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

function isValidMode(value: unknown): value is ServiceHoursMode {
  return value === 'service' || value === 'single-session' || value === 'ramadan'
}

function normalizeTime(value: unknown, fallback: string) {
  return isValidTime(value) ? value : fallback
}

function normalizeDate(value: unknown) {
  return isValidDate(value) ? value : null
}

function normalizeMonth(value: unknown) {
  return isValidMonth(value) ? value : null
}

function normalizeMode(value: unknown, fallback: ServiceHoursMode) {
  return isValidMode(value) ? value : fallback
}

function monthFromDate(value: unknown) {
  return isValidDate(value) ? value.slice(0, 7) : null
}

function endDateOfMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
}

function normalizeServiceHours(row?: ServiceHoursInput | null): ServiceHoursConfig {
  const activeMode = normalizeMode(
    row?.activeMode,
    row?.ramadanEnabled ? 'ramadan' : DEFAULT_SERVICE_HOURS.activeMode,
  )
  const ramadanMonth = normalizeMonth(row?.ramadanMonth) ?? monthFromDate(row?.ramadanStartDate)

  return {
    key: 'default',
    activeMode,
    singleSessionStart: normalizeTime(row?.singleSessionStart, DEFAULT_SERVICE_HOURS.singleSessionStart),
    singleSessionEnd: normalizeTime(row?.singleSessionEnd, DEFAULT_SERVICE_HOURS.singleSessionEnd),
    singleSessionStartMonth: normalizeMonth(row?.singleSessionStartMonth),
    singleSessionEndMonth: normalizeMonth(row?.singleSessionEndMonth),
    ramadanEnabled: activeMode === 'ramadan',
    ramadanMonth,
    ramadanStartDate: ramadanMonth ? `${ramadanMonth}-01` : normalizeDate(row?.ramadanStartDate),
    ramadanEndDate: ramadanMonth ? endDateOfMonth(ramadanMonth) : normalizeDate(row?.ramadanEndDate),
    ramadanStartTime: normalizeTime(row?.ramadanStartTime, DEFAULT_SERVICE_HOURS.ramadanStartTime),
    ramadanEndTime: normalizeTime(row?.ramadanEndTime, DEFAULT_SERVICE_HOURS.ramadanEndTime),
    updatedAt: row?.updatedAt,
  }
}

async function ensureServiceHoursTable() {
  if (!serviceHoursTableReady) {
    serviceHoursTableReady = ensureServiceHoursTableOnce().catch(error => {
      serviceHoursTableReady = null
      throw error
    })
  }

  await serviceHoursTableReady
}

async function ensureServiceHoursTableOnce() {
  // La table et ses colonnes sont gerees par Prisma (db:push), ce qui evite
  // d'executer du DDL PostgreSQL incompatible avec MySQL/MariaDB.
}

export function validateServiceHoursConfig(config: ServiceHoursConfig): string | null {
  if (!isValidMode(config.activeMode)) {
    return 'Mode horaire invalide.'
  }

  if (!isValidTime(config.singleSessionStart) || !isValidTime(config.singleSessionEnd)) {
    return "Horaire de seance unique invalide."
  }

  if (toMinutes(config.singleSessionStart) >= toMinutes(config.singleSessionEnd)) {
    return "L'heure de debut doit etre avant l'heure de fin."
  }

  if (!isValidTime(config.ramadanStartTime) || !isValidTime(config.ramadanEndTime)) {
    return 'Horaire Ramadan invalide.'
  }

  if (toMinutes(config.ramadanStartTime) >= toMinutes(config.ramadanEndTime)) {
    return "L'heure de debut Ramadan doit etre avant l'heure de fin."
  }

  if (config.activeMode === 'single-session') {
    if (!config.singleSessionStartMonth || !config.singleSessionEndMonth) {
      return 'Veuillez choisir les mois de seance unique.'
    }

    if (!isValidMonth(config.singleSessionStartMonth) || !isValidMonth(config.singleSessionEndMonth)) {
      return 'La periode de seance unique est invalide.'
    }

    if (config.singleSessionStartMonth > config.singleSessionEndMonth) {
      return 'Le mois de debut seance unique doit etre avant le mois de fin.'
    }
  }

  if (config.activeMode === 'ramadan') {
    if (!config.ramadanMonth) {
      return 'Veuillez choisir le mois Ramadan.'
    }

    if (!isValidMonth(config.ramadanMonth)) {
      return 'Le mois Ramadan est invalide.'
    }
  }

  return null
}

export async function getServiceHours(): Promise<ServiceHoursConfig> {
  await ensureServiceHoursTable()

  const row = await prisma.serviceHours.findUnique({
    where: { key: 'default' },
    select: {
      key: true,
      activeMode: true,
      singleSessionStart: true,
      singleSessionEnd: true,
      singleSessionStartMonth: true,
      singleSessionEndMonth: true,
      ramadanEnabled: true,
      ramadanMonth: true,
      ramadanStartDate: true,
      ramadanEndDate: true,
      ramadanStartTime: true,
      ramadanEndTime: true,
      updatedAt: true,
    },
  })

  if (row) {
    return normalizeServiceHours({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    })
  }

  await updateServiceHours(DEFAULT_SERVICE_HOURS)
  return DEFAULT_SERVICE_HOURS
}

export async function updateServiceHours(input: Partial<ServiceHoursConfig>): Promise<ServiceHoursConfig> {
  await ensureServiceHoursTable()

  const current = await getServiceHoursFromTable()
  const next = normalizeServiceHours({
    ...current,
    ...input,
    key: 'default',
  })
  const error = validateServiceHoursConfig(next)

  if (error) {
    throw new Error(error)
  }

  const data = {
    key: 'default',
    activeMode: next.activeMode,
    singleSessionStart: next.singleSessionStart,
    singleSessionEnd: next.singleSessionEnd,
    singleSessionStartMonth: next.singleSessionStartMonth,
    singleSessionEndMonth: next.singleSessionEndMonth,
    ramadanEnabled: next.ramadanEnabled,
    ramadanMonth: next.ramadanMonth,
    ramadanStartDate: next.ramadanStartDate,
    ramadanEndDate: next.ramadanEndDate,
    ramadanStartTime: next.ramadanStartTime,
    ramadanEndTime: next.ramadanEndTime,
  }

  const row = await prisma.serviceHours.upsert({
    where: { key: 'default' },
    create: data,
    update: data,
  })

  return normalizeServiceHours({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  })
}

async function getServiceHoursFromTable(): Promise<ServiceHoursConfig> {
  const row = await prisma.serviceHours.findUnique({
    where: { key: 'default' },
    select: {
      key: true,
      activeMode: true,
      singleSessionStart: true,
      singleSessionEnd: true,
      singleSessionStartMonth: true,
      singleSessionEndMonth: true,
      ramadanEnabled: true,
      ramadanMonth: true,
      ramadanStartDate: true,
      ramadanEndDate: true,
      ramadanStartTime: true,
      ramadanEndTime: true,
      updatedAt: true,
    },
  })

  if (!row) return DEFAULT_SERVICE_HOURS

  return normalizeServiceHours({
    ...row,
    updatedAt: row.updatedAt.toISOString(),
  })
}

function getTunisNow(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
}

function resolveServiceWindow(config: ServiceHoursConfig, date: string): ServiceWindow {
  const month = date.slice(0, 7)

  if (
    config.activeMode === 'ramadan' &&
    config.ramadanMonth === month
  ) {
    return {
      mode: 'ramadan',
      label: 'Ramadan',
      startTime: config.ramadanStartTime,
      endTime: config.ramadanEndTime,
    }
  }

  if (
    config.activeMode === 'single-session' &&
    config.singleSessionStartMonth &&
    config.singleSessionEndMonth &&
    month >= config.singleSessionStartMonth &&
    month <= config.singleSessionEndMonth
  ) {
    return {
      mode: 'single-session',
      label: 'Seance unique',
      startTime: config.singleSessionStart,
      endTime: config.singleSessionEnd,
    }
  }

  return {
    mode: 'service',
    label: 'SERVICE',
    startTime: SERVICE_START_TIME,
    endTime: SERVICE_END_TIME,
  }
}

export async function getServiceWindowForDate(date: string): Promise<ServiceWindow> {
  const serviceHours = await getServiceHours()
  return resolveServiceWindow(serviceHours, date)
}

function isOpenWithConfig(config: ServiceHoursConfig, date = new Date()): boolean {
  const tn = getTunisNow(date)
  const day = tn.getDay()
  const dayDate = date.toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
  const window = resolveServiceWindow(config, dayDate)
  const total = tn.getHours() * 60 + tn.getMinutes()

  return day >= 1 && day <= 5 && total >= toMinutes(window.startTime) && total < toMinutes(window.endTime)
}

export function isOpen(): boolean {
  return isOpenWithConfig(DEFAULT_SERVICE_HOURS)
}

export function todayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  const today = todayDate()
  const now = Date.now()
  if (serviceStatusCache?.date === today && now - serviceStatusCache.cachedAt < 5000) {
    return serviceStatusCache.status
  }

  const holiday = await prisma.holiday.findUnique({
    where: { date: today },
    select: { id: true, date: true, label: true },
  })

  let status: ServiceStatus

  if (holiday) {
    status = {
      open: false,
      message: holiday.label ? `Jour ferie - ${holiday.label}` : 'Jour ferie',
      holiday,
    }
  } else {
    const serviceHours = await getServiceHours()
    const window = resolveServiceWindow(serviceHours, today)

    if (!isOpenWithConfig(serviceHours)) {
      const tn = getTunisNow()
      const day = tn.getDay()

      status = {
        open: false,
        message: day === 0 || day === 6 ? 'Ferme le week-end' : `Hors horaires ${window.startTime}-${window.endTime}`,
        holiday: null,
        mode: window.mode,
        hours: window,
      }
    } else {
      status = {
        open: true,
        message: window.mode === 'ramadan'
          ? 'Service ouvert - Ramadan'
          : window.mode === 'single-session'
            ? 'Service ouvert - Seance unique'
            : 'Service ouvert',
        holiday: null,
        mode: window.mode,
        hours: window,
      }
    }
  }

  serviceStatusCache = {
    date: today,
    cachedAt: now,
    status,
  }

  return status
}
