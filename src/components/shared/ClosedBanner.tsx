export default function ClosedBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center m-4">
      <div className="text-3xl mb-2">🕐</div>
      <div className="font-semibold text-amber-800 text-lg">Service fermé</div>
      <div className="text-amber-600 text-sm mt-1">
        Disponible du <strong>Lundi au Vendredi</strong><br/>
        de <strong>08h00 à 16h30</strong>
      </div>
    </div>
  )
}
