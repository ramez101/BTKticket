import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ensureAppointmentTables,
  ensureDefaultAvailability,
  getCharge,
  getCharges,
} from '@/lib/appointments'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function generateChargeCode() {
  const count = await prisma.charge.count()
  return `CH${String(count + 1).padStart(4, '0')}`
}

export async function GET() {
  const charges = await getCharges(false)
  return NextResponse.json(charges)
}

export async function POST(req: NextRequest) {
  await ensureAppointmentTables()

  const body = await req.json()
  const name = cleanText(body.name)
  const agencyId = parseInt(String(body.agencyId || ''), 10)
  const code = cleanText(body.code) || await generateChargeCode()
  const email = cleanText(body.email) || null
  const phone = cleanText(body.phone) || null

  if (!name || !Number.isFinite(agencyId) || !email) {
    return NextResponse.json({ error: 'Nom, agence et email du charge obligatoires' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email du charge invalide' }, { status: 400 })
  }

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true } })
  if (!agency) return NextResponse.json({ error: 'Agence introuvable' }, { status: 404 })

  try {
    const created = await prisma.charge.create({
      data: {
        code,
        name,
        agencyId,
        email,
        phone,
        isActive: body.isActive === false ? false : true,
      },
    })
    await ensureDefaultAvailability(created.id)
    const charge = await getCharge(created.id)
    return NextResponse.json(charge, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Code charge deja utilise ou donnees invalides' }, { status: 409 })
  }
}
