'use client'
import { useState } from 'react'

interface PinModalProps {
  agencyName: string
  onSuccess: (guichetId: number, guichetLabel: string) => void
  guichets: { id: number; label: string; number: number; isActive?: boolean }[]
}

export default function PinModal({ agencyName, onSuccess, guichets }: PinModalProps) {
  const [selectedGuichet, setSelectedGuichet] = useState<number | null>(null)
  const [error, setError] = useState('')

  function handleConnect() {
    if (!selectedGuichet) {
      setError('Selectionner un guichet')
      return
    }

    const guichet = guichets.find(g => g.id === selectedGuichet)
    if (!guichet) {
      setError('Guichet invalide')
      return
    }

    setError('')
    onSuccess(guichet.id, guichet.label)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-btk-blue">
            <span className="text-lg font-bold text-white">BTK</span>
          </div>
          <div className="font-semibold text-gray-800">{agencyName}</div>
          <div className="text-sm text-gray-400">Selection du guichet</div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500">Votre guichet</label>
          <select
            className="btk-input"
            value={selectedGuichet ?? ''}
            onChange={e => setSelectedGuichet(Number(e.target.value))}
          >
            <option value="">-- Selectionner --</option>
            {guichets.map(g => (
              <option key={g.id} value={g.id}>
                {g.label}{g.isActive === false ? ' - ferme' : ''}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-center text-sm text-red-500">{error}</p>}

        <button className="btk-btn w-full" onClick={handleConnect}>
          Se connecter
        </button>
      </div>
    </div>
  )
}
