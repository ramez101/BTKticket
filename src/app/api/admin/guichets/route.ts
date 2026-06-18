import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'

export async function POST(req: NextRequest) {
  const { agencyId, label } = await req.json()
  if (!agencyId || !label) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const lastNumber = await prisma.guichet.aggregate({
    where: { agencyId },
    _max: { number: true },
  })
  const guichet = await prisma.guichet.create({
    data: { agencyId, number: (lastNumber._max.number ?? 0) + 1, label }
  })

  getIO()?.to(`agency-${agencyId}`).emit('ticket-update', {
    guichetId: guichet.id,
    isActive: guichet.isActive,
  })

  return NextResponse.json(guichet, { status: 201 })
}
