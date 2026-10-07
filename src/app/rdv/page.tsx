'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatInternationalPhone } from '@/lib/phone-countries'
import { PhoneCountrySelect } from '@/components/shared/PhoneCountrySelect'

type Agency = {
  id: number
  code: string
  name: string
  city: string
  address?: string | null
  isActive?: boolean
}

type Charge = {
  id: number
  code: string
  name: string
  agencyId: number
  agencyCode: string
  agencyName: string
  city: string
  isActive: boolean
  appointmentCount?: number
}

type Slot = {
  time: string
  available: boolean
  reason?: string
  reasonCode?: 'BOOKED' | 'PAST' | 'BLOCKED' | 'CLOSED'
}

type AvailabilityResponse = {
  date: string
  available: boolean
  weekend?: boolean
  holiday?: { date: string; label: string | null } | null
  serviceWindow?: {
    mode: string
    label: string
    startTime: string
    endTime: string
  }
  slots: Slot[]
}

type AppointmentResult = {
  appointment: {
    reference: string
    date: string
    time: string
    customerName: string
    customerPhone: string
    subject: string | null
  }
  charge: Charge
}

type CancellationAppointment = {
  customerName: string
  chargeName: string
  date: string
  time: string
}

type Step = 'agency' | 'charge' | 'calendar' | 'confirmed'

const stepItems: { key: Step; label: string }[] = [
  { key: 'agency', label: 'Agence' },
  { key: 'charge', label: 'Chargé' },
  { key: 'calendar', label: 'Calendrier' },
  { key: 'confirmed', label: 'RDV' },
]

function todayInputDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00Z`))
}

export default function RendezVousPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayInputDate())
  const [selectedTime, setSelectedTime] = useState('')
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null)
  const [step, setStep] = useState<Step>('agency')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [cancelCode, setCancelCode] = useState('')
  const [cancelNotice, setCancelNotice] = useState('')
  const [cancelNoticeTone, setCancelNoticeTone] = useState<'success' | 'error'>('success')
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancellationAppointment, setCancellationAppointment] = useState<CancellationAppointment | null>(null)
  const [cancelLookupLoading, setCancelLookupLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [phoneCountryCode, setPhoneCountryCode] = useState('TN')
  const [result, setResult] = useState<AppointmentResult | null>(null)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    subject: '',
  })

  useEffect(() => {
    fetch('/api/agency', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setAgencies(Array.isArray(data) ? data.filter((agency: Agency) => agency.isActive !== false) : []))
      .catch(() => setAgencies([]))
  }, [])

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('cancel')?.trim().toUpperCase() ?? ''
    if (/^[A-Z0-9]{5}$/.test(code)) {
      void openCancellationConfirmation(code)
    }
  }, [])

  const fetchCharges = useCallback(async (agencyId: number) => {
    setLoading(true)
    setNotice('')
    try {
      const res = await fetch(`/api/charges?agencyId=${agencyId}`, { cache: 'no-store' })
      const data = await res.json()
      setCharges(Array.isArray(data) ? data : [])
    } catch {
      setCharges([])
      setNotice('Impossible de charger les charges de cette agence.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAvailability = useCallback(async (chargeId: number, date: string) => {
    setLoading(true)
    setNotice('')
    setAvailability(null)
    setSelectedTime('')
    try {
      const res = await fetch(`/api/charges/${chargeId}/availability?date=${date}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Calendrier indisponible')
      setAvailability(data)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Calendrier indisponible.')
    } finally {
      setLoading(false)
    }
  }, [])

  const filteredAgencies = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return agencies
    return agencies.filter(agency => `${agency.code} ${agency.name} ${agency.city}`.toLowerCase().includes(value))
  }, [agencies, search])

  const canSubmit = Boolean(
    selectedAgency &&
    selectedCharge &&
    selectedDate &&
    selectedTime &&
    form.customerName.trim() &&
    form.customerPhone.trim(),
  )

  async function chooseAgency(agency: Agency) {
    setSelectedAgency(agency)
    setSelectedCharge(null)
    setSelectedTime('')
    setAvailability(null)
    setStep('charge')
    await fetchCharges(agency.id)
  }

  async function chooseCharge(charge: Charge) {
    setSelectedCharge(charge)
    setStep('calendar')
    await fetchAvailability(charge.id, selectedDate)
  }

  async function submitAppointment() {
    if (!canSubmit || !selectedCharge) return
    setLoading(true)
    setNotice('')

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId: selectedCharge.id,
          date: selectedDate,
          time: selectedTime,
          ...form,
          customerPhone: formatInternationalPhone(phoneCountryCode, form.customerPhone),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Reservation impossible')
      setResult(data)
      setStep('confirmed')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Reservation impossible.')
      if (selectedCharge) await fetchAvailability(selectedCharge.id, selectedDate)
    } finally {
      setLoading(false)
    }
  }

  async function openCancellationConfirmation(code: string) {
    setCancelNotice('')
    setCancelLookupLoading(true)
    try {
      const res = await fetch(`/api/appointments?reference=${encodeURIComponent(code)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rendez-vous introuvable')

      setCancelCode(code)
      setCancellationAppointment({
        customerName: data.appointment.customerName || '',
        chargeName: data.appointment.chargeName || 'votre chargé',
        date: data.appointment.date,
        time: data.appointment.time,
      })
      setCancelConfirmOpen(true)
    } catch (error) {
      setCancelNoticeTone('error')
      setCancelNotice(error instanceof Error ? error.message : 'Rendez-vous introuvable.')
    } finally {
      setCancelLookupLoading(false)
    }
  }

  async function requestCancelAppointment() {
    const code = cancelCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      setCancelNoticeTone('error')
      setCancelNotice('Saisissez un code RDV valide de 5 caractères.')
      return
    }

    await openCancellationConfirmation(code)
  }

  async function cancelAppointmentByCode() {
    const code = cancelCode.trim().toUpperCase()
    setCancelLoading(true)
    setCancelNotice('')

    try {
      const res = await fetch('/api/appointments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Annulation impossible')

      setCancelNoticeTone('success')
      setCancelNotice('Rendez-vous annulé.')
      setCancelCode('')
      setCancellationAppointment(null)
      setCancelConfirmOpen(false)

      if (selectedCharge) {
        await fetchAvailability(selectedCharge.id, selectedDate)
      }

      if (result?.appointment.reference.toUpperCase() === code) {
        setResult(null)
        setSelectedAgency(null)
        setSelectedCharge(null)
        setSelectedDate(todayInputDate())
        setSelectedTime('')
        setAvailability(null)
        setCharges([])
        setForm({ customerName: '', customerPhone: '', customerEmail: '', subject: '' })
        setStep('agency')
      }
    } catch (error) {
      setCancelNoticeTone('error')
      setCancelNotice(error instanceof Error ? error.message : 'Annulation impossible.')
    } finally {
      setCancelLoading(false)
    }
  }

  function resetFlow() {
    setSelectedAgency(null)
    setSelectedCharge(null)
    setSelectedDate(todayInputDate())
    setSelectedTime('')
    setAvailability(null)
    setCharges([])
    setNotice('')
    setCancelNotice('')
    setResult(null)
    setForm({ customerName: '', customerPhone: '', customerEmail: '', subject: '' })
    setStep('agency')
  }

  async function downloadAppointmentPdf() {
    if (!result) return

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const appointment = result.appointment
      const dateLabel = formatDate(appointment.date)
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 16
      const contentWidth = pageWidth - margin * 2
      const generatedAt = new Intl.DateTimeFormat('fr-TN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Tunis',
      }).format(new Date())
      let logoData = ''

      try {
        const logoResponse = await fetch('/BTK.png')
        const logoBlob = await logoResponse.blob()
        logoData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = reject
          reader.readAsDataURL(logoBlob)
        })
      } catch {
        // Le PDF reste disponible même si le logo ne peut pas être chargé.
      }

      const drawInfoRow = (label: string, value: string, top: number) => {
        const valueLines = doc.splitTextToSize(value || '-', 112)
        const height = Math.max(15, 7 + valueLines.length * 4.7)

        doc.setFillColor(244, 251, 255)
        doc.setDrawColor(219, 234, 248)
        doc.roundedRect(margin, top, contentWidth, height, 2.5, 2.5, 'FD')
        doc.setTextColor(0, 101, 161)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(label.toUpperCase(), margin + 5, top + 6.3)
        doc.setTextColor(0, 58, 102)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10.5)
        doc.text(valueLines, margin + 57, top + 6.3)
        return top + height + 3
      }

      doc.setFillColor(0, 101, 161)
      doc.rect(0, 0, pageWidth, 42, 'F')
      doc.setFillColor(0, 58, 102)
      doc.rect(pageWidth - 48, 0, 48, 42, 'F')
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 8, 22, 22, 3, 3, 'F')
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin + 3, 11, 16, 16)
      }
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(17)
      doc.text('BTK Easy', margin + 28, 17)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text('Service de rendez-vous', margin + 28, 24)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('CONFIRMATION', pageWidth - margin, 18, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Document personnel', pageWidth - margin, 23, { align: 'right' })

      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(219, 234, 248)
      doc.roundedRect(margin, 51, contentWidth, 35, 4, 4, 'FD')
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('CODE RENDEZ-VOUS', margin + 7, 61)
      doc.setTextColor(0, 58, 102)
      doc.setFontSize(22)
      doc.text(appointment.reference, margin + 7, 74)
      doc.setTextColor(0, 101, 161)
      doc.setFontSize(9)
      doc.text('DATE ET HEURE', pageWidth - margin - 7, 61, { align: 'right' })
      doc.setTextColor(0, 58, 102)
      doc.setFontSize(12)
      doc.text(appointment.time, pageWidth - margin - 7, 72, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.text(dateLabel, pageWidth - margin - 7, 78, { align: 'right' })

      doc.setTextColor(0, 58, 102)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('Les détails de votre rendez-vous', margin, 100)

      let rowTop = 107
      rowTop = drawInfoRow('Agence', result.charge.agencyName, rowTop)
      rowTop = drawInfoRow('Chargé', result.charge.name, rowTop)
      rowTop = drawInfoRow('Date', dateLabel, rowTop)
      rowTop = drawInfoRow('Heure', appointment.time, rowTop)
      rowTop = drawInfoRow('Client', appointment.customerName, rowTop)
      rowTop = drawInfoRow('Téléphone', appointment.customerPhone, rowTop)
      rowTop = drawInfoRow('Objet', appointment.subject || 'Non précisé', rowTop)

      doc.setFillColor(234, 245, 255)
      doc.setDrawColor(219, 234, 248)
      doc.roundedRect(margin, rowTop + 2, contentWidth, 27, 3, 3, 'FD')
      doc.setTextColor(0, 101, 161)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('À RETENIR', margin + 6, rowTop + 10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      doc.setFontSize(9)
      const reminderX = margin + 6
      const reminderY = rowTop + 16
      doc.text('Présentez-vous quelques minutes avant l’heure prévue.', reminderX, reminderY)
      doc.setTextColor(220, 38, 38)
      doc.text('Conservez votre ', reminderX, reminderY + 7)
      const codeX = reminderX + doc.getTextWidth('Conservez votre ')
      doc.setFont('helvetica', 'bold')
      doc.text('code RDV', codeX, reminderY + 7)
      const endCodeX = codeX + doc.getTextWidth('code RDV')
      doc.setFont('helvetica', 'normal')
      doc.text(' : il est nécessaire pour annuler votre rendez-vous.', endCodeX, reminderY + 7)

      doc.setDrawColor(219, 234, 248)
      doc.line(margin, pageHeight - 21, pageWidth - margin, pageHeight - 21)
      doc.setTextColor(100, 116, 139)
      doc.setFontSize(8)
      doc.text('Document généré automatiquement par BTK Easy.', margin, pageHeight - 14)
      doc.text(`Généré le ${generatedAt}`, pageWidth - margin, pageHeight - 14, { align: 'right' })
      doc.save(`rdv-${appointment.reference}.pdf`)
    } catch {
      setNotice('Impossible de generer le PDF du rendez-vous.')
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-br from-white via-[#edf7ff] to-[#d8ebff]">
      <header className="border-b border-[#dbeaf8] bg-white/95 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.09)] backdrop-blur">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src="/BTK.png" alt="BTK" className="h-11 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="text-lg font-black leading-tight text-[#003a66]">BTK Easy</div>
              <div className="truncate text-xs font-semibold text-slate-500">Prise de rendez-vous</div>
            </div>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
          >
            Accueil
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1760px] overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="mb-5 grid gap-6 rounded-[32px] border border-[#dbeaf8] bg-white/95 p-5 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,560px)] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#0065a1]">Rendez-vous avec un chargé</p>
              <h1 className="mt-2 text-3xl font-black text-[#003a66] lg:text-4xl">Prendre un rendez-vous</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                Choisissez une agence, un chargé, puis réservez un créneau disponible dans son calendrier.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stepItems.map((item, index) => {
                const active = item.key === step
                return (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.14em] transition ${
                      active ? 'border-btk-blue bg-btk-blue text-white shadow-sm' : 'border-blue-100 bg-slate-50 text-gray-500'
                    }`}
                  >
                    <div className={`mb-1 text-[10px] ${active ? 'text-blue-100' : 'text-gray-400'}`}>Etape {index + 1}</div>
                    <div>{item.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

        <section className="mb-5 rounded-[28px] border border-[#dbeaf8] bg-white/95 p-4 shadow-[0_20px_50px_-36px_rgba(0,101,161,0.18)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_160px] lg:items-end">
            <div>
              <h2 className="text-lg font-black text-gray-950">Annulation RDV</h2>
              <p className="mt-1 text-sm text-gray-500">
                Entrez le code RDV de 5 caractères, puis confirmez l'annulation.
              </p>
            </div>
            <label className="block text-xs font-black uppercase text-gray-400">
              Code RDV
              <input
                className="btk-input mt-2 text-center font-black uppercase tracking-[0.24em]"
                maxLength={5}
                placeholder="A1B2C"
                value={cancelCode}
                onChange={event => setCancelCode(event.target.value.replace(/\s/g, '').toUpperCase().slice(0, 5))}
              />
            </label>
            <button
              type="button"
              onClick={requestCancelAppointment}
              disabled={cancelLoading || cancelLookupLoading}
              className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
            >
              {cancelLookupLoading ? 'Vérification...' : 'Annuler RDV'}
            </button>
          </div>
          {cancelNotice && (
            <div className={`mt-3 rounded-lg px-4 py-3 text-sm font-bold ring-1 ${
              cancelNoticeTone === 'success'
                ? 'bg-green-50 text-green-700 ring-green-100'
                : 'bg-red-50 text-red-700 ring-red-100'
            }`}>
              {cancelNotice}
            </div>
          )}
        </section>

        {notice && (
          <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-100">
            {notice}
          </div>
        )}

        {step === 'agency' && (
          <section className="grid gap-5 lg:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
            <aside className="rounded-[28px] border border-[#dbeaf8] bg-white/95 p-5 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] lg:sticky lg:top-6 lg:self-start">
              <h2 className="text-xl font-black text-gray-950">Choisir l'agence</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                La liste affiche les agences actives. La disponibilité dépend ensuite du chargé choisi.
              </p>
              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-black uppercase text-gray-400">Recherche</span>
                <input
                  className="btk-input"
                  placeholder="Nom, ville ou code agence"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </label>
            </aside>

            {filteredAgencies.length === 0 ? (
              <div className="rounded-lg bg-white p-10 text-center text-sm font-semibold text-gray-400 shadow-sm ring-1 ring-blue-100">
                Aucune agence trouvée.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredAgencies.map(agency => (
                  <button
                    key={agency.id}
                    type="button"
                    onClick={() => chooseAgency(agency)}
                    className="group rounded-2xl border border-[#dbeaf8] bg-white/95 p-5 text-left shadow-[0_20px_50px_-36px_rgba(0,101,161,0.2)] transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e4f2ff] text-sm font-black text-[#0065a1]">
                        {agency.code}
                      </span>
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700 ring-1 ring-green-200">
                        Active
                      </span>
                    </div>
                    <div className="text-lg font-black text-[#003a66] group-hover:text-[#0065a1]">{agency.name}</div>
                    <div className="mt-1 text-sm font-medium text-gray-500">{agency.address || agency.city}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 'charge' && selectedAgency && (
          <section className="grid gap-5 lg:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
            <aside className="rounded-[28px] border border-[#dbeaf8] bg-white/95 p-5 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] lg:sticky lg:top-6 lg:self-start">
              <button
                type="button"
                onClick={() => setStep('agency')}
                className="mb-5 rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-black text-btk-blue transition hover:bg-blue-50"
              >
                Retour agences
              </button>
              <p className="text-xs font-black uppercase text-btk-blue">Agence sélectionnée</p>
              <h2 className="mt-2 text-xl font-black text-gray-950">{selectedAgency.name}</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">{selectedAgency.code} - {selectedAgency.city}</p>
            </aside>

            <div className="rounded-[28px] border border-[#dbeaf8] bg-white/95 p-5 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)]">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-950">Choisir un chargé</h2>
                  <p className="mt-1 text-sm font-medium text-gray-500">Sélectionnez votre conseiller pour voir son calendrier.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-btk-blue ring-1 ring-blue-100">
                  {charges.length}
                </span>
              </div>

              {loading ? (
                <div className="rounded-lg bg-gray-50 p-10 text-center text-sm font-semibold text-gray-400">Chargement...</div>
              ) : charges.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-10 text-center text-sm font-semibold text-gray-400">
                  Aucun chargé configuré pour cette agence.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {charges.map(charge => (
                    <button
                      key={charge.id}
                      type="button"
                      onClick={() => chooseCharge(charge)}
                      className="rounded-2xl border border-[#dbeaf8] bg-white p-4 text-left transition hover:border-[#0065a1] hover:bg-[#f4fbff]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-black text-btk-blue">{charge.code}</span>
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-black text-green-700 ring-1 ring-green-100">
                          Disponible
                        </span>
                      </div>
                      <div className="mt-4 text-lg font-black text-gray-950">{charge.name}</div>
                      <div className="mt-1 text-sm font-medium text-gray-500">{charge.agencyName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {step === 'calendar' && selectedAgency && selectedCharge && (
          <section className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-[24px] border border-[#dbeaf8] bg-white/95 p-4 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] sm:rounded-[28px] sm:p-5 xl:sticky xl:top-6 xl:self-start">
              <button
                type="button"
                onClick={() => setStep('charge')}
                className="mb-4 inline-flex max-w-full items-center gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm font-black text-btk-blue transition hover:bg-blue-50"
              >
                ← Retour charges
              </button>

              <div className="rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-4 sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-btk-blue">Votre chargé</p>
                <h2 className="mt-3 break-words text-xl font-black text-gray-950 sm:text-2xl">{selectedCharge.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{selectedAgency.name}</p>
                <p className="mt-2 text-sm text-gray-500">Sélectionnez la date souhaitée pour afficher les créneaux possibles.</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={() => {
                    const today = todayInputDate()
                    setSelectedDate(today)
                    fetchAvailability(selectedCharge.id, today)
                  }}
                  className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-50"
                >
                  Aujourd'hui
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = addDays(todayInputDate(), 1)
                    setSelectedDate(tomorrow)
                    fetchAvailability(selectedCharge.id, tomorrow)
                  }}
                  className="rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-50"
                >
                  Demain
                </button>
              </div>

              <label className="mt-6 block">
                <span className="mb-2 block text-xs font-black uppercase text-gray-400">Date</span>
                <input
                  type="date"
                  className="btk-input w-full"
                  min={todayInputDate()}
                  value={selectedDate}
                  onChange={event => {
                    setSelectedDate(event.target.value)
                    fetchAvailability(selectedCharge.id, event.target.value)
                  }}
                />
              </label>
            </aside>

            <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="min-w-0 rounded-[24px] border border-[#dbeaf8] bg-white/95 p-4 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] sm:rounded-[28px] sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-950 sm:text-2xl">Calendrier</h2>
                    <p className="mt-2 text-sm text-gray-500">{formatDate(selectedDate)}</p>
                    {availability?.serviceWindow && (
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-btk-blue">
                        Horaires agence : {availability.serviceWindow.label} {availability.serviceWindow.startTime}-{availability.serviceWindow.endTime}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availability?.holiday || availability?.weekend ? (
                      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700 ring-1 ring-red-100">
                        Non disponible
                      </span>
                    ) : availability?.available ? (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-green-700 ring-1 ring-green-100">
                        Disponible
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-yellow-700 ring-1 ring-yellow-100">
                        Non disponible
                      </span>
                    )}
                  </div>
                </div>

                {loading && !availability ? (
                  <div className="rounded-lg bg-gray-50 p-10 text-center text-sm font-semibold text-gray-400">Chargement du calendrier...</div>
                ) : !availability || availability.holiday || availability.weekend || availability.slots.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 p-10 text-center text-sm font-semibold text-gray-400">
                    Aucun créneau disponible pour cette date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-5">
                    {availability.slots.map(slot => {
                      const active = selectedTime === slot.time
                      const reasonText = (slot.reason ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                      const reserved = slot.reasonCode === 'BOOKED' || reasonText.includes('reserv')
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`min-w-0 rounded-xl border px-3 py-3 text-left text-sm font-black transition sm:rounded-lg sm:px-4 sm:py-4 ${
                            active
                              ? 'border-btk-blue bg-btk-blue text-white shadow-sm'
                              : slot.available
                                ? 'border-blue-100 bg-white text-btk-blue hover:border-btk-blue hover:bg-blue-50'
                                : reserved
                                  ? 'cursor-not-allowed border-red-100 bg-red-50/70 text-red-700'
                                  : 'cursor-not-allowed border-slate-100 bg-slate-50 text-gray-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-base sm:text-lg">{slot.time}</span>
                            <span className={`max-w-[62px] truncate rounded-full px-1.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] sm:max-w-none sm:px-2 sm:text-[10px] sm:tracking-[0.18em] ${
                              slot.available
                                ? 'bg-green-50 text-green-700'
                                : reserved
                                  ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
                                  : 'bg-gray-200 text-gray-500'
                            }`}>
                              {slot.available ? 'Libre' : slot.reason ? slot.reason : 'Occupé'}
                            </span>
                          </div>
                          <p className={`mt-2 hidden text-xs font-medium sm:mt-3 sm:block ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                            Cliquez pour sélectionner ce créneau.
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <aside className="min-w-0 rounded-[24px] border border-[#dbeaf8] bg-white/95 p-4 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] sm:rounded-[28px] sm:p-5 xl:sticky xl:top-6 xl:self-start">
                <h2 className="text-xl font-black text-gray-950">Vos informations</h2>
                <div className="mt-4 space-y-3">
                  <input
                    className="btk-input"
                    placeholder="Nom et prénom"
                    value={form.customerName}
                    onChange={event => setForm(prev => ({ ...prev, customerName: event.target.value }))}
                  />
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#0065a1]">Numéro de téléphone</span>
                    <div className="flex rounded-xl border border-slate-200 bg-white focus-within:border-[#0065a1] focus-within:ring-2 focus-within:ring-[#e4f2ff]">
                      <PhoneCountrySelect value={phoneCountryCode} onChange={setPhoneCountryCode} className="w-[142px] shrink-0 border-r border-slate-200 sm:w-[180px]" />
                      <input
                        type="tel"
                        inputMode="tel"
                        className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-semibold text-[#003a66] outline-none"
                        placeholder="Numéro de téléphone"
                        value={form.customerPhone}
                        onChange={event => setForm(prev => ({ ...prev, customerPhone: event.target.value }))}
                      />
                    </div>
                  </label>
                  <input
                    className="btk-input"
                    type="email"
                    placeholder="Email optionnel"
                    value={form.customerEmail}
                    onChange={event => setForm(prev => ({ ...prev, customerEmail: event.target.value }))}
                  />
                  <textarea
                    className="btk-input min-h-24 resize-none"
                    placeholder="Objet du rendez-vous optionnel"
                    value={form.subject}
                    onChange={event => setForm(prev => ({ ...prev, subject: event.target.value }))}
                  />
                </div>

                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-btk-blue ring-1 ring-blue-100">
                  {selectedTime ? `Créneau choisi : ${selectedDate} à ${selectedTime}` : 'Choisissez un créneau disponible.'}
                </div>

                <button
                  type="button"
                  onClick={submitAppointment}
                  disabled={!canSubmit || loading}
                  className="mt-4 w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? 'Réservation...' : 'Confirmer le RDV'}
                </button>
              </aside>
            </div>
          </section>
        )}

        {step === 'confirmed' && result && (
          <section className="mx-auto max-w-xl rounded-[32px] border border-[#dbeaf8] bg-white/95 p-6 text-center shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-green-50 text-lg font-black text-green-700 ring-1 ring-green-100">
              OK
            </div>
            <p className="mt-5 text-sm font-black uppercase text-btk-blue">Rendez-vous confirmé</p>
            <h2 className="mt-2 font-mono text-3xl font-black tracking-[0.24em] text-gray-950">{result.appointment.reference}</h2>
            <p className="mt-2 text-sm font-semibold text-gray-500">Conservez ce code de 5 caractères pour annuler le rendez-vous.</p>
            <div className="mt-5 divide-y divide-blue-50 rounded-lg border border-blue-50 text-left">
              <SummaryRow label="Agence" value={result.charge.agencyName} />
              <SummaryRow label="Chargé" value={result.charge.name} />
              <SummaryRow label="Date" value={formatDate(result.appointment.date)} />
              <SummaryRow label="Heure" value={result.appointment.time} />
              <SummaryRow label="Client" value={result.appointment.customerName} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={resetFlow}
                className="rounded-lg border border-blue-100 px-5 py-3 font-black text-btk-blue transition hover:bg-blue-50"
              >
                Nouveau RDV
              </button>
              <button
                type="button"
                onClick={downloadAppointmentPdf}
                className="rounded-lg border border-green-100 bg-green-50 px-5 py-3 font-black text-green-700 transition hover:bg-green-100"
              >
                📥 PDF
              </button>
              <Link
                href="/"
                className="rounded-lg bg-btk-blue px-5 py-3 font-black text-white transition hover:bg-btk-dark"
              >
                Retour accueil
              </Link>
            </div>
          </section>
        )}

        {cancelConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl ring-1 ring-blue-100">
              <h2 className="text-xl font-black text-gray-950">Confirmer l'annulation</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Bonjour <span className="font-black text-gray-950">{cancellationAppointment?.customerName}</span>, souhaitez-vous annuler le rendez-vous avec{' '}
                <span className="font-black text-gray-950">{cancellationAppointment?.chargeName}</span>, prévu le{' '}
                <span className="font-black text-gray-950">{cancellationAppointment ? `${formatDate(cancellationAppointment.date)} à ${cancellationAppointment.time}` : ''}</span>, Code{' '}
                <span className="font-black tracking-[0.15em] text-gray-950">{cancelCode}</span> ?
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelConfirmOpen(false)
                    setCancellationAppointment(null)
                  }}
                  disabled={cancelLoading}
                  className="rounded-lg border border-blue-100 px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={cancelAppointmentByCode}
                  disabled={cancelLoading}
                  className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200"
                >
                  {cancelLoading ? 'Annulation...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3 text-sm">
      <span className="font-bold text-gray-400">{label}</span>
      <span className="min-w-0 font-black text-gray-800">{value}</span>
    </div>
  )
}
