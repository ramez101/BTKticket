import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const guichets = await prisma.guichet.findMany({
    where: { agencyId: id, isActive: true }, orderBy: { number: 'asc' }
  })
  return NextResponse.json(guichets)
}
