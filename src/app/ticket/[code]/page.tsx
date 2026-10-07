'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function TicketRedirectPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const code = params?.code ?? ''

  useEffect(() => {
    if (code) {
      router.replace(`/?ticket=${encodeURIComponent(code)}`)
    }
  }, [code, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F3F8FC] p-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-btk-blue text-sm font-black text-white">
          BTK
        </div>
        <div className="mt-4 text-sm font-semibold text-btk-blue">Ouverture du ticket...</div>
      </div>
    </main>
  )
}
