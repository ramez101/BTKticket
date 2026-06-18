import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayDate } from '@/lib/hours'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const today = todayDate()
  const [agency, queue, called, allCalled, history] = await Promise.all([
    prisma.agency.findUnique({
      where: { id },
      include: { guichets: { orderBy: { number: 'asc' } } }
    }),
    prisma.ticket.findMany({
      where: { agencyId: id, status: 'WAITING', dayDate: today },
      orderBy: { number: 'asc' }, take: 30,
    }),
    prisma.ticket.findFirst({
      where: { agencyId: id, status: 'CALLED', dayDate: today },
      include: { guichet: true }, orderBy: { calledAt: 'desc' }
    }),
    prisma.ticket.findMany({
      where: { agencyId: id, status: 'CALLED', dayDate: today },
      include: { guichet: true },
      orderBy: { calledAt: 'desc' }
    }),
    prisma.ticket.findMany({
      where: { agencyId: id, status: 'SERVED', dayDate: today },
      include: { guichet: true }, orderBy: { servedAt: 'desc' }, take: 10
    })
  ])
  if (!agency) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    agency: {
      id: agency.id, code: agency.code, name: agency.name, city: agency.city,
      isActive: agency.isActive, guichets: agency.guichets,
      currentCalled: called?.number ?? 0, lastServed: 0,
      waitingCount: queue.length, estimatedWait: Math.round(queue.length * 4),
    },
    queue,
    called,
    allCalled: allCalled.map(t => ({
      id: t.id,
      label: t.label,
      number: t.number,
      service: t.service,
      guichetId: t.guichetId,
      guichet: t.guichet?.label ?? '',
      calledAt: t.calledAt?.toISOString() ?? '',
    })),
    history: history.map(t => ({
      label: t.label, guichet: t.guichet?.label ?? '', time: t.servedAt?.toISOString() ?? ''
    }))
  })
}
