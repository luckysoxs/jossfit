import { useState, useEffect, useCallback, useRef } from 'react'

const TOUR_STEPS = [
  {
    target: '[data-tour="quick-links"]',
    title: 'Acceso Rapido',
    description: 'Tus accesos directos a las funciones principales de la app.',
    position: 'bottom',
  },
  {
    target: '[data-tour="link-rutina"]',
    title: 'Mi Rutina',
    description: 'Tu rutina dividida en dias. Cada ejercicio tiene calculador 1RM y opcion de reemplazo.',
    position: 'bottom',
  },
  {
    target: '[data-tour="link-cardio"]',
    title: 'Cardio',
    description: 'HIIT, LISS (basado en BPM) y Steady State. 4 equipos incluyendo escaladora infinita.',
    position: 'bottom',
  },
  {
    target: '[data-tour="stats"]',
    title: 'Tus Estadisticas',
    description: 'Entrenamientos realizados, racha actual, duracion promedio y mas.',
    position: 'bottom',
  },
  {
    target: '[data-tour="nav-entreno"]',
    title: 'Registrar Entreno',
    description: 'Registra tus entrenamientos y lleva control de tu progreso.',
    position: 'top',
  },
  {
    target: '[data-tour="nav-perfil"]',
    title: 'Tu Perfil',
    description: 'Personaliza el color de la app, modo oscuro/claro y tus datos.',
    position: 'top',
  },
]

function getPlatform() {
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function getPwaInstructions(platform) {
  if (platform === 'ios') {
    return (
      <ol className="text-left text-sm text-gray-300 space-y-2 mt-3">
        <li>1. Toca el boton de compartir (<span className="font-semibold">{'\u25A1\u2191'}</span>) en Safari</li>
        <li>2. Selecciona &quot;Agregar a pantalla de inicio&quot;</li>
        <li>3. Toca &quot;Agregar&quot;</li>
      </ol>
    )
  }
  if (platform === 'android') {
    return (
      <ol className="text-left text-sm text-gray-300 space-y-2 mt-3">
        <li>1. Toca los tres puntos (<span className="font-semibold">{'\u22EE'}</span>) en Chrome</li>
        <li>2. Selecciona &quot;Agregar a pantalla de inicio&quot;</li>
        <li>3. Toca &quot;Agregar&quot;</li>
      </ol>
    )
  }
  return (
    <ol className="text-left text-sm text-gray-300 space-y-2 mt-3">
      <li>1. En Chrome, busca el icono de instalacion (<span className="font-semibold">{'\u2295'}</span>) en la barra de direcciones</li>
      <li>2. Haz clic en &quot;Instalar&quot;</li>
    </ol>
  )
}

export default function AppTour({ onComplete }) {
  const [step, setStep] = useState(0)
  const [spotlightStyle, setSpotlightStyle] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const deferredPromptRef = useRef(null)

  const totalSteps = TOUR_STEPS.length + 1 // 6 spotlight + 1 PWA modal
  const isSpotlightStep = step < TOUR_STEPS.length
  const isPwaStep = step === TOUR_STEPS.length
  const isLast = step === totalSteps - 1

  // Capture the beforeinstallprompt event for PWA install
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPromptRef.current = e
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const updateSpotlight = useCallback(() => {
    if (!isSpotlightStep) {
      setSpotlightStyle(null)
      setTooltipStyle(null)
      return
    }

    const currentStep = TOUR_STEPS[step]
    const el = document.querySelector(currentStep.target)

    if (!el) {
      setSpotlightStyle(null)
      setTooltipStyle(null)
      return
    }

    const rect = el.getBoundingClientRect()
    const padding = 8

    const spotlight = {
      position: 'fixed',
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: '12px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
      zIndex: 101,
      pointerEvents: 'none',
      transition: 'all 0.3s ease',
    }

    const tooltipWidth = 300
    let tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2
    // Clamp to viewport
    if (tooltipLeft < 12) tooltipLeft = 12
    if (tooltipLeft + tooltipWidth > window.innerWidth - 12) {
      tooltipLeft = window.innerWidth - 12 - tooltipWidth
    }

    const tooltip = {
      position: 'fixed',
      left: tooltipLeft,
      width: tooltipWidth,
      zIndex: 102,
      transition: 'all 0.3s ease',
    }

    if (currentStep.position === 'bottom') {
      tooltip.top = rect.bottom + padding + 12
    } else {
      tooltip.bottom = window.innerHeight - rect.top + padding + 12
    }

    setSpotlightStyle(spotlight)
    setTooltipStyle(tooltip)
  }, [step, isSpotlightStep])

  useEffect(() => {
    updateSpotlight()

    const handleResize = () => updateSpotlight()
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize, true)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize, true)
    }
  }, [updateSpotlight])

  const goNext = () => {
    if (isLast) {
      onComplete?.()
      return
    }
    setIsTransitioning(true)
    setTimeout(() => {
      setStep((s) => s + 1)
      setIsTransitioning(false)
    }, 150)
  }

  const skip = () => {
    onComplete?.()
  }

  const handleInstall = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt()
      const result = await deferredPromptRef.current.userChoice
      if (result.outcome === 'accepted') {
        deferredPromptRef.current = null
      }
    }
  }

  // Render PWA final step (centered modal)
  if (isPwaStep) {
    const platform = getPlatform()
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/75" onClick={skip} />
        <div
          className="relative w-full max-w-sm bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700"
          style={{
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.3s ease',
          }}
        >
          <p className="text-xs text-gray-400 text-center mb-4">
            Paso {step + 1} de {totalSteps}
          </p>

          <div className="text-4xl text-center mb-3">{'\uD83D\uDCF2'}</div>

          <h3 className="text-xl font-bold text-white text-center mb-1">
            Instalar como App
          </h3>

          <p className="text-gray-400 text-sm text-center mb-2">
            Instala la app en tu dispositivo para acceso rapido:
          </p>

          {getPwaInstructions(platform)}

          {deferredPromptRef.current && (
            <button
              onClick={handleInstall}
              className="w-full mt-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
            >
              Instalar ahora
            </button>
          )}

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-5 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'bg-brand-500 w-6'
                    : i < step
                      ? 'bg-brand-500/50 w-2'
                      : 'bg-gray-600 w-2'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={skip}
              className="flex-1 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl"
            >
              Omitir
            </button>
            <button
              onClick={() => onComplete?.()}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render spotlight step
  const currentStep = TOUR_STEPS[step]

  return (
    <div className="fixed inset-0 z-[100]" onClick={skip}>
      {/* Spotlight cutout */}
      {spotlightStyle && (
        <div
          style={{
            ...spotlightStyle,
            opacity: isTransitioning ? 0 : 1,
          }}
        />
      )}

      {/* Fallback overlay when no target found */}
      {!spotlightStyle && (
        <div className="absolute inset-0 bg-black/75" />
      )}

      {/* Tooltip */}
      {tooltipStyle && (
        <div
          style={{
            ...tooltipStyle,
            opacity: isTransitioning ? 0 : 1,
            transform: isTransitioning ? 'translateY(8px)' : 'translateY(0)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 rounded-2xl p-5 shadow-2xl border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">
              Paso {step + 1} de {totalSteps}
            </p>

            <h3 className="text-lg font-bold text-white mb-1">
              {currentStep.title}
            </h3>

            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {currentStep.description}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mb-4">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-brand-500 w-6'
                      : i < step
                        ? 'bg-brand-500/50 w-2'
                        : 'bg-gray-600 w-2'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={skip}
                className="flex-1 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl"
              >
                Omitir
              </button>
              <button
                onClick={goNext}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
