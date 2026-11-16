import { X, TrendingUp } from 'lucide-react'

import ExerciseProgressChart from './ExerciseProgressChart'
import { exDisplayName } from '../../utils/routineConstants'

/** La grafica de un ejercicio, abierta desde el dia de entrenamiento. Misma
 *  cascara que la calculadora de 1RM, para que se sienta igual. */
export default function ExerciseProgressModal({ exercise, onClose }) {
  // El mismo nombre que se ve en la pantalla del dia: en espanol cuando lo hay.
  const nombre = exDisplayName(exercise)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp size={20} className="text-brand-500 flex-shrink-0" />
              <h3 className="font-bold text-lg truncate">{nombre}</h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-400">Tu progreso en este ejercicio</p>
        </div>

        <div className="px-5 py-4">
          <ExerciseProgressChart exerciseId={exercise?.id} exerciseName={nombre} />
        </div>
      </div>
    </div>
  )
}
