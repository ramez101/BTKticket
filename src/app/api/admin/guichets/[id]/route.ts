import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIO } from '@/lib/socket-server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()
  const data: any = {}
  if (body.label) data.label = body.label
  if (body.isActive !== undefined) data.isActive = body.isActive
  const g = await prisma.guichet.update({ where: { id }, data })
  if (body.isActive !== undefined) {
    const io = getIO()
    io?.to(`agency-${g.agencyId}`).emit('ticket-update', {
      guichetId: g.id,
      isActive: g.isActive,
    })
  }
  return NextResponse.json(g)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const guichet = await prisma.guichet.findUnique({ where: { id } })
  if (!guichet) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.ticket.updateMany({
    where: { guichetId: id },
    data: { guichetId: null },
  })
  await prisma.guichet.delete({ where: { id } })

  const io = getIO()
  io?.to(`agency-${guichet.agencyId}`).emit('ticket-update', {
    guichetId: id,
    deleted: true,
  })

  return NextResponse.json({ ok: true })
}
