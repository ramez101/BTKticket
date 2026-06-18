'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useAgencySocket } from '@/hooks/useSocket'
import Link from 'next/link'

interface TicketViewData {
  ticket: {
    id: number; label: string; number: number; service: string
    status: 'WAITING' | 'CALLED' | 'SERVED' | 'ABSENT'
    createdAt: string; guichet: string | null
  }
  agency: { name: string; city: string; code: string }
  rank: number
  ahead: number
  presentAt: string
  estimatedMinutes: number
  currentCalled: number
  currentGuichet: string | null
}

export default function TicketViewPage() {
  const params = useParams<{ code: string }>()
  const code = params?.code ?? ''
  const [data, setData] = useState<TicketViewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Decode agencyId from base64url code for socket subscription
  const agencyId = useMemo(() => {
    try {
      const decoded = JSON.parse(Buffer.from(code, 'base64url').toString('utf-8'))
      return decoded.agencyId as number
    } catch { return null }
  }, [code])

  async function fetchData() {
    try {
      const res = await fetch(`/api/ticket/${code}`)
      if (!res.ok) { setError('Ticket introuvable ou expiré.'); setLoading(false); return }
      const json = await res.json()
      setData(json)
    } catch { setError('Erreur de connexion.') }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [code])

  // Periodic refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchData, 30000)
    return () => clearInterval(t)
  }, [code])

  useAgencySocket(agencyId, {
    onNumberCalled: (d) => {
      if (!data) return
      if (d.number === data.ticket.number) {
        // This ticket is being called right now
        setData(prev => prev ? {
          ...prev,
          ticket: { ...prev.ticket, status: 'CALLED', guichet: d.guichet },
          rank: 0, ahead: 0,
        } : prev)
      } else {
        // Another ticket called — refresh rank
        fetchData()
      }
    },
    onTicketUpdate: () => fetchData(),
  })

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-btk-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white font-black text-lg">BTK</span>
        </div>
        <div className="text-btk-blue text-sm animate-pulse font-medium">Chargement de votre ticket…</div>
      </div>
    </div>
  )

  /* ── Error ── */
  if (error || !data) return (
    <div className="min-h-screen bg-[#F0F4FA] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-md">
        <div className="text-5xl mb-4">❌</div>
        <div className="font-bold text-gray-700 mb-2">Ticket introuvable</div>
        <div className="text-gray-400 text-sm mb-6">{error || 'Ce QR code est invalide ou a expiré.'}</div>
        <Link href="/client" className="btk-btn inline-block px-6 py-3 rounded-xl text-sm">
          Prendre un nouveau ticket
        </Link>
      </div>
    </div>
  )

  const { ticket, agency, rank, presentAt, estimatedMinutes, currentCalled, currentGuichet } = data
  const isCalled = ticket.status === 'CALLED'
  const isServed = ticket.status === 'SERVED' || ticket.status === 'ABSENT'

  return (
    <div className="min-h-screen bg-[#F0F4FA] flex flex-col max-w-sm mx-auto">

      {/* ── Top bar — style mobile app ── */}
      <div className="bg-btk-blue px-4 pt-10 pb-5 flex items-center gap-3">
        <Link href="/client" className="text-white/70 hover:text-white transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
          <span>🇫🇷</span>
          <span>Français</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {/* ── Agency card ── */}
      <div className="mx-4 -mt-3 bg-white rounded-2xl shadow-md px-4 py-3 mb-3 flex items-center gap-3">
        {/* BTK Logo */}
        <div className="shrink-0 w-14 h-[52px] bg-btk-blue rounded-xl flex flex-col items-center justify-center">
          <svg viewBox="0 0 40 30" className="w-8 h-5 fill-white opacity-90">
            <path d="M5 25 Q10 5 20 8 Q30 11 35 25" strokeWidth="2" stroke="white" fill="none"/>
            <circle cx="18" cy="12" r="2" fill="white"/>
            <circle cx="24" cy="10" r="1.5" fill="white"/>
          </svg>
          <span className="text-white font-black text-xs leading-tight tracking-wide">BTK</span>
          <span className="text-white/60 text-[8px] leading-none">BANK</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-800 text-sm truncate">{agency.name}</div>
          <div className="text-gray-400 text-xs mt-0.5">{agency.city}</div>
        </div>
        {/* "C'est Votre Tour" badge — shown when called */}
        {isCalled && (
          <div className="shrink-0 bg-btk-blue rounded-xl px-3 py-2 text-center shadow-md">
            <div className="text-white text-[10px] font-medium leading-tight">C'est</div>
            <div className="text-white text-[11px] font-black leading-tight">Votre Tour</div>
          </div>
        )}
      </div>

      {/* ── Main ticket card ── */}
      <div className="mx-4 bg-white rounded-3xl shadow-md overflow-hidden mb-3">

        {/* Called alert banner */}
        {isCalled && (
          <div className="bg-green-500 px-5 py-3 text-center">
            <p className="text-white font-bold text-sm">
              📢 Présentez-vous au <span className="underline">{ticket.guichet ?? 'guichet'}</span>
            </p>
          </div>
        )}

        {isServed && (
          <div className="bg-gray-50 px-5 py-2 text-center border-b border-gray-100">
            <p className="text-gray-400 text-xs">Ce ticket a déjà été traité</p>
          </div>
        )}

        {/* N° */}
        <div className="text-center pt-7 pb-1 px-6">
          <div className="text-btk-blue font-bold text-base tracking-wide">N°</div>
          <div
            className={`font-black leading-none tabular-nums transition-colors duration-700 ${
              isCalled ? 'text-green-500 text-[5.5rem]' : 'text-btk-blue text-[5.5rem]'
            }`}
            style={{ fontSize: 'clamp(4rem, 20vw, 5.5rem)' }}>
            {ticket.number}
          </div>
        </div>

        {/* Dashed separator dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#EEF3FA]" />
          ))}
        </div>

        {/* Rang + Soyez là à */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 pb-6">
          <div className="text-center px-6">
            <div className="text-gray-400 text-xs mb-2">Votre Rang</div>
            <div className={`text-3xl font-black ${isCalled ? 'text-green-500' : 'text-btk-blue'}`}>
              {isCalled ? '✅' : `#${rank}`}
            </div>
          </div>
          <div className="text-center px-6">
            <div className="text-gray-400 text-xs mb-2">Soyez là à</div>
            <div className="text-3xl font-black text-btk-blue tabular-nums">{presentAt}</div>
          </div>
        </div>

        {/* Service */}
        <div className="flex justify-between items-center px-5 py-3.5 border-t border-dashed border-gray-100">
          <span className="text-gray-400 text-sm">Service(s)</span>
          <span className="text-gray-700 font-semibold text-sm">{ticket.service}</span>
        </div>

        {/* Guichet — visible quand appelé */}
        {ticket.guichet && (
          <div className="flex justify-between items-center px-5 py-3.5 border-t border-dashed border-gray-100">
            <span className="text-gray-400 text-sm">Guichet</span>
            <span className="bg-green-100 text-green-700 font-bold text-sm px-3 py-1 rounded-lg">{ticket.guichet}</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="px-5 py-3 border-t border-gray-50 text-center">
          <span className="text-gray-300 text-xs">
            Rejoint à {new Date(ticket.createdAt).toLocaleTimeString('fr-TN', {
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            })}
          </span>
        </div>
      </div>

      {/* ── Live status card (en attente seulement) ── */}
      {ticket.status === 'WAITING' && currentCalled > 0 && (
        <div className="mx-4 bg-white rounded-2xl shadow-sm px-4 py-3 mb-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-medium">En service maintenant</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-500 text-sm">Numéro</span>
              <span className="font-black text-btk-blue text-xl tabular-nums">
                {currentCalled}
              </span>
            </div>
            {currentGuichet && (
              <span className="text-xs bg-btk-bg text-btk-blue font-semibold px-3 py-1.5 rounded-xl">
                {currentGuichet}
              </span>
            )}
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-btk-blue h-1.5 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, Math.max(5, ((currentCalled / ticket.number) * 100)))}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-gray-400">
            {ticket.number > currentCalled
              ? `${ticket.number - currentCalled - 1} ticket(s) avant vous · ~${estimatedMinutes} min`
              : 'Votre tour arrive bientôt !'}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="mx-4 mb-10 flex flex-col gap-2">
        <button onClick={fetchData}
          className="w-full bg-white text-btk-blue border border-btk-blue/20 font-medium py-3 rounded-2xl text-sm hover:bg-btk-bg transition-colors shadow-sm">
          🔄 Actualiser le statut
        </button>
        <Link href="/client"
          className="block text-center text-gray-400 text-xs py-2">
          Prendre un autre ticket
        </Link>
      </div>

    </div>
  )
}
