import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'
import { getServiceStatus, todayDate } from '@/lib/hours'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const serviceStatus = await getServiceStatus()
  if (!serviceStatus.open) {
    return NextResponse.json({ error: serviceStatus.message }, { status: 403 })
  }

  const { agencyId, service } = await req.json()
  if (!agencyId || !service) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const today = todayDate()

  const counter = await prisma.dailyCounter.upsert({
    where: { agencyId_dayDate: { agencyId, dayDate: today } },
    update: { counter: { increment: 1 } },
    create: { agencyId, dayDate: today, counter: 1 },
  })

  const number = counter.counter
  const label = number.toString()
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } })

  const qrPayload = Buffer.from(JSON.stringify({ label, agencyId, service, date: today })).toString('base64url')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const qrUrl = `${baseUrl}/ticket/${qrPayload}`
  const qrCode = await QRCode.toDataURL(qrUrl, { width: 220, margin: 1, color: { dark: '#1565C0', light: '#ffffff' } })

  const ticket = await prisma.ticket.create({
    data: { number, label, service, status: 'WAITING', qrCode, agencyId, dayDate: today },
  })

  const waitingCount = await prisma.ticket.count({ where: { agencyId, status: 'WAITING', dayDate: today } })

  const io = getIO()
  if (io) {
    io.to(`agency-${agencyId}`).emit('ticket-update', { waitingCount, estimatedWait: waitingCount * 4 })
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
    estimatedWait: waitingCount * 4,
  })
}
