import { prisma } from '@/lib/prisma'
import { getAgencyWaitTime } from '@/lib/wait-time'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type PushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  priority?: 'default' | 'normal' | 'high'
  sound?: 'default' | null
  channelId?: string
  collapseId?: string
  tag?: string
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(value.trim())
}

export function formatTicketNumber(number: number) {
  return String(number).padStart(3, '0')
}

function getTicketProgress(initialPosition: number, peopleAhead: number) {
  const safeInitialPosition = Math.max(1, initialPosition, peopleAhead + 1)
  const remainingSteps = Math.max(0, safeInitialPosition - (peopleAhead + 1))
  const totalSteps = Math.max(1, safeInitialPosition - 1)
  const progress = peopleAhead === 0 ? 100 : Math.round((remainingSteps / totalSteps) * 100)
  const filled = Math.round(progress / 10)

  return {
    progress,
    bar: `${'━'.repeat(filled)}${'─'.repeat(10 - filled)}`,
    progressedTickets: remainingSteps,
  }
}

export function buildTicketProgressMessage(input: {
  ticketId: number
  ticketNumber: number
  agencyId?: number
  agencyName: string
  peopleAhead: number
  initialPosition: number
  estimatedWait: number
  status: 'WAITING' | 'CALLED' | 'SERVED' | 'ABSENT'
  guichetLabel?: string | null
  alert?: boolean
}) {
  const { progress, bar, progressedTickets } = getTicketProgress(input.initialPosition, input.peopleAhead)
  const ticketLabel = `#${formatTicketNumber(input.ticketNumber)}`
  const peopleLabel = input.peopleAhead === 0
    ? 'Vous êtes le prochain !'
    : `${input.peopleAhead} personne${input.peopleAhead === 1 ? '' : 's'} avant vous`
  const detail = input.status === 'CALLED'
    ? `Présentez-vous au ${input.guichetLabel || 'guichet'}.`
    : input.status === 'SERVED'
      ? 'Votre passage est terminé.'
      : input.status === 'ABSENT'
        ? 'Ce ticket a été marqué absent.'
        : input.peopleAhead === 0
          ? 'Préparez-vous, votre tour approche.'
    : progressedTickets > 0
      ? `${progressedTickets} ticket${progressedTickets === 1 ? '' : 's'} vient${progressedTickets === 1 ? '' : 'nent'} d'être traité${progressedTickets === 1 ? '' : 's'}.`
      : 'Votre progression est suivie en temps réel.'
  const tag = `ticket-progress-${input.ticketId}`
  const estimatedWait = Math.max(0, Math.round(input.estimatedWait))

  return {
    title: input.status === 'CALLED'
      ? 'C\'EST VOTRE TOUR !'
      : input.status === 'SERVED'
        ? 'Ticket terminé'
        : input.status === 'ABSENT'
          ? 'Ticket clôturé'
          : input.peopleAhead === 0
            ? 'Votre tour arrive !'
            : input.peopleAhead <= 3
              ? 'Votre tour approche'
              : `Votre ticket ${ticketLabel} avance !`,
    body: `${ticketLabel} · ${peopleLabel}\n${bar} ${progress}%\nAttente estimée : ${estimatedWait} min\n${detail}`,
    data: {
      type: 'ticket-progress',
      ticketId: input.ticketId,
      agencyId: input.agencyId,
      peopleAhead: input.peopleAhead,
      progress,
      estimatedWait,
      status: input.status,
      guichetLabel: input.guichetLabel ?? null,
    },
    priority: input.alert || input.status === 'CALLED' ? 'high' as const : 'normal' as const,
    sound: input.alert || input.status === 'CALLED' ? 'default' as const : null,
    channelId: input.alert || input.status === 'CALLED' ? 'ticket-called' : 'ticket-updates',
    collapseId: tag,
    tag,
  }
}

export async function registerPushSubscription(input: {
  token: string
  platform?: string | null
  ticketId?: number | null
  appointmentId?: number | null
}) {
  if (!isExpoPushToken(input.token)) return null

  const token = input.token.trim()
  const ticketId = input.ticketId ?? null
  const appointmentId = input.appointmentId ?? null

  await prisma.pushSubscription.deleteMany({
    where: { token, ticketId, appointmentId },
  })

  return prisma.pushSubscription.create({
    data: {
      token,
      platform: input.platform || null,
      ticketId,
      appointmentId,
    },
  })
}

