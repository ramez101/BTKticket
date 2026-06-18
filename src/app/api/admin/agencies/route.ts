import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { todayDate } from '@/lib/hours'
import bcrypt from 'bcryptjs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const today = todayDate()
  const [agencies, ticketStats] = await Promise.all([
    prisma.agency.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        isActive: true,
        createdAt: true,
        guichets: { orderBy: { number: 'asc' } },
        _count: { select: { tickets: { where: { status: 'WAITING', dayDate: today } } } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.ticket.groupBy({
      by: ['agencyId', 'status'],
      where: { dayDate: today },
      _count: { _all: true },
    }),
  ])

  const statsByAgency = new Map<number, {
    waiting: number
    called: number
    served: number
    absent: number
    total: number
  }>()

  for (const row of ticketStats) {
    const current = statsByAgency.get(row.agencyId) ?? {
      waiting: 0,
      called: 0,
      served: 0,
      absent: 0,
      total: 0,
    }
    const count = row._count._all
    if (row.status === 'WAITING') current.waiting = count
    if (row.status === 'CALLED') current.called = count
    if (row.status === 'SERVED') current.served = count
    if (row.status === 'ABSENT') current.absent = count
    current.total += count
    statsByAgency.set(row.agencyId, current)
  }

  return NextResponse.json(agencies.map(agency => ({
    ...agency,
    todayStats: statsByAgency.get(agency.id) ?? {
      waiting: 0,
      called: 0,
      served: 0,
      absent: 0,
      total: 0,
    },
  })))
}

export async function POST(req: NextRequest) {
  const { name, city, pin } = await req.json()
  if (!name || !city || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const count = await prisma.agency.count()
  const code = `AG${String(count + 1).padStart(2, '0')}`
  const hashedPin = await bcrypt.hash(String(pin), 10)
  const agency = await prisma.agency.create({
    data: { code, name, city, pin: hashedPin },
  })
  // Create 3 default guichets
  for (let g = 1; g <= 3; g++) {
    await prisma.guichet.create({ data: { number: g, label: `Guichet ${g}`, agencyId: agency.id } })
  }
  return NextResponse.json(agency, { status: 201 })
}
