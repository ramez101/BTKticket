import { NextRequest, NextResponse } from 'next/server'
import {
  getCharge,
  getChargeAvailability,
  saveChargeAvailability,
} from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(chargeId)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const availability = await getChargeAvailability(chargeId)
  return NextResponse.json({ charge, availability })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const chargeId = parseInt(params.id, 10)
  if (!Number.isFinite(chargeId)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(chargeId)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const body = await req.json()
  const availability = Array.isArray(body.availability) ? body.availability : []
  if (availability.length === 0) {
    return NextResponse.json({ error: 'Disponibilite manquante' }, { status: 400 })
  }

  try {
    const saved = await saveChargeAvailability(chargeId, availability)
    return NextResponse.json({ charge, availability: saved })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Disponibilite invalide' }, { status: 400 })
  }
}
