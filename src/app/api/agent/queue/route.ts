import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayDate } from '@/lib/hours'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agencyId = parseInt(searchParams.get('agencyId') || '')
  const guichetId = parseInt(searchParams.get('guichetId') || '')
  if (isNaN(agencyId)) return NextResponse.json({ error: 'agencyId required' }, { status: 400 })
  const today = todayDate()

  const [agency, queue, myCalled, allCalled, history, servedCount] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: agencyId },
      include: { guichets: { orderBy: { number: 'asc' } } }
    }),
    prisma.ticket.findMany({
      where: { agencyId, status: 'WAITING', dayDate: today },
      orderBy: { number: 'asc' }, take: 30
    }),
    !isNaN(guichetId) ? prisma.ticket.findFirst({
      where: { agencyId, guichetId, status: 'CALLED', dayDate: today }
    }) : Promise.resolve(null),
    prisma.ticket.findMany({
      where: { agencyId, status: 'CALLED', dayDate: today },
      include: { guichet: true }
    }),
    prisma.ticket.findMany({
      where: { agencyId, status: 'SERVED', dayDate: today },
      include: { guichet: true }, orderBy: { servedAt: 'desc' }, take: 10
    }),
    prisma.ticket.count({ where: { agencyId, status: 'SERVED', dayDate: today } })
  ])

  return NextResponse.json({
    agency,
    currentGuichet: agency?.guichets.find(g => g.id === guichetId) ?? null,
    queue,
    myCalled,
    allCalled,
    history: history.map(t => ({
      label: t.label,
      number: t.number,
      guichet: t.guichet?.label ?? '',
      time: t.servedAt?.toISOString() ?? '',
    })),
    servedCount,
  })
}
