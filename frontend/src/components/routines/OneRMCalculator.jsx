import { useState } from 'react'
import { X, Calculator } from 'lucide-react'

export default function OneRMCalculator({ exercise, onClose }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const w = parseFloat(weight)
  const r = parseInt(reps)
  const valid = w > 0 && r > 0 && r < 37

  const epley = valid ? Math.round(w * (1 + r / 30) * 10) / 10 : 0
  const brzycki = valid && r < 37 ? Math.round((w * 36 / (37 - r)) * 10) / 10 : 0
  const average = valid ? Math.round(((epley + brzycki) / 2) * 10) / 10 : 0

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-brand-500" />
            <h3 className="font-bold text-lg">Calculador 1RM</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">{exercise?.name || 'Ejercicio'}</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs text-gray-500">Peso usado (kg)</label>
            <input
              type="number"
              className="input"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="ej: 80"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Repeticiones realizadas</label>
            <input
              type="number"
              className="input"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="ej: 8"
              inputMode="numeric"
            />
          </div>
        </div>

        {valid && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Tu 1RM estimado</p>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Epley</span>
              <span className="font-bold text-lg">{epley} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Brzycki</span>
              <span className="font-bold text-lg">{brzycki} kg</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
              <span className="text-sm font-medium text-brand-500">Promedio</span>
              <span className="font-bold text-xl text-brand-500">{average} kg</span>
            </div>
          </div>
        )}

        {!valid && weight && reps && (
          <p className="text-xs text-red-400 text-center">Ingresa valores validos (reps &lt; 37)</p>
        )}
      </div>
    </div>
  )
}
