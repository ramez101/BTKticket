import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayDate } from '@/lib/hours'
export const dynamic = 'force-dynamic'

export async function GET() {
  const today = todayDate()
  const agencies = await prisma.agency.findMany({
    orderBy: { id: 'asc' },
    include: {
      guichets: { orderBy: { number: 'asc' } },
      _count: { select: { tickets: { where: { status: 'WAITING', dayDate: today } } } }
    }
  })
  const result = await Promise.all(agencies.map(async a => {
    const called = await prisma.ticket.findFirst({
      where: { agencyId: a.id, status: 'CALLED', dayDate: today }, orderBy: { calledAt: 'desc' }
    })
    return {
      id: a.id, code: a.code, name: a.name, city: a.city, isActive: a.isActive,
      guichets: a.guichets,
      currentCalled: called?.number ?? 0,
      lastServed: 0,
      waitingCount: a._count.tickets,
      estimatedWait: Math.round(a._count.tickets * 4),
    }
  }))
  return NextResponse.json(result)
}
