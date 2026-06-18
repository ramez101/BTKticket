'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

const ADMIN_PIN = 'btk2024'

type DashboardTab = 'agencies' | 'holidays' | 'stats'

interface Guichet {
  id: number
  number: number
  label: string
  agencyId: number
  isActive: boolean
}

interface AgencyTodayStats {
  waiting: number
  called: number
  served: number
  absent: number
  total: number
}

interface Agency {
  id: number
  code: string
  name: string
  city: string
  isActive: boolean
  createdAt?: string
  guichets?: Guichet[]
  todayStats?: AgencyTodayStats
  _count?: { tickets?: number }
}

interface Holiday {
  id: number
  date: string
  label: string | null
  createdAt: string
}

function todayInputDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

function getLoad(waiting: number) {
  if (waiting >= 20) return { label: 'Tres charge', bar: 'bg-red-500', badge: 'bg-red-50 text-red-700 ring-red-200' }
  if (waiting >= 16) return { label: 'Charge', bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-200' }
  if (waiting >= 10) return { label: 'Attente moyenne', bar: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 ring-yellow-200' }
  return { label: "Peu d'attente", bar: 'bg-green-500', badge: 'bg-green-50 text-green-700 ring-green-200' }
}

function getAgencyStats(agency: Agency) {
  const waiting = agency.todayStats?.waiting ?? agency._count?.tickets ?? 0
  const called = agency.todayStats?.called ?? 0
  const served = agency.todayStats?.served ?? 0
  const absent = agency.todayStats?.absent ?? 0
  const total = agency.todayStats?.total ?? waiting + called + served + absent

  return {
    waiting,
    called,
    served,
    absent,
    total,
    estimatedWait: waiting * 4,
  }
}

function getAgencyCapacity(agency: Agency) {
  const guichets = agency.guichets ?? []
  const open = guichets.filter(g => g.isActive).length
  const total = guichets.length

  if (!agency.isActive) {
    return {
      label: 'Agence inactive',
      detail: 'La prise de ticket est stoppee pour cette agence.',
      className: 'bg-gray-50 text-gray-600 ring-gray-200',
    }
  }

  if (total === 0) {
    return {
      label: 'Aucun guichet',
      detail: 'Ajoutez au moins un guichet pour servir la file.',
      className: 'bg-red-50 text-red-700 ring-red-200',
    }
  }

  if (open === 0) {
    return {
      label: 'Guichets fermes',
      detail: 'Aucun guichet ouvert pour appeler les tickets.',
      className: 'bg-orange-50 text-orange-700 ring-orange-200',
    }
  }

  if (open === total) {
    return {
      label: 'Capacite complete',
      detail: 'Tous les guichets sont ouverts.',
      className: 'bg-green-50 text-green-700 ring-green-200',
    }
  }

  return {
    label: 'Capacite partielle',
    detail: `${open} guichet(s) ouvert(s) sur ${total}.`,
    className: 'bg-blue-50 text-btk-blue ring-blue-200',
  }
}

function getAgencyAdvice(agency: Agency) {
  const stats = getAgencyStats(agency)
  const guichets = agency.guichets ?? []
  const open = guichets.filter(g => g.isActive).length
  const closed = guichets.length - open

  if (!agency.isActive) return 'Agence inactive: activez-la pour autoriser les tickets.'
  if (open === 0) return 'Aucun guichet ouvert: ouvrez un guichet avant le debut du service.'
  if (stats.waiting >= 10 && closed > 0) return 'File en hausse: ouvrez un guichet supplementaire si possible.'
  if (stats.waiting === 0) return 'File vide: agence fluide pour le moment.'
  return 'Charge normale: continuez le suivi des appels.'
}

function formatDisplayDate(value?: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(value))
}

function percent(part: number, total: number) {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function getAgencyHealth(agency: Agency) {
  const stats = getAgencyStats(agency)
  const guichets = agency.guichets ?? []
  const open = guichets.filter(g => g.isActive).length
  const total = guichets.length
  const waitingPerOpen = open > 0 ? stats.waiting / open : stats.waiting

  if (!agency.isActive) {
    return {
      label: 'Arret',
      detail: 'Agence inactive, tickets bloques.',
      tone: 'gray' as const,
      bar: 10,
    }
  }

  if (total === 0 || open === 0) {
    return {
      label: 'A ouvrir',
      detail: 'Aucun guichet disponible pour appeler.',
      tone: 'red' as const,
      bar: 18,
    }
  }

  if (waitingPerOpen >= 8) {
    return {
      label: 'Surcharge',
      detail: 'Charge elevee par guichet ouvert.',
      tone: 'red' as const,
      bar: 92,
    }
  }

  if (waitingPerOpen >= 5 || stats.waiting >= 10) {
    return {
      label: 'A surveiller',
      detail: 'File active, un renfort peut aider.',
      tone: 'orange' as const,
      bar: 68,
    }
  }

  return {
    label: 'Stable',
    detail: 'Agence fluide et capacite suffisante.',
    tone: 'green' as const,
    bar: 38,
  }
}

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<DashboardTab>('agencies')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null)

  const [showAddAgency, setShowAddAgency] = useState(false)
  const [showAddGuichet, setShowAddGuichet] = useState<number | null>(null)
  const [editAgency, setEditAgency] = useState<any>(null)
  const [editGuichet, setEditGuichet] = useState<any>(null)

  const [newAgency, setNewAgency] = useState({ name: '', city: '', pin: '' })
  const [newGuichet, setNewGuichet] = useState({ label: '' })
  const [holidayLabel, setHolidayLabel] = useState('')
  const [holidayDates, setHolidayDates] = useState<string[]>([todayInputDate()])

  useEffect(() => {
    if (authed) {
      fetchAgencies()
      fetchHolidays()
    }
  }, [authed])

  async function fetchAgencies() {
    setLoading(true)
    try {
      const data = await fetch('/api/admin/agencies').then(r => r.json())
      setAgencies(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchHolidays() {
    const data = await fetch('/api/admin/holidays', { cache: 'no-store' }).then(r => r.json())
    setHolidays(Array.isArray(data) ? data : [])
  }

  function handlePinLogin() {
    if (pinInput === ADMIN_PIN) {
      setAuthed(true)
      setPinError('')
    } else {
      setPinError('PIN admin incorrect')
      setPinInput('')
    }
  }

  async function runAction(action: () => Promise<void>, success: string) {
    try {
      setNotice('')
      await action()
      await fetchAgencies()
      setNotice(success)
    } catch {
      setNotice('Operation impossible. Verifiez les donnees puis reessayez.')
    }
  }

  async function runHolidayAction(action: () => Promise<void>, success: string) {
    try {
      setNotice('')
      await action()
      await fetchHolidays()
      setNotice(success)
    } catch {
      setNotice('Operation impossible. Verifiez les donnees puis reessayez.')
    }
  }

  function addHolidayDate() {
    setHolidayDates(prev => {
      const lastDate = prev[prev.length - 1] || todayInputDate()
      return [...prev, addDays(lastDate, 1)]
    })
  }

  function updateHolidayDate(index: number, date: string) {
    setHolidayDates(prev => prev.map((value, i) => i === index ? date : value))
  }

  function removeHolidayDate(index: number) {
    setHolidayDates(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))
  }

  async function createHolidays() {
    const dates = holidayDates.filter(Boolean)
    if (dates.length === 0) return

    await runHolidayAction(async () => {
      await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dates, label: holidayLabel }),
      })
      setHolidayLabel('')
      setHolidayDates([todayInputDate()])
    }, dates.length > 1 ? 'Jours feries ajoutes.' : 'Jour ferie ajoute.')
  }

  async function deleteHoliday(id: number) {
    await runHolidayAction(async () => {
      await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' })
    }, 'Jour ferie supprime.')
  }

  async function toggleAgency(id: number, isActive: boolean) {
    await runAction(async () => {
      await fetch(`/api/admin/agencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
    }, !isActive ? 'Agence activee.' : 'Agence desactivee.')
  }

  async function deleteAgency(id: number, name: string) {
    if (!confirm(`Supprimer l'agence "${name}" avec ses guichets et tickets ?`)) return
    await runAction(async () => {
      await fetch(`/api/admin/agencies/${id}`, { method: 'DELETE' })
    }, 'Agence supprimee.')
  }

  async function createAgency() {
    if (!newAgency.name.trim() || !newAgency.city.trim() || !newAgency.pin.trim()) return
    await runAction(async () => {
      await fetch('/api/admin/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgency),
      })
      setNewAgency({ name: '', city: '', pin: '' })
      setShowAddAgency(false)
    }, 'Agence creee avec 3 guichets.')
  }

  async function updateAgency() {
    if (!editAgency) return
    await runAction(async () => {
      await fetch(`/api/admin/agencies/${editAgency.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editAgency.name,
          city: editAgency.city,
          pin: editAgency.newPin || undefined,
          isActive: editAgency.isActive,
        }),
      })
      setEditAgency(null)
    }, 'Agence modifiee.')
  }

  function openAddGuichet(agency: Agency) {
    const maxNumber = Math.max(0, ...(agency.guichets || []).map(g => g.number))
    setNewGuichet({ label: `Guichet ${maxNumber + 1}` })
    setShowAddGuichet(agency.id)
  }

  async function addGuichet() {
    if (showAddGuichet === null || !newGuichet.label.trim()) return
    await runAction(async () => {
      await fetch('/api/admin/guichets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId: showAddGuichet, label: newGuichet.label }),
      })
      setNewGuichet({ label: '' })
      setShowAddGuichet(null)
    }, 'Guichet ajoute.')
  }

  async function toggleGuichet(id: number, isActive: boolean) {
    await runAction(async () => {
      await fetch(`/api/admin/guichets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
    }, !isActive ? 'Guichet ouvert.' : 'Guichet ferme.')
  }

  async function deleteGuichet(id: number, label: string) {
    if (!confirm(`Supprimer "${label}" ?`)) return
    await runAction(async () => {
      await fetch(`/api/admin/guichets/${id}`, { method: 'DELETE' })
    }, 'Guichet supprime.')
  }

  async function updateGuichet() {
    if (!editGuichet) return
    await runAction(async () => {
      await fetch(`/api/admin/guichets/${editGuichet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editGuichet.label }),
      })
      setEditGuichet(null)
    }, 'Guichet modifie.')
  }

  const stats = useMemo(() => {
    const totalGuichets = agencies.reduce((sum, agency) => sum + (agency.guichets?.length ?? 0), 0)
    const openGuichets = agencies.reduce(
      (sum, agency) => sum + (agency.guichets?.filter(g => g.isActive).length ?? 0),
      0,
    )
    const totalWaiting = agencies.reduce((sum, agency) => sum + getAgencyStats(agency).waiting, 0)
    const busiest = [...agencies].sort((a, b) => getAgencyStats(b).waiting - getAgencyStats(a).waiting)[0]

    return {
      totalAgencies: agencies.length,
      activeAgencies: agencies.filter(a => a.isActive).length,
      inactiveAgencies: agencies.filter(a => !a.isActive).length,
      totalGuichets,
      openGuichets,
      closedGuichets: totalGuichets - openGuichets,
      totalWaiting,
      estimatedWait: totalWaiting * 4,
      busiest,
    }
  }, [agencies])

  const filteredAgencies = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return agencies
    return agencies.filter(agency =>
      `${agency.code} ${agency.name} ${agency.city}`.toLowerCase().includes(value),
    )
  }, [agencies, search])

  const selectedAgency = useMemo(() => {
    if (!selectedAgencyId) return null
    return agencies.find(agency => agency.id === selectedAgencyId) ?? null
  }, [agencies, selectedAgencyId])

  const addGuichetAgency = agencies.find(a => a.id === showAddGuichet)
  const isAgencyDetailsOpen = tab === 'agencies' && Boolean(selectedAgency)
  const tabTitle = isAgencyDetailsOpen && selectedAgency
    ? 'Caracteristiques'
    : tab === 'agencies'
    ? 'Agences et guichets'
    : tab === 'holidays'
      ? 'Jours feries'
      : 'Statistiques'
  const tabDescription = isAgencyDetailsOpen && selectedAgency
    ? `${selectedAgency.name} - ${selectedAgency.code} - ${selectedAgency.city}`
    : tab === 'agencies'
    ? 'Gestion des agences, guichets et disponibilites.'
    : tab === 'holidays'
      ? 'Dates de fermeture exceptionnelle du service.'
      : 'Vue globale de la charge et des files.'

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3F8FC] p-6">
        <section className="w-full max-w-sm rounded-lg bg-white p-7 text-center shadow-sm ring-1 ring-blue-100">
          <img src="/BTK.png" alt="BTK" className="mx-auto h-14 w-auto" />
          <h1 className="mt-5 text-2xl font-black text-gray-950">Dashboard Admin</h1>
          <p className="mt-2 text-sm text-gray-500">Gestion agences, guichets et files d'attente</p>

          <input
            type="password"
            className="btk-input mt-6 text-center text-lg tracking-widest"
            placeholder="PIN Admin"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePinLogin()}
          />
          {pinError && <p className="mt-3 text-sm font-semibold text-red-600">{pinError}</p>}
          <button className="mt-4 w-full rounded-lg bg-btk-blue px-5 py-3 font-bold text-white transition hover:bg-btk-dark" onClick={handlePinLogin}>
            Acceder
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F3F8FC]">
      <header className="border-b border-blue-100 bg-white shadow-sm">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white transition hover:bg-blue-50"
              title="Ouvrir le menu"
              aria-label="Ouvrir le menu"
              aria-expanded={menuOpen}
            >
              <img src="/menu.png" alt="" className="h-6 w-6 object-contain" />
            </button>
            <img src="/BTK.png" alt="BTK" className="h-11 w-auto shrink-0" />
            <div className="min-w-0">
              <div className="text-lg font-black leading-tight text-gray-950">Dashboard Admin</div>
              <div className="truncate text-xs font-medium text-gray-500">Gestion des agences BTK</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchAgencies()
                fetchHolidays()
              }}
              className="rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-btk-blue transition hover:bg-blue-50"
            >
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setAuthed(false)}
              className="rounded-lg bg-btk-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-btk-dark"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="fixed left-0 top-0 z-50 flex h-screen w-[310px] max-w-[86vw] flex-col bg-white shadow-2xl ring-1 ring-blue-100">
            <div className="flex items-center justify-between gap-4 border-b border-blue-100 p-5">
              <div>
                <p className="text-xs font-black uppercase text-btk-blue">Menu dashboard</p>
                <h2 className="mt-1 text-xl font-black text-gray-950">Options</h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 text-sm font-black text-gray-500 transition hover:bg-blue-50"
                aria-label="Fermer le menu"
              >
                X
              </button>
            </div>

            <nav className="grid gap-2 p-4">
              <DashboardMenuButton
                active={tab === 'agencies'}
                code="AG"
                label="Agences"
                detail="Agences et guichets"
                onClick={() => {
                  setTab('agencies')
                  setSelectedAgencyId(null)
                  setMenuOpen(false)
                }}
              />
              <DashboardMenuButton
                active={tab === 'holidays'}
                code="JF"
                label="Jours feries"
                detail={`${holidays.length} date(s)`}
                onClick={() => {
                  setTab('holidays')
                  setMenuOpen(false)
                }}
              />
              <DashboardMenuButton
                active={tab === 'stats'}
                code="ST"
                label="Statistiques"
                detail="Charge et attente"
                onClick={() => {
                  setTab('stats')
                  setMenuOpen(false)
                }}
              />
            </nav>

            <div className="mt-auto border-t border-blue-100 p-4">
              <button
                type="button"
                onClick={() => {
                  fetchAgencies()
                  fetchHolidays()
                  setMenuOpen(false)
                }}
                className="w-full rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-50"
              >
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAgency(true)
                  setMenuOpen(false)
                }}
                className="mt-2 w-full rounded-lg bg-btk-blue px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-btk-dark"
              >
                Nouvelle agence
              </button>
            </div>
          </aside>
        </>
      )}

      <section className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <StatCard label="Agences" value={stats.totalAgencies} detail={`${stats.activeAgencies} actives`} tone="blue" />
              <StatCard label="Inactives" value={stats.inactiveAgencies} detail="agences fermees" tone="gray" />
              <StatCard label="Guichets" value={stats.totalGuichets} detail="total" tone="indigo" />
              <StatCard label="Ouverts" value={stats.openGuichets} detail={`${stats.closedGuichets} fermes`} tone="green" />
              <StatCard label="En attente" value={stats.totalWaiting} detail="tickets live" tone="orange" />
              <StatCard label="Attente" value={`~${stats.estimatedWait}m`} detail="estimation totale" tone="red" />
            </div>

            <div className="mt-5 rounded-lg bg-white p-4 shadow-sm ring-1 ring-blue-100">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-btk-blue">Administration</p>
                  <h1 className="mt-1 text-2xl font-black text-gray-950">{tabTitle}</h1>
                  <p className="mt-1 text-sm font-medium text-gray-500">{tabDescription}</p>
                </div>

                {tab !== 'holidays' && !isAgencyDetailsOpen && (
                  <input
                    className="btk-input h-11 min-w-[240px] bg-white"
                    placeholder="Recherche agence, ville, code"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                )}
              </div>

              {notice && (
                <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-100">
                  {notice}
                </div>
              )}
            </div>

            {loading ? (
              <div className="mt-6 rounded-lg bg-white p-10 text-center text-sm font-semibold text-gray-400 shadow-sm ring-1 ring-blue-100">
                Chargement...
              </div>
            ) : tab === 'agencies' ? (
              selectedAgency ? (
                <AgencyDetails
                  agency={selectedAgency}
                  onBack={() => setSelectedAgencyId(null)}
                  onEditAgency={() => setEditAgency({ ...selectedAgency, newPin: '' })}
                  onToggleAgency={() => toggleAgency(selectedAgency.id, selectedAgency.isActive)}
                  onDeleteAgency={() => deleteAgency(selectedAgency.id, selectedAgency.name)}
                  onAddGuichet={() => openAddGuichet(selectedAgency)}
                  onEditGuichet={g => setEditGuichet({ ...g })}
                  onToggleGuichet={g => toggleGuichet(g.id, g.isActive)}
                  onDeleteGuichet={g => deleteGuichet(g.id, g.label)}
                />
              ) : filteredAgencies.length === 0 ? (
                <div className="mt-6 rounded-lg bg-white p-10 text-center text-sm font-semibold text-gray-400 shadow-sm ring-1 ring-blue-100">
                  Aucune agence trouvee.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAgencies.map(agency => (
                    <AgencyPanel
                      key={agency.id}
                      agency={agency}
                      onSelect={() => setSelectedAgencyId(agency.id)}
                      onEditAgency={() => setEditAgency({ ...agency, newPin: '' })}
                      onToggleAgency={() => toggleAgency(agency.id, agency.isActive)}
                      onDeleteAgency={() => deleteAgency(agency.id, agency.name)}
                      onAddGuichet={() => openAddGuichet(agency)}
                    />
                  ))}
                </div>
              )
            ) : tab === 'holidays' ? (
              <HolidaysView
                holidays={holidays}
                holidayDates={holidayDates}
                holidayLabel={holidayLabel}
                onHolidayLabelChange={setHolidayLabel}
                onHolidayDateChange={updateHolidayDate}
                onAddHolidayDate={addHolidayDate}
                onRemoveHolidayDate={removeHolidayDate}
                onCreateHolidays={createHolidays}
                onDeleteHoliday={deleteHoliday}
              />
            ) : (
              <StatsView agencies={filteredAgencies} busiest={stats.busiest} />
            )}
          </div>
      </section>

      {showAddAgency && (
        <Modal title="Nouvelle agence" onClose={() => setShowAddAgency(false)}>
          <div className="space-y-3">
            <input className="btk-input" placeholder="Nom de l'agence" value={newAgency.name} onChange={e => setNewAgency(p => ({ ...p, name: e.target.value }))} />
            <input className="btk-input" placeholder="Ville" value={newAgency.city} onChange={e => setNewAgency(p => ({ ...p, city: e.target.value }))} />
            <input className="btk-input" type="password" placeholder="PIN d'acces" value={newAgency.pin} onChange={e => setNewAgency(p => ({ ...p, pin: e.target.value }))} />
          </div>
          <ModalActions onConfirm={createAgency} onCancel={() => setShowAddAgency(false)} confirmLabel="Creer" />
        </Modal>
      )}

      {editAgency && (
        <Modal title="Modifier agence" onClose={() => setEditAgency(null)}>
          <div className="space-y-3">
            <input className="btk-input" placeholder="Nom" value={editAgency.name} onChange={e => setEditAgency((p: any) => ({ ...p, name: e.target.value }))} />
            <input className="btk-input" placeholder="Ville" value={editAgency.city} onChange={e => setEditAgency((p: any) => ({ ...p, city: e.target.value }))} />
            <input className="btk-input" type="password" placeholder="Nouveau PIN, optionnel" value={editAgency.newPin} onChange={e => setEditAgency((p: any) => ({ ...p, newPin: e.target.value }))} />
          </div>
          <ModalActions onConfirm={updateAgency} onCancel={() => setEditAgency(null)} confirmLabel="Sauvegarder" />
        </Modal>
      )}

      {showAddGuichet !== null && (
        <Modal title={`Ajouter guichet - ${addGuichetAgency?.name ?? ''}`} onClose={() => setShowAddGuichet(null)}>
          <input className="btk-input" placeholder="Nom du guichet" value={newGuichet.label} onChange={e => setNewGuichet({ label: e.target.value })} />
          <ModalActions onConfirm={addGuichet} onCancel={() => setShowAddGuichet(null)} confirmLabel="Ajouter" />
        </Modal>
      )}

      {editGuichet && (
        <Modal title="Modifier guichet" onClose={() => setEditGuichet(null)}>
          <input className="btk-input" value={editGuichet.label} onChange={e => setEditGuichet((p: any) => ({ ...p, label: e.target.value }))} />
          <ModalActions onConfirm={updateGuichet} onCancel={() => setEditGuichet(null)} confirmLabel="Sauvegarder" />
        </Modal>
      )}
    </main>
  )
}

function DashboardMenuButton({
  active,
  code,
  label,
  detail,
  onClick,
}: {
  active: boolean
  code: string
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid grid-cols-[44px_1fr] items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
        active
          ? 'bg-btk-blue text-white shadow-sm'
          : 'bg-white text-gray-700 ring-1 ring-blue-50 hover:bg-blue-50 hover:text-btk-blue'
      }`}
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg text-xs font-black ${
        active ? 'bg-white text-btk-blue' : 'bg-blue-50 text-btk-blue'
      }`}>
        {code}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{label}</span>
        <span className={`mt-0.5 block truncate text-xs font-medium ${active ? 'text-blue-100' : 'text-gray-400'}`}>
          {detail}
        </span>
      </span>
    </button>
  )
}

function AgencyPanel({
  agency,
  onSelect,
  onEditAgency,
  onToggleAgency,
  onDeleteAgency,
  onAddGuichet,
}: {
  agency: Agency
  onSelect: () => void
  onEditAgency: () => void
  onToggleAgency: () => void
  onDeleteAgency: () => void
  onAddGuichet: () => void
}) {
  const guichets = agency.guichets ?? []
  const openGuichets = guichets.filter(g => g.isActive).length
  const stats = getAgencyStats(agency)
  const load = getLoad(stats.waiting)
  const capacity = getAgencyCapacity(agency)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className="cursor-pointer rounded-lg bg-white shadow-sm outline-none ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-btk-blue focus:ring-2 focus:ring-btk-blue"
    >
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-base font-black text-btk-blue">
              {agency.code}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black text-gray-950">{agency.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${agency.isActive ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                  {agency.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${load.badge}`}>
                  {load.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-500">{agency.city}</p>
              <p className="mt-2 text-xs font-bold uppercase text-btk-blue">
                Cliquer pour ouvrir la fiche
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={onEditAgency}>Modifier</ActionButton>
            <ActionButton onClick={onToggleAgency} tone={agency.isActive ? 'orange' : 'green'}>
              {agency.isActive ? 'Desactiver' : 'Activer'}
            </ActionButton>
            <ActionButton onClick={onDeleteAgency} tone="red">Supprimer</ActionButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="En attente" value={stats.waiting} tone="blue" />
          <MiniMetric label="Guichets" value={`${openGuichets}/${guichets.length}`} tone="green" />
          <MiniMetric label="Attente" value={`~${stats.estimatedWait}m`} tone="orange" />
        </div>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${capacity.className}`}>
              {capacity.label}
            </span>
            <span className="text-xs font-bold text-gray-400">{stats.total} ticket(s) aujourd'hui</span>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500">{capacity.detail}</p>
        </div>
      </div>
    </article>
  )
}

function AgencyDetails({
  agency,
  onBack,
  onEditAgency,
  onToggleAgency,
  onDeleteAgency,
  onAddGuichet,
  onEditGuichet,
  onToggleGuichet,
  onDeleteGuichet,
}: {
  agency: Agency
  onBack: () => void
  onEditAgency: () => void
  onToggleAgency: () => void
  onDeleteAgency: () => void
  onAddGuichet: () => void
  onEditGuichet: (guichet: Guichet) => void
  onToggleGuichet: (guichet: Guichet) => void
  onDeleteGuichet: (guichet: Guichet) => void
}) {
  const guichets = agency.guichets ?? []
  const openGuichets = guichets.filter(g => g.isActive).length
  const closedGuichets = guichets.length - openGuichets
  const stats = getAgencyStats(agency)
  const load = getLoad(stats.waiting)
  const capacity = getAgencyCapacity(agency)
  const waitingPercent = Math.min(100, stats.waiting * 5)
  const servedPercent = stats.total > 0 ? Math.round((stats.served / stats.total) * 100) : 0
  const absentPercent = percent(stats.absent, stats.total)
  const openPercent = percent(openGuichets, guichets.length)
  const waitingPerOpen = openGuichets > 0 ? Math.ceil(stats.waiting / openGuichets) : stats.waiting
  const remainingTickets = stats.waiting + stats.called
  const health = getAgencyHealth(agency)

  return (
    <section className="mt-5 rounded-lg bg-white shadow-sm ring-1 ring-blue-100">
      <div className="border-b border-blue-50 p-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 rounded-lg border border-blue-100 bg-white px-4 py-2 text-sm font-black text-btk-blue transition hover:bg-blue-50"
        >
          Retour aux agences
        </button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-btk-blue text-lg font-black text-white">
              {agency.code}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase text-btk-blue">Fiche agence</div>
              <h2 className="mt-1 truncate text-3xl font-black text-gray-950">{agency.name}</h2>
              <p className="mt-1 text-sm font-semibold text-gray-500">{agency.code} - {agency.city}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${agency.isActive ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
              {agency.isActive ? 'Active' : 'Inactive'}
            </span>
            <ActionButton onClick={onEditAgency}>Modifier</ActionButton>
            <ActionButton onClick={onToggleAgency} tone={agency.isActive ? 'orange' : 'green'}>
              {agency.isActive ? 'Desactiver' : 'Activer'}
            </ActionButton>
            <ActionButton onClick={onDeleteAgency} tone="red">Supprimer</ActionButton>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-blue-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase text-gray-500">Caracteristiques</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${load.badge}`}>
                {load.label}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <OperationalMetric
                label="Etat operationnel"
                value={health.label}
                detail={health.detail}
                tone={health.tone}
                percent={health.bar}
              />
              <OperationalMetric
                label="Taux de service"
                value={`${servedPercent}%`}
                detail={`${stats.served} servi(s) sur ${stats.total} ticket(s)`}
                tone={servedPercent >= 70 ? 'green' : servedPercent >= 35 ? 'orange' : 'blue'}
                percent={servedPercent}
              />
              <OperationalMetric
                label="Ouverture guichets"
                value={`${openPercent}%`}
                detail={`${openGuichets} ouvert(s) sur ${guichets.length}`}
                tone={openPercent >= 70 ? 'green' : openPercent > 0 ? 'orange' : 'red'}
                percent={openPercent}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <CharacteristicMetric label="En attente" value={stats.waiting} detail={`${waitingPerOpen} par guichet ouvert`} tone="blue" />
              <CharacteristicMetric label="Temps estime" value={`~${stats.estimatedWait}m`} detail="base 4 min / ticket" tone="orange" />
              <CharacteristicMetric label="Reste a traiter" value={remainingTickets} detail="attente + appeles" tone="indigo" />
              <CharacteristicMetric label="Servis" value={stats.served} detail={`${servedPercent}% du jour`} tone="green" />
              <CharacteristicMetric label="Absents" value={stats.absent} detail={`${absentPercent}% du jour`} tone="red" />
              <CharacteristicMetric label="Total jour" value={stats.total} detail="tickets crees aujourd'hui" tone="gray" />
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-4 ring-1 ring-gray-100">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-black text-gray-800">Charge de la file</span>
                <span className="text-sm font-black text-btk-blue tabular-nums">{stats.waiting} ticket(s) en attente</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${load.bar}`} style={{ width: `${waitingPercent}%` }} />
              </div>
              <div className="mt-3 grid gap-2 text-sm font-semibold text-gray-500 sm:grid-cols-3">
                <span>Conseil: {getAgencyAdvice(agency)}</span>
                <span className="sm:text-center">Charge/guichet: {waitingPerOpen}</span>
                <span className="sm:text-right">Absence: {absentPercent}%</span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase text-gray-500">Guichets</h3>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  onAddGuichet()
                }}
                className="rounded-lg bg-btk-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-btk-dark"
              >
                Ajouter guichet
              </button>
            </div>

            {guichets.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-5 text-center text-sm font-medium text-gray-400">
                Aucun guichet
              </div>
            ) : (
              <div className="divide-y divide-blue-50 rounded-lg border border-blue-50">
                {guichets.map(guichet => (
                  <div key={guichet.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${guichet.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="truncate font-bold text-gray-800">{guichet.label}</span>
                        <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-bold text-gray-500 ring-1 ring-gray-100">
                          N {guichet.number}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-gray-400">
                        {guichet.isActive ? 'Ouvert sur les ecrans' : 'Ferme sur les ecrans'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => onEditGuichet(guichet)}>Modifier</ActionButton>
                      <ActionButton onClick={() => onToggleGuichet(guichet)} tone={guichet.isActive ? 'orange' : 'green'}>
                        {guichet.isActive ? 'Fermer' : 'Ouvrir'}
                      </ActionButton>
                      <ActionButton onClick={() => onDeleteGuichet(guichet)} tone="red">Supprimer</ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
                </div>

        <aside className="space-y-5">
          <section className="rounded-lg bg-blue-50 p-4 ring-1 ring-blue-100">
            <div className="flex items-center justify-between gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${capacity.className}`}>
                {capacity.label}
              </span>
              <span className="text-xs font-black text-btk-blue">{stats.total} ticket(s)</span>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-600">{capacity.detail}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniMetric label="Ouverts" value={openGuichets} tone="green" />
              <MiniMetric label="Fermes" value={closedGuichets} tone="orange" />
              <MiniMetric label="Total" value={guichets.length} tone="blue" />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-black uppercase text-gray-500">Synthese rapide</h3>
            <div className="divide-y divide-blue-50 rounded-lg border border-blue-50">
              <CharacteristicRow label="Etat global" value={health.label} />
              <CharacteristicRow label="Taux service" value={`${servedPercent}%`} />
              <CharacteristicRow label="Ouverture" value={`${openPercent}%`} />
              <CharacteristicRow label="Charge/guichet" value={waitingPerOpen} />
              <CharacteristicRow label="Reste" value={remainingTickets} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-black uppercase text-gray-500">Infos agence</h3>
            <div className="divide-y divide-blue-50 rounded-lg border border-blue-50">
              <CharacteristicRow label="Code agence" value={agency.code} />
              <CharacteristicRow label="Ville" value={agency.city} />
              <CharacteristicRow label="Cree le" value={formatDisplayDate(agency.createdAt)} />
              <CharacteristicRow label="Statut service" value={agency.isActive ? 'Disponible' : 'Ferme'} />
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function CharacteristicMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: ReactNode
  detail: string
  tone: 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'gray'
}) {
  const tones = {
    blue: 'bg-blue-50 text-btk-blue ring-blue-100',
    green: 'bg-green-50 text-green-700 ring-green-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    gray: 'bg-gray-50 text-gray-700 ring-gray-100',
  }

  return (
    <div className={`rounded-lg p-3 ring-1 ${tones[tone]}`}>
      <div className="text-[10px] font-black uppercase opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold opacity-70">{detail}</div>
    </div>
  )
}

function OperationalMetric({
  label,
  value,
  detail,
  tone,
  percent,
}: {
  label: string
  value: ReactNode
  detail: string
  tone: 'blue' | 'green' | 'orange' | 'red' | 'gray'
  percent: number
}) {
  const tones = {
    blue: {
      card: 'bg-blue-50 text-btk-blue ring-blue-100',
      bar: 'bg-btk-blue',
    },
    green: {
      card: 'bg-green-50 text-green-700 ring-green-100',
      bar: 'bg-green-500',
    },
    orange: {
      card: 'bg-orange-50 text-orange-700 ring-orange-100',
      bar: 'bg-orange-500',
    },
    red: {
      card: 'bg-red-50 text-red-700 ring-red-100',
      bar: 'bg-red-500',
    },
    gray: {
      card: 'bg-gray-50 text-gray-700 ring-gray-100',
      bar: 'bg-gray-400',
    },
  }

  const safePercent = Math.max(0, Math.min(100, percent))

  return (
    <div className={`rounded-lg p-4 ring-1 ${tones[tone].card}`}>
      <div className="text-[10px] font-black uppercase opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="mt-1 min-h-8 text-xs font-bold leading-4 opacity-75">{detail}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
        <div className={`h-full rounded-full ${tones[tone].bar}`} style={{ width: `${safePercent}%` }} />
      </div>
    </div>
  )
}

function CharacteristicRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-4 py-3 text-sm">
      <span className="font-bold text-gray-400">{label}</span>
      <span className="min-w-0 truncate font-black text-gray-800">{value}</span>
    </div>
  )
}

