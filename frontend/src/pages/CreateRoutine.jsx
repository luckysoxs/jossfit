import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ArrowLeft, Plus, X, Search, ChevronUp, ChevronDown, Save, Dumbbell } from 'lucide-react'

const SPLIT_TYPES = ['PPL', 'Upper/Lower', 'Full Body', 'Torso/Pierna', 'Bro Split', 'Custom']

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
]

const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', forearms: 'Antebrazos', quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales', glutes: 'Glúteos', calves: 'Pantorrillas',
  abs: 'Abdominales', traps: 'Trapecios',
}

export default function CreateRoutine() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [name, setName] = useState('')
  const [splitType, setSplitType] = useState('PPL')
  const [daysPerWeek, setDaysPerWeek] = useState(3)

  // Step 2
  const [days, setDays] = useState([])

  // Step 3
  const [exercises, setExercises] = useState([])
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('')

  useEffect(() => {
    api.get('/exercises').then(r => setExercises(r.data)).catch(() => {})
  }, [])

  // Initialize days when moving to step 2
  const goToStep2 = () => {
    if (!name.trim()) return
    const newDays = Array.from({ length: daysPerWeek }, (_, i) => ({
      day_number: i + 1,
      name: days[i]?.name || `Día ${i + 1}`,
      focus: days[i]?.focus || '',
      exercises: days[i]?.exercises || [],
    }))
    setDays(newDays)
    setStep(2)
  }

  const updateDay = (index, field, value) => {
    const updated = [...days]
    updated[index] = { ...updated[index], [field]: value }
    setDays(updated)
  }

  const addExercise = (exercise) => {
    const updated = [...days]
    const dayExercises = updated[activeDayIndex].exercises
    dayExercises.push({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      muscle_group: exercise.muscle_group,
      order: dayExercises.length + 1,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      rest_seconds: 90,
    })
    setDays(updated)
    setShowSearch(false)
    setSearchTerm('')
  }

  const updateExercise = (dayIdx, exIdx, field, value) => {
    const updated = [...days]
    updated[dayIdx].exercises[exIdx] = { ...updated[dayIdx].exercises[exIdx], [field]: value }
    setDays(updated)
  }

  const removeExercise = (dayIdx, exIdx) => {
    const updated = [...days]
    updated[dayIdx].exercises.splice(exIdx, 1)
    updated[dayIdx].exercises.forEach((ex, i) => { ex.order = i + 1 })
    setDays(updated)
  }

  const moveExercise = (dayIdx, exIdx, direction) => {
    const updated = [...days]
    const exs = updated[dayIdx].exercises
    const newIdx = exIdx + direction
    if (newIdx < 0 || newIdx >= exs.length) return
    ;[exs[exIdx], exs[newIdx]] = [exs[newIdx], exs[exIdx]]
    exs.forEach((ex, i) => { ex.order = i + 1 })
    setDays(updated)
  }

  const filteredExercises = exercises.filter(e => {
    const matchesName = !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMuscle = !muscleFilter || e.muscle_group === muscleFilter
    return matchesName && matchesMuscle
  })

  const saveRoutine = async () => {
    setSaving(true)
    try {
      const payload = {
        name,
        split_type: splitType,
        objective: null,
        days_per_week: daysPerWeek,
        days: days.map(d => ({
          day_number: d.day_number,
          name: d.name,
          focus: d.focus || null,
          exercises: d.exercises.map(ex => ({
            exercise_id: ex.exercise_id,
            order: ex.order,
            sets: parseInt(ex.sets),
            reps_min: parseInt(ex.reps_min),
            reps_max: parseInt(ex.reps_max),
            rest_seconds: parseInt(ex.rest_seconds),
          })),
        })),
      }
      await api.post('/routines', payload)
      navigate('/routines')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al crear rutina'
      alert(msg)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <button
        onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300"
      >
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="text-center mb-2">
        <Dumbbell size={36} className="text-brand-500 mx-auto mb-2" />
        <h1 className="text-2xl font-bold">Crear Rutina Manual</h1>
        <p className="text-gray-400 text-sm mt-1">Paso {step} de 3</p>
      </div>

      {/* Step progress */}
      <div className="flex gap-2 justify-center">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 w-10 rounded-full ${s <= step ? 'bg-brand-500' : 'bg-gray-700'}`} />
        ))}
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="card space-y-4">
          <div>
            <label className="text-xs text-gray-500">Nombre de la rutina</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ej: Mi rutina PPL" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Tipo de split</label>
            <select className="input" value={splitType} onChange={e => setSplitType(e.target.value)}>
              {SPLIT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Días por semana</label>
            <select className="input" value={daysPerWeek} onChange={e => setDaysPerWeek(parseInt(e.target.value))}>
              {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>{d} días</option>)}
            </select>
          </div>
          <button onClick={goToStep2} disabled={!name.trim()} className="btn-primary w-full">
            Siguiente
          </button>
        </div>
      )}

      {/* Step 2: Configure days */}
      {step === 2 && (
        <div className="space-y-3">
          {days.map((day, i) => (
            <div key={i} className="card space-y-2">
              <h3 className="font-semibold text-sm text-gray-400">Día {day.day_number}</h3>
              <input
                className="input"
                value={day.name}
                onChange={e => updateDay(i, 'name', e.target.value)}
                placeholder="ej: Push, Pull, Legs..."
              />
              <input
                className="input"
                value={day.focus}
                onChange={e => updateDay(i, 'focus', e.target.value)}
                placeholder="Enfoque (opcional): Pecho, Hombros..."
              />
            </div>
          ))}
          <button onClick={() => setStep(3)} className="btn-primary w-full">
            Siguiente: Agregar Ejercicios
          </button>
        </div>
      )}

      {/* Step 3: Add exercises */}
      {step === 3 && (
        <div className="space-y-3">
          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDayIndex(i)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeDayIndex === i
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Current day exercises */}
          <div className="card">
            <h3 className="font-semibold mb-2">{days[activeDayIndex]?.name}</h3>
            {days[activeDayIndex]?.exercises.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Sin ejercicios aún</p>
            )}
            <div className="space-y-2">
              {days[activeDayIndex]?.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ex.exercise_name}</p>
                      <p className="text-xs text-gray-400">{ex.muscle_group}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveExercise(activeDayIndex, exIdx, -1)} className="p-1 text-gray-400 hover:text-white" disabled={exIdx === 0}>
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveExercise(activeDayIndex, exIdx, 1)} className="p-1 text-gray-400 hover:text-white" disabled={exIdx === days[activeDayIndex].exercises.length - 1}>
                        <ChevronDown size={14} />
                      </button>
                      <button onClick={() => removeExercise(activeDayIndex, exIdx)} className="p-1 text-red-400 hover:text-red-300">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="text-[10px] text-gray-500">Series</label>
                      <input type="number" className="input text-xs py-1 px-1.5" value={ex.sets}
                        onChange={e => updateExercise(activeDayIndex, exIdx, 'sets', e.target.value)} inputMode="numeric" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Rep Min</label>
                      <input type="number" className="input text-xs py-1 px-1.5" value={ex.reps_min}
                        onChange={e => updateExercise(activeDayIndex, exIdx, 'reps_min', e.target.value)} inputMode="numeric" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Rep Max</label>
                      <input type="number" className="input text-xs py-1 px-1.5" value={ex.reps_max}
                        onChange={e => updateExercise(activeDayIndex, exIdx, 'reps_max', e.target.value)} inputMode="numeric" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Desc (s)</label>
                      <input type="number" className="input text-xs py-1 px-1.5" value={ex.rest_seconds}
                        onChange={e => updateExercise(activeDayIndex, exIdx, 'rest_seconds', e.target.value)} inputMode="numeric" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => { setShowSearch(true); setSearchTerm(''); setMuscleFilter('') }}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-400 hover:text-brand-500 hover:border-brand-500 transition-colors">
              <Plus size={16} /> Agregar Ejercicio
            </button>
          </div>

          {/* Exercise search modal */}
          {showSearch && (
            <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowSearch(false)}>
              <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">Buscar Ejercicio</h3>
                    <button onClick={() => setShowSearch(false)} className="p-1 text-gray-400"><X size={20} /></button>
                  </div>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input className="input pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre..." autoFocus />
                  </div>
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                    <button onClick={() => setMuscleFilter('')} className={`flex-shrink-0 px-2 py-1 rounded-full text-xs ${!muscleFilter ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                      Todos
                    </button>
                    {MUSCLE_GROUPS.map(mg => (
                      <button key={mg} onClick={() => setMuscleFilter(mg)} className={`flex-shrink-0 px-2 py-1 rounded-full text-xs ${muscleFilter === mg ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        {MUSCLE_LABELS[mg] || mg}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                  {filteredExercises.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No se encontraron ejercicios</p>}
                  {filteredExercises.map(ex => (
                    <button key={ex.id} onClick={() => addExercise(ex)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <p className="font-medium text-sm">{ex.name}</p>
                      <p className="text-xs text-gray-400">{ex.muscle_group} · {ex.equipment}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={saveRoutine} disabled={saving || days.every(d => d.exercises.length === 0)}
            className="btn-primary w-full flex items-center justify-center gap-2">
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Rutina'}
          </button>
        </div>
      )}
    </div>
  )
}
