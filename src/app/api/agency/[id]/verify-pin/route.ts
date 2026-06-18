import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const { pin } = await req.json()
  if (!pin || isNaN(id)) return NextResponse.json({ ok: false }, { status: 400 })
  const agency = await prisma.agency.findUnique({ where: { id }, select: { pin: true, name: true } })
  if (!agency) return NextResponse.json({ ok: false }, { status: 404 })
  const valid = await bcrypt.compare(String(pin), agency.pin)
  return NextResponse.json({ ok: valid, agencyName: valid ? agency.name : undefined })
}