function HolidaysView({
  holidays,
  holidayDates,
  holidayLabel,
  onHolidayLabelChange,
  onHolidayDateChange,
  onAddHolidayDate,
  onRemoveHolidayDate,
  onCreateHolidays,
  onDeleteHoliday,
}: {
  holidays: Holiday[]
  holidayDates: string[]
  holidayLabel: string
  onHolidayLabelChange: (value: string) => void
  onHolidayDateChange: (index: number, date: string) => void
  onAddHolidayDate: () => void
  onRemoveHolidayDate: (index: number) => void
  onCreateHolidays: () => void
  onDeleteHoliday: (id: number) => void
}) {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div>
          <p className="text-sm font-black uppercase text-btk-blue">Calendrier</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Ajouter jour ferie</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Le service sera ferme pendant les dates ajoutees. Utilisez + Jour suivant pour un conge de plusieurs jours.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          <input
            className="btk-input"
            placeholder="Motif optionnel, ex: Aid, Nouvel an"
            value={holidayLabel}
            onChange={e => onHolidayLabelChange(e.target.value)}
          />

          <div className="space-y-2">
            {holidayDates.map((date, index) => (
              <div key={`${date}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="date"
                  className="btk-input"
                  value={date}
                  onChange={e => onHolidayDateChange(index, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => onRemoveHolidayDate(index)}
                  disabled={holidayDates.length === 1}
                  className="rounded-lg border border-red-100 px-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Supprimer cette date"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddHolidayDate}
            className="w-full rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-white"
          >
            + Jour suivant
          </button>

          <button
            type="button"
            onClick={onCreateHolidays}
            disabled={!holidayDates.some(Boolean)}
            className="w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Jours feries enregistres</h2>
            <p className="mt-1 text-sm text-gray-500">Ces dates ferment la prise de ticket et les appels guichet.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-btk-blue ring-1 ring-blue-100">
            {holidays.length}
          </span>
        </div>

        {holidays.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-8 text-center text-sm font-semibold text-gray-400">
            Aucun jour ferie configure.
          </div>
        ) : (
          <div className="divide-y divide-blue-50 rounded-lg border border-blue-50">
            {holidays.map(holiday => (
              <div key={holiday.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="font-black text-gray-900">{holiday.date}</div>
                  <div className="mt-1 text-sm font-medium text-gray-500">
                    {holiday.label || 'Jour ferie'}
                  </div>
                </div>
                <ActionButton onClick={() => onDeleteHoliday(holiday.id)} tone="red">
                  Supprimer
                </ActionButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatsView({ agencies, busiest }: { agencies: Agency[]; busiest?: Agency }) {
  const ranked = [...agencies].sort((a, b) => getAgencyStats(b).waiting - getAgencyStats(a).waiting)
  const busiestStats = busiest ? getAgencyStats(busiest) : null

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_420px]">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-950">Charge par agence</h2>
            <p className="mt-1 text-sm text-gray-500">Tickets en attente et estimation.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-btk-blue ring-1 ring-blue-100">
            {agencies.length} agences
          </span>
        </div>

        <div className="space-y-3">
          {ranked.map(agency => {
            const waiting = getAgencyStats(agency).waiting
            const load = getLoad(waiting)
            return (
              <div key={agency.id} className="rounded-lg border border-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-gray-900">{agency.code} - {agency.name}</div>
                    <div className="mt-1 text-xs text-gray-500">{agency.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-btk-blue tabular-nums">{waiting}</div>
                    <div className="text-xs text-gray-400">~{waiting * 4} min</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${load.bar}`} style={{ width: `${Math.min(100, waiting * 5)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
          <h2 className="text-lg font-black text-gray-950">Agence la plus chargee</h2>
          {busiest ? (
            <div className="mt-4 rounded-lg bg-blue-50 p-4 ring-1 ring-blue-100">
              <div className="text-sm font-bold text-btk-blue">{busiest.code}</div>
              <div className="mt-1 text-xl font-black text-gray-950">{busiest.name}</div>
              <div className="mt-1 text-sm text-gray-500">{busiest.city}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="En attente" value={busiestStats?.waiting ?? 0} tone="blue" />
                <MiniMetric label="Temps" value={`~${busiestStats?.estimatedWait ?? 0}m`} tone="orange" />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-gray-50 p-5 text-sm text-gray-400">Aucune donnee</div>
          )}
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
          <h2 className="text-lg font-black text-gray-950">Etat guichets</h2>
          <div className="mt-4 space-y-3">
            {agencies.slice(0, 8).map(agency => {
              const total = agency.guichets?.length ?? 0
              const open = agency.guichets?.filter(g => g.isActive).length ?? 0
              return (
                <div key={agency.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="truncate text-sm font-bold text-gray-700">{agency.name}</span>
                  <span className="text-sm font-black text-green-700">{open}/{total}</span>
                </div>
              )
            })}
          </div>
        </section>
      </aside>
    </div>
  )
}

function StatCard({ label, value, detail, tone }: { label: string; value: ReactNode; detail: string; tone: 'blue' | 'green' | 'orange' | 'red' | 'indigo' | 'gray' }) {
  const tones = {
    blue: 'bg-blue-50 text-btk-blue ring-blue-100',
    green: 'bg-green-50 text-green-700 ring-green-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    gray: 'bg-gray-50 text-gray-600 ring-gray-100',
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-blue-100">
      <div className="text-xs font-black uppercase text-gray-400">{label}</div>
      <div className={`mt-3 inline-flex min-h-12 min-w-16 items-center justify-center rounded-lg px-3 text-2xl font-black tabular-nums ring-1 ${tones[tone]}`}>
        {value}
      </div>
      <div className="mt-2 text-xs font-medium text-gray-500">{detail}</div>
    </div>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: ReactNode; tone: 'blue' | 'green' | 'orange' }) {
  const tones = {
    blue: 'bg-blue-50 text-btk-blue',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
  }

  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-black uppercase opacity-70">{label}</div>
      <div className="mt-1 text-lg font-black tabular-nums">{value}</div>
    </div>
  )
}

function ActionButton({ children, onClick, tone = 'blue' }: { children: ReactNode; onClick: () => void; tone?: 'blue' | 'green' | 'orange' | 'red' }) {
  const tones = {
    blue: 'border-blue-100 text-btk-blue hover:bg-blue-50',
    green: 'border-green-200 text-green-700 hover:bg-green-50',
    orange: 'border-orange-200 text-orange-700 hover:bg-orange-50',
    red: 'border-red-200 text-red-700 hover:bg-red-50',
  }

  return (
    <button
      type="button"
      onClick={event => {
        event.stopPropagation()
        onClick()
      }}
      className={`rounded-lg border bg-white px-3 py-2 text-xs font-bold transition ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl ring-1 ring-blue-100">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-black text-gray-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-blue-100 px-3 py-2 text-sm font-bold text-gray-500 transition hover:bg-blue-50"
          >
            X
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function ModalActions({ onConfirm, onCancel, confirmLabel }: { onConfirm: () => void; onCancel: () => void; confirmLabel: string }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-lg bg-btk-blue px-5 py-3 font-bold text-white transition hover:bg-btk-dark"
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-blue-100 px-5 py-3 font-bold text-btk-blue transition hover:bg-blue-50"
      >
        Annuler
      </button>
    </div>
  )
}
