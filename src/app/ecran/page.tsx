'use client'

import { useEffect, useState } from 'react'
import { useAgencySocket } from '@/hooks/useSocket'

type GuichetCall = {
  label: string
  number: number
  service?: string
  guichet: string
  guichetId?: number | null
  time?: string
}

export default function EcranPage() {
  const tickerItems = [
    'BTK toujours à vos côtés',
    'Gagnez du temps avec votre ticket en ligne',
    "Suivez votre numéro sur l'écran",
    'Merci pour votre confiance',
  ]
  const [agencies, setAgencies] = useState<any[]>([])
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [agencyData, setAgencyData] = useState<any>(null)
  const [clock, setClock] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [calledAnim, setCalledAnim] = useState(false)
  const [latestCall, setLatestCall] = useState<GuichetCall | null>(null)
  const [openStatus, setOpenStatus] = useState({ open: true, message: 'Service ouvert' })

  useEffect(() => {
    fetch('/api/agency').then(r => r.json()).then(setAgencies)
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const tn = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
      setClock(tn.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setDateStr(tn.toLocaleDateString('fr-TN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))
    }

    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await fetch('/api/service-status').then(r => r.json())
        setOpenStatus({
          open: Boolean(status.open),
          message: status.open ? 'Bienvenue !' : status.message || 'Hors horaires de travail',
        })
      } catch {
        setOpenStatus({ open: false, message: 'Service indisponible' })
      }
    }

    checkStatus()
    const t = setInterval(checkStatus, 30000)
    return () => clearInterval(t)
  }, [])

  async function loadAgencyData(agencyId: number) {
    const data = await fetch(`/api/agency/${agencyId}`).then(r => r.json())
    setAgencyData(data)

    if (data.called) {
      setLatestCall({
        label: data.called.label,
        number: data.called.number,
        service: data.called.service,
        guichet: data.called.guichet?.label ?? 'Guichet',
        guichetId: data.called.guichetId,
        time: data.called.calledAt,
      })
    } else {
      setLatestCall(null)
    }
  }

  async function selectAgency(agency: any) {
    setSelectedAgency(agency)
    await loadAgencyData(agency.id)
  }

  useEffect(() => {
    if (!selectedAgency?.id) return
    const t = setInterval(() => loadAgencyData(selectedAgency.id), 10000)
    return () => clearInterval(t)
  }, [selectedAgency?.id])

  function playBeep() {
    try {
      const ctx = new AudioContext()
      const o1 = ctx.createOscillator()
      const g1 = ctx.createGain()
      o1.connect(g1)
      g1.connect(ctx.destination)
      o1.frequency.value = 880
      g1.gain.value = 0.25
      o1.start()
      o1.stop(ctx.currentTime + 0.12)

      const o2 = ctx.createOscillator()
      const g2 = ctx.createGain()
      o2.connect(g2)
      g2.connect(ctx.destination)
      o2.frequency.value = 1100
      g2.gain.value = 0.2
      o2.start(ctx.currentTime + 0.18)
      o2.stop(ctx.currentTime + 0.32)
    } catch {}
  }

  function speakCall(call: GuichetCall) {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

      const ticketNumber = String(call.number)
      const message = `Ticket numéro ${ticketNumber}, ${call.guichet}.`
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = 'fr-FR'
      utterance.rate = 0.70
      utterance.pitch = 1
      utterance.volume = 1

      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch {}
  }

  useAgencySocket(selectedAgency?.id ?? null, {
    onTicketUpdate: (d) => {
      setAgencyData((prev: any) => prev ? { ...prev, agency: { ...prev.agency, ...d } } : prev)
      if (selectedAgency?.id) loadAgencyData(selectedAgency.id)
    },
    onNumberCalled: (d) => {
      const newCall: GuichetCall = {
        label: d.label,
        number: d.number,
        guichet: d.guichet,
        guichetId: d.guichetId,
        time: d.time,
      }

      setLatestCall(newCall)
      setAgencyData((prev: any) => prev ? {
        ...prev,
        agency: { ...prev.agency, currentCalled: d.number },
      } : prev)
      setCalledAnim(true)
      setTimeout(() => setCalledAnim(false), 4000)
      playBeep()
      setTimeout(() => speakCall(newCall), 450)
    },
  });

  if (!selectedAgency) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#edf7ff] to-[#d8ebff] p-3 text-[#0065a1] sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#0065a1]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[#0065a1]/10 blur-3xl" />
        <section className="relative w-full max-w-4xl rounded-[32px] border border-[#dbeaf8] bg-white/95 p-5 shadow-[0_40px_100px_-50px_rgba(0,101,161,0.28)] backdrop-blur sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dbeaf8] bg-white shadow-sm sm:h-20 sm:w-20">
              <img src="/BTK.png" alt="BTK" className="h-11 w-auto sm:h-14" />
            </span>
            <h1 className="mt-5 text-2xl font-black text-[#003a66] sm:text-3xl">Écran guichets</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">Sélectionnez l'agence à afficher</p>
            <div className="mt-4 font-mono text-xl font-black text-[#0065a1]">{clock}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.filter(a => a.isActive).map(a => (
              <button
                key={a.id}
                onClick={() => selectAgency(a)}
                className="rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-[#0065a1]/10 hover:ring-1 hover:ring-[#0065a1]"
              >
                <div className="text-xs font-black text-[#0065a1]">{a.code}</div>
                <div className="mt-2 font-black text-[#003a66]">{a.name}</div>
                <div className="mt-1 text-sm font-semibold text-slate-500">{a.city}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  const agency = agencyData?.agency
  const closed = !openStatus.open
  function resetDisplay() {
    setSelectedAgency(null)
    setAgencyData(null)
    setLatestCall(null)
  }

  return (
    <main className={closed ? 'flex min-h-[100dvh] flex-col overflow-y-auto select-none bg-slate-100 text-[#003a66]' : 'flex min-h-[100dvh] flex-col overflow-y-auto select-none bg-gradient-to-br from-white via-[#edf7ff] to-[#d8ebff] text-[#003a66]'}>
      <header className="shrink-0 border-b border-[#dbeaf8] bg-white/95 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.09)] backdrop-blur">
        <div className="grid min-h-[118px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-3 sm:hidden">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
            <img src="/BTK.png" alt="BTK" className="h-12 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="text-xl font-black leading-tight text-[#003a66]">BTK Easy</div>
              <div className="truncate text-sm font-semibold text-slate-500">{agency?.name}</div>
            </div>
          </div>

          <div className="col-start-1 row-start-2 min-w-0 text-left">
            <div className={`text-[0.82rem] font-semibold uppercase leading-tight ${closed ? 'text-gray-500' : 'text-btk-blue'}`}>
              {closed ? 'Guichets fermes' : 'Guichets en service'}
            </div>
            <div className="mt-1 truncate text-xs text-gray-500">{openStatus.message}</div>
          </div>

          <div className="col-start-2 row-start-2 justify-self-end text-right">
            <div className="font-mono text-lg font-semibold leading-tight text-gray-900">{clock}</div>
            <div className="text-[0.72rem] capitalize leading-tight text-gray-500">{dateStr}</div>
          </div>

          <button
            onClick={resetDisplay}
            className="col-start-2 row-start-1 h-10 justify-self-end rounded-xl border border-[#0065a1] bg-white px-3 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
          >
            Changer
          </button>
        </div>

        <div className="hidden min-h-[92px] items-center justify-between gap-5 px-6 sm:flex lg:px-10">
          <div className="flex min-w-0 items-center gap-5">
            <img src="/BTK.png" alt="BTK" className="h-16 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="text-2xl font-black leading-tight text-[#003a66]">BTK Easy</div>
              <div className="truncate text-base font-semibold text-slate-500">{agency?.name}</div>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-sm font-semibold uppercase ${closed ? 'text-gray-500' : 'text-btk-blue'}`}>
              {closed ? 'Guichets fermes' : 'Guichets en service'}
            </div>
            <div className="mt-1 text-xs text-gray-500">{openStatus.message}</div>
          </div>

          <div className="flex items-center justify-end gap-5">
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold text-gray-900">{clock}</div>
              <div className="text-xs capitalize text-gray-500">{dateStr}</div>
            </div>
            <button
              onClick={resetDisplay}
              className="rounded-xl border border-[#0065a1] bg-white px-4 py-2 text-sm font-black text-[#0065a1] transition hover:bg-[#eaf5ff]"
            >
              Changer
            </button>
          </div>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 items-stretch justify-center p-3 sm:p-5 lg:p-6 xl:p-8">
        <div className="flex min-h-0 w-full max-w-[1500px]">
          <div className="grid w-full gap-4 sm:gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[38%_62%] 2xl:grid-cols-[36%_64%]">
            <div className="relative flex min-h-[320px] overflow-hidden rounded-[32px] border border-[#dbeaf8] bg-gradient-to-br from-white to-[#ebf4ff] p-5 shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] sm:p-8 lg:h-full lg:p-10">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#0065a1]/10 sm:h-36 sm:w-36" />
            <div className="absolute bottom-0 left-0 h-20 w-20 rounded-tr-full bg-[#0065a1]/10 sm:h-32 sm:w-32" />

            <div className="relative z-10 flex h-full w-full flex-col justify-center">
              <div className="mb-7 flex items-center gap-4 sm:mb-10 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#dbeaf8] bg-white shadow-sm sm:h-24 sm:w-24">
                  <img src="/BTK.png" alt="BTK" className="h-11 w-auto sm:h-16" />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-[#0065a1] sm:text-base">BTK Easy</div>
                  <div className="mt-1 max-w-[14rem] truncate text-base font-bold text-slate-600 sm:mt-2 sm:max-w-xs sm:text-xl">
                    {agency?.name || 'Accueil agence'}
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-[#0065a1] pl-4 sm:border-l-8 sm:pl-7">
                <h1 className="max-w-xl text-4xl font-black leading-[1.12] text-[#003a66] sm:text-5xl lg:text-[clamp(3.25rem,4.5vw,4rem)]">
                  <span className="block">Bienvenue à</span>
                  <span className="block">Notre Agence.</span>
                </h1>
              </div>
            </div>
          </div>

          {closed ? (
            <article className="flex min-h-[260px] flex-col items-center justify-center rounded-[32px] border border-red-200 bg-red-50 px-5 py-8 text-center shadow-[0_30px_80px_-42px_rgba(220,38,38,0.24)] sm:px-10 lg:h-full lg:min-h-0">
              <div className="text-sm font-black uppercase tracking-wide text-red-500">
                Hors horaires de travail
              </div>
              <div className="mt-5 rounded-lg bg-red-600 px-6 py-5 text-3xl font-black uppercase tracking-wide text-white shadow-sm sm:px-10 sm:py-6 sm:text-5xl">
                Guichet fermé
              </div>
              <p className="mt-6 max-w-xl text-base font-semibold leading-7 text-red-800 sm:text-xl sm:leading-8">
                Le service est actuellement fermé. Merci de votre confiance.
              </p>
            </article>
          ) : (
            <article
              className={`flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[32px] border border-[#dbeaf8] bg-white p-4 text-center shadow-[0_30px_80px_-42px_rgba(0,101,161,0.24)] transition-all duration-300 sm:min-h-[360px] sm:p-6 lg:h-full lg:min-h-0 lg:p-8 ${
                latestCall && calledAnim ? 'scale-[1.01] ring-4 ring-[#0065a1]' : ''
              }`}
            >
              <div className="mx-auto flex h-full w-full flex-col justify-center gap-4 sm:gap-5 lg:gap-5">
                <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center rounded-[24px] border border-[#dbeaf8] bg-[#f4fbff] px-4 py-5 sm:min-h-[210px] sm:px-6 lg:min-h-0">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500 sm:text-sm">
                    Ticket
                  </div>
                  <div className={`mt-2 font-mono text-[5.5rem] font-black leading-none tabular-nums sm:text-[9.5rem] lg:text-[clamp(8rem,16vw,13rem)] ${
                    latestCall ? 'text-[#0065a1]' : 'text-slate-200'
                  }`}>
                    {latestCall?.number ?? '---'}
                  </div>
                </div>

                <div className={`rounded-lg px-4 py-5 shadow-sm ring-1 sm:px-8 sm:py-5 ${
                  latestCall
                    ? 'bg-[#0065a1] text-white ring-[#0065a1]'
                    : 'bg-[#f4fbff] text-slate-300 ring-[#dbeaf8]'
                }`}>
                  <div className={`text-xs font-black uppercase tracking-wide sm:text-sm ${
                    latestCall ? 'text-blue-100' : 'text-slate-500'
                  }`}>
                    Guichet
                  </div>
                  <div className="mt-2 break-words text-4xl font-black leading-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl 2xl:text-7xl">
                    {latestCall?.guichet ?? '---'}
                  </div>
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
      </section>

      <footer className="relative shrink-0 overflow-hidden border-t border-[#dbeaf8] bg-white text-[#0065a1] shadow-[0_-8px_24px_rgba(0,101,161,0.08)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-white/0 sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-white/0 sm:w-24" />

        <div className="ticker-track flex w-max items-center whitespace-nowrap py-2.5 [--ticker-duration:46s] sm:py-3">
          {[0, 1, 2, 3].map(group => (
            <div key={group} className="flex items-center gap-5 px-3 text-sm font-black uppercase tracking-wide sm:gap-7 sm:px-5 sm:text-lg lg:text-xl">
              {tickerItems.map(item => (
                <span key={`${group}-${item}`} className="inline-flex items-center gap-5 sm:gap-7">
                  <span className="rounded-full bg-[#f4fbff] px-4 py-1.5 ring-1 ring-[#dbeaf8] sm:px-5">
                    {item}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0065a1]/70 shadow-[0_0_0_5px_rgba(0,101,161,0.10)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </main>
  )
}
