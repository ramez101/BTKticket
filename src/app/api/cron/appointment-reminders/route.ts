import { NextRequest, NextResponse } from 'next/server'
import { notifyAppointmentReminders } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authorization = req.headers.get('authorization')
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  await notifyAppointmentReminders()
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  return POST(req)
}

