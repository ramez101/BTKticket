import { NextRequest, NextResponse } from 'next/server'
import { getCharges } from '@/lib/appointments'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const agencyIdParam = req.nextUrl.searchParams.get('agencyId')
  const agencyId = agencyIdParam ? parseInt(agencyIdParam, 10) : null
  const charges = await getCharges(true, Number.isFinite(agencyId) ? agencyId : null)

  return NextResponse.json(charges)
}
