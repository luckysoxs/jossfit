import { useState } from 'react'

const TOUR_STEPS = [
  {
    title: 'Dashboard',
    description:
      'Tu panel principal donde puedes ver tu resumen de fitness, entrenamientos y estadísticas.',
    icon: '\uD83D\uDCCA',
  },
  {
    title: 'Mi Rutina',
    description:
      'Accede a tu rutina dividida en días. Haz clic en un día para ver los ejercicios, marcarlos como completados y calcular tu 1RM.',
    icon: '\uD83D\uDCAA',
  },
  {
    title: 'Cardio',
    description:
      'Entrena cardio con HIIT, LISS o Steady State. LISS se basa en zonas de BPM con guías para cada equipo.',
    icon: '\u2764\uFE0F',
  },
  {
    title: 'Crear Rutina',
    description:
      'Crea rutinas manualmente eligiendo ejercicios, series, repeticiones y descanso por día. También puedes generar una con IA.',
    icon: '\u2728',
  },
  {
    title: 'Calculador 1RM',
    description:
      'Calcula tu repetición máxima (1RM) para cualquier ejercicio usando las fórmulas Epley y Brzycki.',
    icon: '\uD83E\uDDEE',
  },
  {
    title: 'Color de la App',
    description:
      'Personaliza el color de tu app desde tu perfil. Elige entre 7 colores diferentes.',
    icon: '\uD83C\uDFA8',
  },
  {
    title: 'Beneficios',
    description:
      'Descubre descuentos y promociones exclusivas de nuestros partners.',
    icon: '\uD83C\uDF81',
  },
]

export default function AppTour({ onComplete }) {
  const [step, setStep] = useState(0)
  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  const next = () => {
    if (isLast) {
      onComplete?.()
    } else {
      setStep((s) => s + 1)
    }
  }

  const skip = () => {
    onComplete?.()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm"
        onClick={skip}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700 animate-fade-in">
        {/* Step counter */}
        <p className="text-xs text-gray-400 text-center mb-4">
          Paso {step + 1} de {TOUR_STEPS.length}
        </p>

        {/* Icon */}
        <div className="text-5xl text-center mb-4">{current.icon}</div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white text-center mb-2">
          {current.title}
        </h3>

        {/* Description */}
        <p className="text-gray-300 text-sm text-center leading-relaxed mb-6">
          {current.description}
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {TOUR_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-brand-500 w-6'
                  : i < step
                    ? 'bg-brand-500/50'
                    : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {!isLast && (
            <button
              onClick={skip}
              className="flex-1 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl"
            >
              Omitir
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
          >
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
