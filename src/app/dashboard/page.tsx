'use client'

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PIN = 'btk2024'

type DashboardTab = 'agencies' | 'charges' | 'holidays' | 'service' | 'single-session' | 'ramadan' | 'stats'
type WorkScheduleMode = 'service' | 'single-session' | 'ramadan'

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
  estimatedWait?: number
  averagePassageMinutes?: number
  passageSampleSize?: number
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

interface Charge {
  id: number
  code: string
  name: string
  agencyId: number
  agencyCode: string
  agencyName: string
  city: string
  email?: string | null
  phone?: string | null
  isActive: boolean
  agencyActive: boolean
  appointmentCount?: number
  createdAt?: string
  updatedAt?: string
}

interface ChargeAvailability {
  id?: number
  chargeId?: number
  weekday: number
  enabled: boolean
  startTime: string
  endTime: string
  slotMinutes: number
}

interface Holiday {
  id: number
  date: string
  label: string | null
  createdAt: string
}

interface WorkSchedule {
  key: string
  activeMode: WorkScheduleMode
  singleSessionStart: string
  singleSessionEnd: string
  singleSessionStartMonth: string | null
  singleSessionEndMonth: string | null
  ramadanEnabled: boolean
  ramadanMonth: string | null
  ramadanStartDate: string | null
  ramadanEndDate: string | null
  ramadanStartTime: string
  ramadanEndTime: string
  updatedAt?: string
}

const SERVICE_START_TIME = '08:00'
const SERVICE_END_TIME = '16:30'

const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  key: 'default',
  activeMode: 'service',
  singleSessionStart: SERVICE_START_TIME,
  singleSessionEnd: SERVICE_END_TIME,
  singleSessionStartMonth: null,
  singleSessionEndMonth: null,
  ramadanEnabled: false,
  ramadanMonth: null,
  ramadanStartDate: null,
  ramadanEndDate: null,
  ramadanStartTime: SERVICE_START_TIME,
  ramadanEndTime: '14:00',
}

const WEEKDAY_LABELS = [
  { weekday: 1, label: 'Lundi' },
  { weekday: 2, label: 'Mardi' },
  { weekday: 3, label: 'Mercredi' },
  { weekday: 4, label: 'Jeudi' },
  { weekday: 5, label: 'Vendredi' },
]