async function sendExpoMessages(messages: PushMessage[]) {
  const validMessages = messages.filter(message => isExpoPushToken(message.to))
  if (!validMessages.length) return null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(validMessages),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Expo push request failed:', response.status, result)
      return null
    }
    return result
  } catch (error) {
    // A push failure must never make ticket or appointment creation fail.
    console.error('Expo push delivery failed:', error)
    return null
  }
}

export async function sendPushToTokens(tokens: string[], message: Omit<PushMessage, 'to'>) {
  return sendExpoMessages(tokens.map(to => ({ ...message, to })))
}

export async function sendPushToTicket(ticketId: number, message: Omit<PushMessage, 'to'>) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { ticketId }, select: { token: true } })
  return sendPushToTokens([...new Set(subscriptions.map(item => item.token))], message)
}

export async function sendPushToAppointment(appointmentId: number, message: Omit<PushMessage, 'to'>) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { appointmentId }, select: { token: true } })
  return sendPushToTokens([...new Set(subscriptions.map(item => item.token))], message)
}

export async function notifyTicketConfirmed(input: {
  ticketId: number
  ticketNumber: number
  agencyId: number
  agencyName: string
  service: string
  peopleAhead: number
  estimatedWait: number
}) {
  const peopleLabel = `${input.peopleAhead} personne${input.peopleAhead === 1 ? '' : 's'} avant vous`
  const ticketLabel = `#${formatTicketNumber(input.ticketNumber)}`
  const tag = `ticket-confirmed-${input.ticketId}`

  return sendPushToTicket(input.ticketId, {
    title: `Ticket ${ticketLabel} confirmé`,
    body: `Agence ${input.agencyName}\n${peopleLabel}\nAttente estimée : ${Math.max(0, Math.round(input.estimatedWait))} min.`,
    data: {
      type: 'ticket-confirmed',
      ticketId: input.ticketId,
      ticketNumber: input.ticketNumber,
      agencyId: input.agencyId,
      agencyName: input.agencyName,
      service: input.service,
      peopleAhead: input.peopleAhead,
      estimatedWait: Math.max(0, Math.round(input.estimatedWait)),
      status: 'WAITING',
    },
    priority: 'high',
    sound: 'default',
    channelId: 'ticket-updates',
    collapseId: tag,
    tag,
  })
}

export async function notifyApproachingTickets(agencyId: number, dayDate: string, options: { skipTicketId?: number } = {}) {
  const queue = await prisma.ticket.findMany({
    where: { agencyId, dayDate, status: 'WAITING', onHold: false },
    orderBy: [{ number: 'asc' }],
    select: { id: true, number: true, service: true, initialPosition: true, approachNotifiedAt: true, lastPushState: true },
  })

  if (!queue.length) return null

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { ticketId: { in: queue.map(ticket => ticket.id) } },
    select: { token: true, ticketId: true },
  })
  const tokensByTicket = new Map<number, Set<string>>()
  for (const subscription of subscriptions) {
    if (!subscription.ticketId) continue
    const tokens = tokensByTicket.get(subscription.ticketId) ?? new Set<string>()
    tokens.add(subscription.token)
    tokensByTicket.set(subscription.ticketId, tokens)
  }

  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { name: true, guichets: { where: { isActive: true }, select: { id: true } } },
  })
  const notifications: PushMessage[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const ticket = queue[index]
    if (ticket.id === options.skipTicketId) continue
    const tokens = tokensByTicket.get(ticket.id)
    if (!tokens?.size) continue
    const waitTime = await getAgencyWaitTime({
      agencyId,
      dayDate,
      waitingCount: queue.length,
      openGuichets: agency?.guichets.length ?? 0,
      targetTicketNumber: ticket.number,
      targetService: ticket.service,
    })
    const message = buildTicketProgressMessage({
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      agencyId,
      agencyName: agency?.name ?? 'BTK',
      peopleAhead: index,
      initialPosition: ticket.initialPosition,
      estimatedWait: waitTime.estimatedWait,
      status: 'WAITING',
    })

    const stateKey = JSON.stringify({
      peopleAhead: index,
      progress: message.data?.progress,
      estimatedWait: waitTime.estimatedWait,
      status: 'WAITING',
    })
    if (ticket.lastPushState === stateKey) continue

    const markedState = await prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        status: 'WAITING',
        OR: [{ lastPushState: null }, { lastPushState: { not: stateKey } }],
      },
      data: { lastPushState: stateKey },
    })
    if (!markedState.count) continue

    let alert = false
    if (index === 3 && !ticket.approachNotifiedAt) {
      const markedApproach = await prisma.ticket.updateMany({
        where: { id: ticket.id, approachNotifiedAt: null },
        data: { approachNotifiedAt: new Date() },
      })
      alert = markedApproach.count > 0
    }

    const finalMessage = alert ? { ...message, priority: 'high' as const, sound: 'default' as const, channelId: 'ticket-called' } : message
    for (const token of tokens) {
      notifications.push({ ...finalMessage, to: token })
    }
  }

  return sendExpoMessages(notifications)
}

