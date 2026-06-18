import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET() {
  const holidays = await prisma.holiday.findMany({
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(holidays)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const dates: string[] = Array.isArray(body.dates)
    ? body.dates.filter(isDateValue)
    : isDateValue(body.date)
      ? [body.date]
      : []
  const uniqueDates: string[] = [...new Set(dates)]
  const label: string | null = typeof body.label === 'string' && body.label.trim()
    ? body.label.trim()
    : null

  if (uniqueDates.length === 0) {
    return NextResponse.json({ error: 'Date required' }, { status: 400 })
  }

  await prisma.holiday.createMany({
    data: uniqueDates.map(date => ({ date, label })),
    skipDuplicates: true,
  })

  const holidays = await prisma.holiday.findMany({
    where: { date: { in: uniqueDates } },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(holidays, { status: 201 })
}
