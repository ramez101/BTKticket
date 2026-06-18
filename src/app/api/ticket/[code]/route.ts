import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  // code = base64-encoded JSON from QR: { label, agencyId, service, date }
  let decoded: any
  try {
    decoded = JSON.parse(Buffer.from(params.code, 'base64url').toString('utf-8'))
  } catch {
    return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 })
  }

  const { label, agencyId, service, date } = decoded

  const ticket = await prisma.ticket.findFirst({
    where: { label, agencyId, service, dayDate: date },
    include: { agency: true, guichet: true },
    orderBy: { createdAt: 'desc' }
  })

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  // Count how many WAITING tickets are ahead
  const ahead = await prisma.ticket.count({
    where: {
      agencyId,
      status: 'WAITING',
      dayDate: date,
      number: { lt: ticket.number }
    }
  })

  // Current called number
  const called = await prisma.ticket.findFirst({
    where: { agencyId, status: 'CALLED', dayDate: date },
    include: { guichet: true },
    orderBy: { calledAt: 'desc' }
  })

  // Estimate presentation time
  const estimatedMinutes = ahead * 4
  const presentAt = new Date(Date.now() + estimatedMinutes * 60 * 1000)
    .toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Tunis' })

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      label: ticket.label,
      number: ticket.number,
      service: ticket.service,
      status: ticket.status,
      createdAt: ticket.createdAt.toISOString(),
      guichet: ticket.guichet?.label ?? null,
    },
    agency: {
      name: ticket.agency.name,
      city: ticket.agency.city,
      code: ticket.agency.code,
    },
    rank: ahead + 1,
    ahead,
    presentAt,
    estimatedMinutes,
    currentCalled: called?.number ?? 0,
    currentGuichet: called?.guichet?.label ?? null,
  })
}
