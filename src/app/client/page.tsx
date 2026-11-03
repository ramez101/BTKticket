'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAgencySocket } from '@/hooks/useSocket'
import { SERVICES } from '@/types'
import { formatInternationalPhone } from '@/lib/phone-countries'
import { PhoneCountrySelect } from '@/components/shared/PhoneCountrySelect'
import BTKHeader from '@/components/shared/BTKHeader'

interface Agency {
  id: number
  code: string
  name: string
  city: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  waitingCount: number
  estimatedWait: number
  currentCalled: number
  isActive?: boolean
}

interface Ticket {
  id: number
  number: number
  label: string
  service: string
  agencyName: string
  qrCode: string
  createdAt: string
  waitingCount: number
  estimatedWait: number
}

type Step = 'select' | 'service' | 'ticket'
type Coordinates = { latitude: number; longitude: number }
type TicketMode = 'guest' | 'phone'

/* const LEGACY_PHONE_COUNTRIES = [
  { code: 'TN', name: 'Tunisie', dial: '+216', placeholder: '22 123 456' },
  { code: 'FR', name: 'France', dial: '+33', placeholder: '6 12 34 56 78' },
  { code: 'DZ', name: 'Algérie', dial: '+213', placeholder: '5 12 34 56 78' },
  { code: 'MA', name: 'Maroc', dial: '+212', placeholder: '6 12 34 56 78' },
  { code: 'IT', name: 'Italie', dial: '+39', placeholder: '312 345 6789' },
]

*/
const stepItems: { key: Step; label: string }[] = [
  { key: 'select', label: 'Agence' },
  { key: 'service', label: 'Service' },
  { key: 'ticket', label: 'Ticket' },
]

const AGENCIES_PER_PAGE = 5
const AGENCY_REFRESH_INTERVAL_MS = 15000

function hasLocation(agency?: Pick<Agency, 'latitude' | 'longitude'> | null) {
  return typeof agency?.latitude === 'number' && typeof agency?.longitude === 'number'
}

function getDistanceKm(from: Coordinates, agency: Pick<Agency, 'latitude' | 'longitude'>) {
  if (!hasLocation(agency)) return null

  const earthRadiusKm = 6371
  const toRadians = (value: number) => value * Math.PI / 180
  const dLat = toRadians(agency.latitude! - from.latitude)
  const dLon = toRadians(agency.longitude! - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(agency.latitude!)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return ''
  return distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} m`
    : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`
}

