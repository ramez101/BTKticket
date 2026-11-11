import nodemailer from 'nodemailer'

type AppointmentMailInput = {
  customerName: string
  customerPhone: string
  chargeName: string
  agencyName: string
  date: string
  time: string
  reference: string
  cancellationUrl: string
}

type MailResult = {
  sent: boolean
  reason?: 'guest' | 'missing_recipient' | 'provider_error'
}

type ChargeAppointmentMailInput = {
  chargeEmail: string | null | undefined
  chargeName: string
  agencyName: string
  date: string
  time: string
  reference: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  subject?: string | null
}

function formatBookingDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const dateValue = new Date(Date.UTC(year, month - 1, day, 12))
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(dateValue)

  return `${formattedDate} à ${time}`
}

function formatChargeAppointmentDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const dateValue = new Date(Date.UTC(year, month - 1, day, 12))
  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(dateValue)
  const capitalizedDate = formattedDate.charAt(0).toLocaleUpperCase('fr-FR') + formattedDate.slice(1)
  const formattedTime = time.replace(':', 'h')

  return `${capitalizedDate} à ${formattedTime}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

function mailCatcherRecipient(phone: string) {
  const digits = phone.replace(/\D/g, '') || 'inconnu'
  return {
    name: phone.trim(),
    address: `sms-${digits}@mailcatcher.local`,
  }
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function calendarDateTime(date: string, time: string, minutesToAdd = 0) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day, hours - 1, minutes + minutesToAdd))
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function createAppointmentCalendarEvent(input: ChargeAppointmentMailInput, method: 'REQUEST' | 'CANCEL') {
  const customerDetails = [
    `Client : ${input.customerName}`,
    `Telephone : ${input.customerPhone}`,
    input.customerEmail ? `Email : ${input.customerEmail}` : '',
    input.subject ? `Objet : ${input.subject}` : '',
    `Reference : ${input.reference}`,
  ].filter(Boolean).join('\\n')
  const from = process.env.MAIL_FROM?.trim() || 'BTK Easy <rdv@btk.local>'
  const organizerEmail = process.env.CALENDAR_ORGANIZER_EMAIL?.trim()
    || from.match(/<([^>]+)>/)?.[1]
    || from

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BTK Easy//Rendez-vous//FR',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:btk-rdv-${input.reference.toLowerCase()}@btk.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
    `DTSTART:${calendarDateTime(input.date, input.time)}`,
    `DTEND:${calendarDateTime(input.date, input.time, 30)}`,
    `SUMMARY:${escapeCalendarText(`RDV BTK - ${input.customerName}`)}`,
    `DESCRIPTION:${escapeCalendarText(customerDetails)}`,
    `LOCATION:${escapeCalendarText(input.agencyName)}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    `ORGANIZER:MAILTO:${organizerEmail}`,
    `ATTENDEE;CN=${escapeCalendarText(input.chargeName)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:MAILTO:${input.chargeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

function createChargeAppointmentEmailTemplate(input: ChargeAppointmentMailInput, kind: 'confirmation' | 'cancellation', calendarInvite: boolean) {
  const isCancellation = kind === 'cancellation'
  const bookingDate = formatChargeAppointmentDate(input.date, input.time)
  if (!isCancellation) {
    const calendarMessage = calendarInvite
      ? 'L’invitation à ajouter à votre calendrier Outlook est intégrée à ce courriel.'
      : 'Ce rendez-vous a été ajouté automatiquement à votre calendrier Outlook.'
    const details = [
      ['📅', 'Date', bookingDate],
      ['📍', 'Lieu', input.agencyName],
      ['🔖', 'Référence', input.reference],
    ] as const
    const detailText = details.map(([icon, label, value]) => `${icon} ${label} : ${value}`).join('\n')
    const detailHtml = details.map(([icon, label, value]) => `
      <p style="margin:8px 0">${icon} <strong>${label} :</strong> ${escapeHtml(value)}</p>
    `).join('')

    return {
      subject: `Nouveau rendez-vous BTK easy – ${input.reference}`,
      text: [
        `Bonjour ${input.chargeName},`,
        '',
        `Un nouveau rendez-vous vient de vous être attribué avec le client ${input.customerName}.`,
        '',
        detailText,
        '',
        calendarMessage,
        '',
        'Merci de prendre en compte ce nouveau rendez-vous.',
        '',
        'Cordialement,',
        'BTK easy',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;color:#003a66;line-height:1.7">
          <p>Bonjour <strong>${escapeHtml(input.chargeName)}</strong>,</p>
          <p>Un nouveau rendez-vous vient de vous être attribué avec le client <strong>${escapeHtml(input.customerName)}</strong>.</p>
          <div style="margin:20px 0">${detailHtml}</div>
          <p>${calendarMessage}</p>
          <p>Merci de prendre en compte ce nouveau rendez-vous.</p>
          <p>Cordialement,<br>BTK easy</p>
        </div>
      `,
    }
  }

  const action = 'a été annulé'
  const calendarMessage = calendarInvite
    ? 'Cette invitation met à jour votre calendrier Outlook et retire ce rendez-vous.'
    : 'La mise à jour du calendrier a été effectuée automatiquement dans Outlook.'
  const message = [
    `Bonjour ${input.chargeName},`,
    `Le rendez-vous ${input.reference} avec ${input.customerName} ${action}.`,
    `Date : ${bookingDate}`,
    `Agence : ${input.agencyName}`,
    input.subject ? `Objet : ${input.subject}` : '',
    calendarMessage,
  ].filter(Boolean).join('\n')

  return {
    subject: `BTK Easy - RDV annulé (${input.reference})`,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;color:#003a66;line-height:1.7">
        <p>Bonjour <strong>${escapeHtml(input.chargeName)}</strong>,</p>
        <p>Le rendez-vous <strong>${escapeHtml(input.reference)}</strong> avec
          <strong>${escapeHtml(input.customerName)}</strong> ${action}.</p>
        <p>📅 ${escapeHtml(bookingDate)} à ${escapeHtml(input.agencyName)}</p>
        ${input.subject ? `<p>Objet : ${escapeHtml(input.subject)}</p>` : ''}
        <p>${calendarMessage}</p>
      </div>
    `,
  }
}

export async function sendChargeAppointmentEmail(
  input: ChargeAppointmentMailInput,
  kind: 'confirmation' | 'cancellation',
  options: { calendarInvite?: boolean } = {},
): Promise<MailResult> {
  const recipient = input.chargeEmail?.trim()
  if (!recipient) return { sent: false, reason: 'missing_recipient' }

  const host = process.env.MAIL_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.MAIL_PORT) || 1025
  const user = process.env.MAIL_USER?.trim()
  const pass = process.env.MAIL_PASSWORD?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'BTK Easy <rdv@btk.local>'
  const calendarInvite = options.calendarInvite ?? false
  const template = createChargeAppointmentEmailTemplate(input, kind, calendarInvite)
  const calendarMethod = kind === 'cancellation' ? 'CANCEL' : 'REQUEST'

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.MAIL_SECURE === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
    auth: user && pass ? { user, pass } : undefined,
  })

  try {
    await transporter.sendMail({
      from,
      to: recipient,
      ...template,
      alternatives: calendarInvite ? [{
        contentType: `text/calendar; method=${calendarMethod}; charset=utf-8`,
        content: createAppointmentCalendarEvent(input, calendarMethod),
      }] : undefined,
    })
    return { sent: true }
  } catch (error) {
    console.error(`Charge appointment ${kind} email failed:`, error)
    return { sent: false, reason: 'provider_error' }
  }
}

export async function sendAppointmentConfirmationEmail(input: AppointmentMailInput): Promise<MailResult> {
  const host = process.env.MAIL_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.MAIL_PORT) || 1025
  const user = process.env.MAIL_USER?.trim()
  const pass = process.env.MAIL_PASSWORD?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'BTK Easy <rdv@btk.local>'
  const bookingDate = formatBookingDate(input.date, input.time)
  const message = [
    `Bonjour ${input.customerName}, votre réservation avec ${input.chargeName} est confirmée ✅`,
    `📅 ${bookingDate} à ${input.agencyName}`,
    `🔑 Code : ${input.reference}, Pour toute annulation : ${input.cancellationUrl}`,
  ].join('\n')

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.MAIL_SECURE === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
    auth: user && pass ? { user, pass } : undefined,
  })

  try {
    await transporter.sendMail({
      from,
      to: mailCatcherRecipient(input.customerPhone),
      subject: `BTK Easy - Confirmation RDV (${input.reference})`,
      text: message,
      html: `
        <div style="font-family:Arial,sans-serif;color:#003a66;line-height:1.7">
          <p>Bonjour <strong>${escapeHtml(input.customerName)}</strong>, votre réservation avec <strong>${escapeHtml(input.chargeName)}</strong> est confirmée ✅</p>
          <p>📅 ${escapeHtml(bookingDate)} à ${escapeHtml(input.agencyName)}</p>
          <p>🔑 Code : <strong>${escapeHtml(input.reference)}</strong>, Pour toute annulation : <a href="${escapeHtml(input.cancellationUrl)}" style="color:#0065a1">${escapeHtml(input.cancellationUrl)}</a></p>
        </div>
      `,
    })
    return { sent: true }
  } catch (error) {
    console.error('Appointment confirmation email failed:', error)
    return { sent: false, reason: 'provider_error' }
  }
}

export async function sendTicketWaitNotification(input: {
  customerPhone: string
  ticketNumber: number
  currentTicketNumber: number | null
  estimatedWaitMinutes: number
  agencyName: string
}): Promise<MailResult> {
  const host = process.env.MAIL_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.MAIL_PORT) || 1025
  const user = process.env.MAIL_USER?.trim()
  const pass = process.env.MAIL_PASSWORD?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'BTK Easy <rdv@btk.local>'
  const minutes = Math.max(0, Math.round(input.estimatedWaitMinutes))
  const message = [
    `Bonjour, votre ticket n°${input.ticketNumber} est bien enregistré ✅`,
    `🎫 Ticket actuellement servi : n°${input.currentTicketNumber ?? '-'}`,
    `⏱ Temps d'attente estimé : environ ${minutes} min`,
    `Merci de vous présenter à l'agence BTK ${input.agencyName} quelques minutes avant votre tour.`,
  ].join('\n')

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.MAIL_SECURE === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',
    auth: user && pass ? { user, pass } : undefined,
  })

  try {
    await transporter.sendMail({
      from,
      to: mailCatcherRecipient(input.customerPhone),
      subject: `BTK Easy - Ticket n°${input.ticketNumber}`,
      text: message,
      html: `
        <div style="font-family:Arial,sans-serif;color:#003a66;line-height:1.7">
          <p>Bonjour, votre ticket <strong>n°${input.ticketNumber}</strong> est bien enregistré ✅</p>
          <p>🎫 Ticket actuellement servi : <strong>n°${input.currentTicketNumber ?? '-'}</strong></p>
          <p>⏱ Temps d'attente estimé : environ <strong>${minutes} min</strong></p>
          <p>Merci de vous présenter à l'agence BTK ${escapeHtml(input.agencyName)} quelques minutes avant votre tour.</p>
        </div>
      `,
    })
    return { sent: true }
  } catch (error) {
    console.error('Ticket notification email failed:', error)
    return { sent: false, reason: 'provider_error' }
  }
}
