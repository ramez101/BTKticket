'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BTKHeader from '@/components/shared/BTKHeader'

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
        const status = await fetch('/api/service-status', { cache: 'no-store' }).then(r => r.json())
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
      <BTKHeader
        subtitle="Optimisez chaque visite."
        right={(
          <>
            <nav className="hidden items-center gap-3 rounded-full bg-white/90 p-1 shadow-sm ring-1 ring-[#dbeaf8] lg:flex">
            <a
              href="https://www.btkbank.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff] hover:text-[#003a66]"
            >
              À propos
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
              Horaires
            </button>
            </nav>

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
              {serviceOpen ? 'Service ouvert' : serviceClosed ? 'Service fermé' : 'Vérification du service'}
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
          </>
        )}
      />

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
                <span>Horaires</span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e4f2ff] text-[#0065a1]">›</span>
              </button>
              <a
                href="https://www.btkbank.com/"
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-between rounded-3xl border border-[#dbeaf8] bg-[#f4fbff] px-5 py-4 text-left text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
              >
                <span>À propos</span>
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
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 h-[32rem] w-[32rem] rounded-full bg-[#0065a1]/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-24 h-[30rem] w-[30rem] rounded-full bg-[#1978be]/10 blur-3xl" />

        <div className="relative mx-auto grid min-h-[min(760px,calc(100dvh-140px))] w-full max-w-[1440px] items-center gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:px-12 lg:py-10">
          <div className="relative z-10 max-w-2xl">
            <h1 className="mt-6 max-w-[700px] text-[2.75rem] font-black leading-[1.04] tracking-[-0.045em] text-[#003a66] sm:text-6xl lg:text-[4.5rem]">
              Moins d&apos;attente.
              <span className="mt-1 block text-[#0065a1]">Plus de temps pour vous.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Préparez votre visite à l&apos;agence en quelques instants : prenez un ticket, suivez votre tour ou réservez un rendez-vous avec votre conseiller.
            </p>

            <div className="mt-8 grid max-w-[620px] gap-3 sm:grid-cols-2">
              <Link
                href="/client"
                prefetch
                onMouseEnter={() => router.prefetch('/client')}
                onFocus={() => router.prefetch('/client')}
                onTouchStart={() => router.prefetch('/client')}
                className="group inline-flex min-h-[58px] items-center justify-between gap-4 rounded-2xl bg-[#0065a1] px-5 py-4 text-sm font-bold text-white shadow-[0_16px_35px_-18px_rgba(0,101,161,0.65)] transition hover:-translate-y-0.5 hover:bg-[#003a66] focus:outline-none focus:ring-4 focus:ring-[#0065a1]/20 sm:text-base"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M6 3.75h12a2 2 0 0 1 2 2v14.5a.75.75 0 0 1-1.1.66L12 17.25l-6.9 3.66a.75.75 0 0 1-1.1-.66V5.75a2 2 0 0 1 2-2Z" />
                      <path d="M8 8h8M8 11.5h5" />
                    </svg>
                  </span>
                  Prendre un ticket
                </span>
                <span className="text-lg transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
              <Link
                href="/rdv"
                prefetch
                onMouseEnter={() => router.prefetch('/rdv')}
                onFocus={() => router.prefetch('/rdv')}
                onTouchStart={() => router.prefetch('/rdv')}
                className="group inline-flex min-h-[58px] items-center justify-between gap-4 rounded-2xl border border-[#c5dced] bg-white/85 px-5 py-4 text-sm font-bold text-[#003a66] shadow-sm transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#0065a1]/15 sm:text-base"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0065a1] text-white">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3.75" y="5.5" width="16.5" height="15" rx="2" />
                      <path d="M8 3.75v3.5m8-3.5v3.5M4 9.5h16m-11.5 4h3m-3 3.5h7" />
                    </svg>
                  </span>
                  Prendre rendez-vous
                </span>
                <span className="text-lg text-[#0065a1] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
              <Link
                href="/ecran"
                className="group inline-flex min-h-[58px] items-center justify-between gap-4 rounded-2xl border border-[#c5dced] bg-white/85 px-5 py-4 text-sm font-bold text-[#003a66] shadow-sm transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#0065a1]/15 sm:col-span-2 sm:text-base"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0065a1] text-white">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <rect x="3.5" y="4.5" width="17" height="12.5" rx="2" />
                      <path d="M8 21h8m-4-4v4m-5-9 3-3 2 2 4-4m0 0v3m0-3h-3" />
                    </svg>
                  </span>
                  Suivre votre tour en direct
                </span>
                <span className="text-lg text-[#0065a1] transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex h-[430px] w-full max-w-[560px] items-center justify-center sm:h-[540px] lg:h-[620px]" aria-label="Illustration animée des services BTK Easy">
            <div aria-hidden="true" className="absolute h-[270px] w-[270px] rounded-full border border-[#9bc8e8]/50 sm:h-[390px] sm:w-[390px]" />
            <div aria-hidden="true" className="absolute h-[220px] w-[220px] rounded-full bg-gradient-to-br from-white to-[#d6eafb] shadow-[0_30px_90px_-40px_rgba(0,101,161,0.35)] sm:h-[330px] sm:w-[330px]" />
            <div aria-hidden="true" className="absolute h-[300px] w-[300px] rounded-full border border-dashed border-[#9bc8e8]/70 sm:h-[460px] sm:w-[460px]" />

            <div className="home-phone-float relative z-10 h-[350px] w-[190px] rounded-[34px] border-[7px] border-[#102746] bg-[#102746] p-[5px] shadow-[0_35px_80px_-25px_rgba(0,58,102,0.48)] sm:h-[440px] sm:w-[236px] sm:rounded-[42px] sm:border-[8px]">
              <div className="relative h-full overflow-hidden rounded-[26px] bg-[#f7fbff] px-3.5 pb-4 pt-3 sm:rounded-[32px] sm:px-4 sm:pt-4">
                <div className="absolute left-1/2 top-0 z-20 h-[17px] w-[72px] -translate-x-1/2 rounded-b-xl bg-[#102746] sm:h-[20px] sm:w-[88px]" />
                <div className="flex items-center justify-between text-[8px] font-bold text-[#102746] sm:text-[9px]">
                  <span>9:41</span>
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2 w-3 rounded-sm border border-[#102746]" />
                    <span className="h-2 w-2 rounded-full bg-[#102746]" />
                  </span>
                </div>
                <div className="mt-5 flex items-center gap-2.5 border-b border-[#e4edf5] pb-3 sm:mt-7">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0065a1] text-[10px] font-black text-white sm:h-9 sm:w-9">BTK</span>
                  <span>
                    <span className="block text-[11px] font-black text-[#102746] sm:text-xs">BTK Easy</span>
                    <span className="block text-[8px] font-medium text-slate-500 sm:text-[9px]">Bonjour</span>
                  </span>
                  <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0065a1] shadow-sm" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" />
                    </svg>
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#102746] sm:text-xs">Vos services</span>
                  <span className="text-[8px] font-semibold text-[#0065a1] sm:text-[9px]">Tout voir</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[#dceaf6] bg-white p-2 shadow-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e7f2fb] text-[#0065a1] sm:h-7 sm:w-7">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M6 3.75h12a2 2 0 0 1 2 2v14.5a.75.75 0 0 1-1.1.66L12 17.25l-6.9 3.66a.75.75 0 0 1-1.1-.66V5.75a2 2 0 0 1 2-2Z" />
                        <path d="M8 8h8m-8 3.5h5" />
                      </svg>
                    </span>
                    <span className="mt-1.5 block text-[8px] font-bold text-[#102746] sm:text-[9px]">Ticket en ligne</span>
                    <span className="block text-[7px] text-slate-500 sm:text-[8px]">Sans attendre</span>
                  </div>
                  <div className="rounded-xl border border-[#dceaf6] bg-white p-2 shadow-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e7f2fb] text-[#0065a1] sm:h-7 sm:w-7">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <rect x="3.75" y="5.5" width="16.5" height="15" rx="2" />
                        <path d="M8 3.75v3.5m8-3.5v3.5M4 9.5h16m-11.5 4h3" />
                      </svg>
                    </span>
                    <span className="mt-1.5 block text-[8px] font-bold text-[#102746] sm:text-[9px]">Rendez-vous</span>
                    <span className="block text-[7px] text-slate-500 sm:text-[8px]">À votre agenda</span>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-[#0065a1] p-3 text-white shadow-md sm:p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-semibold text-blue-100 sm:text-[9px]">VOTRE TICKET</span>
                    <span className="rounded-full bg-white/15 px-2 py-1 text-[7px] font-bold sm:text-[8px]">EN ATTENTE</span>
                  </div>
                  <div className="mt-1 flex items-end justify-between">
                    <span className="text-3xl font-black leading-none sm:text-4xl">A024</span>
                    <span className="text-right text-[8px] font-medium text-blue-100 sm:text-[9px]">Centrale<br />~ 8 min</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
                    <div className="home-progress-bar h-full w-2/3 rounded-full bg-white" />
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-[#dceaf6] bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e7f2fb] text-[#0065a1]">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" />
                        <circle cx="12" cy="10" r="2.3" />
                      </svg>
                    </span>
                    <span>
                      <span className="block text-[8px] font-bold text-[#102746] sm:text-[9px]">Agence la plus proche</span>
                      <span className="block text-[7px] text-slate-500 sm:text-[8px]">Centrale · 1,2 km</span>
                    </span>
                    <span className="ml-auto text-[8px] font-bold text-[#0065a1]">›</span>
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-[#e4edf5] bg-white/95 px-2 py-2.5">
                  <span className="flex flex-col items-center gap-1 text-[#0065a1]">
                    <span className="h-1 w-4 rounded-full bg-[#0065a1]" />
                    <span className="text-[7px] font-bold">Accueil</span>
                  </span>
                  <span className="flex flex-col items-center gap-1 text-slate-400">
                    <span className="h-1 w-4 rounded-full bg-slate-200" />
                    <span className="text-[7px] font-medium">Tickets</span>
                  </span>
                  <span className="flex flex-col items-center gap-1 text-slate-400">
                    <span className="h-1 w-4 rounded-full bg-slate-200" />
                    <span className="text-[7px] font-medium">Profil</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="home-notice-float absolute left-0 top-[21%] z-20 flex items-center gap-2.5 rounded-2xl border border-[#dceaf6] bg-white px-3 py-2.5 shadow-[0_18px_40px_-20px_rgba(0,58,102,0.35)] sm:left-1 sm:px-4 sm:py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e7f2fb] text-[#0065a1]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3.75" y="5.5" width="16.5" height="15" rx="2" />
                  <path d="M8 3.75v3.5m8-3.5v3.5M4 9.5h16m-11.5 4h3" />
                </svg>
              </span>
              <span>
                <span className="block text-[9px] font-bold text-[#102746] sm:text-[10px]">Rendez-vous confirmé</span>
                <span className="block text-[8px] text-slate-500 sm:text-[9px]">Demain · 10:30</span>
              </span>
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#e4f5eb] text-[10px] font-black text-[#14804a]">✓</span>
            </div>

            <div className="home-notice-float-delayed absolute bottom-[19%] right-0 z-20 flex items-center gap-2.5 rounded-2xl border border-[#dceaf6] bg-white px-3 py-2.5 shadow-[0_18px_40px_-20px_rgba(0,58,102,0.35)] sm:right-0 sm:px-4 sm:py-3">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#e7f2fb] text-[#0065a1]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 5h4m-4 2.5h2m-2 6h4" />
                </svg>
                <span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-white bg-[#1978be]" />
              </span>
              <span>
                <span className="block text-[9px] font-bold text-[#102746] sm:text-[10px]">Votre tour approche</span>
                <span className="block text-[8px] text-slate-500 sm:text-[9px]">Encore 2 personnes</span>
              </span>
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
