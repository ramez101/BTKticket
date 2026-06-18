import { NextResponse } from 'next/server'
import { getServiceStatus } from '@/lib/hours'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getServiceStatus()
  return NextResponse.json(status)
}