function getMapUrl(agency?: Agency | null) {
  if (!hasLocation(agency)) return ''

  const lat = agency?.latitude
  const lon = agency?.longitude
  if (typeof lat !== 'number' || typeof lon !== 'number') return ''

  return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}&t=k&z=17&output=embed`
}

function getAgencyLoad(waitingCount: number) {
  if (waitingCount >= 20) {
    return {
      label: 'Très chargé',
      textClassName: 'text-red-700',
      dotClassName: 'bg-red-500',
    }
  }

  if (waitingCount >= 16) {
    return {
      label: 'Chargé',
      textClassName: 'text-orange-700',
      dotClassName: 'bg-orange-500',
    }
  }

  if (waitingCount >= 10) {
    return {
      label: 'Attente moyenne',
      textClassName: 'text-yellow-700',
      dotClassName: 'bg-yellow-500',
    }
  }

  return {
    label: "Peu d'attente",
    textClassName: 'text-green-700',
    dotClassName: 'bg-green-500',
  }
}

export default function ClientPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [allAgencies, setAllAgencies] = useState<Agency[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [agencyData, setAgencyData] = useState<any>(null)
  const [selectedService, setSelectedService] = useState('')
  const [ticketMode, setTicketMode] = useState<TicketMode>('guest')
  const [customerPhone, setCustomerPhone] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('TN')
  const [modeChoiceAgencyId, setModeChoiceAgencyId] = useState<number | null>(null)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [search, setSearch] = useState('')
  const [agencyPage, setAgencyPage] = useState(1)
  const [totalAgencyPages, setTotalAgencyPages] = useState(1)
  const [openStatus, setOpenStatus] = useState({ open: true, message: '' })
  const [clientLocation, setClientLocation] = useState<Coordinates | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'unsupported'>('idle')

  const refreshAgencies = useCallback(async (page: number, query: string, signal?: AbortSignal) => {
    try {
      const q = query.trim()
      const url = `/api/agency?page=${page}&limit=${AGENCIES_PER_PAGE}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url, { cache: 'no-store', signal })
      if (!res.ok) return

      const data = await res.json()
      const nextAgencies = Array.isArray(data.agencies) ? data.agencies : []
      setAgencies(nextAgencies)
      setTotalAgencyPages(data.totalCount ? Math.max(1, Math.ceil(data.totalCount / AGENCIES_PER_PAGE)) : 1)
      setAgencyData((prev: any) => {
        if (!prev?.agency) return prev

        const updatedAgency = nextAgencies.find((agency: Agency) => agency.id === prev.agency.id)
        return updatedAgency ? { ...prev, agency: { ...prev.agency, ...updatedAgency } } : prev
      })
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Erreur mise a jour agences', error)
      }
    }
  }, [])

  const refreshAllAgencies = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/agency', { cache: 'no-store', signal })
      if (!res.ok) return

      const data = await res.json()
      setAllAgencies(Array.isArray(data) ? data : [])
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Erreur liste agences', error)
      }
    }
  }, [])

  const locateClient = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      position => {
        setClientLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationStatus('ready')
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  useEffect(() => {
    const check = async () => {
      try {
        const status = await fetch('/api/service-status', { cache: 'no-store' }).then(r => r.json())
        setOpenStatus({ open: Boolean(status.open), message: status.message || 'Service indisponible' })
      } catch {
        setOpenStatus({ open: false, message: 'Service indisponible' })
      }
    }

    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refreshAgencies(agencyPage, search, controller.signal)
    const timer = setInterval(() => refreshAgencies(agencyPage, search), AGENCY_REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [refreshAgencies, agencyPage, search])

  useEffect(() => {
    const controller = new AbortController()
    refreshAllAgencies(controller.signal)
    const timer = setInterval(() => refreshAllAgencies(), AGENCY_REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [refreshAllAgencies])

  useEffect(() => {
    locateClient()
  }, [locateClient])

  useEffect(() => {
    setAgencyPage(1)
  }, [search])

  useAgencySocket(selectedId, {
    onTicketUpdate: (d) => {
      setAgencyData((prev: any) => prev ? { ...prev, agency: { ...prev.agency, ...d } } : prev)
      if (selectedId) {
        setAgencies(prev => prev.map(agency => (
          agency.id === selectedId ? { ...agency, ...d } : agency
        )))
      }
    },
  })

  function openTicketModeChoice(id: number) {
    setModeChoiceAgencyId(id)
    setTicketMode('guest')
    setCustomerPhone('')
    setPhoneCountryCode('TN')
  }

  async function continueWithAgency(id: number) {
    setSelectedId(id)
    setStep('service')
    setSelectedService('')
    setModeChoiceAgencyId(null)
    const data = await fetch(`/api/agency/${id}`).then(r => r.json())
    setAgencyData(data)
  }

  async function takeTicket() {
    if (!selectedId || !selectedService) return
    if (ticketMode === 'phone' && !customerPhone.trim()) {
      alert('Saisissez votre numéro de téléphone pour recevoir la notification.')
      return
    }
    setLoading(true)
    const notificationPhone = formatInternationalPhone(phoneCountryCode, customerPhone)

    try {
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: selectedId,
          service: selectedService,
          notificationMode: ticketMode,
          customerPhone: ticketMode === 'phone' ? notificationPhone : undefined,
        }),
      })

      if (!res.ok) {
        alert('Service ferme ou erreur de generation.')
        return
      }

      const data = await res.json()
      setTicket(data)
      setAgencyData((prev: any) => prev ? { ...prev, agency: { ...prev.agency, ...data } } : prev)
      setAgencies(prev => prev.map(agency => (
        agency.id === data.agencyId
          ? {
              ...agency,
              waitingCount: data.waitingCount,
              estimatedWait: data.estimatedWait,
            }
          : agency
      )))
      setStep('ticket')
    } finally {
      setLoading(false)
    }
  }

  function resetFlow() {
    setStep('select')
    setTicket(null)
    setSelectedService('')
    setSelectedId(null)
    setAgencyData(null)
  }

  async function downloadTicket() {
    if (!ticket) return

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [420, 640] })

    const loadImage = async (src: string) => {
      const response = await fetch(src)
      const blob = await response.blob()
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    doc.setFillColor(255, 255, 255)
    doc.roundedRect(0, 0, 420, 640, 18, 18, 'F')

    doc.setFillColor(21, 101, 192)
    doc.roundedRect(0, 0, 420, 116, 18, 18, 'F')
    doc.rect(0, 58, 420, 58, 'F')

    try {
      const logo = await loadImage('/BTK.png')
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(28, 28, 48, 48, 8, 8, 'F')
      doc.addImage(logo, 'PNG', 34, 33, 36, 36)
    } catch {}

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('BTK Easy', 92, 50)
    doc.setFontSize(15)
    doc.text(ticket.agencyName, 92, 75)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(ticket.service, 92, 96)

    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('VOTRE NUMERO', 210, 174, { align: 'center', charSpace: 3 })

    doc.setTextColor(21, 101, 192)
    doc.setFontSize(96)
    doc.text(String(ticket.number), 210, 278, { align: 'center' })

    doc.setTextColor(71, 85, 105)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${peopleAhead > 0 ? `${peopleAhead} personne(s) avant vous` : 'Vous etes le prochain'}  |  ~${ticket.estimatedWait} min`,
      210,
      322,
      { align: 'center' },
    )

    if (ticket.qrCode) {
      doc.setDrawColor(219, 234, 254)
      doc.roundedRect(132, 354, 156, 156, 8, 8, 'S')
      doc.addImage(ticket.qrCode, 'PNG', 142, 364, 136, 136)
    }

    doc.setFillColor(239, 246, 255)
    doc.roundedRect(34, 540, 352, 58, 10, 10, 'F')
    doc.setTextColor(21, 101, 192)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Presentez ce QR code ou votre numero', 210, 564, { align: 'center' })
    doc.text(`${ticket.number} a votre arrivee a l'agence.`, 210, 582, { align: 'center' })

    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Reserve le ${new Date(ticket.createdAt).toLocaleString('fr-TN', { hour12: false })}`, 210, 618, { align: 'center' })

    doc.save(`ticket-${ticket.number}.pdf`)
  }

  const currentAgencyPage = Math.min(agencyPage, totalAgencyPages)

  const selectedAgency = agencyData?.agency ?? agencies.find(a => a.id === selectedId)
  const nearestAgency = useMemo(() => {
    if (!clientLocation) return null

    return allAgencies
      .filter(agency => agency.isActive !== false && hasLocation(agency))
      .map(agency => ({
        agency,
        distanceKm: getDistanceKm(clientLocation, agency),
      }))
      .filter((item): item is { agency: Agency; distanceKm: number } => item.distanceKm !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null
  }, [allAgencies, clientLocation])

  const mapAgency = selectedAgency ?? nearestAgency?.agency ?? agencies.find(hasLocation) ?? null
  const mapUrl = getMapUrl(mapAgency)
  const currentCalled = selectedAgency?.currentCalled ?? 0
  const waitingCount = selectedAgency?.waitingCount ?? 0
  const estimatedWait = selectedAgency?.estimatedWait ?? 0
  const peopleAhead = ticket ? Math.max(0, ticket.waitingCount - 1) : 0
  const modeChoiceAgency = allAgencies.find(agency => agency.id === modeChoiceAgencyId)
    ?? agencies.find(agency => agency.id === modeChoiceAgencyId)
    ?? null
  return (
    <main className="workspace-page client-page flex min-h-[100dvh] flex-col bg-[#f2f5fa] lg:h-[100dvh] lg:overflow-hidden">
      <BTKHeader
        subtitle="Prise de ticket en ligne"
        right={(
          <div className={`inline-flex max-w-[42vw] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            openStatus.open ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${openStatus.open ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className="truncate">{openStatus.message}</span>
          </div>
        )}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col px-4 py-5 sm:px-6 lg:overflow-hidden lg:px-10 lg:py-7">
        <div className="mb-5 shrink-0 flex flex-col gap-4 pb-1 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#003a66] sm:text-4xl">Prenez votre ticket</h1>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            {stepItems.map((item, index) => {
              const active = item.key === step
              return (
                <div
                  key={item.key}
                  className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none"
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-btk-blue text-white' : 'bg-[#e5ebf4] text-slate-500'
                  }`}>
                    {index + 1}
                  </span>
                  <span className={`truncate text-sm font-semibold ${active ? 'text-[#003a66]' : 'text-slate-500'}`}>{item.label}</span>
                  {index < stepItems.length - 1 && <span className="hidden h-px w-8 bg-[#cbd7e6] sm:block" />}
                </div>
              )
            })}
          </div>
        </div>

        {step === 'select' && (
          <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col rounded-2xl border border-[#dfe7f1] bg-white p-5 shadow-sm lg:h-full">
              <div>
                <h2 className="text-lg font-black text-[#102746]">Agence la plus proche</h2>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-[#d9e5f2] bg-[#e6effa]">
                {mapUrl ? (
                  <iframe
                    title={mapAgency ? `Carte ${mapAgency.name}` : 'Carte agence'}
                    src={mapUrl}
                    className="h-48 w-full border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center px-5 text-center text-sm font-medium text-slate-500">
                    Carte indisponible pour cette agence.
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-[#d9e5f2] bg-[#f4f8fd] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Plus proche</div>
                    <div className="mt-1 truncate text-sm font-black text-[#102746]">
                      {nearestAgency?.agency.name ?? 'Position non detectee'}
                    </div>
                    <div className="mt-1 text-xs leading-4 text-slate-500">
                      {nearestAgency
                        ? nearestAgency.agency.address || nearestAgency.agency.city
                        : locationStatus === 'denied'
                          ? 'Autorisez la localisation du navigateur.'
                          : locationStatus === 'unsupported'
                            ? 'Geolocalisation non supportee par ce navigateur.'
                            : 'Cliquez pour detecter votre position.'}
                    </div>
                  </div>

                  {nearestAgency && (
                    <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">
                      {formatDistance(nearestAgency.distanceKm)}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={locateClient}
                    disabled={locationStatus === 'loading'}
                    className="rounded-lg border border-btk-blue bg-white px-3 py-2 text-xs font-bold text-btk-blue transition hover:bg-btk-bg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {locationStatus === 'loading' ? 'Localisation...' : 'Detecter ma position'}
                  </button>
                  <button
                    type="button"
                    onClick={() => nearestAgency && openTicketModeChoice(nearestAgency.agency.id)}
                    disabled={!nearestAgency}
                    className="rounded-lg bg-btk-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Choisir cette agence
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="agency-search" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Recherche
                </label>
                <input
                  id="agency-search"
                  className="btk-input rounded-lg bg-white px-3 py-2.5 text-xs"
                  placeholder="Nom, ville ou code agence"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8edf4] px-5 py-4">
                <h2 className="text-base font-black text-[#102746]">Choisir une agence</h2>
                <span className="text-right text-[11px] font-medium text-slate-500">
                  <span className="hidden sm:inline">Agences actives · attente en direct</span>
                  <span className="sm:hidden">Agences actives · direct</span>
                </span>
              </div>
              {agencies.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
                  Aucune agence trouvee.
                </div>
              ) : (
                <>
                  <div className="agency-list min-h-0 flex-1 grid auto-rows-fr gap-2 overflow-visible p-3 pr-2" aria-label="Liste des agences">
                    {agencies.map(a => {
                      const load = getAgencyLoad(a.waitingCount)
                      const distanceKm = clientLocation ? getDistanceKm(clientLocation, a) : null

                      return (
                        <button
                          key={a.id}
                          onClick={() => openTicketModeChoice(a.id)}
                          className="group grid min-h-[104px] w-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_1fr] items-start gap-x-3 gap-y-2 overflow-hidden rounded-2xl border border-[#dbeaf8] bg-white/95 p-3 text-left shadow-[0_20px_50px_-36px_rgba(0,101,161,0.2)] transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:shadow-lg lg:h-full lg:min-h-0 lg:grid-cols-[auto_minmax(0,1fr)_minmax(280px,0.75fr)_auto] lg:grid-rows-1 lg:items-center lg:gap-2.5 lg:p-2.5"
                        >
                          <div className="row-span-2 flex h-12 w-12 self-center items-center justify-center rounded-2xl bg-[#e4f2ff] text-sm font-black text-[#0065a1] lg:row-span-1 lg:h-11 lg:w-11">
                            {a.code}
                          </div>
                          <div className="min-w-0 self-center">
                            <div className="truncate text-sm font-black leading-tight text-[#102746] group-hover:text-btk-blue">{a.name}</div>
                            <div className="mt-1 flex min-w-0 items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${load.dotClassName}`} />
                              <span className={`truncate text-[11px] font-medium ${load.textClassName}`}>
                                {formatDistance(distanceKm) || a.city} · {load.label}
                              </span>
                            </div>
                          </div>

                          <div className="col-start-2 col-span-2 row-start-2 grid w-full grid-cols-3 gap-2 self-end text-[10px] lg:col-start-3 lg:col-span-1 lg:row-start-1 lg:w-auto">
                            <div className="min-w-0 lg:text-center">
                              <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">En cours</div>
                              <div className="mt-0.5 truncate text-xs font-bold text-[#102746]">{a.currentCalled > 0 ? a.currentCalled : '-'}</div>
                            </div>
                            <div className="min-w-0 lg:text-center">
                              <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Attente</div>
                              <div className="mt-0.5 truncate text-xs font-bold text-[#102746]">{a.waitingCount}</div>
                            </div>
                            <div className="min-w-0 lg:text-center">
                              <div className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Temps</div>
                              <div className="mt-0.5 truncate text-xs font-bold text-[#102746]">~{a.estimatedWait} min</div>
                            </div>
                          </div>
                          <span aria-hidden="true" className="col-start-3 row-start-1 flex h-8 w-8 self-center items-center justify-center rounded-full bg-[#102746] text-white transition group-hover:bg-btk-blue lg:col-start-4 lg:row-start-1 lg:h-9 lg:w-9">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t border-[#e8edf4] bg-[#fbfcfe] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setAgencyPage(page => Math.max(1, page - 1))}
                      disabled={currentAgencyPage === 1}
                      className="rounded-lg border border-[#d9e2ee] bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-[#f2f6fb] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <div className="text-xs font-semibold text-[#102746]">
                      Page {currentAgencyPage} / {totalAgencyPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgencyPage(page => Math.min(totalAgencyPages, page + 1))}
                      disabled={currentAgencyPage === totalAgencyPages}
                      className="rounded-lg bg-[#102746] px-4 py-2 text-xs font-semibold text-white transition hover:bg-btk-blue disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {(step === 'service' || step === 'ticket') && selectedAgency && (
          <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] lg:items-stretch">
            <aside className="flex min-h-0 flex-col rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm sm:p-5">
              <button
                onClick={() => setStep('select')}
                className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold text-btk-blue transition hover:bg-[#f1f6fc]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5m7 7-7-7 7-7" />
                </svg>
                Retour aux agences
              </button>

              <div className="border-b border-[#e8edf4] pb-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Agence sélectionnée</div>
                <h2 className="mt-1.5 text-xl font-black leading-tight text-[#102746]">{selectedAgency.name}</h2>
                <p className="mt-1.5 text-sm leading-5 text-slate-500">{selectedAgency.address || selectedAgency.city}</p>
              </div>

              <div className="mt-4 h-48 shrink-0 overflow-hidden rounded-xl border border-[#d9e5f2] bg-[#e6effa] sm:h-56 lg:min-h-[220px] lg:flex-1">
                {mapUrl ? (
                  <iframe
                    title={`Carte ${selectedAgency.name}`}
                    src={mapUrl}
                    className="h-full w-full border-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                    Carte indisponible pour cette agence.
                  </div>
                )}
              </div>

              <div className="mt-4 grid shrink-0 grid-cols-3 gap-2 text-center sm:gap-3">
                <div className="rounded-xl border border-green-100 bg-green-50/70 px-2 py-3">
                  <div className="text-xl font-black text-green-700 tabular-nums sm:text-2xl">
                    {currentCalled > 0 ? currentCalled : '-'}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-green-700/75 sm:text-xs">En cours</div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-2 py-3">
                  <div className="text-xl font-black text-btk-blue tabular-nums sm:text-2xl">{waitingCount}</div>
                  <div className="mt-1 text-[11px] font-semibold text-btk-blue/75 sm:text-xs">En attente</div>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-2 py-3">
                  <div className="text-xl font-black text-orange-600 tabular-nums sm:text-2xl">{estimatedWait}</div>
                  <div className="mt-1 text-[11px] font-semibold text-orange-600/75 sm:text-xs">Minutes</div>
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 flex-col rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm sm:p-6 lg:p-7">
              <div className="mb-5 flex shrink-0 flex-col gap-3 border-b border-[#e8edf4] pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#102746] sm:text-2xl">Choisir le service</h2>
                  <p className="mt-1.5 text-sm text-slate-500">Votre ticket sera ajouté à la file de l'agence sélectionnée.</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-[#f1f6fc] px-3 py-1.5 text-xs font-bold text-[#1565c0]">
                  {SERVICES.length} services disponibles
                </span>
              </div>

              <div className="grid content-start grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
                {SERVICES.map(s => {
                  const active = selectedService === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSelectedService(s.key)}
                      aria-pressed={active}
                      className={`group flex min-h-[76px] items-center gap-3 rounded-xl border p-3.5 text-left transition sm:min-h-[88px] sm:gap-4 sm:p-4 ${
                        active
                          ? 'border-btk-blue bg-[#f1f7fd] shadow-sm ring-1 ring-btk-blue'
                          : 'border-[#e1e9f2] bg-white hover:border-[#9fc1e5] hover:bg-[#f8fbff]'
                      }`}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black transition ${
                        active ? 'bg-btk-blue text-white' : 'bg-[#f1f4f8] text-slate-600 group-hover:bg-[#e8f1fb] group-hover:text-btk-blue'
                      }`}>
                        {s.key.slice(0, 2).toUpperCase()}
                      </span>
                      <span className={`flex-1 text-sm font-bold sm:text-base ${active ? 'text-[#0d47a1]' : 'text-[#26384d]'}`}>{s.key}</span>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                        active ? 'border-btk-blue bg-btk-blue text-white' : 'border-[#d5dfeb] text-transparent'
                      }`}>
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.26a1 1 0 0 1-1.42.004L3.29 9.17a1 1 0 0 1 1.42-1.407l4.09 4.13 6.49-6.597a1 1 0 0 1 1.414-.006Z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </button>
                  )
                })}
              </div>

              <section className="hidden mt-5 rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-4">
                <div>
                  <p className="text-sm font-black text-[#003a66]">Mode de prise de ticket</p>
                  <p className="mt-1 text-sm text-slate-500">Choisissez si vous souhaitez recevoir une notification avec votre temps d'attente estimé.</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTicketMode('guest')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      ticketMode === 'guest'
                        ? 'border-[#0065a1] bg-white text-[#0065a1] shadow-sm'
                        : 'border-[#dbeaf8] bg-white/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="block text-sm font-black">1. Mode invité</span>
                    <span className="mt-1 block text-xs font-semibold">Prendre un ticket sans notification.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketMode('phone')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      ticketMode === 'phone'
                        ? 'border-[#0065a1] bg-white text-[#0065a1] shadow-sm'
                        : 'border-[#dbeaf8] bg-white/70 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="block text-sm font-black">2. Recevoir une notification</span>
                    <span className="mt-1 block text-xs font-semibold">Saisir votre numéro de téléphone.</span>
                  </button>
                </div>

                {ticketMode === 'phone' && (
                  <label className="mt-4 block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#0065a1]">Numéro de téléphone</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      className="btk-input bg-white"
                      placeholder="Ex. 22 123 456 ou +216 22 123 456"
                      value={customerPhone}
                      onChange={event => setCustomerPhone(event.target.value)}
                    />
                  </label>
                )}
              </section>

              <button
                className="mt-5 w-full shrink-0 rounded-xl bg-btk-blue px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-btk-dark focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-[#a8c5e4] disabled:shadow-none sm:py-4 sm:text-base lg:mt-auto lg:pt-4"
                onClick={takeTicket}
                disabled={!selectedService || loading || !openStatus.open || (ticketMode === 'phone' && !customerPhone.trim())}
              >
                {loading ? 'Generation en cours...' : !openStatus.open ? 'Service ferme' : 'Prendre mon ticket'}
              </button>
            </div>
          </section>
        )}

      </div>

      {modeChoiceAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#003a66]/40 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setModeChoiceAgencyId(null)}
            aria-label="Fermer le choix du mode"
          />
          <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-[#dbeaf8] bg-white shadow-[0_40px_100px_-50px_rgba(0,101,161,0.4)]">
            <div className="border-b border-[#dbeaf8] bg-gradient-to-r from-[#f4fbff] to-white px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0065a1]">Agence sélectionnée</p>
                  <h2 className="mt-2 text-2xl font-black text-[#003a66]">{modeChoiceAgency.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Comment souhaitez-vous prendre votre ticket ?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModeChoiceAgencyId(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dbeaf8] bg-white text-lg font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setTicketMode('guest')
                    void continueWithAgency(modeChoiceAgency.id)
                  }}
                  className="rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-5 text-left text-[#003a66] transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-black text-[#0065a1] shadow-sm">1</span>
                  <span className="mt-4 block text-base font-black">Mode invité</span>
                  <span className="mt-1 block text-sm font-semibold text-slate-500">Continuez sans renseigner de numéro.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTicketMode('phone')}
                  className={`rounded-2xl border p-5 text-left transition ${
                    ticketMode === 'phone'
                      ? 'border-[#0065a1] bg-[#0065a1] text-white shadow-lg shadow-[#0065a1]/20'
                      : 'border-[#dbeaf8] bg-[#f4fbff] text-[#003a66] hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white hover:shadow-lg'
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black shadow-sm ${ticketMode === 'phone' ? 'bg-white text-[#0065a1]' : 'bg-white text-[#0065a1]'}`}>2</span>
                  <span className="mt-4 block text-base font-black">Saisir votre numéro</span>
                  <span className={`mt-1 block text-sm font-semibold ${ticketMode === 'phone' ? 'text-blue-100' : 'text-slate-500'}`}>Recevez la notification de votre ticket.</span>
                </button>
              </div>

              {ticketMode === 'phone' && (
                <div className="mt-5 rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-4 sm:p-5">
                  <label className="block text-sm font-black text-[#003a66]">
                    Numéro de téléphone
                    <div className="mt-2 flex rounded-xl border border-[#dbeaf8] bg-white focus-within:border-[#0065a1] focus-within:ring-2 focus-within:ring-[#e4f2ff]">
                      <PhoneCountrySelect value={phoneCountryCode} onChange={setPhoneCountryCode} className="w-[180px] shrink-0 border-r border-[#dbeaf8]" />
                      <input
                        type="tel"
                        inputMode="tel"
                        className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-semibold text-[#003a66] outline-none"
                        placeholder="Numéro de téléphone"
                        value={customerPhone}
                        onChange={event => setCustomerPhone(event.target.value)}
                      />
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={() => void continueWithAgency(modeChoiceAgency.id)}
                    disabled={!customerPhone.trim()}
                    className="mt-4 w-full rounded-xl bg-[#0065a1] px-5 py-3 text-sm font-black text-white transition hover:bg-[#003a66] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Continuer vers les services
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {ticket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-blue-100">
            <div className="flex items-center justify-between border-b border-blue-100 px-5 py-3">
              <div>
                <div className="text-sm font-bold uppercase text-btk-blue">Ticket confirme</div>
                <div className="mt-1 text-xs text-gray-500">Votre numero est ajoute a la file</div>
              </div>
              <button
                type="button"
                onClick={resetFlow}
                className="rounded-lg border border-blue-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-blue-50"
              >
                Fermer
              </button>
            </div>

            <div id="ticket-print" className="bg-white text-center">
              <div className="bg-btk-blue px-5 py-4 text-white">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
                    <img src="/BTK.png" alt="BTK" className="h-7 w-auto" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-bold">{ticket.agencyName}</div>
                    <div className="mt-0.5 text-xs text-blue-100">{ticket.service}</div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Votre numero</div>
                <div className="mt-1 text-7xl font-black leading-none text-btk-blue tabular-nums">{ticket.number}</div>
                <div className="mt-3 text-sm font-medium text-gray-600">
                  {peopleAhead > 0 ? `${peopleAhead} personne(s) avant vous` : 'Vous etes le prochain'}
                  <span className="text-gray-300"> | </span>
                  ~{ticket.estimatedWait} min
                </div>

                {ticket.qrCode && (
                  <div className="mt-4 flex justify-center">
                    <img src={ticket.qrCode} alt="QR Code ticket" className="h-32 w-32 rounded-lg border border-blue-100 bg-white p-2" />
                  </div>
                )}

                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium leading-6 text-btk-blue">
                  Presentez ce QR code ou votre numero {ticket.number} a votre arrivee a l'agence.
                </div>

                <div className="mt-3 text-xs text-gray-400">
                  Reserve le {new Date(ticket.createdAt).toLocaleString('fr-TN', { hour12: false })}
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-blue-100 bg-gray-50 p-4 sm:grid-cols-2">
              <button
                className="rounded-lg border border-btk-blue bg-white px-5 py-3 font-semibold text-btk-blue transition hover:bg-blue-50"
                onClick={downloadTicket}
              >
                Telecharger
              </button>
              <button
                className="rounded-lg bg-btk-blue px-5 py-3 font-semibold text-white transition hover:bg-btk-dark"
                onClick={resetFlow}
              >
                Nouveau ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
