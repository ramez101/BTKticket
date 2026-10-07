import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureAppointmentTables,
  getCharge,
  normalizeAppointment,
  todayTunisDate,
} from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureAppointmentTables()

  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(chargeId, true)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const dateFrom = req.nextUrl.searchParams.get('from') || todayTunisDate()
  const rows = await prisma.appointment.findMany({
    where: { chargeId, date: { gte: dateFrom } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    take: 100,
  })

  return NextResponse.json({
    charge,
    appointments: rows.map(normalizeAppointment),
  })
}
