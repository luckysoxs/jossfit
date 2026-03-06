import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, HeartPulse } from 'lucide-react'
import { CARDIO_TYPES, EQUIPMENT, DURATIONS, LEVELS, generateHIITIntervals, generateSteadyIntervals } from '../data/cardioProtocols'
import CardioSession from '../components/cardio/CardioSession'

export default function Cardio() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [cardioType, setCardioType] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [duration, setDuration] = useState(null)
  const [level, setLevel] = useState(null)

  const equipData = EQUIPMENT.find(e => e.id === equipment)
  const unit = equipData?.unit || ''

  const getIntervals = () => {
    if (cardioType === 'hiit') return generateHIITIntervals(equipment, level, duration)
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
        onExit={() => navigate('/')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
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
          <div className="space-y-3">
            {CARDIO_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => { setCardioType(t.id); setStep(2) }}
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
            <h1 className="text-2xl font-bold">Nivel de Intensidad</h1>
            <p className="text-gray-400 text-sm mt-1">{CARDIO_TYPES.find(t => t.id === cardioType)?.label} · {duration}'</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {LEVELS.map(l => (
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
            ))}
          </div>
        </>
      )}

      {/* Step progress */}
      <div className="flex gap-2 justify-center pt-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-gray-700'}`} />
        ))}
      </div>
    </div>
  )
}
