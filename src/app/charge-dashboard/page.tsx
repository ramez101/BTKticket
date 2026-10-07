'use client'

import { useEffect, useMemo, useState } from 'react'

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
    <main className="min-h-screen bg-[#F3F8FC] py-6 lg:py-8">
      <div className="mx-auto w-full max-w-[1760px] px-4 sm:px-6 lg:px-8">
        {!connectedCharge ? (
          <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center py-8">
            <div className="w-full rounded-lg bg-white p-6 shadow-sm ring-1 ring-blue-100 sm:p-8">
              <div className="text-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-btk-blue">Dashboard chargé</p>
                <h1 className="mt-3 text-3xl font-black text-gray-950">Connexion chargé</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600">
                  Choisissez un chargé pour ouvrir sa session.
                </p>
              </div>

              {notice && (
                <div className="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-btk-blue ring-1 ring-blue-100">
                  {notice}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <label className="block text-sm font-black text-gray-700">
                  Choisir un chargé
                  <input
                    className="btk-input mt-2 w-full"
                    placeholder="Écrire le nom, code ou agence"
                    value={chargeSearch}
                    onChange={event => setChargeSearch(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && filteredCharges[0]) {
                        setSelectedChargeId(filteredCharges[0].id)
                      }
                    }}
                  />
                </label>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-blue-100 bg-slate-50 p-2">
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
                            className={`w-full rounded-lg border px-4 py-3 text-left transition ${
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

                {selectedCharge && (
                  <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-700 ring-1 ring-green-100">
                    Sélection : {selectedCharge.name} - {selectedCharge.agencyName}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={loading || !selectedChargeId}
                  className="w-full rounded-lg bg-btk-blue px-4 py-3 text-sm font-black text-white transition hover:bg-btk-dark disabled:cursor-not-allowed disabled:bg-blue-200"
                >
                  {loading ? 'Chargement...' : 'Se connecter'}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-5 flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-btk-blue">Chargé connecté</p>
                <h1 className="mt-2 text-2xl font-black text-gray-950">{connectedCharge.name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className={`rounded-full px-3 py-1 ring-1 ${
                    outlookConnection?.connected
                      ? 'bg-green-50 text-green-700 ring-green-100'
                      : 'bg-orange-50 text-orange-700 ring-orange-100'
                  }`}>
                    {outlookLoading
                      ? 'Vérification Outlook...'
                      : outlookConnection?.connected
                        ? `Outlook connecté${outlookConnection.email ? ` : ${outlookConnection.email}` : ''}`
                        : 'Outlook non connecté'}
                  </span>
                  {!outlookLoading && outlookConnection?.configured && !outlookConnection.connected && (
                    <button
                      type="button"
                      onClick={connectOutlook}
                      className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-btk-blue transition hover:bg-blue-100"
                    >
                      Connecter Outlook
                    </button>
                  )}
                  {!outlookLoading && outlookConnection && !outlookConnection.configured && (
                    <span className="text-orange-700">Configuration Microsoft Graph requise.</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center justify-center rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-100"
              >
                Déconnexion
              </button>
            </section>

            {notice && (
              <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 ring-1 ring-green-100">
                {notice}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-950">Calendrier de disponibilité</h2>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block min-w-[220px] text-sm font-black text-gray-700">
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
                      className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-btk-blue transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                    <section className="rounded-lg border border-blue-100 bg-blue-50 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-btk-blue">
                            Jour sélectionné - {WEEKDAYS[dayCalendar.weekday]}
                          </p>
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

                    <section className="rounded-lg border border-blue-100 p-5">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setLeaveModalOpen(true)}
                          className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700"
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

                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
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

                      <div className="mt-4 flex flex-wrap gap-2">
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

                      <div className="mt-4 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-100">
                        <h4 className="text-sm font-black text-gray-950">Indisponibilités du jour</h4>
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

                    <section>
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg font-black text-gray-950">Créneaux du jour</h3>
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
                                className={`rounded-lg border px-4 py-3 text-sm font-black ${
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

              <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-blue-100 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-950">Rendez-vous à venir</h2>
                    <p className="mt-2 text-sm text-gray-500">
                      Suivez les prochaines réservations et annulez si nécessaire.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-btk-blue ring-1 ring-blue-100">
                    {appointments.length} à venir
                  </span>
                </div>

                {dashboardLoading ? (
                  <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Chargement des rendez-vous...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="mt-6 rounded-lg bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
                    Aucun rendez-vous prévu.
                  </div>
                ) : (
                  <div className="mt-6 overflow-x-auto rounded-lg border border-blue-100">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="bg-blue-50 text-xs uppercase tracking-[0.16em] text-blue-700">
                        <tr>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Heure</th>
                          <th className="px-4 py-3">Client</th>
                          <th className="px-4 py-3">Sujet</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map(appointment => (
                          <tr key={appointment.id} className="border-t border-blue-50 hover:bg-blue-50/50">
                            <td className="px-4 py-3 font-black text-btk-blue">{appointment.reference}</td>
                            <td className="px-4 py-3 font-black text-gray-900">{formatAppointmentDate(appointment.date)}</td>
                            <td className="px-4 py-3 text-gray-700">{appointment.time}</td>
                            <td className="px-4 py-3 text-gray-700">{appointment.customerName}</td>
                            <td className="px-4 py-3 text-gray-700">{appointment.subject || '-'}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => cancelAppointment(appointment.id)}
                                disabled={cancellingAppointmentId === appointment.id}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {cancellingAppointmentId === appointment.id ? 'Annulation...' : 'Annuler'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
