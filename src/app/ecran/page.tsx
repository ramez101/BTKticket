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
  const [callsByGuichet, setCallsByGuichet] = useState<Record<string, GuichetCall>>({})
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
        const status = await fetch('/api/service-status', { cache: 'no-store' }).then(r => r.json())
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

    const calls: Record<string, GuichetCall> = {}
    ;(data.allCalled || []).forEach((t: any) => {
      if (t.guichetId) {
        calls[String(t.guichetId)] = {
          label: t.label,
          number: t.number,
          service: t.service,
          guichet: t.guichet,
          guichetId: t.guichetId,
          time: t.calledAt,
        }
      }
    })

    setCallsByGuichet(calls)

    if (data.called) {
      setLatestCall({
        label: data.called.label,
        number: data.called.number,
        service: data.called.service,
        guichet: data.called.guichet?.label ?? 'Guichet',
        guichetId: data.called.guichetId,
        time: data.called.calledAt,
      })
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
      const message = `Ticket numéro ${ticketNumber}${call.guichet}.`
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
      setCallsByGuichet(prev => d.guichetId ? { ...prev, [String(d.guichetId)]: newCall } : prev)
      setAgencyData((prev: any) => prev ? {
        ...prev,
        agency: { ...prev.agency, currentCalled: d.number },
      } : prev)
      setCalledAnim(true)
      setTimeout(() => setCalledAnim(false), 4000)
      playBeep()
      setTimeout(() => speakCall(newCall), 450)
    },
  })

  if (!selectedAgency) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3F8FC] p-4 sm:p-8">
        <section className="w-full max-w-4xl rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/BTK.png" alt="BTK" className="h-14 w-auto sm:h-16" />
            <h1 className="mt-5 text-2xl font-bold text-gray-900 sm:text-3xl">Ecran guichets</h1>
            <p className="mt-2 text-sm text-gray-500">Selectionner l'agence a afficher</p>
            <div className="mt-4 font-mono text-xl font-semibold text-btk-blue">{clock}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.filter(a => a.isActive).map(a => (
              <button
                key={a.id}
                onClick={() => selectAgency(a)}
                className="rounded-lg bg-blue-50 p-4 text-left ring-1 ring-blue-100 transition hover:bg-white hover:shadow-md hover:ring-btk-blue"
              >
                <div className="text-xs font-bold text-btk-blue">{a.code}</div>
                <div className="mt-2 font-semibold text-gray-900">{a.name}</div>
                <div className="mt-1 text-sm text-gray-500">{a.city}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  const agency = agencyData?.agency
  const guichets = agency?.guichets || []
  const guichetCount = guichets.length
  const compactGuichets = guichetCount > 3
  const closed = !openStatus.open

  return (
    <main className={`flex min-h-screen flex-col overflow-y-auto text-gray-900 select-none lg:h-screen lg:overflow-hidden ${closed ? 'bg-gray-100' : 'bg-[#F3F8FC]'}`}>
      <header className="shrink-0 border-b border-blue-100 bg-white shadow-sm">
        <div className="flex min-h-[92px] flex-col justify-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-6 lg:px-10 lg:py-0">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <img src="/BTK.png" alt="BTK" className="h-12 w-auto shrink-0 sm:h-16" />
            <div className="min-w-0">
              <div className="text-xl font-black leading-tight text-gray-900 sm:text-2xl">BTK RDV</div>
              <div className="truncate text-sm font-semibold text-gray-500 sm:text-base">{agency?.name}</div>
            </div>
          </div>

          <div className="text-left sm:text-center">
            <div className={`text-sm font-semibold uppercase ${closed ? 'text-gray-500' : 'text-btk-blue'}`}>
              {closed ? 'Guichets fermes' : 'Guichets en service'}
            </div>
            <div className="mt-1 text-xs text-gray-500">{openStatus.message}</div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5">
            <div className="text-left sm:text-right">
              <div className="font-mono text-xl font-semibold text-gray-900 sm:text-2xl">{clock}</div>
              <div className="text-xs capitalize text-gray-500">{dateStr}</div>
            </div>
            <button
              onClick={() => {
                setSelectedAgency(null)
                setAgencyData(null)
                setLatestCall(null)
                setCallsByGuichet({})
              }}
              className="rounded-lg border border-blue-100 px-3 py-2 text-sm font-semibold text-btk-blue transition hover:bg-blue-50 sm:px-4"
            >
              Changer
            </button>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-stretch justify-center p-3 sm:p-5 lg:min-h-0 lg:items-center">
        <div className="grid w-full gap-4 sm:gap-5 lg:h-full lg:origin-center lg:scale-[0.85] lg:grid-cols-[38%_62%]">
          <div className="relative flex min-h-[320px] overflow-hidden rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-8 lg:h-full lg:p-10">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-blue-50 sm:h-36 sm:w-36" />
            <div className="absolute bottom-0 left-0 h-20 w-20 rounded-tr-full bg-blue-50/70 sm:h-32 sm:w-32" />

            <div className="relative z-10 flex h-full w-full flex-col justify-center">
              <div className="mb-7 flex items-center gap-4 sm:mb-10 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-blue-100 sm:h-24 sm:w-24">
                  <img src="/BTK.png" alt="BTK" className="h-11 w-auto sm:h-16" />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-wide text-btk-blue sm:text-base">BTK RDV</div>
                  <div className="mt-1 max-w-[14rem] truncate text-base font-bold text-gray-600 sm:mt-2 sm:max-w-xs sm:text-xl">
                    {agency?.name || 'Accueil agence'}
                  </div>
                </div>
              </div>

              <div className="border-l-4 border-btk-blue pl-4 sm:border-l-8 sm:pl-7">
                <h1 className="max-w-xl text-4xl font-black leading-[1.12] text-gray-950 sm:text-5xl lg:text-[4rem]">
                  <span className="block">Bienvenue à</span>
                  <span className="block">Notre Agence.</span>
                </h1>
              </div>
            </div>
          </div>

          {closed ? (
            <article className="flex min-h-[260px] flex-col items-center justify-center rounded-lg bg-red-50 px-5 py-8 text-center shadow-sm ring-2 ring-red-200 sm:px-10 lg:h-full lg:min-h-0">
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
            <div
              className="grid gap-3 lg:h-full lg:min-h-0"
              style={guichetCount > 0 ? { gridTemplateRows: `repeat(${guichetCount}, minmax(0, 1fr))` } : undefined}
            >
              {guichetCount === 0 ? (
                <article className="flex min-h-[260px] items-center justify-center rounded-lg bg-white p-6 text-center shadow-sm ring-1 ring-blue-100 lg:h-full">
                  <div>
                    <div className="text-sm font-black uppercase text-btk-blue">Aucun guichet</div>
                    <p className="mt-2 text-base font-semibold text-gray-500">Ajoutez un guichet depuis le dashboard.</p>
                  </div>
                </article>
              ) : guichets.map((g: any) => {
              const call = callsByGuichet[String(g.id)]
              const isClosed = g.isActive === false
              const isLatest = !isClosed && latestCall?.guichetId === g.id
              const statusLabel = isClosed ? 'Guichet fermé' : call ? 'En service' : 'Libre'
              const statusClass = isClosed
                ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                : call
                  ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                  : 'bg-gray-50 text-gray-500 ring-1 ring-gray-200'

              return (
                <article
                  key={g.id}
                  className={`grid min-h-[130px] grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-4 py-4 shadow-sm ring-1 transition-all duration-300 sm:grid-cols-[1fr_150px_auto] sm:gap-4 sm:px-5 lg:min-h-0 ${
                    compactGuichets
                      ? 'sm:min-h-[130px] lg:grid-cols-[1fr_150px_auto] lg:px-4 lg:py-3'
                      : 'sm:min-h-[160px] lg:grid-cols-[1fr_180px_auto]'
                  } ${
                    isLatest && calledAnim
                      ? 'scale-[1.01] ring-4 ring-btk-blue'
                      : isClosed
                        ? 'ring-red-100'
                        : call
                        ? 'ring-blue-200'
                        : 'ring-blue-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase text-gray-400 sm:text-sm">Guichet</div>
                    <h2 className={`mt-1 truncate font-black text-gray-900 ${
                      compactGuichets ? 'text-xl sm:text-2xl lg:text-[1.7rem]' : 'text-2xl sm:text-3xl'
                    }`}>{g.label}</h2>
                    <div className="mt-1 text-sm font-semibold text-gray-500 sm:text-base">
                      {isClosed ? 'Guichet fermé' : call?.service || 'Aucun numero en cours'}
                    </div>
                  </div>

                  <div className={`text-right font-mono font-black leading-none tabular-nums sm:text-center ${
                    compactGuichets ? 'text-4xl sm:text-5xl lg:text-[3.2rem]' : 'text-5xl sm:text-[3.8rem] lg:text-[4.4rem]'
                  } ${
                    !isClosed && call ? 'text-btk-blue' : 'text-gray-200'
                  }`}>
                    {!isClosed && call ? call.number : '---'}
                  </div>

                  <span className={`col-span-2 justify-self-start rounded-full px-4 py-2 text-sm font-bold sm:col-span-1 sm:justify-self-auto ${
                    compactGuichets ? 'sm:text-sm' : 'sm:text-base'
                  } ${statusClass}`}>
                    {statusLabel}
                  </span>
                </article>
              )
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="relative shrink-0 overflow-hidden border-t border-blue-100 bg-white text-btk-blue shadow-[0_-8px_24px_rgba(21,101,192,0.08)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-white/0 sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-white/0 sm:w-24" />

        <div className="ticker-track flex w-max items-center whitespace-nowrap py-2.5 [--ticker-duration:46s] sm:py-3">
          {[0, 1, 2, 3].map(group => (
            <div key={group} className="flex items-center gap-5 px-3 text-sm font-black uppercase tracking-wide sm:gap-7 sm:px-5 sm:text-lg lg:text-xl">
              {tickerItems.map(item => (
                <span key={`${group}-${item}`} className="inline-flex items-center gap-5 sm:gap-7">
                  <span className="rounded-full bg-blue-50 px-4 py-1.5 ring-1 ring-blue-100 sm:px-5">
                    {item}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full bg-btk-blue/70 shadow-[0_0_0_5px_rgba(21,101,192,0.10)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </footer>
    </main>
  )
}
