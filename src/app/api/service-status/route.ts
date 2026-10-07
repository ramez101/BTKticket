import { NextResponse } from 'next/server'
import { getServiceStatus } from '@/lib/hours'

export async function GET() {
  const status = await getServiceStatus()
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=30',
    },
  })
}
