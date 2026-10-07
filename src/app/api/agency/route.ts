import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { todayDate } from '@/lib/hours'
import { getAgencyWaitTimeMap } from '@/lib/wait-time'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const today = todayDate()
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10))
  const limit = Math.max(0, parseInt(req.nextUrl.searchParams.get('limit') || '0', 10))
  const query = req.nextUrl.searchParams.get('q')?.trim() || ''

  const where: Prisma.AgencyWhereInput | undefined = query ? {
    OR: [
      { code: { contains: query } },
      { name: { contains: query } },
      { city: { contains: query } },
    ],
  } : undefined

  const [count, agencies] = await Promise.all([
    limit > 0 ? prisma.agency.count({ where }) : prisma.agency.count({ where }),
    prisma.agency.findMany({
      orderBy: { id: 'asc' },
      include: {
        guichets: { orderBy: { number: 'asc' } },
        _count: { select: { tickets: { where: { status: 'WAITING', dayDate: today } } } }
      },
      where,
      skip: limit > 0 ? (page - 1) * limit : undefined,
      take: limit > 0 ? limit : undefined,
    }),
  ])

  const calledByAgency = new Map<number, number>()
  if (agencies.length > 0) {
    const calledTickets = await prisma.ticket.findMany({
      where: {
        status: 'CALLED',
        dayDate: today,
        agencyId: { in: agencies.map(a => a.id) },
      },
      select: { agencyId: true, number: true },
      orderBy: { calledAt: 'desc' },
    })

    for (const ticket of calledTickets) {
      if (!calledByAgency.has(ticket.agencyId)) {
        calledByAgency.set(ticket.agencyId, ticket.number)
      }
    }
  }

  const waitTimes = await getAgencyWaitTimeMap(
    agencies.map(a => ({
      id: a.id,
      waitingCount: a._count.tickets,
      openGuichets: a.guichets.filter(g => g.isActive).length,
    })),
    today,
  )
  const result = agencies.map(a => {
    const waitTime = waitTimes.get(a.id)
    return {
      id: a.id, code: a.code, name: a.name, city: a.city,
      address: a.address, latitude: a.latitude, longitude: a.longitude,
      isActive: a.isActive,
      guichets: a.guichets,
      currentCalled: calledByAgency.get(a.id) ?? 0,
      lastServed: 0,
      waitingCount: a._count.tickets,
      estimatedWait: waitTime?.estimatedWait ?? 0,
      averagePassageMinutes: waitTime?.averagePassageMinutes ?? 4,
      passageSampleSize: waitTime?.passageSampleSize ?? 0,
    }
  })
  const response = limit > 0
    ? { agencies: result, totalCount: count }
    : result

  return NextResponse.json(response)
}
