import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAgencyWaitTime } from '@/lib/wait-time'
import { isExpoPushToken } from '@/lib/push'
import { todayTunisDate } from '@/lib/appointments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getProgress(initialPosition: number, peopleAhead: number, status: string) {
  if (status !== 'WAITING') return 100
  const safeInitialPosition = Math.max(1, initialPosition, peopleAhead + 1)
  if (peopleAhead === 0) return 100
  return Math.round(Math.max(0, safeInitialPosition - (peopleAhead + 1)) / Math.max(1, safeInitialPosition - 1) * 100)
}

function getPeopleAhead(ticket: { number: number; onHold: boolean; agencyId: number; dayDate: string }) {
  return prisma.ticket.count({
    where: ticket.onHold
      ? {
        agencyId: ticket.agencyId,
        dayDate: ticket.dayDate,
        status: 'WAITING',
        OR: [{ onHold: false }, { onHold: true, number: { lt: ticket.number } }],
      }
      : {
        agencyId: ticket.agencyId,
        dayDate: ticket.dayDate,
        status: 'WAITING',
        onHold: false,
        number: { lt: ticket.number },
      },
  })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''
  if (!isExpoPushToken(token)) {
    return NextResponse.json({ error: 'Token push invalide' }, { status: 400 })
  }

  const synchronizedAt = new Date()
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      token,
      OR: [{ ticketId: { not: null } }, { appointmentId: { not: null } }],
    },
    include: {
      ticket: {
        include: {
          agency: { select: { name: true, city: true } },
          guichet: { select: { label: true } },
        },
      },
      appointment: {
        include: {
          charge: { select: { name: true } },
          agency: { select: { name: true, city: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const ticketSubscriptions = new Map<number, typeof subscriptions[number]>()
  for (const subscription of subscriptions) {
    if (subscription.ticket && !ticketSubscriptions.has(subscription.ticket.id)) {
      ticketSubscriptions.set(subscription.ticket.id, subscription)
    }
  }

  const tickets = await Promise.all([...ticketSubscriptions.values()].map(async subscription => {
    const ticket = subscription.ticket
    if (!ticket) return null

    const active = ticket.status === 'WAITING' || ticket.status === 'CALLED'
    const [peopleAhead, waitTime] = active && ticket.status === 'WAITING'
      ? await Promise.all([
        getPeopleAhead(ticket),
        getAgencyWaitTime({
          agencyId: ticket.agencyId,
          dayDate: ticket.dayDate,
          waitingCount: 0,
          targetTicketNumber: ticket.number,
          targetService: ticket.service,
        }),
      ])
      : [0, null] as const

    return {
      id: ticket.id,
      number: ticket.number,
      service: ticket.service,
      status: ticket.status,
      statusLabel: ticket.status === 'WAITING'
        ? peopleAhead <= 3 ? 'Votre tour approche' : 'En attente'
        : ticket.status === 'CALLED' ? 'C’est votre tour !' : ticket.status === 'SERVED' ? 'Terminé' : 'Absent',
      peopleAhead,
      progress: getProgress(ticket.initialPosition, peopleAhead, ticket.status),
      estimatedWait: waitTime?.estimatedWait ?? 0,
      agencyName: ticket.agency.name,
      agencyCity: ticket.agency.city,
      guichet: ticket.guichet?.label ?? null,
      active,
      lastUpdatedAt: synchronizedAt.toISOString(),
    }
  })).then(items => items.filter((ticket): ticket is NonNullable<typeof ticket> => ticket !== null))

  const appointments = []
  const seenAppointments = new Set<number>()
  const today = todayTunisDate()
  for (const subscription of subscriptions) {
    const appointment = subscription.appointment
    if (!appointment || seenAppointments.has(appointment.id)) continue
    seenAppointments.add(appointment.id)
    appointments.push({
      id: appointment.id,
      reference: appointment.reference,
      title: appointment.subject || `Rendez-vous avec ${appointment.charge.name}`,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      statusLabel: appointment.status === 'CONFIRMED' ? 'Confirmé' : appointment.status,
      chargeName: appointment.charge.name,
      agencyName: appointment.agency.name,
      agencyCity: appointment.agency.city,
      subject: appointment.subject,
      upcoming: appointment.date >= today && appointment.status === 'CONFIRMED',
    })
  }

  tickets.sort((a, b) => Number(b.active) - Number(a.active) || b.id - a.id)
  appointments.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))

  return NextResponse.json(
    { tickets, appointments, updatedAt: synchronizedAt.toISOString() },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
  )
}

export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''
  if (!isExpoPushToken(token)) {
    return NextResponse.json({ error: 'Token push invalide' }, { status: 400 })
  }

  const result = await prisma.pushSubscription.deleteMany({
    where: {
      token,
      ticketId: { not: null },
      ticket: { is: { status: { in: ['SERVED', 'ABSENT'] } } },
    },
  })

  return NextResponse.json({ deleted: result.count })
}
