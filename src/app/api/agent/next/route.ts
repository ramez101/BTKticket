import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'
import { getServiceStatus, todayDate } from '@/lib/hours'
import { getAgencyWaitTime } from '@/lib/wait-time'
import { notifyApproachingTickets, notifyCalledTicket, notifyFinishedTicket } from '@/lib/push'

export async function POST(req: NextRequest) {
  const serviceStatus = await getServiceStatus()
  if (!serviceStatus.open) {
    return NextResponse.json({ error: serviceStatus.message }, { status: 403 })
  }

  const { agencyId, guichetId, guichetLabel, action, ticketId } = await req.json()
  if (!agencyId || !guichetId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const today = todayDate()

  const guichet = await prisma.guichet.findUnique({ where: { id: guichetId } })
  if (!guichet?.isActive) {
    return NextResponse.json({ error: 'Guichet ferme' }, { status: 403 })
  }

  if (action === 'recall') {
    if (!ticketId) return NextResponse.json({ error: 'ticketId required for recall' }, { status: 400 })
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.agencyId !== agencyId || ticket.status !== 'WAITING') {
      return NextResponse.json({ error: 'Ticket invalide pour relance' }, { status: 400 })
    }

    const called = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'CALLED', calledAt: new Date(), guichetId, onHold: false },
    })

    const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })
    const servedCount = await prisma.ticket.count({ where: { agencyId, status: 'SERVED', dayDate: today } })
    const waitTime = await getAgencyWaitTime({ agencyId, dayDate: today, waitingCount })

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
        estimatedWait: waitTime.estimatedWait,
        averagePassageMinutes: waitTime.averagePassageMinutes,
        passageSampleSize: waitTime.passageSampleSize,
        servedCount,
      })
    }

    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } })
    await notifyCalledTicket(called.id, agency?.name ?? 'BTK', guichetLabel || guichet.label)
    await notifyApproachingTickets(agencyId, today)

    return NextResponse.json({
      called,
      waitingCount,
      estimatedWait: waitTime.estimatedWait,
      averagePassageMinutes: waitTime.averagePassageMinutes,
      passageSampleSize: waitTime.passageSampleSize,
      servedCount,
    })
  }

  const finishingTicket = action === 'hold' ? null : await prisma.ticket.findFirst({
    where: { agencyId, guichetId, status: 'CALLED', dayDate: today },
    select: { id: true },
  })

  await prisma.ticket.updateMany({
    where: { agencyId, guichetId, status: 'CALLED', dayDate: today },
    data: action === 'hold'
      ? { status: 'WAITING', guichetId: null, calledAt: null, onHold: true }
      : { status: action === 'absent' ? 'ABSENT' : 'SERVED', servedAt: new Date(), onHold: false },
  })

  if (finishingTicket && (action === 'absent' || action === 'next')) {
    await notifyFinishedTicket(finishingTicket.id, action === 'absent' ? 'ABSENT' : 'SERVED')
  }

  const next = await prisma.ticket.findFirst({
    where: { agencyId, status: 'WAITING', dayDate: today },
    orderBy: [{ onHold: 'asc' }, { number: 'asc' }],
  })
  if (!next) {
    if (action === 'hold') {
      const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })
      const servedCount = await prisma.ticket.count({ where: { agencyId, status: 'SERVED', dayDate: today } })
      const waitTime = await getAgencyWaitTime({ agencyId, dayDate: today, waitingCount })

      const io = getIO()
      if (io) {
        io.to(`agency-${agencyId}`).emit('ticket-update', {
          currentCalled: null,
          waitingCount,
          estimatedWait: waitTime.estimatedWait,
          averagePassageMinutes: waitTime.averagePassageMinutes,
          passageSampleSize: waitTime.passageSampleSize,
          servedCount,
        })
      }

      return NextResponse.json({
        called: null,
        waitingCount,
        estimatedWait: waitTime.estimatedWait,
        averagePassageMinutes: waitTime.averagePassageMinutes,
        passageSampleSize: waitTime.passageSampleSize,
        servedCount,
        message: 'Ticket mis en attente, pas de client suivant',
      })
    }
    return NextResponse.json({ error: 'No waiting tickets' }, { status: 404 })
  }

  const called = await prisma.ticket.update({
    where: { id: next.id },
    data: { status: 'CALLED', calledAt: new Date(), guichetId },
  })

  const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })
  const servedCount = await prisma.ticket.count({ where: { agencyId, status: 'SERVED', dayDate: today } })
  const waitTime = await getAgencyWaitTime({
    agencyId,
    dayDate: today,
    waitingCount,
  })

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
      estimatedWait: waitTime.estimatedWait,
      averagePassageMinutes: waitTime.averagePassageMinutes,
      passageSampleSize: waitTime.passageSampleSize,
      servedCount,
    })
  }

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } })
  await notifyCalledTicket(called.id, agency?.name ?? 'BTK', guichetLabel || guichet.label)
  await notifyApproachingTickets(agencyId, today)

  return NextResponse.json({
    called,
    waitingCount,
    estimatedWait: waitTime.estimatedWait,
    averagePassageMinutes: waitTime.averagePassageMinutes,
    passageSampleSize: waitTime.passageSampleSize,
    servedCount,
  })
}
