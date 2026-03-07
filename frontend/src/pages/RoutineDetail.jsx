import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import OneRMCalculator from '../components/routines/OneRMCalculator'
import AIRoutineView from '../components/routines/AIRoutineView'
import { ArrowLeft, Play, Check, ChevronRight, Calculator, RefreshCw, X, Zap, Trash2, Plus, Trophy, Dumbbell, GripVertical } from 'lucide-react'

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState({})
  const [selectedDay, setSelectedDay] = useState(null)
  const [oneRMExercise, setOneRMExercise] = useState(null)
  const [swapExercise, setSwapExercise] = useState(null)
  const [allExercises, setAllExercises] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [addingToDay, setAddingToDay] = useState(null)
  const [personalBests, setPersonalBests] = useState({})
  const [showAIView, setShowAIView] = useState(false)

  // Drag state
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)
  const [draggingId, setDraggingId] = useState(null)

  // Quick-set popup state
  const [quickSetExercise, setQuickSetExercise] = useState(null)
  const [quickSetForm, setQuickSetForm] = useState({ weight_kg: '', reps: '' })
  const [quickSetSaving, setQuickSetSaving] = useState(false)
  const [quickSetNewPR, setQuickSetNewPR] = useState(false)

  const todayKey = `routine_progress_${id}_${new Date().toISOString().split('T')[0]}`

  useEffect(() => {
    Promise.all([
      api.get(`/routines/${id}`),
      api.get('/workouts/personal-bests').catch(() => ({ data: [] })),
    ]).then(([r, pb]) => {
      setRoutine(r.data)
      const bests = {}
      pb.data.forEach(b => { bests[b.exercise_id] = b })
      setPersonalBests(bests)
    }).catch(() => navigate('/routines'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const saved = localStorage.getItem(todayKey)
    if (saved) setChecked(JSON.parse(saved))
  }, [todayKey])

  const handleExerciseCheck = (routineExId, exerciseId, exerciseName) => {
    if (checked[routineExId]) {
      const next = { ...checked, [routineExId]: false }
      setChecked(next)
      localStorage.setItem(todayKey, JSON.stringify(next))
    } else {
      const prev = personalBests[exerciseId]
      setQuickSetExercise({ routineExId, exerciseId, name: exerciseName })
      setQuickSetForm({ weight_kg: prev?.weight_kg?.toString() || '', reps: prev?.reps?.toString() || '' })
      setQuickSetNewPR(false)
    }
  }

  const submitQuickSet = async () => {
    if (!quickSetForm.weight_kg || !quickSetForm.reps) return
    setQuickSetSaving(true)
    try {
      const weight = parseFloat(quickSetForm.weight_kg)
      const reps = parseInt(quickSetForm.reps)
      await api.post(`/workouts/quick-set?exercise_id=${quickSetExercise.exerciseId}&weight_kg=${weight}&reps=${reps}`)

      const prev = personalBests[quickSetExercise.exerciseId]
      const isNewPR = !prev || weight > prev.weight_kg || (weight === prev.weight_kg && reps > prev.reps)

      setPersonalBests(p => ({
        ...p,
        [quickSetExercise.exerciseId]: {
          exercise_id: quickSetExercise.exerciseId,
          weight_kg: isNewPR ? weight : prev?.weight_kg || weight,
          reps: isNewPR ? reps : prev?.reps || reps,
        },
      }))

      const next = { ...checked, [quickSetExercise.routineExId]: true }
      setChecked(next)
      localStorage.setItem(todayKey, JSON.stringify(next))

      if (isNewPR) {
        setQuickSetNewPR(true)
        setTimeout(() => { setQuickSetExercise(null); setQuickSetNewPR(false) }, 1500)
      } else {
        setQuickSetExercise(null)
      }
    } catch {
      alert('Error al guardar')
    } finally {
      setQuickSetSaving(false)
    }
  }

  const skipQuickSet = () => {
    const next = { ...checked, [quickSetExercise.routineExId]: true }
    setChecked(next)
    localStorage.setItem(todayKey, JSON.stringify(next))
    setQuickSetExercise(null)
  }

  const getYoutubeUrl = (name) => {
    const query = encodeURIComponent(`${name} ejercicio como hacerlo`)
    return `https://www.youtube.com/results?search_query=${query}`
  }

  const reloadRoutine = () => api.get(`/routines/${id}`).then(r => setRoutine(r.data))

  const deleteExercise = async (exId) => {
    await api.delete(`/routines/exercises/${exId}`)
    await reloadRoutine()
  }

  const loadExercises = () => {
    if (allExercises.length === 0) api.get('/exercises').then(r => setAllExercises(r.data))
  }

  // --- Drag handlers for days ---
  const handleDayDragStart = (idx) => {
    dragItem.current = idx
    setDraggingId(`day-${idx}`)
  }

  const handleDayDragOver = (e, idx) => {
    e.preventDefault()
    dragOverItem.current = idx
  }

  const handleDayDrop = async (sortedDays) => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDraggingId(null)
      return
    }
    const items = [...sortedDays]
    const [dragged] = items.splice(dragItem.current, 1)
    items.splice(dragOverItem.current, 0, dragged)
    const newOrder = items.map(d => d.id)
    dragItem.current = null
    dragOverItem.current = null
    setDraggingId(null)
    await api.put('/routines/reorder-days', { routine_id: routine.id, day_order: newOrder })
    await reloadRoutine()
  }

  // --- Drag handlers for exercises ---
  const handleExDragStart = (idx) => {
    dragItem.current = idx
    setDraggingId(`ex-${idx}`)
  }

  const handleExDragOver = (e, idx) => {
    e.preventDefault()
    dragOverItem.current = idx
  }

  const handleExDrop = async (dayId, sortedExercises) => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDraggingId(null)
      return
    }
    const items = [...sortedExercises]
    const [dragged] = items.splice(dragItem.current, 1)
    items.splice(dragOverItem.current, 0, dragged)
    const newOrder = items.map(e => e.id)
    dragItem.current = null
    dragOverItem.current = null
    setDraggingId(null)
    await api.put('/routines/reorder-exercises', { day_id: dayId, exercise_order: newOrder })
    await reloadRoutine()
  }

  if (loading) return <LoadingSpinner />
  if (!routine) return null

  const allIds = routine.days?.flatMap(d => d.exercises?.map(e => e.id) || []) || []
  const allDone = allIds.filter(eId => checked[eId]).length

  // ─── Day detail view ───
  if (selectedDay !== null) {
    const day = routine.days?.find(d => d.day_number === selectedDay)
    if (!day) { setSelectedDay(null); return null }

    const sortedExercises = [...(day.exercises || [])].sort((a, b) => a.order - b.order)
    const dayExIds = sortedExercises.map(e => e.id)
    const done = dayExIds.filter(eId => checked[eId]).length
    const total = dayExIds.length
    const progress = total > 0 ? (done / total) * 100 : 0

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedDay(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} /> Volver a dias
        </button>

        <div className="card">
          <h2 className="text-lg font-bold">Dia {day.day_number}: {day.name}</h2>
          {day.focus && <p className="text-xs text-gray-400 mt-1">{day.focus}</p>}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-400">{done}/{total}</span>
          </div>
        </div>

        {sortedExercises.map((ex, exIdx) => (
          <div
            key={ex.id}
            draggable
            onDragStart={() => handleExDragStart(exIdx)}
            onDragOver={(e) => handleExDragOver(e, exIdx)}
            onDragEnd={() => handleExDrop(day.id, sortedExercises)}
            className={`card bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 transition-all ${
              checked[ex.id] ? 'opacity-40' : ''
            } ${draggingId === `ex-${exIdx}` ? 'opacity-50 scale-[0.98] ring-2 ring-brand-500' : ''}`}
          >
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-400 hover:text-gray-300 touch-none">
                <GripVertical size={16} />
              </div>
              {/* Check button */}
              <button
                onClick={() => handleExerciseCheck(ex.id, ex.exercise_id, ex.exercise?.name)}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checked[ex.id] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {checked[ex.id] && <Check size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${checked[ex.id] ? 'line-through text-gray-400' : ''}`}>{ex.exercise?.name || 'Ejercicio'}</p>
                    <p className="text-xs text-gray-400">{ex.exercise?.muscle_group} · {ex.exercise?.equipment}</p>
                  </div>
                  <div className="text-right text-sm ml-3">
                    <p className="font-medium">{ex.sets} x {ex.reps_min}-{ex.reps_max}</p>
                    <p className="text-xs text-gray-400">Descanso: {ex.rest_seconds}s</p>
                  </div>
                </div>
                {personalBests[ex.exercise_id] && (
                  <div className="flex items-center gap-1.5 mt-1.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-lg w-fit">
                    <Trophy size={12} />
                    <span className="text-xs font-semibold">
                      PR: {personalBests[ex.exercise_id].weight_kg} kg × {personalBests[ex.exercise_id].reps} reps
                    </span>
                  </div>
                )}
                {ex.exercise?.name && (
                  <a href={getYoutubeUrl(ex.exercise.name)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
                    <Play size={14} fill="currentColor" /> VER VIDEO
                  </a>
                )}
                <button onClick={() => setOneRMExercise(ex.exercise)}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors">
                  <Calculator size={14} /> 1RM
                </button>
                <button onClick={() => { setSwapExercise(ex); loadExercises() }}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">
                  <RefreshCw size={14} /> Reemplazar
                </button>
                <button onClick={() => { if (confirm('¿Eliminar este ejercicio?')) deleteExercise(ex.id) }}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}

        <button onClick={() => { setAddingToDay(day); loadExercises(); setSearchTerm('') }}
          className="card w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors border-2 border-dashed border-brand-500/30">
          <Plus size={16} /> Agregar ejercicio
        </button>

        {/* Quick Set Popup */}
        {quickSetExercise && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 animate-in overflow-hidden">
              {quickSetNewPR ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-16 h-16 bg-yellow-50 dark:bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Trophy size={32} className="text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-bold">¡Nuevo PR! 🎉</h3>
                  <p className="text-brand-500 font-bold text-lg">{quickSetForm.weight_kg} kg × {quickSetForm.reps} reps</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                          <Dumbbell size={20} className="text-brand-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{quickSetExercise.name}</h3>
                          <p className="text-xs text-gray-400">Serie más pesada de hoy</p>
                        </div>
                      </div>
                      <button onClick={() => setQuickSetExercise(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {personalBests[quickSetExercise.exerciseId] && (
                      <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-2 rounded-xl text-sm">
                        <Trophy size={14} />
                        <span className="font-medium">PR actual: {personalBests[quickSetExercise.exerciseId].weight_kg} kg × {personalBests[quickSetExercise.exerciseId].reps} reps</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Peso (kg)</label>
                        <input
                          type="number"
                          className="input text-center text-lg font-bold"
                          value={quickSetForm.weight_kg}
                          onChange={(e) => setQuickSetForm({ ...quickSetForm, weight_kg: e.target.value })}
                          placeholder="0"
                          inputMode="decimal"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="label">Reps</label>
                        <input
                          type="number"
                          className="input text-center text-lg font-bold"
                          value={quickSetForm.reps}
                          onChange={(e) => setQuickSetForm({ ...quickSetForm, reps: e.target.value })}
                          placeholder="0"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <button
                      onClick={submitQuickSet}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                      disabled={quickSetSaving || !quickSetForm.weight_kg || !quickSetForm.reps}
                    >
                      {quickSetSaving ? 'Guardando...' : <><Check size={18} /> Guardar y completar</>}
                    </button>
                    <button
                      onClick={skipQuickSet}
                      className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1"
                    >
                      Saltar sin registrar peso
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {oneRMExercise && (
          <OneRMCalculator exercise={oneRMExercise} onClose={() => setOneRMExercise(null)} />
        )}

        {swapExercise && (() => {
          const MUSCLE_LABELS = {
            chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
            triceps: 'Tríceps', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
            glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Abdominales',
            traps: 'Trapecios', forearms: 'Antebrazos', cardio: 'Cardio',
          }
          const filtered = allExercises.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
          const grouped = {}
          filtered.forEach(e => {
            const g = e.muscle_group || 'other'
            if (!grouped[g]) grouped[g] = []
            grouped[g].push(e)
          })
          const currentMuscle = swapExercise.exercise?.muscle_group
          const sortedGroups = Object.keys(grouped).sort((a, b) => {
            if (a === currentMuscle) return -1
            if (b === currentMuscle) return 1
            return (MUSCLE_LABELS[a] || a).localeCompare(MUSCLE_LABELS[b] || b)
          })

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold">Reemplazar {swapExercise.exercise?.name}</h3>
                  <button onClick={() => setSwapExercise(null)}><X size={20} /></button>
                </div>
                <div className="p-4">
                  <input type="text" placeholder="Buscar ejercicio..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                  {sortedGroups.map(group => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide py-2 sticky top-0 bg-gray-900 z-10">
                        {MUSCLE_LABELS[group] || group}
                      </p>
                      {grouped[group].map(e => (
                        <button key={e.id} onClick={async () => {
                          await api.put(`/routines/exercises/${swapExercise.id}/swap?new_exercise_id=${e.id}`)
                          const r = await api.get(`/routines/${id}`)
                          setRoutine(r.data)
                          setSwapExercise(null)
                          setSearchTerm('')
                        }}
                        className="w-full text-left bg-gray-800 rounded-xl p-3 hover:bg-gray-700 transition-colors mb-1.5">
                          <p className="font-medium text-sm">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.category} · {e.equipment}</p>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {addingToDay && (() => {
          const MUSCLE_LABELS = {
            chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
            triceps: 'Tríceps', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
            glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Abdominales',
            traps: 'Trapecios', forearms: 'Antebrazos', cardio: 'Cardio',
          }
          const filtered = allExercises.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
          const grouped = {}
          filtered.forEach(e => {
            const g = e.muscle_group || 'other'
            if (!grouped[g]) grouped[g] = []
            grouped[g].push(e)
          })
          const sortedGroups = Object.keys(grouped).sort((a, b) =>
            (MUSCLE_LABELS[a] || a).localeCompare(MUSCLE_LABELS[b] || b)
          )

          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold">Agregar ejercicio</h3>
                  <button onClick={() => setAddingToDay(null)}><X size={20} /></button>
                </div>
                <div className="p-4">
                  <input type="text" placeholder="Buscar ejercicio..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm" />
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                  {sortedGroups.map(group => (
                    <div key={group}>
                      <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide py-2 sticky top-0 bg-gray-900 z-10">
                        {MUSCLE_LABELS[group] || group}
                      </p>
                      {grouped[group].map(e => (
                        <button key={e.id} onClick={async () => {
                          const nextOrder = (addingToDay.exercises?.length || 0) + 1
                          await api.post(`/routines/days/${addingToDay.id}/exercises`, {
                            exercise_id: e.id,
                            order: nextOrder,
                            sets: 3,
                            reps_min: 8,
                            reps_max: 12,
                            rest_seconds: 90,
                          })
                          await reloadRoutine()
                          setAddingToDay(null)
                          setSearchTerm('')
                        }}
                        className="w-full text-left bg-gray-800 rounded-xl p-3 hover:bg-gray-700 transition-colors mb-1.5">
                          <p className="font-medium text-sm">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.category} · {e.equipment}</p>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ─── Day cards view ───
  const sortedDays = [...(routine.days || [])].sort((a, b) => a.day_number - b.day_number)

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{routine.name}</h1>
            <div className="flex gap-3 text-sm text-gray-400 mt-1">
              <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{routine.split_type}</span>
              <span>{routine.days_per_week} dias/semana</span>
              {routine.generation_type === 'adaptativo' && (
                <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Adaptativo</span>
              )}
            </div>
          </div>
          <button onClick={() => navigate('/routines/generate')}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 rounded-xl transition-colors">
            <Zap size={14} /> Nueva rutina
          </button>
        </div>
      </div>

      {routine.ai_data && (
        <div className="flex gap-2">
          <button onClick={() => setShowAIView(false)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${!showAIView ? 'bg-brand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Entrenamiento
          </button>
          <button onClick={() => setShowAIView(true)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${showAIView ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            Plan Adaptativo
          </button>
        </div>
      )}

      {showAIView && routine.ai_data ? (
        <AIRoutineView aiData={routine.ai_data} />
      ) : (
        <>
          {allIds.length > 0 && (
            <div className="card flex items-center justify-between">
              <span className="text-sm font-medium">Progreso de hoy</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                    style={{ width: `${(allDone / allIds.length) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 tabular-nums">{allDone}/{allIds.length}</span>
              </div>
            </div>
          )}

          {sortedDays.map((day, idx) => {
            const dayExIds = day.exercises?.map(e => e.id) || []
            const dayDone = dayExIds.filter(eId => checked[eId]).length
            const dayAllDone = dayExIds.length > 0 && dayDone === dayExIds.length

            return (
              <div
                key={day.id}
                draggable
                onDragStart={() => handleDayDragStart(idx)}
                onDragOver={(e) => handleDayDragOver(e, idx)}
                onDragEnd={() => handleDayDrop(sortedDays)}
                className={`card hover:bg-gray-800/50 transition-all ${
                  dayAllDone ? 'border border-green-500/30' : ''
                } ${draggingId === `day-${idx}` ? 'opacity-50 scale-[0.98] ring-2 ring-brand-500' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing flex-shrink-0 text-gray-400 hover:text-gray-300 touch-none py-2">
                    <GripVertical size={18} />
                  </div>
                  <button onClick={() => setSelectedDay(day.day_number)} className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Dia {day.day_number}: {day.name}</h3>
                        {day.focus && <p className="text-xs text-gray-400 mt-0.5">{day.focus}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${dayAllDone ? 'text-green-500' : 'text-gray-400'}`}>
                          {dayDone}/{dayExIds.length}
                        </span>
                        <ChevronRight size={18} className="text-gray-400" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{dayExIds.length} ejercicios</p>
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
