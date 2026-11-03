import { prisma } from '@/lib/prisma'

const DEFAULT_PASSAGE_SECONDS = 4 * 60
const HISTORY_WINDOW_DAYS = 30
const MIN_SERVICE_SAMPLE_SIZE = 3
const MAX_HISTORY_ROWS = 5000

// Reference values used only when an operation does not yet have enough history.
const SERVICE_REFERENCE_SECONDS: Record<string, number> = {
  caisse: 4 * 60,
  virement: 6 * 60,
  credit: 7 * 60,
  renseignement: 3 * 60,
  cheque: 5 * 60,
  devise: 5 * 60,
}

type PassageSummary = {
  averagePassageSeconds: number
  averagePassageMinutes: number
  passageSampleSize: number
}

type AgencyWaitTime = PassageSummary & {
  estimatedWait: number
  openGuichets: number
}

type HistoryTicket = {
  service: string
  calledAt: Date | null
  servedAt: Date | null
}

type WaitingTicket = {
  number: number
  service: string
  onHold: boolean
}

type ActiveTicket = {
  service: string
  calledAt: Date | null
  guichetId: number | null
}

function normalizeService(service: string) {
  return service
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr')
}

function getReferenceSeconds(service: string) {
  return SERVICE_REFERENCE_SECONDS[normalizeService(service)] ?? DEFAULT_PASSAGE_SECONDS
}

function durationSeconds(ticket: Pick<HistoryTicket, 'calledAt' | 'servedAt'>) {
  if (!ticket.calledAt || !ticket.servedAt) return 0
  const seconds = Math.round((ticket.servedAt.getTime() - ticket.calledAt.getTime()) / 1000)
  return seconds > 0 ? seconds : 0
}

function passageSummary(tickets: Pick<HistoryTicket, 'calledAt' | 'servedAt'>[]): PassageSummary {
  const durations = tickets.map(durationSeconds).filter(Boolean)
  const averagePassageSeconds = durations.length > 0
    ? Math.round(durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length)
    : DEFAULT_PASSAGE_SECONDS

  return {
    averagePassageSeconds,
    averagePassageMinutes: Math.max(1, Math.ceil(averagePassageSeconds / 60)),
    passageSampleSize: durations.length,
  }
}

function serviceAverages(tickets: HistoryTicket[]) {
  const durationsByService = new Map<string, number[]>()

  for (const ticket of tickets) {
    const seconds = durationSeconds(ticket)
    if (!seconds) continue
    const key = normalizeService(ticket.service)
    const durations = durationsByService.get(key) ?? []
    durations.push(seconds)
    durationsByService.set(key, durations)
  }

  const averages = new Map<string, { seconds: number; sampleSize: number }>()
  for (const [service, durations] of durationsByService) {
    if (durations.length < MIN_SERVICE_SAMPLE_SIZE) continue
    averages.set(service, {
      seconds: Math.round(durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length),
      sampleSize: durations.length,
    })
  }

  return averages
}

function getServiceDuration(service: string, averages: Map<string, { seconds: number; sampleSize: number }>) {
  return averages.get(normalizeService(service))?.seconds ?? getReferenceSeconds(service)
}

function getServiceSampleSize(service: string, averages: Map<string, { seconds: number; sampleSize: number }>) {
  return averages.get(normalizeService(service))?.sampleSize ?? 0
}

function estimateFromWorkloads({
  waitingTickets,
  activeTickets,
  history,
  openGuichets,
  targetTicketNumber,
  targetService,
}: {
  waitingTickets: WaitingTicket[]
  activeTickets: ActiveTicket[]
  history: HistoryTicket[]
  openGuichets: number
  targetTicketNumber?: number
  targetService?: string
}): AgencyWaitTime {
  const summary = passageSummary(history)
  const averages = serviceAverages(history)
  const effectiveGuichets = Math.max(1, openGuichets, activeTickets.length)
  const workloads = Array.from({ length: effectiveGuichets }, () => 0)
  const guichetIndexes = new Map<number, number>()

  function leastLoadedGuichet() {
    let index = 0
    for (let current = 1; current < workloads.length; current += 1) {
      if (workloads[current] < workloads[index]) index = current
    }
    return index
  }

  // A called ticket contributes only its remaining service time.
  for (const ticket of activeTickets) {
    let index = ticket.guichetId == null ? leastLoadedGuichet() : guichetIndexes.get(ticket.guichetId)
    if (index == null) {
      index = leastLoadedGuichet()
      if (ticket.guichetId != null) guichetIndexes.set(ticket.guichetId, index)
    }

    const serviceSeconds = getServiceDuration(ticket.service, averages)
    const elapsedSeconds = ticket.calledAt ? Math.max(0, Math.round((Date.now() - ticket.calledAt.getTime()) / 1000)) : 0
    workloads[index] += Math.max(0, serviceSeconds - elapsedSeconds)
  }

  // Held tickets are deliberately placed after normal tickets, matching queue priority.
  const orderedWaiting = [...waitingTickets].sort((a, b) => Number(a.onHold) - Number(b.onHold) || a.number - b.number)
  let ticketsBefore = orderedWaiting
  if (typeof targetTicketNumber === 'number') {
    const targetIndex = orderedWaiting.findIndex(ticket => ticket.number === targetTicketNumber)
    // A ticket that is already called or served has no remaining queue ahead of it.
    ticketsBefore = targetIndex >= 0 ? orderedWaiting.slice(0, targetIndex) : []
  }

  // Simulate the assignment of queued work to the least-loaded active guichet.
  for (const ticket of ticketsBefore) {
    workloads[leastLoadedGuichet()] += getServiceDuration(ticket.service, averages)
  }

  const estimatedWait = Math.max(0, Math.ceil(Math.max(...workloads, 0) / 60))
  const displaySeconds = targetService ? getServiceDuration(targetService, averages) : summary.averagePassageSeconds
  const displaySamples = targetService ? getServiceSampleSize(targetService, averages) : summary.passageSampleSize

  return {
    estimatedWait,
    openGuichets: effectiveGuichets,
    averagePassageSeconds: displaySeconds,
    averagePassageMinutes: Math.max(1, Math.ceil(displaySeconds / 60)),
    passageSampleSize: displaySamples,
  }
}

