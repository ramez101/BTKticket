import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()
  const data: any = {}
  if (body.name) data.name = body.name
  if (body.city) data.city = body.city
  if (body.pin) data.pin = await bcrypt.hash(String(body.pin), 10)
  if (body.isActive !== undefined) data.isActive = body.isActive
  const agency = await prisma.agency.update({ where: { id }, data })
  return NextResponse.json(agency)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  await prisma.$transaction([
    prisma.ticket.deleteMany({ where: { agencyId: id } }),
    prisma.dailyCounter.deleteMany({ where: { agencyId: id } }),
    prisma.guichet.deleteMany({ where: { agencyId: id } }),
    prisma.agency.delete({ where: { id } }),
  ])
  return NextResponse.json({ ok: true })
}