export async function notifyCalledTicket(ticketId: number, agencyName: string, guichetLabel: string) {
  const marked = await prisma.ticket.updateMany({
    where: { id: ticketId, calledNotifiedAt: null },
    data: { calledNotifiedAt: new Date() },
  })
  if (!marked.count) return null

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { number: true } })
  if (!ticket) return null

  return sendPushToTicket(ticketId, {
    ...buildTicketProgressMessage({
      ticketId,
      ticketNumber: ticket.number,
      agencyName,
      peopleAhead: 0,
      initialPosition: 1,
      estimatedWait: 0,
      status: 'CALLED',
      guichetLabel,
    }),
    data: { type: 'ticket-called', ticketId, status: 'CALLED', guichetLabel },
  })
}

export async function notifyFinishedTicket(ticketId: number, status: 'SERVED' | 'ABSENT') {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { number: true } })
  if (!ticket) return null

  return sendPushToTicket(ticketId, {
    ...buildTicketProgressMessage({
      ticketId,
      ticketNumber: ticket.number,
      agencyName: 'BTK',
      peopleAhead: 0,
      initialPosition: 1,
      estimatedWait: 0,
      status,
    }),
    data: { type: 'ticket-finished', ticketId, status },
    sound: null,
  })
}

export async function notifyAppointmentReminders(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now)
  const appointments = await prisma.appointment.findMany({
    where: { status: 'CONFIRMED', date: { gte: today } },
    include: {
      charge: { select: { name: true } },
      agency: { select: { name: true } },
    },
  })

  const messages: PushMessage[] = []
  for (const appointment of appointments) {
    // Tunisia uses UTC+01:00. Keeping the conversion here makes reminders
    // independent of the server's local timezone.
    const appointmentAt = new Date(`${appointment.date}T${appointment.time}:00+01:00`)
    const hoursUntil = (appointmentAt.getTime() - now.getTime()) / 3600000
    const reminder: '24h' | '1h' | null = hoursUntil >= 23.5 && hoursUntil < 24.5
      ? '24h'
      : hoursUntil >= 0.5 && hoursUntil < 1.5
        ? '1h'
        : null
    if (!reminder) continue

    const subscriptions = await prisma.pushSubscription.findMany({ where: { appointmentId: appointment.id }, select: { token: true } })
    const tokens = [...new Set(subscriptions.map(item => item.token))]
    if (!tokens.length) continue

    const marked = await prisma.appointment.updateMany({
      where: {
        id: appointment.id,
        [reminder === '24h' ? 'reminder24NotifiedAt' : 'reminder1NotifiedAt']: null,
      },
      data: { [reminder === '24h' ? 'reminder24NotifiedAt' : 'reminder1NotifiedAt']: new Date() },
    })
    if (!marked.count) continue

    const dateLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Tunis' })
      .format(new Date(`${appointment.date}T12:00:00Z`))
    for (const token of tokens) messages.push({
      to: token,
      title: 'Rappel de votre rendez-vous',
      body: `N'oubliez pas votre rendez-vous ${reminder === '24h' ? 'demain' : 'dans une heure'} à ${appointment.time.replace(':', ' h ')} à l'agence ${appointment.agency.name}.`,
      data: { type: reminder === '24h' ? 'appointment-reminder-24h' : 'appointment-reminder-1h', appointmentId: appointment.id, reference: appointment.reference, date: dateLabel },
      priority: 'high',
      sound: 'default',
      channelId: 'appointments',
    })
  }

  if (!messages.length) return null
  return sendExpoMessages(messages)
}

