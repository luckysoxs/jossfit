import { useState, useEffect, useCallback } from 'react'
import { HelpCircle, X } from 'lucide-react'

/**
 * Lightweight per-page tour component.
 * Usage:
 *   <PageTour pageKey="routines" steps={[
 *     { target: '[data-tour="gen-btn"]', title: 'Generar Rutina', description: 'Crea tu rutina personalizada' },
 *   ]} />
 *
 * Add data-tour attributes to elements you want to highlight.
 * Tour auto-shows once per page (stored in localStorage).
 */

export default function PageTour({ pageKey, steps }) {
  const storageKey = `tour_done_${pageKey}`
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [spotlightStyle, setSpotlightStyle] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState(null)

  const showTour = () => {
    setStep(0)
    setActive(true)
  }

  const completeTour = () => {
    setActive(false)
    localStorage.setItem(storageKey, '1')
  }

  // Auto-show on first visit
  useEffect(() => {
    if (!localStorage.getItem(storageKey) && steps.length > 0) {
      const timer = setTimeout(() => showTour(), 600)
      return () => clearTimeout(timer)
    }
  }, [pageKey])

  const updatePosition = useCallback(() => {
    if (!active || step >= steps.length) return

    const currentStep = steps[step]
    const el = document.querySelector(currentStep.target)

    if (!el) {
      setSpotlightStyle(null)
      setTooltipStyle(null)
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 6

    setSpotlightStyle({
      position: 'fixed',
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: '12px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
      zIndex: 101,
      pointerEvents: 'none',
      transition: 'all 0.3s ease',
    })

    const tw = 280
    let tl = rect.left + rect.width / 2 - tw / 2
    if (tl < 8) tl = 8
    if (tl + tw > window.innerWidth - 8) tl = window.innerWidth - 8 - tw

    const pos = currentStep.position || 'bottom'
    const tooltip = { position: 'fixed', left: tl, width: tw, zIndex: 102 }

    if (pos === 'top') {
      tooltip.bottom = window.innerHeight - rect.top + pad + 10
    } else {
      tooltip.top = rect.bottom + pad + 10
    }

    setTooltipStyle(tooltip)
  }, [active, step, steps])

  useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  const next = () => {
    if (step >= steps.length - 1) {
      completeTour()
    } else {
      setStep(s => s + 1)
    }
  }

  if (!active || steps.length === 0) {
    // Show help button to re-trigger tour
    return (
      <button
        onClick={showTour}
        className="fixed bottom-20 right-4 z-40 w-10 h-10 rounded-full bg-brand-500 text-white shadow-lg flex items-center justify-center hover:bg-brand-600 transition-colors"
        aria-label="Tour de ayuda"
      >
        <HelpCircle size={20} />
      </button>
    )
  }

  const currentStep = steps[step]

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={completeTour}>
        {spotlightStyle && <div style={spotlightStyle} />}
        {!spotlightStyle && <div className="absolute inset-0 bg-black/70" />}

        {tooltipStyle && (
          <div style={tooltipStyle} onClick={e => e.stopPropagation()}>
            <div className="bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs text-gray-400">
                  {step + 1} de {steps.length}
                </p>
                <button onClick={completeTour} className="text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>

              <h3 className="text-sm font-bold text-white mb-1">{currentStep.title}</h3>
              <p className="text-xs text-gray-300 leading-relaxed mb-3">{currentStep.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'bg-brand-500 w-4' : i < step ? 'bg-brand-500/50 w-1.5' : 'bg-gray-600 w-1.5'
                    }`} />
                  ))}
                </div>
                <button onClick={next}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors">
                  {step >= steps.length - 1 ? 'Listo' : 'Siguiente'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