export function estimateWaitMinutes(
  waitingCount: number,
  averagePassageSeconds: number,
  openGuichets: number,
) {
  if (waitingCount <= 0) return 0
  return Math.max(1, Math.ceil((waitingCount * averagePassageSeconds) / Math.max(1, openGuichets) / 60))
}

export async function getAgencyWaitTime({
  agencyId,
  dayDate,
  waitingCount: _waitingCount,
  openGuichets,
  targetTicketNumber,
  targetService,
}: {
  agencyId: number
  dayDate: string
  waitingCount: number
  openGuichets?: number
  targetTicketNumber?: number
  targetService?: string
}): Promise<AgencyWaitTime> {
  const historyStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [history, waitingTickets, activeTickets, activeGuichetCount] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        agencyId,
        createdAt: { gte: historyStart },
        status: { in: ['SERVED', 'ABSENT'] },
        calledAt: { not: null },
        servedAt: { not: null },
      },
      select: { service: true, calledAt: true, servedAt: true },
      orderBy: { servedAt: 'desc' },
      take: MAX_HISTORY_ROWS,
    }),
    prisma.ticket.findMany({
      where: { agencyId, dayDate, status: 'WAITING' },
      select: { number: true, service: true, onHold: true },
      orderBy: [{ onHold: 'asc' }, { number: 'asc' }],
    }),
    prisma.ticket.findMany({
      where: { agencyId, dayDate, status: 'CALLED' },
      select: { service: true, calledAt: true, guichetId: true },
    }),
    typeof openGuichets === 'number'
      ? Promise.resolve(openGuichets)
      : prisma.guichet.count({ where: { agencyId, isActive: true } }),
  ])

  return estimateFromWorkloads({
    waitingTickets,
    activeTickets,
    history,
    openGuichets: activeGuichetCount,
    targetTicketNumber,
    targetService,
  })
}

export async function getAgencyWaitTimeMap(
  agencies: { id: number; waitingCount: number; openGuichets: number }[],
  dayDate: string,
) {
  if (agencies.length === 0) return new Map<number, AgencyWaitTime>()

  const agencyIds = agencies.map(agency => agency.id)
  const historyStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [historyRows, waitingRows, activeRows] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        agencyId: { in: agencyIds },
        createdAt: { gte: historyStart },
        status: { in: ['SERVED', 'ABSENT'] },
        calledAt: { not: null },
        servedAt: { not: null },
      },
      select: { agencyId: true, service: true, calledAt: true, servedAt: true },
      orderBy: { servedAt: 'desc' },
      take: MAX_HISTORY_ROWS,
    }),
    prisma.ticket.findMany({
      where: { agencyId: { in: agencyIds }, dayDate, status: 'WAITING' },
      select: { agencyId: true, number: true, service: true, onHold: true },
      orderBy: [{ onHold: 'asc' }, { number: 'asc' }],
    }),
    prisma.ticket.findMany({
      where: { agencyId: { in: agencyIds }, dayDate, status: 'CALLED' },
      select: { agencyId: true, service: true, calledAt: true, guichetId: true },
    }),
  ])

  const historyByAgency = new Map<number, HistoryTicket[]>()
  const waitingByAgency = new Map<number, WaitingTicket[]>()
  const activeByAgency = new Map<number, ActiveTicket[]>()

  for (const row of historyRows) {
    const items = historyByAgency.get(row.agencyId) ?? []
    items.push({ service: row.service, calledAt: row.calledAt, servedAt: row.servedAt })
    historyByAgency.set(row.agencyId, items)
  }
  for (const row of waitingRows) {
    const items = waitingByAgency.get(row.agencyId) ?? []
    items.push({ number: row.number, service: row.service, onHold: row.onHold })
    waitingByAgency.set(row.agencyId, items)
  }
  for (const row of activeRows) {
    const items = activeByAgency.get(row.agencyId) ?? []
    items.push({ service: row.service, calledAt: row.calledAt, guichetId: row.guichetId })
    activeByAgency.set(row.agencyId, items)
  }

  return new Map(agencies.map(agency => [
    agency.id,
    estimateFromWorkloads({
      waitingTickets: waitingByAgency.get(agency.id) ?? [],
      activeTickets: activeByAgency.get(agency.id) ?? [],
      history: historyByAgency.get(agency.id) ?? [],
      openGuichets: agency.openGuichets,
    }),
  ]))
}
