import { useState } from 'react'
import { X, Calculator } from 'lucide-react'

// Brzycki percentages for 1RM through 20RM
const RM_PERCENTAGES = [
  1.000, 0.943, 0.906, 0.881, 0.856,
  0.831, 0.806, 0.786, 0.765, 0.744,
  0.723, 0.703, 0.688, 0.673, 0.658,
  0.643, 0.628, 0.618, 0.608, 0.598,
]

export default function OneRMCalculator({ exercise, onClose }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const w = parseFloat(weight)
  const r = parseInt(reps)
  const valid = w > 0 && r > 0 && r <= 20

  // Calculate 1RM using Brzycki formula
  const oneRM = valid ? Math.round(w / RM_PERCENTAGES[r - 1]) : 0

  // Build RM table
  const rmTable = valid
    ? RM_PERCENTAGES.map((pct, i) => ({
        rm: i + 1,
        kg: Math.round(oneRM * pct),
      }))
    : []

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Calculator size={20} className="text-brand-500" />
              <h3 className="font-bold text-lg">Calcula tu 1RM</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-400">{exercise?.name || 'Ejercicio'}</p>
        </div>

        <div className="px-5 py-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-medium">Peso (kg)</label>
              <input
                type="number"
                className="input text-center text-lg font-bold"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Repeticiones</label>
              <input
                type="number"
                className="input text-center text-lg font-bold"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* RM Grid */}
          {valid && rmTable.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {rmTable.map(({ rm, kg }) => (
                <div
                  key={rm}
                  className={'rounded-xl p-2.5 text-center transition-all ' + (rm === 1
                    ? 'bg-brand-500/10 dark:bg-brand-500/20 ring-2 ring-brand-500/30'
                    : rm === r
                      ? 'bg-green-500/10 dark:bg-green-500/20 ring-2 ring-green-500/30'
                      : 'bg-gray-50 dark:bg-gray-800'
                  )}
                >
                  <p className={'text-xs font-bold ' + (rm === 1
                    ? 'text-brand-500'
                    : rm === r
                      ? 'text-green-500'
                      : 'text-gray-400'
                  )}>
                    {rm}RM
                  </p>
                  <p className={'text-xl font-bold ' + (rm === 1
                    ? 'text-brand-500'
                    : ''
                  )}>
                    {kg}
                  </p>
                  <p className="text-[10px] text-gray-400">kg</p>
                </div>
              ))}
            </div>
          )}

          {!valid && weight && reps && (
            <p className="text-xs text-red-400 text-center py-4">
              Ingresa valores validos (1-20 reps)
            </p>
          )}

          {!weight && !reps && (
            <div className="text-center py-8 text-gray-400">
              <Calculator size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Ingresa peso y reps para ver la tabla</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
