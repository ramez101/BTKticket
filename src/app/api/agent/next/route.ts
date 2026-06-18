import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'
import { getServiceStatus, todayDate } from '@/lib/hours'

export async function POST(req: NextRequest) {
  const serviceStatus = await getServiceStatus()
  if (!serviceStatus.open) {
    return NextResponse.json({ error: serviceStatus.message }, { status: 403 })
  }

  const { agencyId, guichetId, guichetLabel, action } = await req.json()
  if (!agencyId || !guichetId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const today = todayDate()

  const guichet = await prisma.guichet.findUnique({ where: { id: guichetId } })
  if (!guichet?.isActive) {
    return NextResponse.json({ error: 'Guichet ferme' }, { status: 403 })
  }

  await prisma.ticket.updateMany({
    where: { agencyId, guichetId, status: 'CALLED', dayDate: today },
    data: { status: action === 'absent' ? 'ABSENT' : 'SERVED', servedAt: new Date() },
  })

  const next = await prisma.ticket.findFirst({
    where: { agencyId, status: 'WAITING', dayDate: today },
    orderBy: { number: 'asc' },
  })
  if (!next) return NextResponse.json({ error: 'No waiting tickets' }, { status: 404 })

  const called = await prisma.ticket.update({
    where: { id: next.id },
    data: { status: 'CALLED', calledAt: new Date(), guichetId },
  })

  const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })
  const servedCount = await prisma.ticket.count({ where: { agencyId, status: 'SERVED', dayDate: today } })

  const io = getIO()
  if (io) {
    const now = new Date().toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', hour12: false })
    io.to(`agency-${agencyId}`).emit('number-called', {
      label: called.label,
      number: called.number,
      guichet: guichetLabel,
      guichetId,
      time: now,
    })
    io.to(`agency-${agencyId}`).emit('ticket-update', {
      currentCalled: called.number,
      waitingCount,
      estimatedWait: waitingCount * 4,
      servedCount,
    })
  }

  return NextResponse.json({ called, waitingCount, servedCount })
}