function defaultChargeAvailability(): ChargeAvailability[] {
  return WEEKDAY_LABELS.map(({ weekday }) => ({
    weekday,
    enabled: weekday >= 1 && weekday <= 5,
    startTime: '08:30',
    endTime: '16:00',
    slotMinutes: 30,
  }))
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
  const averagePassageMinutes = agency.todayStats?.averagePassageMinutes ?? 4
  const passageSampleSize = agency.todayStats?.passageSampleSize ?? 0

  return {
    waiting,
    called,
    served,
    absent,
    total,
    estimatedWait: agency.todayStats?.estimatedWait ?? waiting * averagePassageMinutes,
    averagePassageMinutes,
    passageSampleSize,
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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isTimeRangeValid(start: string, end: string) {
  return Boolean(start && end) && timeToMinutes(start) < timeToMinutes(end)
}

function displayTimeRange(start: string, end: string) {
  return `${start} - ${end}`
}

function normalizeWorkScheduleMode(value: unknown): WorkScheduleMode {
  if (value === 'service' || value === 'single-session' || value === 'ramadan') return value
  return 'service'
}

function isValidMonthInput(value: string | null) {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
}

function displayMonth(value: string | null) {
  if (!value) return 'Mois non defini'
  const [year, month] = value.split('-')
  return `${month}/${year}`
}

function displayMonthRange(start: string | null, end: string | null) {
  if (!start || !end) return 'Mois non definis'
  return `${displayMonth(start)} - ${displayMonth(end)}`
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
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(DEFAULT_WORK_SCHEDULE)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<DashboardTab>('agencies')
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedAgencyId, setSelectedAgencyId] = useState<number | null>(null)

  const [showAddAgency, setShowAddAgency] = useState(false)
  const [showAddGuichet, setShowAddGuichet] = useState<number | null>(null)
  const [editAgency, setEditAgency] = useState<any>(null)
  const [editGuichet, setEditGuichet] = useState<any>(null)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [editCharge, setEditCharge] = useState<any>(null)
  const [calendarCharge, setCalendarCharge] = useState<Charge | null>(null)
  const [chargeAvailability, setChargeAvailability] = useState<ChargeAvailability[]>(defaultChargeAvailability())

  const [newAgency, setNewAgency] = useState({ name: '', city: '', pin: '' })
  const [newGuichet, setNewGuichet] = useState({ label: '' })
  const [newCharge, setNewCharge] = useState({ code: '', name: '', agencyId: '', email: '', phone: '' })
  const [holidayLabel, setHolidayLabel] = useState('')
  const [holidayDates, setHolidayDates] = useState<string[]>([todayInputDate()])

  useEffect(() => {
    if (authed) {
      fetchAgencies()
      fetchCharges()
      fetchHolidays()
      fetchWorkSchedule()
    }
  }, [authed])

  useEffect(() => {
    if (!authed) return

    const timer = setInterval(() => {
      fetchAgencies(false)
      fetchCharges(false)
    }, 5000)

    return () => clearInterval(timer)
  }, [authed])

  async function fetchAgencies(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const data = await fetch('/api/admin/agencies').then(r => r.json())
      setAgencies(Array.isArray(data) ? data : [])
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function fetchCharges(showLoading = false) {
    if (showLoading) setLoading(true)
    try {
      const data = await fetch('/api/admin/charges', { cache: 'no-store' }).then(r => r.json())
      setCharges(Array.isArray(data) ? data : [])
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  async function fetchHolidays() {
    const data = await fetch('/api/admin/holidays', { cache: 'no-store' }).then(r => r.json())
    setHolidays(Array.isArray(data) ? data : [])
  }

  async function fetchWorkSchedule() {
    const data = await fetch('/api/admin/hours', { cache: 'no-store' }).then(r => r.json())
    setWorkSchedule({
      ...DEFAULT_WORK_SCHEDULE,
      ...data,
      activeMode: normalizeWorkScheduleMode(data?.activeMode),
      singleSessionStartMonth: data?.singleSessionStartMonth ?? null,
      singleSessionEndMonth: data?.singleSessionEndMonth ?? null,
      ramadanMonth: data?.ramadanMonth ?? data?.ramadanStartDate?.slice?.(0, 7) ?? null,
      ramadanEnabled: normalizeWorkScheduleMode(data?.activeMode) === 'ramadan',
      ramadanStartDate: data?.ramadanStartDate ?? null,
      ramadanEndDate: data?.ramadanEndDate ?? null,
    })
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

  async function runChargeAction(action: () => Promise<void>, success: string) {
    try {
      setNotice('')
      await action()
      await fetchCharges()
      setNotice(success)
    } catch {
      setNotice('Operation charge impossible. Verifiez les donnees puis reessayez.')
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

  async function runScheduleAction(action: () => Promise<void>, success: string) {
    try {
      setNotice('')
      await action()
      await fetchWorkSchedule()
      setNotice(success)
    } catch {
      setNotice('Horaire impossible a enregistrer. Verifiez les donnees puis reessayez.')
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

  async function saveWorkSchedule(success: string, override?: Partial<WorkSchedule>) {
    await runScheduleAction(async () => {
      const nextSchedule = {
        ...workSchedule,
        ...override,
      }
      const response = await fetch('/api/admin/hours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSchedule),
      })

      if (!response.ok) {
        throw new Error('Invalid schedule')
      }
    }, success)
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

  async function createCharge() {
    if (!newCharge.name.trim() || !newCharge.agencyId || !newCharge.email.trim()) {
      setNotice('Nom, agence et email du charge sont obligatoires.')
      return
    }
    await runChargeAction(async () => {
      const response = await fetch('/api/admin/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCharge.code || undefined,
          name: newCharge.name,
          agencyId: Number(newCharge.agencyId),
          email: newCharge.email,
          phone: newCharge.phone,
        }),
      })
      if (!response.ok) throw new Error('Charge invalid')
      setNewCharge({ code: '', name: '', agencyId: '', email: '', phone: '' })
      setShowAddCharge(false)
    }, 'Charge ajoute.')
  }

  async function updateCharge() {
    if (!editCharge) return
    if (!String(editCharge.email ?? '').trim()) {
      setNotice('Email du charge obligatoire.')
      return
    }
    await runChargeAction(async () => {
      const response = await fetch(`/api/admin/charges/${editCharge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editCharge.code,
          name: editCharge.name,
          agencyId: Number(editCharge.agencyId),
          email: editCharge.email,
          phone: editCharge.phone,
          isActive: editCharge.isActive,
        }),
      })
      if (!response.ok) throw new Error('Charge invalid')
      setEditCharge(null)
    }, 'Charge modifie.')
  }

  async function toggleCharge(charge: Charge) {
    await runChargeAction(async () => {
      const response = await fetch(`/api/admin/charges/${charge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !charge.isActive }),
      })
      if (!response.ok) throw new Error('Charge invalid')
    }, charge.isActive ? 'Charge desactive.' : 'Charge active.')
  }

  async function deleteCharge(charge: Charge) {
    if (!confirm(`Supprimer le charge "${charge.name}" avec ses rendez-vous ?`)) return
    await runChargeAction(async () => {
      const response = await fetch(`/api/admin/charges/${charge.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Charge invalid')
      if (calendarCharge?.id === charge.id) setCalendarCharge(null)
    }, 'Charge supprime.')
  }

  async function openChargeCalendar(charge: Charge) {
    setCalendarCharge(charge)
    setChargeAvailability(defaultChargeAvailability())
    try {
      const data = await fetch(`/api/admin/charges/${charge.id}/availability`, { cache: 'no-store' }).then(r => r.json())
      setChargeAvailability(Array.isArray(data.availability) ? data.availability : defaultChargeAvailability())
    } catch {
      setNotice('Calendrier charge indisponible.')
    }
  }

  function updateChargeAvailability(weekday: number, patch: Partial<ChargeAvailability>) {
    setChargeAvailability(prev => prev.map(item => (
      item.weekday === weekday ? { ...item, ...patch } : item
    )))
  }

  async function saveChargeCalendar() {
    if (!calendarCharge) return
    await runChargeAction(async () => {
      const response = await fetch(`/api/admin/charges/${calendarCharge.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: chargeAvailability }),
      })
      if (!response.ok) throw new Error('Invalid calendar')
      setCalendarCharge(null)
    }, 'Calendrier charge enregistre.')
  }

  const stats = useMemo(() => {
    const totalGuichets = agencies.reduce((sum, agency) => sum + (agency.guichets?.length ?? 0), 0)
    const openGuichets = agencies.reduce(
      (sum, agency) => sum + (agency.guichets?.filter(g => g.isActive).length ?? 0),
      0,
    )
    const totalWaiting = agencies.reduce((sum, agency) => sum + getAgencyStats(agency).waiting, 0)
    const estimatedWait = agencies.reduce((sum, agency) => sum + getAgencyStats(agency).estimatedWait, 0)
    const busiest = [...agencies].sort((a, b) => getAgencyStats(b).waiting - getAgencyStats(a).waiting)[0]

    return {
      totalAgencies: agencies.length,
      activeAgencies: agencies.filter(a => a.isActive).length,
      inactiveAgencies: agencies.filter(a => !a.isActive).length,
      totalCharges: charges.length,
      activeCharges: charges.filter(charge => charge.isActive).length,
      totalGuichets,
      openGuichets,
      closedGuichets: totalGuichets - openGuichets,
      totalWaiting,
      estimatedWait,
      busiest,
    }
  }, [agencies, charges])

  const filteredAgencies = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return agencies
    return agencies.filter(agency =>
      `${agency.code} ${agency.name} ${agency.city}`.toLowerCase().includes(value),
    )
  }, [agencies, search])

  const filteredCharges = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return charges
    return charges.filter(charge =>
      `${charge.code} ${charge.name} ${charge.agencyCode} ${charge.agencyName} ${charge.city}`.toLowerCase().includes(value),
    )
  }, [charges, search])

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
    : tab === 'charges'
      ? 'Config charge'
    : tab === 'holidays'
      ? 'Jours feries'
      : tab === 'service'
        ? 'SERVICE'
      : tab === 'single-session'
        ? 'Seance unique'
        : tab === 'ramadan'
          ? 'Ramadan'
      : 'Statistiques'
  const tabDescription = isAgencyDetailsOpen && selectedAgency
    ? `${selectedAgency.name} - ${selectedAgency.code} - ${selectedAgency.city}`
    : tab === 'agencies'
    ? 'Gestion des agences, guichets et disponibilites.'
    : tab === 'charges'
      ? 'Gestion des charges, affectation agence et calendriers RDV.'
    : tab === 'holidays'
      ? 'Dates de fermeture exceptionnelle du service.'
      : tab === 'service'
        ? 'Horaire par defaut du service: 08:00 - 16:30.'
      : tab === 'single-session'
        ? 'Horaire special applique pendant les mois choisis.'
        : tab === 'ramadan'
          ? 'Mois Ramadan et horaire applique pendant ce mois.'
      : 'Vue globale de la charge et des files.'
  const dashboardNavigation: { key: DashboardTab; code: string; label: string; detail: string }[] = [
    { key: 'agencies', code: 'AG', label: 'Agences', detail: `${stats.activeAgencies} agences actives` },
    { key: 'charges', code: 'CH', label: 'Charges', detail: `${charges.length} conseillers` },
    { key: 'holidays', code: 'JF', label: 'Jours fériés', detail: `${holidays.length} dates configurées` },
    { key: 'service', code: 'SV', label: 'Service standard', detail: displayTimeRange(SERVICE_START_TIME, SERVICE_END_TIME) },
    { key: 'single-session', code: 'SU', label: 'Séance unique', detail: workSchedule.activeMode === 'single-session' ? 'Mode actif' : 'Mode inactif' },
    { key: 'ramadan', code: 'RA', label: 'Ramadan', detail: workSchedule.activeMode === 'ramadan' ? 'Mode actif' : 'Mode inactif' },
    { key: 'stats', code: 'ST', label: 'Statistiques', detail: 'Charge et attente' },
  ]

  if (!authed) {
    return (
        <main className="dashboard-page dashboard-login flex min-h-screen items-center justify-center p-6">
          <section className="dashboard-login-card w-full max-w-md bg-white p-7 text-center sm:p-9">
            <img src="/BTK.png" alt="BTK" className="mx-auto h-12 w-auto" />
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-btk-blue">Espace sécurisé</p>
            <h1 className="mt-2 text-2xl font-black text-[#102746]">Dashboard Admin</h1>
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
          <button className="mt-4 w-full rounded-xl bg-btk-blue px-5 py-3 font-bold text-white transition hover:bg-btk-dark focus:outline-none focus:ring-4 focus:ring-blue-100" onClick={handlePinLogin}>
            Acceder
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className={`dashboard-page dashboard-shell min-h-screen ${sidebarCollapsed ? 'dashboard-shell--sidebar-collapsed' : ''}`}>
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-inner">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="dashboard-topbar-menu lg:hidden"
            title="Ouvrir le menu"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
          >
            <img src="/menu.png" alt="" />
          </button>
          <div className="dashboard-topbar-brand lg:hidden">
            <span className="dashboard-sidebar-brand-mark"><img src="/BTK.png" alt="BTK" /></span>
            <span><strong>BTK Easy</strong><small>Gestion des agences BTK</small></span>
          </div>
          <label className="dashboard-topbar-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une agence, un guichet, un code..."
              aria-label="Rechercher dans le dashboard"
            />
          </label>
          <div className="dashboard-topbar-actions">
            <button
              type="button"
              onClick={() => {
                fetchAgencies()
                fetchCharges()
                fetchHolidays()
                fetchWorkSchedule()
              }}
              className="dashboard-topbar-refresh"
            >
              <span aria-hidden="true">↻</span> Actualiser
            </button>
            <span className="dashboard-topbar-user-icon" aria-hidden="true">●</span>
            <span className="dashboard-topbar-user dashboard-topbar-profile">
              <strong>Administrateur</strong>
              <small><i aria-hidden="true" /> En ligne</small>
            </span>
            <button type="button" className="dashboard-topbar-logout" onClick={() => setAuthed(false)}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
          />
          <aside className="dashboard-mobile-menu fixed inset-y-0 left-0 z-50 flex h-dvh w-[310px] max-w-[86vw] flex-col bg-white shadow-2xl ring-1 ring-blue-100 lg:hidden">
            <div className="dashboard-sidebar-top">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="dashboard-sidebar-toggle"
                aria-label="Fermer le menu"
              >
                ×
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="grid gap-2">
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
                active={tab === 'charges'}
                code="CH"
                label="Config charge"
                detail={`${charges.length} charge(s)`}
                onClick={() => {
                  setTab('charges')
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
                active={tab === 'service'}
                code="SV"
                label="SERVICE"
                detail={workSchedule.activeMode === 'service' ? `Actif - ${displayTimeRange(SERVICE_START_TIME, SERVICE_END_TIME)}` : displayTimeRange(SERVICE_START_TIME, SERVICE_END_TIME)}
                onClick={() => {
                  setTab('service')
                  setSelectedAgencyId(null)
                  setMenuOpen(false)
                }}
              />
              <DashboardMenuButton
                active={tab === 'single-session'}
                code="SU"
                label="Seance unique"
                detail={workSchedule.activeMode === 'single-session' ? displayMonthRange(workSchedule.singleSessionStartMonth, workSchedule.singleSessionEndMonth) : 'Non active'}
                onClick={() => {
                  setTab('single-session')
                  setSelectedAgencyId(null)
                  setMenuOpen(false)
                }}
              />
              <DashboardMenuButton
                active={tab === 'ramadan'}
                code="RA"
                label="Ramadan"
                detail={workSchedule.activeMode === 'ramadan' ? displayMonth(workSchedule.ramadanMonth) : 'Non actif'}
                onClick={() => {
                  setTab('ramadan')
                  setSelectedAgencyId(null)
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
              <DashboardMenuButton
                active={false}
                code="DC"
                label="Dashboard chargé"
                detail="Connexion chargé"
                onClick={() => {
                  router.push('/charge-dashboard')
                  setMenuOpen(false)
                }}
              />
              </div>
            </nav>

            <div className="shrink-0 border-t border-blue-100 p-4">
              <button
                type="button"
                onClick={() => {
                  fetchAgencies()
                  fetchCharges()
                  fetchHolidays()
                  fetchWorkSchedule()
                  setMenuOpen(false)
                }}
                className="w-full rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-50"
              >
                Actualiser
              </button>
              {(tab === 'charges' || tab === 'agencies') && (
                <button
                  type="button"
                  onClick={() => {
                    if (tab === 'charges') setShowAddCharge(true)
                    else setShowAddAgency(true)
                    setMenuOpen(false)
                  }}
                  className="mt-2 w-full rounded-lg bg-btk-blue px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-btk-dark"
                >
                  {tab === 'charges' ? 'Nouveau chargé' : 'Nouvelle agence'}
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      <div className="dashboard-layout">
        <aside className={`dashboard-sidebar sticky top-[76px] hidden shrink-0 flex-col px-4 py-5 lg:flex ${sidebarCollapsed ? 'dashboard-sidebar--collapsed' : ''}`}>
          <div className="dashboard-sidebar-brand">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(value => !value)}
              className="dashboard-sidebar-toggle dashboard-sidebar-brand-toggle"
              aria-label={sidebarCollapsed ? 'Agrandir le menu' : 'Reduire le menu'}
              title={sidebarCollapsed ? 'Agrandir le menu' : 'Reduire le menu'}
            >
              {sidebarCollapsed ? '>' : '<'}
            </button>
            <span className="dashboard-sidebar-brand-mark"><img src="/BTK.png" alt="BTK" /></span>
            <span><strong>BTK Easy</strong><small>Gestion des agences BTK</small></span>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Navigation dashboard">
            <p className="dashboard-nav-section-label">Gestion</p>
            {dashboardNavigation.filter(item => item.key !== 'stats').map(item => (
              <DashboardMenuButton
                key={item.key}
                active={tab === item.key}
                code={item.code}
                label={item.label}
                detail={item.detail}
                onClick={() => {
                  setTab(item.key)
                  if (item.key === 'agencies' || item.key === 'charges' || item.key === 'service' || item.key === 'single-session' || item.key === 'ramadan') {
                    setSelectedAgencyId(null)
                  }
                }}
              />
            ))}
            <p className="dashboard-nav-section-label dashboard-nav-section-label--stats">Statistiques</p>
            {dashboardNavigation.filter(item => item.key === 'stats').map(item => (
              <DashboardMenuButton
                key={item.key}
                active={tab === item.key}
                code={item.code}
                label={item.label}
                detail={item.detail}
                onClick={() => setTab(item.key)}
              />
            ))}
            <DashboardMenuButton
              active={false}
              code="DC"
              label="Dashboard chargé"
              detail="Connexion conseiller"
              onClick={() => router.push('/charge-dashboard')}
            />
          </nav>
          <div className="mt-4 shrink-0 border-t border-[#e8edf4] pt-4">
            {(tab === 'charges' || tab === 'agencies') ? (
              <button
                type="button"
                onClick={() => tab === 'charges' ? setShowAddCharge(true) : setShowAddAgency(true)}
                className="w-full rounded-xl bg-btk-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-btk-dark focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                {tab === 'charges' ? '+ Ajouter un chargé' : '+ Ajouter une agence'}
              </button>
            ) : (
              <div className="rounded-xl bg-[#f4f8fc] px-3 py-3 text-center text-xs font-semibold text-slate-500">
                Paramètres BTK Easy
              </div>
            )}
            <p className="dashboard-sidebar-footer mt-3 text-center text-[10px] font-medium text-slate-400">BTK Easy · Administration</p>
          </div>
        </aside>

      <section className="dashboard-content">
        <div className="mx-auto min-w-0 max-w-none">
            <div className="dashboard-page-intro">
              <div>
                <div className="dashboard-breadcrumb"><span aria-hidden="true">⌂</span> Accueil</div>
                <h1>{tab === 'agencies' ? 'Tableau de bord' : tabTitle}</h1>
                <p>{tab === 'agencies' ? 'Vue d’ensemble de la gestion des agences BTK' : tabDescription}</p>
              </div>
              <div className="dashboard-date">
                <strong>Aujourd’hui</strong>
                <span>Suivi en temps réel</span>
              </div>
            </div>
            <div className="dashboard-kpi-grid">
              <StatCard label="Agences" value={stats.totalAgencies} detail={`${stats.activeAgencies} actives`} tone="blue" />
              <StatCard label="Inactives" value={stats.inactiveAgencies} detail="agences fermees" tone="gray" />
              <StatCard label="Charges" value={stats.totalCharges} detail={`${stats.activeCharges} actifs`} tone="indigo" />
              <StatCard label="Guichets" value={stats.totalGuichets} detail="total" tone="indigo" />
              <StatCard label="Ouverts" value={stats.openGuichets} detail={`${stats.closedGuichets} fermes`} tone="green" />
              <StatCard label="En attente" value={stats.totalWaiting} detail="tickets live" tone="orange" />
              <StatCard label="Attente" value={`~${stats.estimatedWait}m`} detail="estimation totale" tone="red" />
            </div>

            <div className="dashboard-toolbar mt-5 p-5 sm:p-6">
              <div className="dashboard-toolbar-heading">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-btk-blue">Administration</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102746] sm:text-3xl">{tabTitle}</h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">{tabDescription}</p>
                </div>

                <div className="dashboard-toolbar-controls">
                  {(tab === 'agencies' || tab === 'charges' || tab === 'stats') && !isAgencyDetailsOpen && (
                    <input
                      className="btk-input h-11 min-w-[240px] rounded-xl bg-[#f8fafc]"
                      placeholder={tab === 'charges' ? 'Recherche charge, agence, code' : 'Recherche agence, ville, code'}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  )}
                  {tab === 'agencies' && !isAgencyDetailsOpen && (
                    <button type="button" className="dashboard-add-button" onClick={() => setShowAddAgency(true)}>
                      <span aria-hidden="true">＋</span> Ajouter une agence
                    </button>
                  )}
                </div>
              </div>

              {notice && (
                <div className="dashboard-notice mt-4 px-4 py-3 text-sm font-semibold">
                  {notice}
                </div>
              )}
            </div>

            {loading ? (
              <div className="mt-6 rounded-2xl border border-[#e2eaf3] bg-white p-10 text-center text-sm font-semibold text-gray-400 shadow-sm">
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
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredAgencies.map(agency => (
                    <AgencyPanel
                      key={agency.id}
                      agency={agency}
                      onSelect={() => setSelectedAgencyId(agency.id)}
                      onToggleAgency={() => toggleAgency(agency.id, agency.isActive)}
                    />
                  ))}
                </div>
              )
            ) : tab === 'charges' ? (
              <ChargesView
                charges={filteredCharges}
                agencies={agencies}
                onAdd={() => setShowAddCharge(true)}
                onEdit={charge => setEditCharge({ ...charge })}
                onCalendar={openChargeCalendar}
                onToggle={toggleCharge}
                onDelete={deleteCharge}
              />
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
            ) : tab === 'service' ? (
              <ServiceScheduleView
                schedule={workSchedule}
                onSave={() => saveWorkSchedule('SERVICE active.', { activeMode: 'service', ramadanEnabled: false })}
              />
            ) : tab === 'single-session' ? (
              <SingleSessionView
                schedule={workSchedule}
                onChange={setWorkSchedule}
                onSave={() => saveWorkSchedule('Horaire seance unique enregistre.')}
              />
            ) : tab === 'ramadan' ? (
              <RamadanView
                schedule={workSchedule}
                onChange={setWorkSchedule}
                onSave={() => saveWorkSchedule('Horaire Ramadan enregistre.')}
              />
            ) : (
              <StatsView agencies={filteredAgencies} busiest={stats.busiest} />
            )}
          </div>
      </section>
      </div>

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

      {showAddCharge && (
        <Modal title="Nouveau charge" onClose={() => setShowAddCharge(false)}>
          <div className="space-y-3">
            <input className="btk-input" placeholder="Code optionnel, ex: CH0001" value={newCharge.code} onChange={e => setNewCharge(p => ({ ...p, code: e.target.value }))} />
            <input className="btk-input" placeholder="Nom du charge" value={newCharge.name} onChange={e => setNewCharge(p => ({ ...p, name: e.target.value }))} />
            <select className="btk-input" value={newCharge.agencyId} onChange={e => setNewCharge(p => ({ ...p, agencyId: e.target.value }))}>
              <option value="">Choisir agence</option>
              {agencies.map(agency => (
                <option key={agency.id} value={agency.id}>{agency.code} - {agency.name}</option>
              ))}
            </select>
            <input type="email" required className="btk-input" placeholder="Email du charge (obligatoire)" value={newCharge.email} onChange={e => setNewCharge(p => ({ ...p, email: e.target.value }))} />
            <input className="btk-input" placeholder="Telephone optionnel" value={newCharge.phone} onChange={e => setNewCharge(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <ModalActions onConfirm={createCharge} onCancel={() => setShowAddCharge(false)} confirmLabel="Ajouter" />
        </Modal>
      )}

      {editCharge && (
        <Modal title="Modifier charge" onClose={() => setEditCharge(null)}>
          <div className="space-y-3">
            <input className="btk-input" placeholder="Code" value={editCharge.code} onChange={e => setEditCharge((p: any) => ({ ...p, code: e.target.value }))} />
            <input className="btk-input" placeholder="Nom du charge" value={editCharge.name} onChange={e => setEditCharge((p: any) => ({ ...p, name: e.target.value }))} />
            <select className="btk-input" value={editCharge.agencyId} onChange={e => setEditCharge((p: any) => ({ ...p, agencyId: Number(e.target.value) }))}>
              {agencies.map(agency => (
                <option key={agency.id} value={agency.id}>{agency.code} - {agency.name}</option>
              ))}
            </select>
            <input type="email" required className="btk-input" placeholder="Email du charge (obligatoire)" value={editCharge.email ?? ''} onChange={e => setEditCharge((p: any) => ({ ...p, email: e.target.value }))} />
            <input className="btk-input" placeholder="Telephone optionnel" value={editCharge.phone ?? ''} onChange={e => setEditCharge((p: any) => ({ ...p, phone: e.target.value }))} />
            <label className="flex items-center justify-between gap-4 rounded-lg bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
              <span>
                <span className="block text-sm font-black text-gray-900">Charge actif</span>
                <span className="mt-0.5 block text-xs font-semibold text-gray-500">Visible dans la prise de RDV client</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#1565C0]"
                checked={editCharge.isActive}
                onChange={e => setEditCharge((p: any) => ({ ...p, isActive: e.target.checked }))}
              />
            </label>
          </div>
          <ModalActions onConfirm={updateCharge} onCancel={() => setEditCharge(null)} confirmLabel="Sauvegarder" />
        </Modal>
      )}

      {calendarCharge && (
        <Modal title={`Calendrier - ${calendarCharge.name}`} onClose={() => setCalendarCharge(null)} wide>
          <div className="space-y-3">
            {WEEKDAY_LABELS.map(({ weekday, label }) => {
              const item = chargeAvailability.find(value => value.weekday === weekday) ?? {
                weekday,
                enabled: false,
                startTime: '08:30',
                endTime: '16:00',
                slotMinutes: 30,
              }
              return (
                <div key={weekday} className="grid gap-3 rounded-lg border border-blue-50 p-3 sm:grid-cols-[120px_1fr_1fr_96px] sm:items-center">
                  <label className="flex items-center gap-2 text-sm font-black text-gray-800">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1565C0]"
                      checked={item.enabled}
                      onChange={e => updateChargeAvailability(weekday, { enabled: e.target.checked })}
                    />
                    {label}
                  </label>
                  <input
                    type="time"
                    className="btk-input"
                    value={item.startTime}
                    onChange={e => updateChargeAvailability(weekday, { startTime: e.target.value })}
                  />
                  <input
                    type="time"
                    className="btk-input"
                    value={item.endTime}
                    onChange={e => updateChargeAvailability(weekday, { endTime: e.target.value })}
                  />
                  <select
                    className="btk-input"
                    value={item.slotMinutes}
                    onChange={e => updateChargeAvailability(weekday, { slotMinutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              )
            })}
          </div>
          <ModalActions onConfirm={saveChargeCalendar} onCancel={() => setCalendarCharge(null)} confirmLabel="Enregistrer" />
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
      data-active={active}
      className={`dashboard-nav-item grid w-full grid-cols-[38px_1fr] items-center gap-3 px-2.5 py-2.5 text-left ${
        active
          ? 'bg-[#eaf3fb] text-[#003a66] ring-1 ring-[#cfe1f1]'
          : 'bg-transparent text-gray-700 hover:bg-[#f4f8fc] hover:text-btk-blue'
      }`}
    >
      <span className={`dashboard-nav-badge flex h-9 w-9 items-center justify-center text-[10px] font-black ${
        active ? 'bg-btk-blue text-white' : 'bg-[#eef4fa] text-btk-blue'
      }`}>
        {code}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{label}</span>
        <span className={`mt-0.5 block truncate text-[10px] font-medium ${active ? 'text-[#42617d]' : 'text-gray-400'}`}>
          {detail}
        </span>
      </span>
    </button>
  )
}

function AgencyPanel({
  agency,
  onSelect,
  onToggleAgency,
}: {
  agency: Agency
  onSelect: () => void
  onToggleAgency: () => void
}) {
  const guichets = agency.guichets ?? []
  const openGuichets = guichets.filter(g => g.isActive).length
  const stats = getAgencyStats(agency)
  const load = getLoad(stats.waiting)

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
      className="dashboard-agency-card cursor-pointer outline-none focus:ring-2 focus:ring-btk-blue"
    >
      <div className="p-5">
        <div className="dashboard-agency-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="dashboard-agency-main flex min-w-0 items-start gap-4">
            <div className="dashboard-agency-code flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-base font-black text-btk-blue">
              {agency.code}
            </div>
            <div className="dashboard-agency-content min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black text-gray-950">{agency.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${agency.isActive ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                  {agency.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${load.badge}`}>
                  {load.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-gray-500">{agency.city === agency.name ? 'Agence principale' : agency.city}</p>
              <p className="mt-2 text-xs font-bold uppercase text-btk-blue">
                Cliquez ici
              </p>
            </div>
          </div>

          <div className="dashboard-agency-actions flex flex-wrap gap-2">
            <ActionButton onClick={onToggleAgency} tone={agency.isActive ? 'orange' : 'green'}>
              {agency.isActive ? 'Desactiver' : 'Activer'}
            </ActionButton>
          </div>
        </div>

        <div className="dashboard-agency-metrics mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="En attente" value={stats.waiting} tone="blue" />
          <MiniMetric label="Guichets" value={`${openGuichets}/${guichets.length}`} tone="green" />
          <MiniMetric label="Attente" value={`~${stats.estimatedWait}m`} tone="orange" />
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
  const passageDetail = stats.passageSampleSize > 0
    ? `${stats.averagePassageMinutes} min / ticket reel`
    : `${stats.averagePassageMinutes} min / ticket par defaut`

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
              <CharacteristicMetric label="Temps estime" value={`~${stats.estimatedWait}m`} detail={passageDetail} tone="orange" />
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

function ChargesView({
  charges,
  agencies,
  onAdd,
  onEdit,
  onCalendar,
  onToggle,
  onDelete,
}: {
  charges: Charge[]
  agencies: Agency[]
  onAdd: () => void
  onEdit: (charge: Charge) => void
  onCalendar: (charge: Charge) => void
  onToggle: (charge: Charge) => void
  onDelete: (charge: Charge) => void
}) {
  const activeCharges = charges.filter(charge => charge.isActive).length
  const agenciesWithCharges = new Set(charges.map(charge => charge.agencyId)).size

  return (
    <div className="charges-view mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="charges-intro rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
          <p className="text-sm font-black uppercase text-btk-blue">Configuration</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Chargés clients</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Ajoutez, modifiez, supprimez ou affectez un chargé à une autre agence.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark"
          >
            Ajouter un chargé
          </button>
        </section>

        <section className="charges-summary rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
          <h3 className="text-sm font-black uppercase text-gray-500">Vue d’ensemble</h3>
          <div className="charges-summary-grid mt-4 grid gap-2">
            <MiniMetric label="Charges" value={charges.length} tone="blue" />
            <MiniMetric label="Actifs" value={activeCharges} tone="green" />
            <MiniMetric label="Agences" value={`${agenciesWithCharges}/${agencies.length}`} tone="orange" />
          </div>
        </section>
      </aside>

      <section className="charges-list-panel rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="charges-list-header mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Liste des chargés</h2>
            <p className="mt-1 text-sm text-gray-500">Chaque chargé est rattaché automatiquement à son agence.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-btk-blue ring-1 ring-blue-100">
            {charges.length}
          </span>
        </div>

        {charges.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-10 text-center text-sm font-semibold text-gray-400">
            Aucun charge trouve.
          </div>
        ) : (
          <div className="charges-list divide-y divide-blue-50 rounded-lg border border-blue-50">
            {charges.map(charge => (
              <div key={charge.id} className="charges-row grid gap-3 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="charges-identity min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-black text-btk-blue">{charge.code}</span>
                    <h3 className="truncate text-lg font-black text-gray-950">{charge.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
                      charge.isActive ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-gray-50 text-gray-500 ring-gray-100'
                    }`}>
                      {charge.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <div className="charges-meta mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
                    <span>{charge.agencyCode} - {charge.agencyName}</span>
                    <span className="text-gray-300">|</span>
                    <span>{charge.city}</span>
                    <span className="text-gray-300">|</span>
                    <span>{charge.appointmentCount ?? 0} RDV</span>
                    <span className="text-gray-300">|</span>
                    <span className={charge.email ? 'text-gray-500' : 'text-red-600'}>
                      {charge.email || 'Email Outlook manquant'}
                    </span>
                  </div>
                </div>

                <div className="charges-actions flex flex-wrap gap-2">
                  <ActionButton onClick={() => onEdit(charge)}>Modifier</ActionButton>
                  <ActionButton onClick={() => onCalendar(charge)} tone="green">Calendrier</ActionButton>
                  <ActionButton onClick={() => onToggle(charge)} tone={charge.isActive ? 'orange' : 'green'}>
                    {charge.isActive ? 'Desactiver' : 'Activer'}
                  </ActionButton>
                  <ActionButton onClick={() => onDelete(charge)} tone="red">Supprimer</ActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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

function ServiceScheduleView({
  schedule,
  onSave,
}: {
  schedule: WorkSchedule
  onSave: () => void
}) {
  const isActive = schedule.activeMode === 'service'

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div>
          <p className="text-sm font-black uppercase text-btk-blue">Horaire par defaut</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">SERVICE</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            SERVICE est l'option normale du lundi au vendredi.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <CharacteristicMetric label="Ouverture" value={SERVICE_START_TIME} detail="heure fixe" tone="green" />
          <CharacteristicMetric label="Fermeture" value={SERVICE_END_TIME} detail="heure fixe" tone="orange" />
        </div>

        <div className={`mt-5 rounded-lg px-4 py-3 text-sm font-black ring-1 ${
          isActive ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-gray-50 text-gray-600 ring-gray-100'
        }`}>
          {isActive ? 'SERVICE est actif' : 'SERVICE n est pas actif'}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={isActive}
          className="mt-5 w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Activer SERVICE
        </button>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Configuration SERVICE</h2>
            <p className="mt-1 text-sm text-gray-500">Cet horaire s'applique quand aucun mode special n'est actif pour le mois courant.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
            isActive ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-blue-50 text-btk-blue ring-blue-100'
          }`}>
            {isActive ? 'Actif' : 'Par defaut'}
          </span>
        </div>

        <div className="mt-4 divide-y divide-blue-50 rounded-lg border border-blue-50">
          <CharacteristicRow label="Mode" value="SERVICE" />
          <CharacteristicRow label="Jours" value="Lundi - Vendredi" />
          <CharacteristicRow label="Horaire" value={displayTimeRange(SERVICE_START_TIME, SERVICE_END_TIME)} />
        </div>
      </section>
    </div>
  )
}

function SingleSessionView({
  schedule,
  onChange,
  onSave,
}: {
  schedule: WorkSchedule
  onChange: Dispatch<SetStateAction<WorkSchedule>>
  onSave: () => void
}) {
  const rangeValid = isTimeRangeValid(schedule.singleSessionStart, schedule.singleSessionEnd)
  const isActive = schedule.activeMode === 'single-session'
  const monthsValid = !isActive || Boolean(
    isValidMonthInput(schedule.singleSessionStartMonth) &&
    isValidMonthInput(schedule.singleSessionEndMonth) &&
    schedule.singleSessionStartMonth &&
    schedule.singleSessionEndMonth &&
    schedule.singleSessionStartMonth <= schedule.singleSessionEndMonth,
  )
  const canSave = rangeValid && monthsValid

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div>
          <p className="text-sm font-black uppercase text-btk-blue">Horaire special</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Seance unique</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Horaire applique pendant la periode de mois choisie.
          </p>
        </div>

        <label className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
          <span>
            <span className="block text-sm font-black text-gray-900">Activer seance unique</span>
            <span className="mt-0.5 block text-xs font-semibold text-gray-500">
              {isActive ? 'Seance unique active' : 'SERVICE reste actif'}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#1565C0]"
            checked={isActive}
            onChange={e => onChange(prev => ({
              ...prev,
              activeMode: e.target.checked ? 'single-session' : 'service',
              ramadanEnabled: false,
            }))}
          />
        </label>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Mois debut</span>
            <input
              type="month"
              className="btk-input"
              value={schedule.singleSessionStartMonth ?? ''}
              onChange={e => onChange(prev => ({ ...prev, singleSessionStartMonth: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Mois fin</span>
            <input
              type="month"
              className="btk-input"
              value={schedule.singleSessionEndMonth ?? ''}
              onChange={e => onChange(prev => ({ ...prev, singleSessionEndMonth: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Debut</span>
            <input
              type="time"
              className="btk-input"
              value={schedule.singleSessionStart}
              onChange={e => onChange(prev => ({ ...prev, singleSessionStart: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Fin</span>
            <input
              type="time"
              className="btk-input"
              value={schedule.singleSessionEnd}
              onChange={e => onChange(prev => ({ ...prev, singleSessionEnd: e.target.value }))}
            />
          </label>
        </div>

        {!monthsValid && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
            Choisissez une periode de mois valide.
          </div>
        )}

        {!rangeValid && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
            L'heure de debut doit etre avant l'heure de fin.
          </div>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="mt-5 w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enregistrer
        </button>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Configuration seance unique</h2>
            <p className="mt-1 text-sm text-gray-500">Les clients peuvent prendre un ticket dans cette plage pendant les mois choisis.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
            isActive ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-gray-50 text-gray-600 ring-gray-100'
          }`}>
            {isActive ? 'Actif' : 'Inactif'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CharacteristicMetric label="Ouverture" value={schedule.singleSessionStart} detail="heure de debut" tone="green" />
          <CharacteristicMetric label="Fermeture" value={schedule.singleSessionEnd} detail="heure de fin" tone="orange" />
        </div>

        <div className="mt-4 divide-y divide-blue-50 rounded-lg border border-blue-50">
          <CharacteristicRow label="Mode" value="Seance unique" />
          <CharacteristicRow label="Periode" value={displayMonthRange(schedule.singleSessionStartMonth, schedule.singleSessionEndMonth)} />
          <CharacteristicRow label="Horaire" value={displayTimeRange(schedule.singleSessionStart, schedule.singleSessionEnd)} />
          <CharacteristicRow label="Remplace" value="SERVICE" />
        </div>
      </section>
    </div>
  )
}

function RamadanView({
  schedule,
  onChange,
  onSave,
}: {
  schedule: WorkSchedule
  onChange: Dispatch<SetStateAction<WorkSchedule>>
  onSave: () => void
}) {
  const rangeValid = isTimeRangeValid(schedule.ramadanStartTime, schedule.ramadanEndTime)
  const isActive = schedule.activeMode === 'ramadan'
  const monthValid = !isActive || isValidMonthInput(schedule.ramadanMonth)
  const canSave = rangeValid && monthValid

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[420px_1fr]">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div>
          <p className="text-sm font-black uppercase text-btk-blue">Horaire special</p>
          <h2 className="mt-1 text-xl font-black text-gray-950">Ramadan</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Horaire prioritaire pendant la periode choisie.
          </p>
        </div>

        <label className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
          <span>
            <span className="block text-sm font-black text-gray-900">Activer Ramadan</span>
            <span className="mt-0.5 block text-xs font-semibold text-gray-500">
              {isActive ? 'Horaire Ramadan actif' : 'SERVICE reste actif'}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#1565C0]"
            checked={isActive}
            onChange={e => onChange(prev => ({
              ...prev,
              activeMode: e.target.checked ? 'ramadan' : 'service',
              ramadanEnabled: e.target.checked,
            }))}
          />
        </label>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Mois</span>
            <input
              type="month"
              className="btk-input"
              value={schedule.ramadanMonth ?? ''}
              onChange={e => onChange(prev => ({ ...prev, ramadanMonth: e.target.value || null }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Debut</span>
            <input
              type="time"
              className="btk-input"
              value={schedule.ramadanStartTime}
              onChange={e => onChange(prev => ({ ...prev, ramadanStartTime: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase text-gray-400">Fin</span>
            <input
              type="time"
              className="btk-input"
              value={schedule.ramadanEndTime}
              onChange={e => onChange(prev => ({ ...prev, ramadanEndTime: e.target.value }))}
            />
          </label>
        </div>

        {!monthValid && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
            Choisissez le mois Ramadan.
          </div>
        )}

        {!rangeValid && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
            L'heure de debut doit etre avant l'heure de fin.
          </div>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="mt-5 w-full rounded-lg bg-btk-blue px-5 py-3 font-black text-white shadow-sm transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enregistrer
        </button>
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">Configuration Ramadan</h2>
            <p className="mt-1 text-sm text-gray-500">Pendant ce mois, cet horaire remplace SERVICE.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
            isActive ? 'bg-green-50 text-green-700 ring-green-100' : 'bg-gray-50 text-gray-600 ring-gray-100'
          }`}>
            {isActive ? 'Actif' : 'Inactif'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CharacteristicMetric label="Ouverture" value={schedule.ramadanStartTime} detail="heure Ramadan" tone="green" />
          <CharacteristicMetric label="Fermeture" value={schedule.ramadanEndTime} detail="heure Ramadan" tone="orange" />
        </div>

        <div className="mt-4 divide-y divide-blue-50 rounded-lg border border-blue-50">
          <CharacteristicRow label="Mois" value={displayMonth(schedule.ramadanMonth)} />
          <CharacteristicRow label="Horaire" value={displayTimeRange(schedule.ramadanStartTime, schedule.ramadanEndTime)} />
          <CharacteristicRow label="Remplace" value="SERVICE" />
        </div>
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
            const agencyStats = getAgencyStats(agency)
            const waiting = agencyStats.waiting
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
                    <div className="text-xs text-gray-400">~{agencyStats.estimatedWait} min</div>
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
    <div className="dashboard-kpi-card group p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <span className="dashboard-kpi-icon" aria-hidden="true">{label.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className={`mt-4 text-3xl font-black tabular-nums tracking-tight ${tones[tone].split(' ')[1]}`}>
        {value}
      </div>
      <div className="mt-1 truncate text-xs font-medium text-slate-500">{detail}</div>
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
    <div className={`rounded-[var(--radius-md)] border border-slate-100 px-3 py-2 ${tones[tone]}`}>
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
      className={`rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-xs font-bold transition hover:shadow-sm ${tones[tone]}`}
    >
      {children}
    </button>
  )
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <section className={`dashboard-modal-panel w-full bg-white p-6 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
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
