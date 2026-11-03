'use client'

import { useState, useEffect, useCallback } from 'react'
import PinModal from '@/components/shared/PinModal'
import BTKHeader from '@/components/shared/BTKHeader'
import { useAgencySocket } from '@/hooks/useSocket'

interface QueueTicket {
  id: number
  number: number
  label: string
  service: string
  createdAt: string
  onHold?: boolean
}

interface CalledTicket {
  id: number
  number: number
  label: string
  service: string
  guichet?: { label: string }
}

export default function AgentPage() {
  const [agencies, setAgencies] = useState<any[]>([])
  const [selectedAgency, setSelectedAgency] = useState<any>(null)
  const [auth, setAuth] = useState<{ guichetId: number; guichetLabel: string } | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [queue, setQueue] = useState<QueueTicket[]>([])
  const [myCalled, setMyCalled] = useState<CalledTicket | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [servedCount, setServedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string>('')
  const [guichets, setGuichets] = useState<any[]>([])
  const [guichetActive, setGuichetActive] = useState(true)
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/agency').then(r => r.json()).then(setAgencies)
  }, [])

  const fetchQueue = useCallback(async () => {
    if (!selectedAgency || !auth) return
    const res = await fetch(`/api/agent/queue?agencyId=${selectedAgency.id}&guichetId=${auth.guichetId}`)
    const data = await res.json()
    setQueue(data.queue || [])
    setMyCalled(data.myCalled || null)
    setHistory(data.history || [])
    setServedCount(data.servedCount || 0)
    setGuichets(data.agency?.guichets || [])
    setGuichetActive(data.currentGuichet?.isActive ?? true)
  }, [selectedAgency, auth])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useAgencySocket(selectedAgency?.id ?? null, {
    onTicketUpdate: (d) => {
      setServedCount(prev => d.servedCount ?? prev)
      if (d.guichetId && typeof d.isActive === 'boolean') {
        setGuichets(prev => prev.map(g => g.id === d.guichetId ? { ...g, isActive: d.isActive } : g))
        if (auth?.guichetId === d.guichetId) setGuichetActive(d.isActive)
      }
      fetchQueue()
    },
    onNewTicket: () => fetchQueue(),
  })

  async function callNext(action: 'next' | 'absent' | 'hold' | 'recall', ticketId?: number) {
    if (!selectedAgency || !auth) return
    setLoading(true)

    try {
      const res = await fetch('/api/agent/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId: selectedAgency.id,
          guichetId: auth.guichetId,
          guichetLabel: auth.guichetLabel,
          action,
          ticketId,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (action === 'hold') {
          setLastAction(data.called ? `Ticket ${data.called.number} appele - ${auth.guichetLabel}` : 'Ticket mis en attente')
        } else if (action === 'recall') {
          setLastAction(data.called ? `Ticket ${data.called.number} relance - ${auth.guichetLabel}` : 'Relance effectuee')
        } else {
          setLastAction(`${action === 'next' ? 'Appel' : 'Absent'} ${data.called?.number ?? ''} - ${auth.guichetLabel}`)
        }
        fetchQueue()
      } else {
        const err = await res.json()
        setLastAction(err.error || 'Erreur')
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleGuichetStatus(guichet: any) {
    if (!guichet?.id) return
    const nextActive = guichet.isActive === false
    setStatusLoadingId(guichet.id)

    try {
      const res = await fetch(`/api/admin/guichets/${guichet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })

      if (res.ok) {
        const updated = await res.json()
        setGuichets(prev => prev.map(g => g.id === updated.id ? updated : g))
        if (auth?.guichetId === updated.id) setGuichetActive(updated.isActive)
        setLastAction(`${updated.label} ${updated.isActive ? 'ouvert' : 'ferme'}`)
        fetchQueue()
      } else {
        setLastAction('Erreur changement etat guichet')
      }
    } finally {
      setStatusLoadingId(null)
    }
  }

  function handlePinSuccess(guichetId: number, guichetLabel: string) {
    setAuth({ guichetId, guichetLabel })
    const initialGuichet = selectedAgency?.guichets?.find((g: any) => g.id === guichetId)
    setGuichetActive(initialGuichet?.isActive ?? true)
    setShowPin(false)
  }

  function resetSession() {
    setAuth(null)
    setSelectedAgency(null)
    setQueue([])
    setMyCalled(null)
    setHistory([])
    setLastAction('')
    setGuichets([])
    setGuichetActive(true)
    setStatusLoadingId(null)
  }

  const activeAgencies = agencies.filter(a => a.isActive)

  if (!selectedAgency) {
    return (
      <main className="workspace-page agent-page min-h-screen bg-[#F3F8FC]">
        <AgentHeader subtitle="Connexion guichet" />

        <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-6 border-b border-blue-100 pb-5">
            <p className="text-sm font-semibold uppercase text-btk-blue">Espace agent</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Selectionner une agence</h1>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAgencies.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedAgency(a); setShowPin(true) }}
                className="group rounded-lg bg-white p-5 text-left shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-btk-blue"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-btk-blue">
                    {a.code}
                  </div>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                    Active
                  </span>
                </div>
                <div className="font-bold text-gray-900 group-hover:text-btk-blue">{a.name}</div>
                <div className="mt-1 text-sm text-gray-500">{a.city}</div>
                <div className="mt-4 text-xs font-medium text-gray-400">
                  {a.guichets?.filter((g: any) => g.isActive !== false).length ?? 0} guichet(s) ouvert(s)
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (!auth) {
    return (
      <main className="workspace-page agent-page min-h-screen bg-[#F3F8FC]">
        <AgentHeader subtitle={selectedAgency.name} />
        {showPin && (
          <PinModal
            agencyName={selectedAgency.name}
            guichets={selectedAgency.guichets || []}
            onSuccess={handlePinSuccess}
          />
        )}

        <section className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-3xl items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-blue-100">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50">
              <img src="/BTK.png" alt="BTK" className="h-9 w-auto" />
            </div>
            <p className="text-sm font-semibold uppercase text-btk-blue">Connexion guichet</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">{selectedAgency.name}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
              Choisissez votre guichet pour acceder a l'espace agent.
            </p>
            <button className="mt-6 rounded-lg bg-btk-blue px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-btk-dark" onClick={() => setShowPin(true)}>
              Se connecter
            </button>
          </div>
        </section>
      </main>
    )
  }

  const nextTicket = queue[0] ?? null
  const activeGuichetCount = guichets.filter(g => g.isActive !== false).length
  const currentGuichet = guichets.find(g => g.id === auth.guichetId) ?? {
    id: auth.guichetId,
    label: auth.guichetLabel,
    isActive: guichetActive,
  }

  return (
    <main className="workspace-page agent-page min-h-screen bg-[#F3F8FC]">
      <AgentHeader
        subtitle={`${selectedAgency.name} - ${auth.guichetLabel}`}
        right={
          <button
            onClick={resetSession}
            className="rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-btk-blue transition hover:bg-blue-50"
          >
            Deconnexion
          </button>
        }
      />

      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="En attente" value={queue.length} tone="blue" />
          <StatCard label="Servis aujourd'hui" value={servedCount} tone="green" />
          <StatCard label="Guichets ouverts" value={activeGuichetCount} tone="orange" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-blue-100">
              <div className="mb-5 flex flex-col gap-3 border-b border-blue-50 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">Ticket en service</p>
                  <h1 className="mt-1 text-lg font-bold text-gray-900">{auth.guichetLabel}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    guichetActive
                      ? 'bg-green-50 text-green-700 ring-green-200'
                      : 'bg-red-50 text-red-700 ring-red-200'
                  }`}>
                    {guichetActive ? 'Ouvert' : 'Guichet ferme'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleGuichetStatus(currentGuichet)}
                    disabled={statusLoadingId === currentGuichet.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      guichetActive
                        ? 'bg-white text-red-700 ring-red-200 hover:bg-red-50'
                        : 'bg-white text-green-700 ring-green-200 hover:bg-green-50'
                    }`}
                  >
                    {statusLoadingId === currentGuichet.id ? '...' : guichetActive ? 'Fermer guichet' : 'Ouvrir guichet'}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-[1fr_240px] md:items-center">
                <div className="text-center md:text-left">
                  <div className={`text-8xl font-black leading-none tabular-nums ${myCalled ? 'text-btk-blue' : 'text-gray-200'}`}>
                    {myCalled ? myCalled.number : '---'}
                  </div>
                  <div className="mt-3 text-sm font-medium text-gray-500">
                    {myCalled ? `Service : ${myCalled.service}` : 'Aucun client appele pour le moment'}
                  </div>
                  {lastAction && (
                    <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600 ring-1 ring-gray-100">
                      {lastAction}
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-[#F7FAFD] p-4 ring-1 ring-blue-100">
                  <div className="text-xs font-semibold uppercase text-gray-400">Prochain ticket</div>
                  <div className="mt-2 text-3xl font-black text-gray-900 tabular-nums">{nextTicket?.number ?? '---'}</div>
                  <div className="mt-1 text-sm text-gray-500">{nextTicket?.service ?? 'File vide'}</div>
                  {!guichetActive && (
                    <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                      Ce guichet est ferme sur l'ecran.
                    </div>
                  )}
                  <div className="mt-5 grid gap-3">
                    <button
                      className="rounded-lg bg-btk-blue px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => callNext('next')}
                      disabled={loading || queue.length === 0 || !guichetActive}
                    >
                      {!guichetActive ? 'Guichet ferme' : loading ? 'Traitement...' : 'Appeler suivant'}
                    </button>
                    <button
                      className="rounded-lg border border-btk-blue px-5 py-3 font-semibold text-btk-blue transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => callNext('absent')}
                      disabled={loading || queue.length === 0 || !guichetActive}
                    >
                      Client absent
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => callNext('hold')}
                      disabled={loading || !myCalled || !guichetActive}
                    >
                      Mettre en attente
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <Panel title="Etat des guichets" emptyText="Aucun guichet">
                {guichets.slice(0, 6).map(g => {
                  const isOpen = g.isActive !== false
                  return (
                    <div key={g.id} className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ring-1 ${
                      isOpen ? 'bg-green-50/70 ring-green-100' : 'bg-red-50/70 ring-red-100'
                    }`}>
                      <div className="min-w-0">
                        <div className={`truncate font-bold ${isOpen ? 'text-green-700' : 'text-red-700'}`}>{g.label}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {isOpen ? "Affiche ouvert sur l'ecran" : "Affiche Guichet ferme sur l'ecran"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGuichetStatus(g)}
                        disabled={statusLoadingId === g.id}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          isOpen
                            ? 'bg-white text-red-700 ring-red-200 hover:bg-red-50'
                            : 'bg-white text-green-700 ring-green-200 hover:bg-green-50'
                        }`}
                      >
                        {statusLoadingId === g.id ? '...' : isOpen ? 'Fermer' : 'Ouvrir'}
                      </button>
                    </div>
                  )
                })}
              </Panel>

              <Panel title="Derniers servis" emptyText="Aucun ticket servi">
                {history.slice(0, 6).map((h, i) => (
                  <div key={`${h.label}-${i}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
                    <div className="font-bold text-gray-700 tabular-nums">{h.number ?? h.label}</div>
                    <div className="truncate text-sm text-gray-500">{h.guichet}</div>
                    <div className="text-xs text-gray-400">
                      {h.time ? new Date(h.time).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                    </div>
                  </div>
                ))}
              </Panel>
            </section>
          </div>

          <aside className="rounded-lg bg-white shadow-sm ring-1 ring-blue-100">
            <div className="flex items-center justify-between border-b border-blue-50 px-5 py-4">
              <div>
                <h2 className="font-bold text-gray-900">File d'attente</h2>
                <p className="mt-1 text-xs text-gray-500">Ordre d'appel en temps reel</p>
              </div>
              <span className="rounded-full bg-btk-blue px-3 py-1 text-xs font-semibold text-white">{queue.length}</span>
            </div>

            {queue.length === 0 ? (
              <div className="flex min-h-[360px] items-center justify-center p-6 text-center text-sm text-gray-400">
                Aucun ticket en attente
              </div>
            ) : (
              <div className="max-h-[620px] divide-y divide-blue-50 overflow-auto">
                {queue.slice(0, 20).map((t, i) => (
                  <div key={t.id} className={`grid grid-cols-[64px_1fr_auto] items-center gap-3 px-5 py-4 ${i === 0 ? 'bg-blue-50/80' : 'bg-white'}`}>
                    <div className={`text-xl font-black tabular-nums ${i === 0 ? 'text-btk-blue' : 'text-gray-700'}`}>{t.number}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-700">{t.service}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>{new Date(t.createdAt).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        {t.onHold && (
                          <span className="rounded-full bg-yellow-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-yellow-700 ring-1 ring-yellow-100">
                            En attente
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i === 0 ? 'bg-btk-blue text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {i === 0 ? 'Prochain' : `#${i + 1}`}
                      </span>
                      {t.onHold && (
                        <button
                          type="button"
                          onClick={() => callNext('recall', t.id)}
                          disabled={loading || !guichetActive}
                          className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Relancer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}

function AgentHeader({ subtitle, right }: { subtitle?: string; right?: React.ReactNode }) {
  return <BTKHeader subtitle={subtitle || 'Espace agent'} right={right} />
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'orange' }) {
  const tones = {
    blue: 'bg-blue-50 text-btk-blue ring-blue-100',
    green: 'bg-green-50 text-green-700 ring-green-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
  }

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
      <div className="text-xs font-semibold uppercase text-gray-400">{label}</div>
      <div className={`mt-3 inline-flex min-w-16 items-center justify-center rounded-lg px-4 py-2 text-3xl font-black tabular-nums ring-1 ${tones[tone]}`}>
        {value}
      </div>
    </div>
  )
}

function Panel({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
      <h2 className="font-bold text-gray-900">{title}</h2>
      <div className="mt-4 grid gap-3">
        {hasChildren ? children : (
          <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  )
}
