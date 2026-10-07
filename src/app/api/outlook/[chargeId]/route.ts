import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAppointmentTables } from '@/lib/appointments'
import { getOutlookConnection, isOutlookConfigured } from '@/lib/outlook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { chargeId: string } }) {
  await ensureAppointmentTables()
  const chargeId = Number(params.chargeId)
  if (!Number.isInteger(chargeId) || chargeId <= 0) return NextResponse.json({ error: 'Charge invalide.' }, { status: 400 })
  const charge = await prisma.charge.findUnique({ where: { id: chargeId }, select: { id: true } })
  if (!charge) return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })

  return NextResponse.json({ configured: isOutlookConfigured(), ...(await getOutlookConnection(chargeId)) })
}
