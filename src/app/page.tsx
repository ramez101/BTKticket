'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ActiveHours = {
  label: string
  startTime: string
  endTime: string
}

type TicketViewData = {
  ticket: {
    id: number
    label: string
    number: number
    service: string
    status: 'WAITING' | 'CALLED' | 'SERVED' | 'ABSENT'
    createdAt: string
    guichet: string | null
    qrCode: string | null
  }
  agency: {
    name: string
    city: string
    code: string
  }
  rank: number
  ahead: number
  presentAt: string
  estimatedMinutes: number
  currentCalled: number
  currentGuichet: string | null
}

export default function Home() {
  const router = useRouter()
  const tickerText = 'BTK Easy • Prenez votre ticket en ligne • Suivez l’état des guichets en temps réel • Rendez-vous au bon moment avec votre conseiller • Simplifiez votre visite'
  const [showHours, setShowHours] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openStatus, setOpenStatus] = useState<{ open: boolean | null; message: string; hours: ActiveHours | null }>({
    open: null,
    message: 'Verification du service',
    hours: null,
  })
  const [ticketCode, setTicketCode] = useState('')
  const [ticketView, setTicketView] = useState<TicketViewData | null>(null)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketError, setTicketError] = useState('')

  useEffect(() => {
    const checkOpenStatus = async () => {
      try {
        const status = await fetch('/api/service-status').then(r => r.json())
        setOpenStatus({
          open: Boolean(status.open),
          message: status.message || 'Service indisponible',
          hours: status.hours ?? null,
        })
      } catch {
        setOpenStatus({ open: false, message: 'Service indisponible', hours: null })
      }
    }

    checkOpenStatus()
    const timer = setInterval(checkOpenStatus, 30000)
    return () => clearInterval(timer)
  }, [])

  const serviceOpen = openStatus.open === true
  const serviceClosed = openStatus.open === false
  const activeHours = openStatus.hours ?? { label: 'SERVICE', startTime: '08:00', endTime: '16:30' }
  const weekSchedule = [
    ['Lundi', `De ${activeHours.startTime} - ${activeHours.endTime}`, true],
    ['Mardi', `De ${activeHours.startTime} - ${activeHours.endTime}`, true],
    ['Mercredi', `De ${activeHours.startTime} - ${activeHours.endTime}`, true],
    ['Jeudi', `De ${activeHours.startTime} - ${activeHours.endTime}`, true],
    ['Vendredi', `De ${activeHours.startTime} - ${activeHours.endTime}`, true],
    ['Samedi', 'Fermé', false],
    ['Dimanche', 'Fermé', false],
  ] as const

  useEffect(() => {
    // Les parcours les plus utilisés sont prêts avant le premier clic.
    router.prefetch('/client')
    router.prefetch('/rdv')
  }, [router])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('ticket')
    if (code) setTicketCode(code)
  }, [])

  useEffect(() => {
    if (!ticketCode) return

    let active = true

    const loadTicket = async (showLoading = false) => {
      if (showLoading) setTicketLoading(true)
      setTicketError('')

      try {
        const res = await fetch(`/api/ticket/${encodeURIComponent(ticketCode)}`, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error('Ticket introuvable')
        }

        const data = await res.json()
        if (active) setTicketView(data)
      } catch {
        if (active) setTicketError('Ticket introuvable ou expire.')
      } finally {
        if (active) setTicketLoading(false)
      }
    }

    loadTicket(true)
    const timer = setInterval(() => loadTicket(false), 30000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [ticketCode])

  function closeTicketView() {
    setTicketCode('')
    setTicketView(null)
    setTicketError('')
    setTicketLoading(false)
    router.replace('/')
  }

  return (
    <main className="flex min-h-screen min-w-full overflow-x-hidden overflow-y-auto bg-gradient-to-br from-white via-[#edf6ff] to-[#d8ebff] text-[#0065a1]">
      <div className="flex min-h-screen w-full flex-1 flex-col">
      <header className="shrink-0 border-b border-[#dbeaf8] bg-white shadow-[0_20px_50px_-30px_rgba(0,0,0,0.09)]">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:min-h-[80px] lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white shadow-sm">
              <img src="/BTK.png" alt="BTK" className="h-8 w-auto" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-black leading-tight text-slate-950 sm:text-xl">BTK Easy</span>
              <span className="block truncate text-xs font-semibold text-slate-500 sm:text-sm">Optimisez chaque visite.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-3 rounded-full bg-white/90 p-1 shadow-sm ring-1 ring-[#dbeaf8] lg:flex">
            <a
              href="https://www.btkbank.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff] hover:text-[#003a66]"
            >
              A Propos
            </a>
            <a
              href="https://www.btkbank.com/site/fr/contact.php?id_article=38&objet=1"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff] hover:text-[#003a66]"
            >
              Contact
            </a>
            <button
              type="button"
              onClick={() => setShowHours(true)}
              className="rounded-full border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff] hover:text-[#003a66]"
            >
              Horaire
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black shadow-sm ring-1 sm:px-4 sm:py-2.5 sm:text-sm ${
              serviceOpen
                ? 'bg-green-50 text-green-700 ring-green-200'
                : serviceClosed
                  ? 'bg-red-50 text-red-700 ring-red-200'
                  : 'bg-slate-50 text-slate-500 ring-slate-200'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${
                serviceOpen ? 'bg-green-500' : serviceClosed ? 'bg-red-500' : 'bg-slate-400'
              }`} />
              {serviceOpen ? 'Ouvert' : serviceClosed ? 'Fermé' : 'Vérification'}
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 lg:hidden"
              title="Ouvrir le menu"
              aria-label="Ouvrir le menu"
              aria-expanded={mobileMenuOpen}
            >
              <img src="/menu.png" alt="Menu" className="h-5 w-5 object-contain" />
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#0065a1]/14 backdrop-blur-md"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[340px] flex-col bg-white shadow-2xl ring-1 ring-slate-200 lg:static lg:h-auto lg:max-w-[86vw] lg:flex-row">
            <div className="flex h-full w-full flex-col overflow-y-auto p-5 lg:max-w-[300px]">
            <div className="flex items-center justify-between gap-4 border-b border-[#dbeaf8] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-[#0065a1]">Menu</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">BTK Easy</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#dbeaf8] bg-white text-lg font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
                aria-label="Fermer le menu"
              >
                X
              </button>
            </div>

            <nav className="flex flex-col gap-3 p-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowHours(true)
                }}
                className="flex w-full items-center justify-between rounded-3xl border border-[#dbeaf8] bg-[#f4fbff] px-5 py-4 text-left text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
              >
                <span>Horaire</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e4f2ff] text-[#0065a1]">›</span>
              </button>
              <a
                href="https://www.btkbank.com/"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-between rounded-3xl border border-[#dbeaf8] bg-[#f4fbff] px-5 py-4 text-left text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
              >
                <span>A Propos</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e4f2ff] text-[#0065a1]">›</span>
              </a>
              <a
                href="https://www.btkbank.com/site/fr/contact.php?id_article=38&objet=1"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-between rounded-3xl border border-[#dbeaf8] bg-[#f4fbff] px-5 py-4 text-left text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
              >
                <span>Contact</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e4f2ff] text-[#0065a1]">›</span>
              </a>
            </nav>
          </div>
          </aside>
        </>
      )}

      <section className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-white via-[#edf7ff] to-[#e3f0ff] text-[#0065a1]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#0065a1]/10 blur-3xl" />
          <div className="pointer-events-none absolute left-10 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#0065a1]/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0065a1]/12 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[calc(86vh-72px)] max-w-[1500px] items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="max-w-2xl">
              <h1 className="mt-8 text-5xl font-black leading-[1.02] tracking-[-0.03em] text-[#003a66] sm:text-6xl lg:text-[4.6rem]">
                Moins d'attente. Plus de Satisfaction.
              </h1>

              <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="flex w-full gap-3">
                  <Link
                    href="/client"
                    prefetch
                    onMouseEnter={() => router.prefetch('/client')}
                    onFocus={() => router.prefetch('/client')}
                    onTouchStart={() => router.prefetch('/client')}
                    className="inline-flex basis-[50%] min-w-0 items-center justify-center rounded-full border border-[#0065a1] bg-white px-5 py-4 text-base font-black text-[#0065a1] transition duration-150 hover:bg-[#f4fbff] active:scale-[0.98] sm:basis-auto sm:min-w-[170px] lg:px-9 lg:py-5 lg:text-lg"
                  >
                    Prendre Ticket
                  </Link>
                  <Link
                    href="/ecran"
                    className="inline-flex basis-[50%] min-w-0 items-center justify-center rounded-full border border-[#0065a1] bg-white px-5 py-4 text-base font-black text-[#0065a1] transition hover:bg-[#f4fbff] sm:basis-auto sm:min-w-[170px] lg:px-9 lg:py-5 lg:text-lg"
                  >
                    Suivre votre tour
                  </Link>
                </div>
                <div className="flex w-full justify-start lg:w-auto">
                  <Link
                    href="/rdv"
                    prefetch
                    onMouseEnter={() => router.prefetch('/rdv')}
                    onFocus={() => router.prefetch('/rdv')}
                    onTouchStart={() => router.prefetch('/rdv')}
                    className="inline-flex w-[50%] min-w-[160px] items-center justify-center rounded-full bg-[#0065a1] px-7 py-4 text-base font-black text-white shadow-[0_22px_55px_-30px_rgba(0,101,161,0.45)] transition duration-150 hover:bg-[#005583] active:scale-[0.98] lg:w-auto lg:px-11 lg:py-5 lg:text-lg"
                  >
                    Prendre RDV
                  </Link>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="relative overflow-hidden rounded-[40px] border border-[#dbeaf8] bg-gradient-to-br from-white to-[#ebf4ff] p-4 shadow-[0_40px_120px_-48px_rgba(0,101,161,0.2)] backdrop-blur-xl">
                <img
                  src="/rdv.png"
                  alt="Planification de rendez-vous BTK"
                  className="w-full max-w-[520px] rounded-[32px] object-cover shadow-2xl"
                />
                <div className="pointer-events-none absolute -bottom-6 left-4 h-20 w-20 rounded-full bg-[#0065a1]/10 blur-2xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="shrink-0 overflow-hidden border-t border-[#dbeaf8] bg-white py-4 text-[#0065a1]">
        <div className="overflow-hidden w-full">
          <div className="ticker-track flex min-w-full whitespace-nowrap px-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#0065a1]">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className="inline-flex items-center gap-3">
                <span>{tickerText}</span>
                <span className="text-[#0065a1]/70">|</span>
              </span>
            ))}
          </div>
        </div>
      </footer>
      </div>

      {showHours && (
        <div className="fixed inset-0 z-50 flex justify-end bg-gray-950/35">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fermer les horaires"
            onClick={() => setShowHours(false)}
          />

          <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Horaires de travail</h2>
                <p className="mt-1 text-sm font-semibold text-btk-blue">{activeHours.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHours(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-xl font-black text-slate-500 transition hover:bg-slate-50 hover:text-btk-blue"
                aria-label="Fermer"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-4">
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="space-y-3">
                  {weekSchedule.map(([day, hours, isOpen]) => (
                    <div
                      key={String(day)}
                      className={`flex items-center justify-between gap-4 rounded-lg px-4 py-2 ring-1 ${
                        isOpen
                          ? 'bg-green-50 text-green-900 ring-green-200'
                          : 'bg-red-50 text-red-900 ring-red-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-base font-black">{day}</div>
                        <div className={`mt-1 text-sm font-bold ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
                          {hours}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase ring-1 ${
                        isOpen
                          ? 'bg-white text-green-700 ring-green-200'
                          : 'bg-white text-red-700 ring-red-200'
                      }`}>
                        {isOpen ? 'Ouvert' : 'Fermé'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {(ticketCode || ticketLoading || ticketError || ticketView) && (
        <TicketPreviewModal
          data={ticketView}
          loading={ticketLoading}
          error={ticketError}
          onClose={closeTicketView}
        />
      )}
    </main>
  )
}

function TicketPreviewModal({
  data,
  loading,
  error,
  onClose,
}: {
  data: TicketViewData | null
  loading: boolean
  error: string
  onClose: () => void
}) {
  const ticket = data?.ticket
  const isCalled = ticket?.status === 'CALLED'
  const isFinished = ticket?.status === 'SERVED' || ticket?.status === 'ABSENT'
  const statusLabel = isCalled
    ? 'Votre tour'
    : isFinished
      ? 'Ticket traite'
      : 'En attente'
  const statusClass = isCalled
    ? 'bg-green-50 text-green-700 ring-green-200'
    : isFinished
      ? 'bg-gray-50 text-gray-600 ring-gray-200'
      : 'bg-blue-50 text-btk-blue ring-blue-100'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <section className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-blue-100">
        <div className="flex items-center justify-between border-b border-blue-100 px-5 py-3">
          <div>
            <div className="text-sm font-black uppercase text-btk-blue">Votre ticket</div>
            <div className="mt-1 text-xs font-medium text-gray-500">BTK Easy</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-blue-100 px-3 py-2 text-sm font-black text-gray-600 transition hover:bg-blue-50"
          >
            X
          </button>
        </div>

        {loading && !data ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-sm font-black text-btk-blue">
              BTK
            </div>
            <div className="mt-4 text-sm font-semibold text-gray-500">Chargement du ticket...</div>
          </div>
        ) : error && !data ? (
          <div className="px-5 py-10 text-center">
            <div className="text-lg font-black text-gray-900">Ticket introuvable</div>
            <p className="mt-2 text-sm leading-6 text-gray-500">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-btk-blue px-5 py-3 text-sm font-bold text-white"
            >
              Retour accueil
            </button>
          </div>
        ) : data && ticket ? (
          <>
            <div className="bg-btk-blue px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
                    <img src="/BTK.png" alt="BTK" className="h-7 w-auto" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black leading-tight">BTK Easy</div>
                    <div className="truncate text-xs text-blue-100">{data.agency.name}</div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>

            {isCalled && (
              <div className="bg-green-50 px-5 py-3 text-center text-sm font-black text-green-700 ring-1 ring-green-100">
                Presentez-vous au {ticket.guichet ?? data.currentGuichet ?? 'guichet'}.
              </div>
            )}

            <div className="border-b border-dashed border-blue-100 px-5 py-5 text-center">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Numero</div>
              <div className={`mt-1 text-7xl font-black leading-none tabular-nums ${isCalled ? 'text-green-600' : 'text-btk-blue'}`}>
                {ticket.number}
              </div>
              <div className="mt-2 text-sm font-bold text-gray-700">{ticket.service}</div>
              <div className="mt-1 text-xs font-medium text-gray-400">{data.agency.city}</div>
            </div>

            <div className="px-5 py-5">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-lg font-black text-btk-blue tabular-nums">{data.ahead}</div>
                  <div className="mt-1 text-xs font-semibold text-btk-blue/70">Avant vous</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <div className="text-lg font-black text-orange-600 tabular-nums">~{data.estimatedMinutes}</div>
                  <div className="mt-1 text-xs font-semibold text-orange-600/70">Minutes</div>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-center text-xs font-semibold leading-5 text-gray-500">
                {isFinished
                  ? 'Ce ticket a deja ete traite.'
                  : isCalled
                    ? 'Votre numero est appele maintenant.'
                    : `Soyez pret vers ${data.presentAt}.`}
              </div>

              {ticket.qrCode && (
                <div className="mt-4 flex justify-center">
                  <div className="rounded-lg border border-blue-100 bg-white p-2">
                    <img src={ticket.qrCode} alt="QR Code du ticket" className="h-28 w-28" />
                  </div>
                </div>
              )}

              <div className="mt-4 text-center text-[11px] font-medium text-gray-400">
                Cree le {new Date(ticket.createdAt).toLocaleString('fr-TN', { hour12: false })}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  )
}
