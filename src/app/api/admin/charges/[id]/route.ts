import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureAppointmentTables, getCharge } from '@/lib/appointments'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await ensureAppointmentTables()

  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const current = await getCharge(id)
  if (!current) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  const body = await req.json()
  const code = body.code !== undefined ? cleanText(body.code) : current.code
  const name = body.name !== undefined ? cleanText(body.name) : current.name
  const agencyId = body.agencyId !== undefined ? parseInt(String(body.agencyId), 10) : current.agencyId
  const email = body.email !== undefined ? cleanText(body.email) || null : current.email
  const phone = body.phone !== undefined ? cleanText(body.phone) || null : current.phone
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : current.isActive

  if (!code || !name || !Number.isFinite(agencyId)) {
    return NextResponse.json({ error: 'Code, nom et agence obligatoires' }, { status: 400 })
  }
  if (body.email !== undefined && !email) {
    return NextResponse.json({ error: 'Email du charge obligatoire' }, { status: 400 })
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: 'Email du charge invalide' }, { status: 400 })
  }

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true } })
  if (!agency) return NextResponse.json({ error: 'Agence introuvable' }, { status: 404 })

  try {
    await prisma.charge.update({
      where: { id },
      data: { code, name, agencyId, email, phone, isActive },
    })
    const charge = await getCharge(id)
    return NextResponse.json(charge)
  } catch {
    return NextResponse.json({ error: 'Code charge deja utilise ou donnees invalides' }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await ensureAppointmentTables()

  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Id invalide' }, { status: 400 })

  const charge = await getCharge(id)
  if (!charge) return NextResponse.json({ error: 'Charge introuvable' }, { status: 404 })

  await prisma.charge.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
