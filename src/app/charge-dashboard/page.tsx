'use client'

import { useEffect, useMemo, useState } from 'react'
import BTKHeader from '@/components/shared/BTKHeader'

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
}

interface ChargeAvailability {
  id: number
  chargeId: number
  weekday: number
  enabled: boolean
  startTime: string
  endTime: string
  slotMinutes: number
}

interface Appointment {
  id: number
  reference: string
  chargeId: number
  agencyId: number
  date: string
  time: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  subject: string | null
  status: string
  createdAt: string
}

interface Slot {
  time: string
  available: boolean
  reason?: string
  reasonCode?: 'BOOKED' | 'PAST' | 'BLOCKED' | 'CLOSED'
}

interface DayBlock {
  id?: number
  chargeId?: number
  date?: string
  startTime: string | null
  endTime: string | null
  allDay: boolean
  label?: string | null
  createdAt?: string
}

interface DayCalendar {
  date: string
  weekday: number
  weekend?: boolean
  holiday?: { date: string; label: string | null } | null
  serviceWindow?: {
    mode: string
    label: string
    startTime: string
    endTime: string
  }
  dayAvailability?: ChargeAvailability | null
  dayBlocks: DayBlock[]
  slots: Slot[]
  available: boolean
}

interface OutlookConnection {
  configured: boolean
  connected: boolean
  email: string | null
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function todayInputDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

function datesInRange(startDate: string, endDate: string) {
  const dates: string[] = []
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date)
  }
  return dates
}

function getLeavePeriod(dayBlocks: DayBlock[] | undefined) {
  if (!Array.isArray(dayBlocks)) return null
  const leaveDays = dayBlocks
    .filter(block => block.allDay && block.date)
    .map(block => block.date!)
    .sort()

  if (leaveDays.length === 0) return null
  return { startDate: leaveDays[0], endDate: leaveDays[leaveDays.length - 1] }
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00Z`))
}

function formatAppointmentDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00Z`))
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isTimeRangeValid(start: string, end: string) {
  return Boolean(start && end) && timeToMinutes(start) < timeToMinutes(end)
}

function isReservedSlot(slot: Slot) {
  const reasonText = normalizeText(slot.reason ?? '')
  return slot.reasonCode === 'BOOKED' || reasonText.includes('reserv')
}

