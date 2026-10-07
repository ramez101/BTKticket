import { NextResponse } from 'next/server'
import { getCharge, getChargeLeaveBlocks } from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) {
    return NextResponse.json({ error: 'Id invalide' }, { status: 400 })
  }

  const charge = await getCharge(chargeId, true)
  if (!charge) {
    return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })
  }

  const dayBlocks = await getChargeLeaveBlocks(chargeId)
  return NextResponse.json({ dayBlocks })
}
