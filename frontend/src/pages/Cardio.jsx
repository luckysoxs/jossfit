import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, HeartPulse } from 'lucide-react'
import { CARDIO_TYPES, EQUIPMENT, DURATIONS, LEVELS, HIIT_LEVELS, LISS_BPM_ZONES, LISS_EQUIPMENT_GUIDANCE, generateHIITIntervals, generateSteadyIntervals, generateLISSIntervals } from '../data/cardioProtocols'
import CardioSession from '../components/cardio/CardioSession'
import PageTour from '../components/ui/PageTour'

export default function Cardio() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedType = location.state?.preselectedType
  const [step, setStep] = useState(1)
  const [cardioType, setCardioType] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [duration, setDuration] = useState(null)
  const [level, setLevel] = useState(null)

  // Auto-advance if coming from routine with preselected type
  useEffect(() => {
    if (preselectedType && CARDIO_TYPES.some(t => t.id === preselectedType)) {
      setCardioType(preselectedType)
      if (preselectedType === 'liss') {
        setStep(3) // LISS skips equipment
      } else {
        setStep(2) // HIIT/Steady go to equipment selection
      }
    }
  }, [])

  const equipData = EQUIPMENT.find(e => e.id === equipment)
  const unit = equipData?.unit || ''

  const getIntervals = () => {
    if (cardioType === 'hiit') return generateHIITIntervals(equipment, level, duration)
    if (cardioType === 'liss') return generateLISSIntervals(level, duration)
    return generateSteadyIntervals(equipment, level, duration)
  }

  if (step === 5) {
    const intervals = getIntervals()
    return (
      <CardioSession
        intervals={intervals}
        equipment={equipment}
        cardioType={cardioType}
        level={level}
        duration={duration}
        unit={unit}
        bpmZone={cardioType === 'liss' ? LISS_BPM_ZONES.find(z => z.level === level) : null}
        onExit={() => preselectedType ? navigate(-1) : navigate('/')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => {
          if (step === 1) navigate(-1)
          else if (step === 2 && preselectedType) navigate(-1)
          else if (step === 3 && cardioType === 'liss' && preselectedType) navigate(-1)
          else if (step === 3 && cardioType === 'liss') setStep(1)
          else setStep(step - 1)
        }}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300"
      >
        <ArrowLeft size={20} /> Volver
      </button>

      {/* Step 1: Cardio Type */}
      {step === 1 && (
        <>
          <div className="text-center">
            <HeartPulse size={40} className="text-red-500 mx-auto mb-2" />
            <h1 className="text-2xl font-bold">Entrenamiento Cardio</h1>
            <p className="text-gray-400 text-sm mt-1">Elige tu tipo de cardio</p>
          </div>
          <div data-tour="cardio-types" className="space-y-3">
            {CARDIO_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.id === 'liss') { setCardioType('liss'); setStep(3) }
                  else { setCardioType(t.id); setStep(2) }
                }}
                className="card w-full text-left flex items-center gap-4 hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-3xl">{t.emoji}</span>
                <div>
                  <p className="font-bold text-lg">{t.label}</p>
                  <p className="text-sm text-gray-400">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 2: Equipment */}
      {step === 2 && (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Elige tu Equipo</h1>
            <p className="text-gray-400 text-sm mt-1">{CARDIO_TYPES.find(t => t.id === cardioType)?.label}</p>
          </div>
          <div className="space-y-3">
            {EQUIPMENT.map(e => (
              <button
                key={e.id}
                onClick={() => { setEquipment(e.id); setStep(3) }}
                className="card w-full text-left flex items-center gap-4 hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-4xl">{e.emoji}</span>
                <div>
                  <p className="font-bold text-lg">{e.label}</p>
                  <p className="text-sm text-gray-400">Unidad: {e.unit}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 3: Duration */}
      {step === 3 && (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Duración</h1>
            <p className="text-gray-400 text-sm mt-1">¿Cuánto tiempo?</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DURATIONS.map(d => (
              <button
                key={d}
                onClick={() => { setDuration(d); setStep(4) }}
                className="card text-center py-8 hover:bg-gray-800/50 transition-colors"
              >
                <p className="text-3xl font-bold">{d}'</p>
                <p className="text-sm text-gray-400 mt-1">minutos</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 4: Level */}
      {step === 4 && (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{cardioType === 'liss' ? 'Zona de BPM' : 'Nivel de Intensidad'}</h1>
            <p className="text-gray-400 text-sm mt-1">{CARDIO_TYPES.find(t => t.id === cardioType)?.label} · {duration}'</p>
          </div>
          {cardioType === 'hiit' ? (
            <div className="space-y-3">
              {HIIT_LEVELS.map(l => (
                <button
                  key={l.level}
                  onClick={() => { setLevel(l.level); setStep(5) }}
                  className="card w-full text-left hover:bg-gray-800/50 transition-colors overflow-hidden"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl ${l.color} flex items-center justify-center text-3xl`}>
                      {l.emoji}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{l.label}</p>
                      <p className="text-sm text-gray-400">{l.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {cardioType === 'liss' ? (
                LISS_BPM_ZONES.map(z => (
                  <button
                    key={z.level}
                    onClick={() => { setLevel(z.level); setStep(5) }}
                    className="card text-left hover:bg-gray-800/50 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${z.color} flex items-center justify-center text-white text-xl font-bold`}>
                        {z.level}
                      </div>
                      <div>
                        <p className="font-bold">{z.label}</p>
                        <p className="text-sm text-gray-400">{z.bpm[0]}-{z.bpm[1]} BPM</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                LEVELS.map(l => (
                  <button
                    key={l.level}
                    onClick={() => { setLevel(l.level); setStep(5) }}
                    className="card text-left hover:bg-gray-800/50 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${l.color} flex items-center justify-center text-white text-xl font-bold`}>
                        {l.level}
                      </div>
                      <div>
                        <p className="font-bold">Nivel {l.level}</p>
                        <p className="text-sm text-gray-400">{l.label}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      <PageTour
        pageKey="cardio"
        steps={[
          { target: '[data-tour="cardio-types"]', title: 'Tipos de Cardio', description: 'HIIT, LISS y Steady State con diferentes equipos.', position: 'top' },
        ]}
      />

      {/* Step progress */}
      <div className="flex gap-2 justify-center pt-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-gray-700'}`} />
        ))}
      </div>
    </div>
  )
}