export default function ChargeDashboardPage() {
  const [todayDate] = useState(() => todayInputDate())
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState(() => todayInputDate())
  const [leaveRange, setLeaveRange] = useState(() => ({ startDate: todayInputDate(), endDate: todayInputDate() }))
  const [charges, setCharges] = useState<Charge[]>([])
  const [chargeSearch, setChargeSearch] = useState('')
  const [selectedChargeId, setSelectedChargeId] = useState<number | null>(null)
  const [connectedCharge, setConnectedCharge] = useState<Charge | null>(null)
  const [outlookConnection, setOutlookConnection] = useState<OutlookConnection | null>(null)
  const [outlookLoading, setOutlookLoading] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [leaveListOpen, setLeaveListOpen] = useState(false)
  const [allLeaveBlocks, setAllLeaveBlocks] = useState<DayBlock[]>([])
  const [savedLeavePeriod, setSavedLeavePeriod] = useState<{ startDate: string; endDate: string } | null>(null)
  const [dayCalendar, setDayCalendar] = useState<DayCalendar | null>(null)
  const [dayBlocks, setDayBlocks] = useState<DayBlock[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const [daySaving, setDaySaving] = useState(false)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [newDayBlock, setNewDayBlock] = useState({ startTime: '09:00', endTime: '11:00' })

  useEffect(() => {
    loadCharges()
  }, [])

  useEffect(() => {
    if (charges.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const chargeId = Number(params.get('chargeId'))
    const outcome = params.get('outlook')
    if (!outcome || !Number.isInteger(chargeId)) return

    const charge = charges.find(item => item.id === chargeId)
    if (charge) {
      setSelectedChargeId(charge.id)
      setConnectedCharge(charge)
      void loadChargeDashboard(charge.id, selectedAvailabilityDate)
      void loadOutlookConnection(charge.id)
    }
    setNotice(outcome === 'connected'
      ? 'Compte Outlook connecté : les prochains RDV seront ajoutés automatiquement.'
      : params.get('message') || 'Connexion Outlook impossible.')
    window.history.replaceState({}, '', '/charge-dashboard')
  }, [charges])

  const filteredCharges = useMemo(() => {
    const value = normalizeText(chargeSearch.trim())
    if (!value) return charges
    return charges.filter(charge =>
      normalizeText(`${charge.code} ${charge.name} ${charge.agencyCode} ${charge.agencyName} ${charge.city}`).includes(value),
    )
  }, [charges, chargeSearch])

  const selectedCharge = useMemo(
    () => charges.find(charge => charge.id === selectedChargeId) ?? null,
    [charges, selectedChargeId],
  )

  const wholeDayBlocked = dayBlocks.some(block => block.allDay)
  const rangeBlocks = dayBlocks.filter(block => !block.allDay)
  const leaveBlocks = savedLeavePeriod
    ? datesInRange(savedLeavePeriod.startDate, savedLeavePeriod.endDate).map(date => ({
        date,
        startTime: null,
        endTime: null,
        allDay: true,
        label: 'Congé',
      }))
    : dayCalendar?.dayBlocks
        .filter((block): block is DayBlock & { date: string } => block.allDay && Boolean(block.date))
        .sort((a, b) => (a.date < b.date ? -1 : 1)) ?? []
  const dayHasLeave = leaveBlocks.length > 0
  const leaveStart = leaveBlocks[0]?.date ?? ''
  const leaveEnd = leaveBlocks[leaveBlocks.length - 1]?.date ?? ''
  const leaveLabel = leaveBlocks.length > 1 && leaveStart !== leaveEnd
    ? `du ${leaveStart} au ${leaveEnd}`
    : leaveStart
  const savedLeaveLabel = savedLeavePeriod
    ? savedLeavePeriod.startDate === savedLeavePeriod.endDate
      ? `le ${savedLeavePeriod.startDate}`
      : `du ${savedLeavePeriod.startDate} au ${savedLeavePeriod.endDate}`
    : leaveLabel
  const selectedDateIsLeave = dayBlocks.some(block => block.allDay && block.date === selectedAvailabilityDate)
  const displayLeave = Boolean(savedLeavePeriod || dayHasLeave)
  const leaveStatusLabel = selectedDateIsLeave ? 'Congé actif' : 'Congé planifié'

  async function loadCharges() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/charges', { cache: 'no-store' })
      const data = await response.json()
      setCharges(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
      setCharges([])
    } finally {
      setLoading(false)
    }
  }

  async function loadLeaveBlocks(chargeId = connectedCharge?.id) {
    if (!chargeId) return

    const response = await fetch(`/api/charge-dashboard/${chargeId}/leaves`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || 'Conges indisponibles')
    }
    setAllLeaveBlocks(Array.isArray(data.dayBlocks) ? data.dayBlocks : [])
  }

  async function loadOutlookConnection(chargeId: number) {
    setOutlookLoading(true)
    try {
      const response = await fetch(`/api/outlook/${chargeId}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Statut Outlook indisponible.')
      setOutlookConnection(data)
    } catch (error) {
      console.error(error)
      setOutlookConnection(null)
    } finally {
      setOutlookLoading(false)
    }
  }

  async function loadChargeDashboard(chargeId: number, date = selectedAvailabilityDate) {
    setDashboardLoading(true)
    try {
      const [availabilityResponse, appointmentsResponse] = await Promise.all([
        fetch(`/api/charge-dashboard/${chargeId}/availability?date=${date}`, { cache: 'no-store' }),
        fetch(`/api/charge-dashboard/${chargeId}/appointments?from=${date}`, { cache: 'no-store' }),
      ])

      const availabilityData = await availabilityResponse.json()
      const appointmentsData = await appointmentsResponse.json()

      if (!availabilityResponse.ok) {
        throw new Error(availabilityData?.error || 'Calendrier indisponible')
      }

      setDayCalendar(availabilityData)
      const blocks = Array.isArray(availabilityData.dayBlocks) ? availabilityData.dayBlocks : []
      setDayBlocks(blocks)
      setSavedLeavePeriod(getLeavePeriod(blocks))
      setAppointments(Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : [])
      await loadLeaveBlocks(chargeId)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'Impossible de charger le tableau de bord du chargé.')
    } finally {
      setDashboardLoading(false)
    }
  }

  async function refreshDayCalendar(date = selectedAvailabilityDate, chargeId = connectedCharge?.id) {
    if (!chargeId) return

    setDayLoading(true)
    try {
      const response = await fetch(`/api/charge-dashboard/${chargeId}/availability?date=${date}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Jour indisponible')
      }
      setDayCalendar(data)
      const refreshedBlocks = Array.isArray(data.dayBlocks) ? data.dayBlocks : []
      setDayBlocks(refreshedBlocks)
      setSavedLeavePeriod(getLeavePeriod(refreshedBlocks))
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'Impossible de charger cette journée.')
    } finally {
      setDayLoading(false)
    }
  }

  async function handleConnect() {
    if (!selectedChargeId) {
      setNotice('Veuillez choisir un chargé.')
      return
    }
    const charge = charges.find(item => item.id === selectedChargeId) ?? null
    if (!charge) {
      setNotice('Chargé introuvable.')
      return
    }
    setConnectedCharge(charge)
    setNotice('')
    await Promise.all([
      loadChargeDashboard(charge.id, selectedAvailabilityDate),
      loadOutlookConnection(charge.id),
    ])
  }

  function handleDisconnect() {
    setConnectedCharge(null)
    setAppointments([])
    setDayCalendar(null)
    setDayBlocks([])
    setAllLeaveBlocks([])
    setOutlookConnection(null)
    setNotice('Déconnecté.')
  }

  function connectOutlook() {
    if (!connectedCharge) return
    window.location.assign(`/api/outlook/connect?chargeId=${connectedCharge.id}`)
  }

  function addDayBlock() {
    if (!isTimeRangeValid(newDayBlock.startTime, newDayBlock.endTime)) {
      setNotice("La plage indisponible n'est pas valide.")
      return
    }

    setDayBlocks(prev => [
      ...prev.filter(block => !block.allDay),
      {
        startTime: newDayBlock.startTime,
        endTime: newDayBlock.endTime,
        allDay: false,
        label: 'Indisponible',
      },
    ])
    setNotice('Plage ajoutée. Enregistrez pour appliquer au calendrier.')
  }

  function removeDayBlock(index: number) {
    setDayBlocks(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  function toggleWholeDayBlock(enabled: boolean) {
    setDayBlocks(prev => enabled
      ? [{ startTime: null, endTime: null, allDay: true, label: 'Journée désactivée' }]
      : prev.filter(block => !block.allDay)
    )
  }

  async function handleAvailabilityDateChange(date: string) {
    if (!date) return

    setSelectedAvailabilityDate(date)
    if (connectedCharge) {
      await loadChargeDashboard(connectedCharge.id, date)
    }
  }

  async function saveDayCalendar() {
    if (!connectedCharge || !dayCalendar) return

    setDaySaving(true)
    try {
      const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dayCalendar.date, dayBlocks }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Sauvegarde impossible')
      }
      setDayCalendar(data)
      const savedBlocks = Array.isArray(data.dayBlocks) ? data.dayBlocks : []
      setDayBlocks(savedBlocks)
      setSavedLeavePeriod(getLeavePeriod(savedBlocks))
      setNotice('Journée enregistrée.')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : "Impossible d'enregistrer cette journée.")
    } finally {
      setDaySaving(false)
    }
  }

  async function saveLeaveRange() {
    if (!connectedCharge) return

    const { startDate, endDate } = leaveRange
    if (!startDate || !endDate || startDate < todayDate || endDate < startDate) {
      setNotice('La période de congé est invalide.')
      return
    }

    const dates = datesInRange(startDate, endDate)
    if (dates.length > 60) {
      setNotice('La période de congé ne doit pas dépasser 60 jours.')
      return
    }

    setLeaveSaving(true)
    try {
      for (const date of dates) {
        const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            dayBlocks: [{ startTime: null, endTime: null, allDay: true, label: 'Congé' }],
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Congé impossible')
        }
      }

      if (dates.includes(selectedAvailabilityDate)) {
        await loadChargeDashboard(connectedCharge.id, selectedAvailabilityDate)
      }
      setLeaveModalOpen(false)
      setSavedLeavePeriod({ startDate, endDate })
      setNotice(`${dates.length} journée(s) désactivée(s) pour congé.`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : "Impossible d'enregistrer le congé.")
    } finally {
      setLeaveSaving(false)
    }
  }

  async function removeCurrentLeave() {
    if (!connectedCharge || !dayCalendar) return

    setDaySaving(true)
    try {
      const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dayCalendar.date, dayBlocks: [] }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Suppression impossible')
      }
      setDayCalendar(data)
      setDayBlocks(Array.isArray(data.dayBlocks) ? data.dayBlocks : [])
      setNotice('Congé supprimé pour cette date.')
      setLeaveModalOpen(false)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'Impossible de supprimer le congé.')
    } finally {
      setDaySaving(false)
    }
  }

  async function removeLeaveDate(date: string) {
    if (!connectedCharge) return
    setDaySaving(true)
    try {
      const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, dayBlocks: [] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Suppression impossible')
      if (dayCalendar?.date === date) {
        setDayCalendar(data)
        setDayBlocks(Array.isArray(data.dayBlocks) ? data.dayBlocks : [])
      }
      setNotice(`Congé supprimé pour le ${date}.`)
      setLeaveListOpen(false)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'Impossible de supprimer le congé.')
    } finally {
      setDaySaving(false)
    }
  }

  async function removeAllLeaves() {
    if (!connectedCharge) return
    const dates = allLeaveBlocks
      .map(block => block.date)
      .filter((date): date is string => Boolean(date))
    if (dates.length === 0) {
      setNotice('Aucune date de congé à supprimer.')
      return
    }

    setDaySaving(true)
    try {
      for (const date of dates) {
        const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, dayBlocks: [] }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || `Impossible de supprimer le congé du ${date}`)
        }
        if (dayCalendar?.date === date) {
          setDayCalendar(data)
          setDayBlocks(Array.isArray(data.dayBlocks) ? data.dayBlocks : [])
        }
      }
      setAllLeaveBlocks([])
      setSavedLeavePeriod(null)
      setLeaveListOpen(false)
      setNotice('Toutes les dates de congé ont été supprimées.')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'Impossible de supprimer tous les congés.')
    } finally {
      setDaySaving(false)
    }
  }

  async function cancelAppointment(appointmentId: number) {
    setCancellingAppointmentId(appointmentId)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Impossible d'annuler ce rendez-vous")
      }
      setAppointments(prev => prev.filter(item => item.id !== appointmentId))
      await refreshDayCalendar(dayCalendar?.date ?? selectedAvailabilityDate, connectedCharge?.id)
      setNotice('Rendez-vous annulé.')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : "Impossible d'annuler le rendez-vous.")
    } finally {
      setCancellingAppointmentId(null)
    }
  }

  return (
    <main className="workspace-page charge-dashboard-page min-h-screen bg-[#F3F8FC]">
      <BTKHeader
        subtitle="Espace chargé"
        right={connectedCharge ? (
          <span className="max-w-[38vw] truncate rounded-full bg-[#f1f6fc] px-3 py-1.5 text-xs font-semibold text-[#1565c0]">
            {connectedCharge.name}
          </span>
        ) : undefined}
      />
      <div className="charge-dashboard-content mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {!connectedCharge ? (
          <section className="charge-login-shell mx-auto grid w-full max-w-6xl items-stretch gap-6 py-5 lg:grid-cols-[0.88fr_1.12fr] lg:gap-8 lg:py-10">
            <div className="charge-login-intro">
              <span className="charge-login-eyebrow">
                <i aria-hidden="true" />
                Espace professionnel
              </span>
              <h1>Votre activité, en toute simplicité.</h1>
              <p>
                Retrouvez vos rendez-vous et gérez vos disponibilités depuis un espace unique, pensé pour votre quotidien.
              </p>
              <div className="charge-login-benefits">
                <div>
                  <span aria-hidden="true">01</span>
                  <p><strong>Accès personnalisé</strong><small>Un espace dédié à chaque chargé.</small></p>
                </div>
                <div>
                  <span aria-hidden="true">02</span>
                  <p><strong>Disponibilités maîtrisées</strong><small>Organisez vos créneaux et congés.</small></p>
                </div>
                <div>
                  <span aria-hidden="true">03</span>
                  <p><strong>Rendez-vous centralisés</strong><small>Consultez les prochaines réservations.</small></p>
                </div>
              </div>
              <div className="charge-login-security"><span aria-hidden="true">✓</span> Accès réservé aux collaborateurs BTK</div>
            </div>

            <div className="charge-login-card">
              <div className="charge-login-card-heading">
                <span className="charge-login-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  </svg>
                </span>
                <div>
                  <p>Accès à votre espace</p>
                  <h2>Connexion chargé</h2>
                  <span>Choisissez votre profil pour continuer.</span>
                </div>
              </div>
              {notice && (
                <div className="charge-login-notice mt-5 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-btk-blue ring-1 ring-blue-100">
                  {notice}
                </div>
              )}

              <div className="charge-login-form mt-6 space-y-4">
                <label className="charge-login-search-label block text-sm font-black text-gray-700">
                  <span>Rechercher votre profil</span>
                  <input
                    className="btk-input mt-2 w-full"
                    placeholder="Nom, matricule ou agence"
                    aria-label="Rechercher un chargé par nom, code ou agence"
                    value={chargeSearch}
                    onChange={event => setChargeSearch(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && filteredCharges[0]) {
                        setSelectedChargeId(filteredCharges[0].id)
                      }
                    }}
                  />
                </label>

                <div className="charge-login-list-wrap">
                  <div className="charge-login-list-heading">
                    <span>Chargés disponibles</span>
                    {!loading && <span>{filteredCharges.length} profil{filteredCharges.length > 1 ? 's' : ''}</span>}
                  </div>
                  <div className="charge-login-list max-h-72 overflow-y-auto rounded-lg border border-blue-100 bg-slate-50 p-2">
                  {loading ? (
                    <div className="p-4 text-center text-sm font-semibold text-gray-400">Chargement...</div>
                  ) : filteredCharges.length === 0 ? (
                    <div className="p-4 text-center text-sm font-semibold text-gray-400">Aucun chargé trouvé.</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCharges.map(charge => {
                        const active = selectedChargeId === charge.id
                        return (
                          <button
                            key={charge.id}
                            type="button"
                            onClick={() => setSelectedChargeId(charge.id)}
                            aria-pressed={active}
                            className={`charge-login-option w-full rounded-lg border px-4 py-3 text-left transition ${
                              active
                                ? 'border-btk-blue bg-blue-50 ring-2 ring-blue-100'
                                : 'border-transparent bg-white hover:border-blue-100 hover:bg-blue-50/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-sm font-black text-gray-950">{charge.name}</span>
                              <span className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-btk-blue">
                                {charge.code}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-semibold text-gray-500">
                              {charge.agencyCode} / {charge.agencyName}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  </div>
                </div>

                {selectedCharge && (
                  <div className="charge-login-selected rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-700 ring-1 ring-green-100">
                    <span className="charge-login-selected-check" aria-hidden="true">✓</span>
                    <span><small>Profil sélectionné</small><strong>{selectedCharge.name}</strong><em>{selectedCharge.agencyCode} / {selectedCharge.agencyName}</em></span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={loading || !selectedChargeId}
                  className="charge-login-submit w-full rounded-lg bg-btk-blue px-4 py-3 text-sm font-black text-white transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:bg-blue-200"
                >
                  {loading ? 'Chargement...' : 'Se connecter'}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="charge-dashboard-hero">
              <div className="charge-dashboard-hero-identity">
                <span className="charge-dashboard-avatar" aria-hidden="true">
                  {connectedCharge.name.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase()}
                </span>
                <div className="charge-dashboard-hero-copy">
                  <p className="charge-dashboard-eyebrow">Espace chargé · Tableau de bord</p>
                  <h1>{connectedCharge.name}</h1>
                  <div className="charge-dashboard-meta">
                    <span>{connectedCharge.agencyName}</span>
                    <i aria-hidden="true" />
                    <span>{connectedCharge.agencyCode}</span>
                    <i aria-hidden="true" />
                    <span>Matricule {connectedCharge.code}</span>
                  </div>
                </div>
              </div>
              <div className="charge-dashboard-hero-actions">
                <div className={`charge-outlook-status ${outlookConnection?.connected ? 'is-connected' : 'is-disconnected'}`}>
                  <span className="charge-status-dot" aria-hidden="true" />
                  <span>
                    <strong>{outlookLoading ? 'Vérification Outlook...' : outlookConnection?.connected ? 'Outlook connecté' : 'Outlook non connecté'}</strong>
                    {!outlookLoading && outlookConnection?.connected && outlookConnection.email && <small>{outlookConnection.email}</small>}
                    {!outlookLoading && outlookConnection && !outlookConnection.configured && <small>Configuration Microsoft Graph requise</small>}
                  </span>
                </div>
                {!outlookLoading && outlookConnection?.configured && !outlookConnection.connected && (
                  <button
                    type="button"
                    onClick={connectOutlook}
                    className="charge-outlook-connect"
                  >
                    Connecter Outlook
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="charge-dashboard-logout"
                >
                  Déconnexion
                </button>
              </div>
            </section>

            <section className="charge-dashboard-kpis" aria-label="Résumé de l'activité">
              <article className="charge-dashboard-kpi">
                <span className="charge-kpi-icon is-blue" aria-hidden="true">01</span>
                <div><small>Disponibilité</small><strong>{dayCalendar ? (dayCalendar.available ? 'Disponible' : 'Indisponible') : '—'}</strong><span>{dayCalendar ? formatDayLabel(dayCalendar.date) : 'Sélectionnez une date'}</span></div>
              </article>
              <article className="charge-dashboard-kpi">
                <span className="charge-kpi-icon is-green" aria-hidden="true">02</span>
                <div><small>Créneaux libres</small><strong>{dayCalendar?.slots.filter(slot => slot.available).length ?? '—'}</strong><span>Pour la date sélectionnée</span></div>
              </article>
              <article className="charge-dashboard-kpi">
                <span className="charge-kpi-icon is-violet" aria-hidden="true">03</span>
                <div><small>Rendez-vous à venir</small><strong>{appointments.length}</strong><span>Dans votre agenda</span></div>
              </article>
              <article className="charge-dashboard-kpi">
                <span className="charge-kpi-icon is-amber" aria-hidden="true">04</span>
                <div><small>Votre agence</small><strong>{connectedCharge.agencyCode}</strong><span>{connectedCharge.agencyName}</span></div>
              </article>
            </section>

            {notice && (
              <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-100">
                {notice}
              </div>
            )}

            <div className="charge-dashboard-grid grid gap-5 lg:grid-cols-2">
              <div className="charge-dashboard-panel charge-calendar-panel rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-6">
                <div className="charge-panel-heading flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="charge-panel-title">
                    <span className="charge-panel-icon" aria-hidden="true">CAL</span>
                    <div>
                      <p>Planning personnel</p>
                    <h2 className="text-xl font-black text-gray-950">Calendrier de disponibilité</h2>
                      <span>Gérez vos horaires et vos créneaux.</span>
                    </div>
                  </div>
                  <div className="charge-date-controls flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block min-w-[220px] text-sm font-black text-gray-700">
                      <span className="charge-date-label">Date à consulter</span>
                      <input
                        type="date"
                        className="btk-input mt-2 w-full"
                        min={todayDate}
                        value={selectedAvailabilityDate}
                        onChange={event => handleAvailabilityDateChange(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => refreshDayCalendar(selectedAvailabilityDate)}
                      disabled={dayLoading}
                      className="charge-calendar-refresh rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {dayLoading ? 'Actualisation...' : 'Actualiser'}
                    </button>
                  </div>
                </div>

                {dashboardLoading && !dayCalendar ? (
                  <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Chargement du calendrier...
                  </div>
                ) : !dayCalendar ? (
                  <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Calendrier indisponible.
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    <section className={`charge-selected-day rounded-lg border border-blue-100 bg-blue-50 p-5 ${dayCalendar.available ? 'is-available' : 'is-unavailable'}`}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="charge-selected-day-label">{WEEKDAYS[dayCalendar.weekday]} · Vue du jour</p>
                          <h3 className="mt-2 text-2xl font-black capitalize text-gray-950">
                            {formatDayLabel(dayCalendar.date)}
                          </h3>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ring-1 ${
                          dayCalendar.available
                            ? 'bg-green-50 text-green-700 ring-green-100'
                            : 'bg-red-50 text-red-700 ring-red-100'
                        }`}>
                          {dayCalendar.available ? 'Disponible' : 'Non disponible'}
                        </span>
                      </div>
                    </section>

                    <section className="charge-schedule-editor rounded-lg border border-blue-100 p-5">
                      <div className="charge-schedule-actions flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setLeaveModalOpen(true)}
                          className="charge-leave-primary rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700"
                        >
                          Planifier un congé
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await loadLeaveBlocks()
                              setLeaveListOpen(true)
                            } catch (error) {
                              console.error(error)
                              setNotice(error instanceof Error ? error.message : 'Impossible de charger les conges.')
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          Congé
                        </button>
                      </div>

                      {displayLeave && (
                        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-900">{leaveStatusLabel}</p>
                              <p className="mt-2 text-lg font-black text-gray-950">Congé {savedLeaveLabel}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={removeCurrentLeave}
                                className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="charge-block-form flex flex-col gap-4 lg:flex-row lg:items-end">
                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-black text-gray-700">
                            Indisponible de
                            <input
                              type="time"
                              className="btk-input mt-2 w-full"
                              value={newDayBlock.startTime}
                              onChange={event => setNewDayBlock(prev => ({ ...prev, startTime: event.target.value }))}
                            />
                          </label>
                          <label className="block text-sm font-black text-gray-700">
                            Jusqu'à
                            <input
                              type="time"
                              className="btk-input mt-2 w-full"
                              value={newDayBlock.endTime}
                              onChange={event => setNewDayBlock(prev => ({ ...prev, endTime: event.target.value }))}
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={addDayBlock}
                          className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700 transition hover:bg-orange-100"
                        >
                          Désactiver cette plage
                        </button>
                      </div>

                      <div className="charge-schedule-footer mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleWholeDayBlock(!wholeDayBlocked)}
                          className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                            wholeDayBlocked
                              ? 'bg-green-50 text-green-700 ring-1 ring-green-100 hover:bg-green-100'
                              : 'bg-red-50 text-red-700 ring-1 ring-red-100 hover:bg-red-100'
                          }`}
                        >
                          {wholeDayBlocked ? 'Réactiver la journée' : 'Désactiver toute la journée'}
                        </button>
                        <button
                          type="button"
                          onClick={saveDayCalendar}
                          disabled={daySaving}
                          className="rounded-lg bg-btk-blue px-4 py-2 text-sm font-black text-white transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:bg-blue-200"
                        >
                          {daySaving ? 'Enregistrement...' : 'Sauvegarder'}
                        </button>
                      </div>

                      <div className="charge-blocks-summary mt-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
                        <div className="charge-blocks-heading"><h4>Indisponibilités</h4><span>{wholeDayBlocked ? 'Journée complète' : `${rangeBlocks.length} plage${rangeBlocks.length > 1 ? 's' : ''}`}</span></div>
                        {wholeDayBlocked ? (
                          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-100">
                            Toute la journée est désactivée.
                          </p>
                        ) : rangeBlocks.length === 0 ? (
                          <p className="mt-3 text-sm font-semibold text-gray-400">Aucune plage indisponible.</p>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rangeBlocks.map((block, index) => (
                              <div
                                key={`${block.startTime}-${block.endTime}-${index}`}
                                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black text-gray-800 ring-1 ring-blue-100"
                              >
                                <span>{block.startTime} - {block.endTime}</span>
                                <button
                                  type="button"
                                  onClick={() => removeDayBlock(index)}
                                  className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700 transition hover:bg-red-100"
                                >
                                  Retirer
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="charge-slots-section">
                      <div className="charge-slots-heading mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div><h3>Créneaux du jour</h3><span>{dayCalendar.slots.filter(slot => slot.available).length} disponibles sur {dayCalendar.slots.length}</span></div>
                        <div className="charge-slots-legend" aria-label="Légende des créneaux">
                          <span><i className="is-free" />Libre</span><span><i className="is-booked" />Réservé</span><span><i className="is-blocked" />Bloqué</span>
                        </div>
                      </div>

                      {dayCalendar.slots.length === 0 ? (
                        <div className="rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                          Aucun créneau disponible pour cette date.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                          {dayCalendar.slots.map(slot => {
                            const reserved = isReservedSlot(slot)
                            const blocked = slot.reasonCode === 'BLOCKED'
                            return (
                              <div
                                key={slot.time}
                                className={`charge-slot rounded-lg border px-4 py-3 text-sm font-black ${
                                  slot.available
                                    ? 'border-green-100 bg-green-50 text-green-700'
                                    : reserved
                                      ? 'border-red-100 bg-red-50 text-red-700'
                                      : blocked
                                        ? 'border-orange-100 bg-orange-50 text-orange-700'
                                        : 'border-slate-100 bg-slate-50 text-gray-400'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-lg">{slot.time}</span>
                                  <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] uppercase tracking-[0.16em]">
                                    {slot.available ? 'Libre' : slot.reason || 'Indisponible'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>

              <div className="charge-dashboard-panel charge-appointments-panel rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-6">
                <div className="charge-panel-heading charge-appointments-heading flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="charge-panel-title">
                    <span className="charge-panel-icon is-violet" aria-hidden="true">RDV</span>
                    <div>
                      <p>Votre agenda</p>
                    <h2 className="text-xl font-black text-gray-950">Rendez-vous à venir</h2>
                    <span>
                      Suivez les prochaines réservations et annulez si nécessaire.
                    </span>
                    </div>
                  </div>
                  <span className="charge-appointment-count">
                    <strong>{appointments.length}</strong> à venir
                  </span>
                </div>

                {dashboardLoading ? (
                  <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Chargement des rendez-vous...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="charge-appointments-empty mt-6 rounded-lg bg-gray-50 p-6 text-center">
                    <span aria-hidden="true">✓</span>
                    <strong>Aucun rendez-vous prévu</strong>
                    <p>Votre agenda est à jour pour le moment.</p>
                  </div>
                ) : (
                  <div className="charge-appointments-list mt-6">
                    {appointments.map(appointment => (
                      <article key={appointment.id} className="charge-appointment-card">
                        <div className="charge-appointment-date">
                          <strong>{appointment.time}</strong>
                          <span>{formatAppointmentDate(appointment.date)}</span>
                        </div>
                        <div className="charge-appointment-details">
                          <div className="charge-appointment-title">
                            <strong>{appointment.customerName}</strong>
                            <span>{appointment.reference}</span>
                          </div>
                          <p>{appointment.subject || 'Rendez-vous'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelAppointment(appointment.id)}
                          disabled={cancellingAppointmentId === appointment.id}
                          className="charge-appointment-cancel"
                        >
                          {cancellingAppointmentId === appointment.id ? 'Annulation...' : 'Annuler'}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {leaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <button
              type="button"
              className="absolute inset-0"
              onClick={() => setLeaveModalOpen(false)}
              aria-label="Fermer le modal congé"
            />
            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-900">Congé</p>
                  <h2 className="mt-2 text-2xl font-black text-gray-950">Planifier un congé</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Choisissez une période de congé pour désactiver le calendrier sur ces dates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  Fermer
                </button>
              </div>

              {dayHasLeave ? (
                <div className="mt-6 rounded-3xl border border-red-100 bg-red-50 p-5">
                  <p className="text-sm font-black text-red-700">
                    Congé {leaveLabel}
                  </p>
                  <p className="mt-2 text-sm text-gray-600">Ce jour est bloqué en congé.</p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!connectedCharge || !dayCalendar) return
                      setDaySaving(true)
                      try {
                        const response = await fetch(`/api/charge-dashboard/${connectedCharge.id}/availability`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ date: dayCalendar.date, dayBlocks: [] }),
                        })
                        const data = await response.json()
                        if (!response.ok) throw new Error(data?.error || 'Suppression impossible')
                        setDayCalendar(data)
                        setDayBlocks(Array.isArray(data.dayBlocks) ? data.dayBlocks : [])
                        setNotice('Congé supprimé pour cette date.')
                        setLeaveModalOpen(false)
                      } catch (error) {
                        console.error(error)
                        setNotice(error instanceof Error ? error.message : 'Impossible de supprimer le congé.')
                      } finally {
                        setDaySaving(false)
                      }
                    }}
                    className="mt-4 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                  >
                    Supprimer le congé
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-black text-gray-700">
                      Du
                      <input
                        type="date"
                        className="btk-input mt-2 w-full"
                        min={todayDate}
                        value={leaveRange.startDate}
                        onChange={event => {
                          const startDate = event.target.value
                          setLeaveRange(prev => ({
                            startDate,
                            endDate: prev.endDate < startDate ? startDate : prev.endDate,
                          }))
                        }}
                      />
                    </label>
                    <label className="block text-sm font-black text-gray-700">
                      Au
                      <input
                        type="date"
                        className="btk-input mt-2 w-full"
                        min={leaveRange.startDate}
                        value={leaveRange.endDate}
                        onChange={event => setLeaveRange(prev => ({ ...prev, endDate: event.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setLeaveModalOpen(false)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={saveLeaveRange}
                      disabled={leaveSaving}
                      className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-200"
                    >
                      {leaveSaving ? 'Enregistrement...' : 'Enregistrer le congé'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {leaveListOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <button
              type="button"
              className="absolute inset-0"
              onClick={() => setLeaveListOpen(false)}
              aria-label="Fermer le modal congés"
            />
            <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-900">Congé</p>
                  <h2 className="mt-2 text-2xl font-black text-gray-950">Congés planifiés</h2>
                  
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLeaveListOpen(false)
                      setLeaveModalOpen(true)
                      setLeaveRange({ startDate: todayDate, endDate: todayDate })
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    + Planifier un congé
                  </button>
                  {allLeaveBlocks.length > 0 && (
                    <button
                      type="button"
                      onClick={removeAllLeaves}
                      disabled={daySaving}
                      className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Supprimer tous
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLeaveListOpen(false)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {allLeaveBlocks.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Aucun congé planifié.
                  </div>
                ) : (
                  allLeaveBlocks.map(block => (
                    <div key={block.date} className="flex flex-col gap-3 rounded-3xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-gray-950">{block.date}</p>
                        <p className="text-sm text-gray-600">Congé planifié</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const leaveDate = block.date ?? todayDate
                            setLeaveRange({ startDate: leaveDate, endDate: leaveDate })
                            setLeaveListOpen(false)
                            setLeaveModalOpen(true)
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLeaveDate(block.date ?? '')}
                          className="rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
