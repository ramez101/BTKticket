import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const DEFAULT_PASSAGE_SECONDS = 4 * 60
const PASSAGE_SAMPLE_SIZE = 20

type PassageSummary = {
  averagePassageSeconds: number
  averagePassageMinutes: number
  passageSampleSize: number
}

type AgencyWaitTime = PassageSummary & {
  estimatedWait: number
  openGuichets: number
}

function passageSummary(tickets: { calledAt: Date | null; servedAt: Date | null }[]): PassageSummary {
  const durations = tickets
    .map(ticket => {
      if (!ticket.calledAt || !ticket.servedAt) return 0
      return Math.round((ticket.servedAt.getTime() - ticket.calledAt.getTime()) / 1000)
    })
    .filter(seconds => seconds > 0)

  if (durations.length === 0) {
    return {
      averagePassageSeconds: DEFAULT_PASSAGE_SECONDS,
      averagePassageMinutes: Math.round(DEFAULT_PASSAGE_SECONDS / 60),
      passageSampleSize: 0,
    }
  }

  const averagePassageSeconds = Math.round(
    durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length,
  )

  return {
    averagePassageSeconds,
    averagePassageMinutes: Math.max(1, Math.ceil(averagePassageSeconds / 60)),
    passageSampleSize: durations.length,
  }
}

export function estimateWaitMinutes(
  waitingCount: number,
  averagePassageSeconds: number,
  openGuichets: number,
) {
  if (waitingCount <= 0) return 0

  const safeOpenGuichets = Math.max(1, openGuichets)
  return Math.max(1, Math.ceil((waitingCount * averagePassageSeconds) / safeOpenGuichets / 60))
}

export async function getAgencyWaitTime({
  agencyId,
  dayDate,
  waitingCount,
  openGuichets,
}: {
  agencyId: number
  dayDate: string
  waitingCount: number
  openGuichets?: number
}): Promise<AgencyWaitTime> {
  const [tickets, activeGuichets] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        agencyId,
        dayDate,
        status: { in: ['SERVED', 'ABSENT'] },
        calledAt: { not: null },
        servedAt: { not: null },
      },
      select: {
        calledAt: true,
        servedAt: true,
      },
      orderBy: { servedAt: 'desc' },
      take: PASSAGE_SAMPLE_SIZE,
    }),
    typeof openGuichets === 'number'
      ? Promise.resolve(openGuichets)
      : prisma.guichet.count({ where: { agencyId, isActive: true } }),
  ])

  const summary = passageSummary(tickets)

  return {
    ...summary,
    openGuichets: activeGuichets,
    estimatedWait: estimateWaitMinutes(
      waitingCount,
      summary.averagePassageSeconds,
      activeGuichets,
    ),
  }
}

export async function getAgencyWaitTimeMap(
  agencies: { id: number; waitingCount: number; openGuichets: number }[],
  dayDate: string,
) {
  if (agencies.length === 0) return new Map<number, AgencyWaitTime>()

  const agencyIds = agencies.map(agency => agency.id)
  const recentTickets = await prisma.$queryRaw<{ agencyId: number; calledAt: Date | null; servedAt: Date | null }[]>`
    SELECT agencyId, calledAt, servedAt
    FROM (
      SELECT
        agencyId,
        calledAt,
        servedAt,
        ROW_NUMBER() OVER (PARTITION BY agencyId ORDER BY servedAt DESC) AS rn
      FROM tickets
      WHERE agencyId IN (${Prisma.join(agencyIds)})
        AND dayDate = ${dayDate}
        AND status IN ('SERVED', 'ABSENT')
        AND calledAt IS NOT NULL
        AND servedAt IS NOT NULL
    ) recent
    WHERE rn <= ${PASSAGE_SAMPLE_SIZE}
  `

  const ticketsByAgency = new Map<number, { calledAt: Date | null; servedAt: Date | null }[]>()

  for (const ticket of recentTickets) {
    const tickets = ticketsByAgency.get(ticket.agencyId) ?? []
    tickets.push({ calledAt: ticket.calledAt, servedAt: ticket.servedAt })
    ticketsByAgency.set(ticket.agencyId, tickets)
  }

  const entries = agencies.map(agency => {
    const summary = passageSummary(ticketsByAgency.get(agency.id) ?? [])

    return [
      agency.id,
      {
        ...summary,
        openGuichets: agency.openGuichets,
        estimatedWait: estimateWaitMinutes(
          agency.waitingCount,
          summary.averagePassageSeconds,
          agency.openGuichets,
        ),
      },
    ] as const
  })

  return new Map(entries)
}
