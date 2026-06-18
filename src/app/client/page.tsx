'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useAgencySocket } from '@/hooks/useSocket'
import { SERVICES } from '@/types'

interface Agency {
  id: number
  code: string
  name: string
  city: string
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

const stepItems: { key: Step; label: string }[] = [
  { key: 'select', label: 'Agence' },
  { key: 'service', label: 'Service' },
  { key: 'ticket', label: 'Ticket' },
]

const AGENCIES_PER_PAGE = 6
const AGENCY_REFRESH_INTERVAL_MS = 5000

function getAgencyLoad(waitingCount: number) {
  if (waitingCount >= 20) {
    return {
      label: 'Très chargé 🔴',
      className: 'bg-red-50 text-red-700 ring-red-200',
      dotClassName: 'bg-red-500',
    }
  }

  if (waitingCount >= 16) {
    return {
      label: 'Chargé 🟠',
      className: 'bg-orange-50 text-orange-700 ring-orange-200',
      dotClassName: 'bg-orange-500',
    }
  }

  if (waitingCount >= 10) {
    return {
      label: 'Attente moyenne 🟡',
      className: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
      dotClassName: 'bg-yellow-500',
    }
  }

  return {
    label: "Peu d'attente 🟢",
    className: 'bg-green-50 text-green-700 ring-green-200',
    dotClassName: 'bg-green-500',
  }
}

export default function ClientPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [agencyData, setAgencyData] = useState<any>(null)
  const [selectedService, setSelectedService] = useState('')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [search, setSearch] = useState('')
  const [agencyPage, setAgencyPage] = useState(1)
  const [openStatus, setOpenStatus] = useState({ open: true, message: '' })

  const refreshAgencies = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/agency', { cache: 'no-store', signal })
      if (!res.ok) return

      const data = await res.json()
      const nextAgencies = Array.isArray(data) ? data : []
      setAgencies(nextAgencies)
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
    refreshAgencies(controller.signal)
    const timer = setInterval(() => refreshAgencies(), AGENCY_REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [refreshAgencies])

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

  async function selectAgency(id: number) {
    setSelectedId(id)
    setStep('service')
    setSelectedService('')
    const data = await fetch(`/api/agency/${id}`).then(r => r.json())
    setAgencyData(data)
  }

  async function takeTicket() {
    if (!selectedId || !selectedService) return
    setLoading(true)

    try {
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId: selectedId, service: selectedService }),
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
    doc.text('BTK RDV', 92, 50)
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

  const searchValue = search.trim().toLowerCase()
  const filteredAgencies = agencies
    .filter(a => a.isActive ?? true)
    .filter(a => `${a.code} ${a.name} ${a.city}`.toLowerCase().includes(searchValue))
  const totalAgencyPages = Math.max(1, Math.ceil(filteredAgencies.length / AGENCIES_PER_PAGE))
  const currentAgencyPage = Math.min(agencyPage, totalAgencyPages)
  const paginatedAgencies = filteredAgencies.slice(
    (currentAgencyPage - 1) * AGENCIES_PER_PAGE,
    currentAgencyPage * AGENCIES_PER_PAGE,
  )

  const selectedAgency = agencyData?.agency ?? agencies.find(a => a.id === selectedId)
  const currentCalled = selectedAgency?.currentCalled ?? 0
  const waitingCount = selectedAgency?.waitingCount ?? 0
  const estimatedWait = selectedAgency?.estimatedWait ?? 0
  const peopleAhead = ticket ? Math.max(0, ticket.waitingCount - 1) : 0

