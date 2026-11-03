import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'
import { getServiceStatus, todayDate } from '@/lib/hours'
import { getAgencyWaitTime } from '@/lib/wait-time'
import { sendTicketWaitNotification } from '@/lib/mail'
import { isExpoPushToken, notifyApproachingTickets, notifyTicketConfirmed, registerPushSubscription } from '@/lib/push'
import QRCode from 'qrcode'

function getTicketBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim()

  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured.replace(/\/$/, '')
  }

  return req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const serviceStatus = await getServiceStatus()
  if (!serviceStatus.open) {
    return NextResponse.json({ error: serviceStatus.message }, { status: 403 })
  }

  const { agencyId, service, notificationMode, customerPhone, pushToken, pushPlatform } = await req.json()
  if (!agencyId || !service) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (notificationMode === 'phone' && (!customerPhone || typeof customerPhone !== 'string' || !customerPhone.trim())) {
    return NextResponse.json({ error: 'Numero de telephone requis pour la notification' }, { status: 400 })
  }

  const today = todayDate()

  const counter = await prisma.dailyCounter.upsert({
    where: { agencyId_dayDate: { agencyId, dayDate: today } },
    update: { counter: { increment: 1 } },
    create: { agencyId, dayDate: today, counter: 1 },
  })

  const number = counter.counter
  const label = number.toString()
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      name: true,
      guichets: { where: { isActive: true }, select: { id: true } },
    },
  })

  const qrPayload = Buffer.from(JSON.stringify({ label, agencyId, service, date: today })).toString('base64url')
  const baseUrl = getTicketBaseUrl(req)
  const qrUrl = `${baseUrl}/?ticket=${encodeURIComponent(qrPayload)}`
  const qrCode = await QRCode.toDataURL(qrUrl, { width: 220, margin: 1, color: { dark: '#1565C0', light: '#ffffff' } })

  const ticket = await prisma.ticket.create({
    data: { number, label, service, status: 'WAITING', qrCode, agencyId, dayDate: today },
  })

  const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })
  const peopleBefore = await prisma.ticket.count({
    where: { agencyId, dayDate: today, status: 'WAITING', onHold: false, number: { lt: number } },
  })
  const initialPosition = Math.max(1, peopleBefore + 1)
  await prisma.ticket.update({ where: { id: ticket.id }, data: { initialPosition } })
  const waitTime = await getAgencyWaitTime({
    agencyId,
    dayDate: today,
    waitingCount,
    openGuichets: agency?.guichets.length ?? 0,
    targetTicketNumber: number,
    targetService: service,
  })
  const currentTicket = await prisma.ticket.findFirst({
    where: { agencyId, dayDate: today, status: 'CALLED' },
    orderBy: { calledAt: 'desc' },
    select: { number: true },
  })
  const notification = notificationMode === 'phone'
    ? await sendTicketWaitNotification({
      customerPhone: customerPhone.trim(),
      ticketNumber: number,
      currentTicketNumber: currentTicket?.number ?? null,
      estimatedWaitMinutes: waitTime.estimatedWait,
        agencyName: agency?.name ?? 'votre agence',
      })
    : { sent: false, reason: 'guest' as const }

  let hasPushToken = false
  if (isExpoPushToken(pushToken)) {
    await registerPushSubscription({ token: pushToken, platform: pushPlatform, ticketId: ticket.id })
    hasPushToken = true
  }

  const pushConfirmation = hasPushToken
    ? await notifyTicketConfirmed({
      ticketId: ticket.id,
      ticketNumber: number,
      agencyId,
      agencyName: agency?.name ?? 'votre agence',
      service,
      peopleAhead: peopleBefore,
      estimatedWait: waitTime.estimatedWait,
    })
    : { sent: false, reason: 'no-token' as const }
  const pushNotification = hasPushToken
    ? await notifyApproachingTickets(agencyId, today, { skipTicketId: ticket.id })
    : { sent: false, reason: 'no-token' as const }

  const io = getIO()
  if (io) {
    io.to(`agency-${agencyId}`).emit('ticket-update', {
      waitingCount,
      estimatedWait: waitTime.estimatedWait,
      averagePassageMinutes: waitTime.averagePassageMinutes,
      passageSampleSize: waitTime.passageSampleSize,
    })
    io.to(`agency-${agencyId}`).emit('new-ticket', {
      id: ticket.id,
      number,
      label,
      service,
      status: 'WAITING',
      agencyId,
      agencyName: agency?.name,
      qrCode,
      createdAt: ticket.createdAt.toISOString(),
    })
  }

  return NextResponse.json({
    id: ticket.id,
    number,
    label,
    service,
    agencyId,
    agencyName: agency?.name,
    qrCode,
    qrUrl,
    createdAt: ticket.createdAt.toISOString(),
    waitingCount,
    estimatedWait: waitTime.estimatedWait,
    averagePassageMinutes: waitTime.averagePassageMinutes,
    passageSampleSize: waitTime.passageSampleSize,
    notification,
    pushConfirmation,
    pushNotification,
  })
}
