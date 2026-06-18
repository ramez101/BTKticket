'use client'
import { useState } from 'react'

interface PinModalProps {
  agencyId: number
  agencyName: string
  onSuccess: (guichetId: number, guichetLabel: string) => void
  guichets: { id: number; label: string; number: number; isActive?: boolean }[]
}

export default function PinModal({ agencyId, agencyName, onSuccess, guichets }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [selectedGuichet, setSelectedGuichet] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (!selectedGuichet) { setError('Sélectionner un guichet'); return }
    if (pin.length < 4) { setError('PIN à 4 chiffres requis'); return }
    setLoading(true); setError('')
    const res = await fetch(`/api/agency/${agencyId}/verify-pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      const g = guichets.find(g => g.id === selectedGuichet)!
      onSuccess(selectedGuichet, g.label)
    } else {
      setError('PIN incorrect'); setPin('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-btk-blue rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">BTK</span>
          </div>
          <div className="font-semibold text-gray-800">{agencyName}</div>
          <div className="text-sm text-gray-400">Authentification chargé</div>
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Votre guichet</label>
          <select className="btk-input" value={selectedGuichet ?? ''} onChange={e => setSelectedGuichet(Number(e.target.value))}>
            <option value="">-- Sélectionner --</option>
            {guichets.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}{g.isActive === false ? ' - ferme' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Code PIN agence</label>
          <input type="password" inputMode="numeric" maxLength={6} className="btk-input text-center text-xl tracking-widest"
            placeholder="••••" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleVerify()} />
        </div>
        {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
        <button className="btk-btn w-full" onClick={handleVerify} disabled={loading}>
          {loading ? 'Vérification...' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}