  return (
    <main className="flex min-h-screen flex-col bg-[#F3F8FC] lg:h-screen lg:overflow-hidden">
      <header className="shrink-0 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <img src="/BTK.png" alt="BTK" className="h-11 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="text-lg font-bold leading-tight text-gray-900">BTK RDV</div>
              <div className="text-xs font-medium text-gray-500">Prise de ticket en ligne</div>
            </div>
          </Link>

          <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            openStatus.open ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
          }`}>
            {openStatus.message}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col px-4 py-5 sm:px-6 lg:overflow-hidden lg:py-6">
        <div className="mb-5 shrink-0 flex flex-col gap-4 border-b border-blue-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Prenez votre ticket</h1>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            {stepItems.map((item, index) => {
              const active = item.key === step
              return (
                <div
                  key={item.key}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm sm:flex-none ${
                    active ? 'bg-btk-blue text-white shadow-sm' : 'bg-white text-gray-500 ring-1 ring-blue-100'
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-white text-btk-blue' : 'bg-blue-50 text-btk-blue'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="truncate font-medium">{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {step === 'select' && (
          <section className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 lg:h-full">
              <h2 className="text-xl font-bold text-gray-900">Choisir une agence</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Selectionnez l'agence la plus proche pour consulter l'attente et reserver votre numero.
              </p>

              <div className="mt-5">
                <label htmlFor="agency-search" className="mb-2 block text-xs font-semibold uppercase text-gray-500">
                  Recherche
                </label>
                <input
                  id="agency-search"
                  className="btk-input bg-white"
                  placeholder="Nom, ville ou code agence"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col">
              {filteredAgencies.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-blue-100">
                  Aucune agence trouvee.
                </div>
              ) : (
                <>
                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-rows-3">
                    {paginatedAgencies.map(a => {
                      const load = getAgencyLoad(a.waitingCount)

                      return (
                        <button
                          key={a.id}
                          onClick={() => selectAgency(a.id)}
                          className="group grid h-full min-h-0 w-full grid-cols-[auto_1fr] gap-3 overflow-hidden rounded-lg bg-white p-3 text-left shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-btk-blue lg:p-3.5"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-btk-blue lg:h-[52px] lg:w-[52px]">
                            {a.code}
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-lg font-black leading-tight text-gray-900 group-hover:text-btk-blue lg:text-xl">{a.name}</div>
                                <div className="mt-0.5 truncate text-sm font-medium text-gray-600 lg:text-base">{a.city}</div>
                              </div>
                              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 lg:px-2.5 ${load.className}`}>
                                <span className={`h-2 w-2 rounded-full ${load.dotClassName}`} />
                                {load.label}
                              </span>
                            </div>

                            <div className="mt-auto grid grid-cols-3 gap-1.5 pt-2 text-xs">
                              <div className="min-w-0 rounded-md bg-green-50 px-2 py-1">
                                <div className="truncate text-[9px] font-semibold uppercase text-green-700/70 lg:text-[10px]">En cours</div>
                                <div className="mt-0.5 truncate font-bold leading-tight text-green-700">
                                  {a.currentCalled > 0 ? a.currentCalled : '-'}
                                </div>
                              </div>
                              <div className="min-w-0 rounded-md bg-blue-50 px-2 py-1">
                                <div className="truncate text-[9px] font-semibold uppercase text-btk-blue/70 lg:text-[10px]">Attente</div>
                                <div className="mt-0.5 truncate font-bold leading-tight text-btk-blue">{a.waitingCount}</div>
                              </div>
                              <div className="min-w-0 rounded-md bg-orange-50 px-2 py-1">
                                <div className="truncate text-[9px] font-semibold uppercase text-orange-600/70 lg:text-[10px]">Temps</div>
                                <div className="mt-0.5 truncate font-bold leading-tight text-orange-600">~{a.estimatedWait} min</div>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex shrink-0 items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-blue-100">
                    <button
                      type="button"
                      onClick={() => setAgencyPage(page => Math.max(1, page - 1))}
                      disabled={currentAgencyPage === 1}
                      className="rounded-lg border border-blue-100 px-4 py-2 text-sm font-semibold text-btk-blue transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Precedent
                    </button>
                    <div className="text-sm font-semibold text-gray-600">
                      Page {currentAgencyPage} / {totalAgencyPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgencyPage(page => Math.min(totalAgencyPages, page + 1))}
                      disabled={currentAgencyPage === totalAgencyPages}
                      className="rounded-lg border border-blue-100 px-4 py-2 text-sm font-semibold text-btk-blue transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          <section className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
            <aside className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
              <button onClick={() => setStep('select')} className="mb-5 text-sm font-semibold text-red-600 hover:text-red-800">
                Retour aux agences
              </button>

              <div className="border-b border-blue-50 pb-5">
                <div className="text-xs font-semibold uppercase text-gray-400">Agence selectionnee</div>
                <h2 className="mt-2 text-xl font-bold text-gray-900">{selectedAgency.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedAgency.city}</p>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-2xl font-bold text-green-700 tabular-nums">
                    {currentCalled > 0 ? currentCalled : '-'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-green-700/70">En cours</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-2xl font-bold text-btk-blue tabular-nums">{waitingCount}</div>
                  <div className="mt-1 text-xs font-medium text-btk-blue/70">En attente</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <div className="text-2xl font-bold text-orange-600 tabular-nums">{estimatedWait}</div>
                  <div className="mt-1 text-xs font-medium text-orange-600/70">Minutes</div>
                </div>
              </div>
            </aside>

            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">Choisir le service</h2>
                <p className="mt-2 text-sm text-gray-500">Votre ticket sera ajoute a la file de l'agence selectionnee.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SERVICES.map(s => {
                  const active = selectedService === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSelectedService(s.key)}
                      className={`flex min-h-[76px] items-center gap-3 rounded-lg p-4 text-left ring-1 transition ${
                        active
                          ? 'bg-blue-50 ring-btk-blue shadow-sm'
                          : 'bg-white ring-blue-100 hover:bg-blue-50/50 hover:ring-blue-200'
                      }`}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        active ? 'bg-btk-blue text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.key.slice(0, 2).toUpperCase()}
                      </span>
                      <span className={`font-semibold ${active ? 'text-btk-blue' : 'text-gray-800'}`}>{s.key}</span>
                    </button>
                  )
                })}
              </div>

              <button
                className="mt-5 w-full rounded-lg bg-btk-blue px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
                onClick={takeTicket}
                disabled={!selectedService || loading || !openStatus.open}
              >
                {loading ? 'Generation en cours...' : !openStatus.open ? 'Service ferme' : 'Prendre mon ticket'}
              </button>
            </div>
          </section>
        )}

      </div>

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
