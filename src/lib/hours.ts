import { prisma } from '@/lib/prisma'

type HolidayStatus = {
  id: number
  date: string
  label: string | null
} | null

export type ServiceStatus = {
  open: boolean
  message: string
  holiday: HolidayStatus
}

export function isOpen(): boolean {
  const now = new Date()
  const tn = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
  const day = tn.getDay()
  const total = tn.getHours() * 60 + tn.getMinutes()
  return day >= 1 && day <= 5 && total >= 480 && total < 990
}

export function todayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Tunis' })
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  const today = todayDate()
  const holiday = await prisma.holiday.findUnique({
    where: { date: today },
    select: { id: true, date: true, label: true },
  })

  if (holiday) {
    return {
      open: false,
      message: holiday.label ? `Jour ferie - ${holiday.label}` : 'Jour ferie',
      holiday,
    }
  }

  if (!isOpen()) {
    const now = new Date()
    const tn = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
    const day = tn.getDay()

    return {
      open: false,
      message: day === 0 || day === 6 ? 'Ferme le week-end' : 'Hors horaires 08h00-16h30',
      holiday: null,
    }
  }

  return {
    open: true,
    message: 'Service ouvert',
    holiday: null,
  }
}
