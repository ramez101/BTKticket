import { NextRequest, NextResponse } from 'next/server'
import { getServiceHours, updateServiceHours, validateServiceHoursConfig, type ServiceHoursMode } from '@/lib/hours'

export const dynamic = 'force-dynamic'

function isServiceHoursMode(value: unknown): value is ServiceHoursMode {
  return value === 'service' || value === 'single-session' || value === 'ramadan'
}

function stringOrNull(value: unknown, fallback: string | null) {
  if (typeof value === 'string') return value
  if (value === null) return null
  return fallback
}

export async function GET() {
  const hours = await getServiceHours()
  return NextResponse.json(hours)
}

export async function PATCH(req: NextRequest) {
  const current = await getServiceHours()
  const body = await req.json()
  const activeMode = isServiceHoursMode(body.activeMode)
    ? body.activeMode
    : typeof body.ramadanEnabled === 'boolean'
      ? body.ramadanEnabled ? 'ramadan' : current.activeMode === 'ramadan' ? 'service' : current.activeMode
      : current.activeMode
  const next = {
    ...current,
    activeMode,
    singleSessionStart: typeof body.singleSessionStart === 'string' ? body.singleSessionStart : current.singleSessionStart,
    singleSessionEnd: typeof body.singleSessionEnd === 'string' ? body.singleSessionEnd : current.singleSessionEnd,
    singleSessionStartMonth: stringOrNull(body.singleSessionStartMonth, current.singleSessionStartMonth),
    singleSessionEndMonth: stringOrNull(body.singleSessionEndMonth, current.singleSessionEndMonth),
    ramadanEnabled: activeMode === 'ramadan',
    ramadanMonth: stringOrNull(body.ramadanMonth, current.ramadanMonth),
    ramadanStartDate: stringOrNull(body.ramadanStartDate, current.ramadanStartDate),
    ramadanEndDate: stringOrNull(body.ramadanEndDate, current.ramadanEndDate),
    ramadanStartTime: typeof body.ramadanStartTime === 'string' ? body.ramadanStartTime : current.ramadanStartTime,
    ramadanEndTime: typeof body.ramadanEndTime === 'string' ? body.ramadanEndTime : current.ramadanEndTime,
  }
  const error = validateServiceHoursConfig(next)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  const hours = await updateServiceHours(next)
  return NextResponse.json(hours)
}
