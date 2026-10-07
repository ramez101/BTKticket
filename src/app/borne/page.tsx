'use client'

import { useEffect, useState } from 'react'
import { SERVICES } from '@/types'
import { formatInternationalPhone } from '@/lib/phone-countries'
import { PhoneCountrySelect } from '@/components/shared/PhoneCountrySelect'

type KioskMode = 'guest' | 'phone'

export default function BornePage() {
  const [agencies, setAgencies] = useState<any[]>([])
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [selectedService, setSelectedService] = useState('')
  const [kioskMode, setKioskMode] = useState<KioskMode | null>(null)
  const [serviceScreenOpen, setServiceScreenOpen] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [phoneCountryCode, setPhoneCountryCode] = useState('TN')
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [clock, setClock] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    fetch('/api/agency').then(r => r.json()).then(setAgencies)

    const tick = () => {
      const now = new Date()
      const tn = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
      setClock(tn.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setDateStr(tn.toLocaleDateString('fr-TN', { weekday: 'long', day: '2-digit', month: 'long' }))
    }

    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await fetch('/api/service-status').then(r => r.json())
        setIsOpen(Boolean(status.open))
      } catch {
        setIsOpen(false)
      }
    }

    checkStatus()
    const t = setInterval(checkStatus, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!selectedAgency || ticket || !serviceScreenOpen) return
    const t = setTimeout(() => resetToWelcome(), 20000)
    return () => clearTimeout(t)
  }, [selectedAgency, ticket, serviceScreenOpen, selectedService, customerPhone, phoneCountryCode])

  useEffect(() => {
    if (!ticket) return
    const t = setTimeout(() => closeTicket(), 20000)
    return () => clearTimeout(t)
  }, [ticket])

  async function generateTicket() {
    if (!selectedAgency || !selectedService) return
    if (kioskMode === 'phone' && !customerPhone.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: selectedAgency.id,
          service: selectedService,
          notificationMode: kioskMode,
          customerPhone: kioskMode === 'phone' ? formatInternationalPhone(phoneCountryCode, customerPhone) : undefined,
        }),
      })

      if (!res.ok) {
        alert('Service ferme')
        return
      }

      const data = await res.json()
      setTicket(data)
    } finally {
      setLoading(false)
    }
  }

  function closeTicket() {
    setTicket(null)
    resetToWelcome()
  }

  function resetToWelcome() {
    setSelectedService('')
    setKioskMode(null)
    setServiceScreenOpen(false)
    setCustomerPhone('')
    setPhoneCountryCode('TN')
  }

  function resetToAgencies() {
    setTicket(null)
    resetToWelcome()
    setSelectedAgency(null)
  }

  if (!selectedAgency) {
    return (
      <main className="flex min-h-screen flex-col bg-[#F3F8FC]">
        <KioskHeader clock={clock} dateStr={dateStr} />

        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-semibold uppercase text-btk-blue">Borne de ticket</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Choisissez votre agence</h1>
            <p className="mt-3 text-base text-gray-500">
              Selectionnez l'agence de la borne pour commencer la generation des tickets.
            </p>
          </div>

          {!isOpen && <ClosedNotice />}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.filter(a => a.isActive).map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgency(a)}
                className="group rounded-lg bg-white p-5 text-left shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-btk-blue"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-btk-blue">
                    {a.code}
                  </span>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                    Active
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 group-hover:text-btk-blue">{a.name}</div>
                <div className="mt-1 text-sm text-gray-500">{a.city}</div>
                <div className="mt-4 text-xs font-medium text-gray-400">
                  {a.guichets?.length ?? 0} guichet(s)
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (!serviceScreenOpen) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-white via-[#edf7ff] to-[#d8ebff]">
        <KioskHeader clock={clock} dateStr={dateStr} agencyName={selectedAgency.name} />

        <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-8 sm:px-6">
          <div className="grid w-full overflow-hidden rounded-[36px] border border-[#dbeaf8] bg-white shadow-[0_40px_100px_-50px_rgba(0,101,161,0.32)] lg:grid-cols-[1fr_1fr]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#003a66] via-[#0065a1] to-[#1780c9] p-7 text-white sm:p-10">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#d8ebff]/20 blur-2xl" />
              <div className="relative flex h-full flex-col justify-between gap-12">
                <div>
                  <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
                    <img src="/BTK.png" alt="BTK" className="h-full w-auto" />
                  </span>
                  <p className="mt-8 text-l font-black uppercase tracking-[0.34em] text-blue-100">Bienvenue</p>
                  <h1 className="mt-3 max-w-md text-5xl font-black leading-tight sm:text-5xl">BTK Easy</h1>
                  <p className="mt-5 max-w-md text-base leading-7 text-blue-100 sm:text-lg">Sélectionnez le mode de connexion souhaité, puis le service correspondant.</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Agence</p>
                  <p className="mt-2 text-2xl font-black">{selectedAgency.name}</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0065a1]">Bonjour!</p>
              <h2 className="mt-3 text-3xl font-black text-[#003a66]">Comment souhaitez-vous prendre votre ticket ?</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">Choisissez une option pour poursuivre vers le choix du service.</p>

              {!isOpen && <ClosedNotice />}

              <div className="mt-7 grid gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setKioskMode('guest')
                    setServiceScreenOpen(true)
                  }}
                  disabled={!isOpen}
                  className="group flex items-center gap-5 rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-[#0065a1] shadow-sm">1</span>
                  <span>
                    <span className="block text-lg font-black text-[#003a66]">Mode invité</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-500">Prendre un ticket rapidement, sans notification.</span>
                  </span>
                  <span className="ml-auto text-2xl font-black text-[#0065a1] transition group-hover:translate-x-1">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setKioskMode('phone')}
                  disabled={!isOpen}
                  className="group flex items-center gap-5 rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#0065a1] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-[#0065a1] shadow-sm">2</span>
                  <span>
                    <span className="block text-lg font-black text-[#003a66]">Recevoir un message SMS</span>
                    <span className="mt-1 block text-sm font-semibold text-slate-500">Saisissez votre numéro pour recevoir l'estimation d'attente.</span>
                  </span>
                  <span className="ml-auto text-2xl font-black text-[#0065a1] transition group-hover:translate-x-1">›</span>
                </button>
              </div>

              {kioskMode === 'phone' && (
                <div className="mt-5 rounded-2xl border border-[#dbeaf8] bg-[#f4fbff] p-5">
                  <label className="block text-sm font-black text-[#003a66]">
                    Numéro de téléphone
                    <div className="mt-2 flex rounded-xl border border-[#dbeaf8] bg-white focus-within:border-[#0065a1] focus-within:ring-2 focus-within:ring-[#e4f2ff]">
                      <PhoneCountrySelect value={phoneCountryCode} onChange={setPhoneCountryCode} className="w-[185px] shrink-0 border-r border-[#dbeaf8]" />
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
                    onClick={() => setServiceScreenOpen(true)}
                    disabled={!customerPhone.trim()}
                    className="mt-4 w-full rounded-xl bg-[#0065a1] px-5 py-3 text-sm font-black text-white transition hover:bg-[#003a66] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Continuer vers les services
                  </button>
                </div>
              )}

              
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F3F8FC]">
      <KioskHeader clock={clock} dateStr={dateStr} agencyName={selectedAgency.name} />

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-8">
        <section className="w-full rounded-lg bg-white p-6 shadow-sm ring-1 ring-blue-100">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-btk-blue">Choix du service</p>
              <h2 className="mt-2 text-3xl font-bold text-gray-900">Selectionner un service</h2>
              <p className="mt-2 text-sm text-gray-500">{selectedAgency.name} - {selectedAgency.city}</p>
            </div>
            <button
              type="button"
              onClick={resetToAgencies}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-blue-100 text-xl font-black text-btk-blue transition hover:bg-blue-50"
              title="Changer d'agence"
            >
              X
            </button>
          </div>

          {!isOpen && <ClosedNotice />}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(s => {
              const active = selectedService === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setSelectedService(s.key)}
                  className={`flex min-h-[130px] flex-col justify-between rounded-lg p-5 text-left ring-1 transition ${
                    active
                      ? 'bg-blue-50 ring-btk-blue shadow-sm'
                      : 'bg-white ring-blue-100 hover:bg-blue-50/50 hover:ring-blue-200'
                  }`}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold ${
                    active ? 'bg-btk-blue text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {s.key.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={`mt-5 text-lg font-bold ${active ? 'text-btk-blue' : 'text-gray-900'}`}>{s.key}</span>
                </button>
              )
            })}
          </div>

          <button
            className="mt-6 w-full rounded-lg bg-btk-blue px-6 py-5 text-lg font-bold text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
            onClick={generateTicket}
            disabled={!selectedService || loading || !isOpen}
          >
            {loading ? 'Generation en cours...' : !isOpen ? 'Service ferme' : 'Generer le ticket'}
          </button>
        </section>
      </section>

      {ticket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-blue-100">
            <div className="flex items-center justify-between border-b border-blue-100 px-5 py-3">
              <div>
                <div className="text-sm font-bold uppercase text-btk-blue">Ticket cree</div>
                <div className="mt-1 text-xs text-gray-500">Fermeture automatique dans 20 secondes</div>
              </div>
              <button
                type="button"
                onClick={closeTicket}
                className="rounded-lg border border-blue-100 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-blue-50"
              >
                X
              </button>
            </div>

            <TicketCard ticket={ticket} clock={clock} />

            <div className="hidden">
              <button
                className="w-full rounded-lg bg-btk-blue px-5 py-3 font-semibold text-white transition hover:bg-btk-dark"
                onClick={closeTicket}
              >
                ❌ Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function TicketCard({ ticket, clock }: { ticket: any; clock: string }) {
  const peopleAhead = Math.max(0, ticket.waitingCount - 1)

  return (
    <div id="ticket-print" className="bg-white">
      <div className="bg-btk-blue px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <img src="/BTK.png" alt="BTK" className="h-7 w-auto" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">BTK Easy</div>
              <div className="text-xs text-blue-100">{ticket.agencyName}</div>
            </div>
          </div>
          <div className="text-right text-xs text-blue-100">{clock}</div>
        </div>
      </div>

      <div className="border-b border-dashed border-blue-100 px-5 py-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Numero</div>
        <div className="mt-1 text-7xl font-black leading-none text-btk-blue tabular-nums">{ticket.number}</div>
        <div className="mt-2 text-sm font-semibold text-gray-700">{ticket.service}</div>
      </div>

      <div className="px-5 py-5">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-lg font-bold text-btk-blue tabular-nums">{peopleAhead}</div>
            <div className="mt-1 text-xs font-medium text-btk-blue/70">Avant vous</div>
          </div>
          <div className="rounded-lg bg-orange-50 p-3">
            <div className="text-lg font-bold text-orange-600 tabular-nums">~{ticket.estimatedWait}</div>
            <div className="mt-1 text-xs font-medium text-orange-600/70">Minutes</div>
          </div>
        </div>

        {ticket.qrCode && (
          <div className="mt-4 flex justify-center">
            <div className="rounded-lg border border-blue-100 bg-white p-2">
              <img src={ticket.qrCode} alt="QR Code" className="h-32 w-32" />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-center text-xs font-medium leading-5 text-gray-500">
          Presentez ce numero lorsque votre tour est affiche a l'ecran.
        </div>
      </div>
    </div>
  )
}

function KioskHeader({ clock, dateStr, agencyName }: { clock: string; dateStr: string; agencyName?: string }) {
  return (
    <header className="shrink-0 border-b border-blue-100 bg-white shadow-sm">
      <div className="mx-auto flex min-h-[82px] w-full max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-4">
          <img src="/BTK.png" alt="BTK" className="h-12 w-auto shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight text-gray-900">BTK Easy</div>
            <div className="truncate text-xs font-medium text-gray-500">{agencyName || 'Borne de tickets'}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-gray-900">{clock}</div>
          <div className="text-sm capitalize text-gray-500">{dateStr}</div>
        </div>
      </div>
    </header>
  )
}

function ClosedNotice() {
  return (
    <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-800 ring-1 ring-amber-200">
      Service disponible du lundi au vendredi de 08h00 a 16h30.
    </div>
  )
}
