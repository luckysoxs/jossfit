import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { cacheSet, cacheGet, queueAction } from '../services/offlineCache'
import useOnlineStatus from '../hooks/useOnlineStatus'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import OneRMCalculator from '../components/routines/OneRMCalculator'
import AIRoutineView from '../components/routines/AIRoutineView'
import { ArrowLeft, Play, Check, ChevronRight, Calculator, RefreshCw, X, Zap, Trash2, Plus, Trophy, Dumbbell, GripVertical, ChevronUp, ChevronDown, Search, Settings2, WifiOff, TrendingUp, Calendar, Moon, Timer, Pause } from 'lucide-react'

const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Abdominales',
  traps: 'Trapecios', forearms: 'Antebrazos', cardio: 'Cardio', full_body: 'Cuerpo Completo',
}

const MUSCLE_COLORS = {
  chest: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  back: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  shoulders: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
  biceps: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  triceps: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  quadriceps: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
  hamstrings: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  glutes: 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
  calves: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  abs: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
  traps: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  forearms: 'bg-lime-100 dark:bg-lime-500/20 text-lime-600 dark:text-lime-400',
  cardio: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
  full_body: 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400',
}

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getWeekdayMap(daysPerWeek, restWeekdays = [6]) {
  // Map routine day_number -> weekday index (0=Monday...6=Sunday)
  const trainingWeekdays = []
  for (let i = 0; i < 7; i++) {
    if (!restWeekdays.includes(i)) trainingWeekdays.push(i)
  }
  const map = {} // day_number -> weekday
  for (let i = 0; i < Math.min(daysPerWeek, trainingWeekdays.length); i++) {
    map[i + 1] = trainingWeekdays[i]
  }
  return map
}

function getNextTrainingDate(weekdayIndex) {
  const today = new Date()
  const todayWeekday = (today.getDay() + 6) % 7 // JS Sunday=0 → our Monday=0
  let daysAhead = weekdayIndex - todayWeekday
  if (daysAhead < 0) daysAhead += 7
  const nextDate = new Date(today)
  nextDate.setDate(today.getDate() + daysAhead)
  return nextDate
}

function exDisplayName(ex) {
  if (!ex) return 'Ejercicio'
  if (ex.name_es) return ex.name_es
  return ex.name
}

function exSubtitle(ex) {
  if (!ex) return ''
  if (ex.name_es) return ex.name
  return ''
}

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [offlineMode, setOfflineMode] = useState(false)
  const todayDate = new Date().toISOString().split('T')[0]
  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(`routine_progress_${id}_${todayDate}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [selectedDay, setSelectedDay] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`routine_selected_day_${id}`)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [oneRMExercise, setOneRMExercise] = useState(null)
  const [personalBests, setPersonalBests] = useState({})
  const [showAIView, setShowAIView] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  // Rest timer state
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef(null)

  // Drag reorder state for day cards
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const touchStartY = useRef(null)
  const touchStartIdx = useRef(null)
  const dayCardsRef = useRef([])

  // Exercise picker modals
  const [swapExercise, setSwapExercise] = useState(null)
  const [addingToDay, setAddingToDay] = useState(null)

  // Reorder loading state
  const [reordering, setReordering] = useState(false)

  // Quick-set popup state
  const [quickSetExercise, setQuickSetExercise] = useState(null)
  const [quickSetForm, setQuickSetForm] = useState({ weight_kg: '', reps: '' })
  const [quickSetSaving, setQuickSetSaving] = useState(false)
  const [quickSetNewPR, setQuickSetNewPR] = useState(false)

  const todayKey = `routine_progress_${id}_${todayDate}`

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [r, pb] = await Promise.all([
          api.get(`/routines/${id}`),
          api.get('/workouts/personal-bests').catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setRoutine(r.data)
        const bests = {}
        pb.data.forEach(b => { bests[b.exercise_id] = b })
        setPersonalBests(bests)
        setOfflineMode(false)
        // Cache for offline use
        cacheSet(`routine_${id}`, r.data)
        cacheSet(`personal_bests`, bests)
      } catch {
        if (cancelled) return
        // Try loading from cache
        const cachedRoutine = cacheGet(`routine_${id}`)
        const cachedBests = cacheGet('personal_bests')
        if (cachedRoutine) {
          setRoutine(cachedRoutine)
          if (cachedBests) setPersonalBests(cachedBests)
          setOfflineMode(true)
        } else {
          navigate('/routines')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [id])

  // Re-fetch when coming back online
  useEffect(() => {
    if (online && offlineMode && routine) {
      api.get(`/routines/${id}`).then(r => {
        setRoutine(r.data)
        cacheSet(`routine_${id}`, r.data)
        setOfflineMode(false)
      }).catch(() => {})
    }
  }, [online])

  // Persist checked progress to sessionStorage as backup
  useEffect(() => {
    if (Object.keys(checked).length > 0) {
      sessionStorage.setItem(todayKey, JSON.stringify(checked))
    }
  }, [checked, todayKey])

  // Persist selected day across refreshes
  useEffect(() => {
    if (selectedDay !== null) {
      sessionStorage.setItem(`routine_selected_day_${id}`, JSON.stringify(selectedDay))
    } else {
      sessionStorage.removeItem(`routine_selected_day_${id}`)
    }
  }, [selectedDay, id])

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
      const url = `/workouts/quick-set?exercise_id=${quickSetExercise.exerciseId}&weight_kg=${weight}&reps=${reps}`

      if (online) {
        await api.post(url)
      } else {
        // Queue for later sync
        queueAction({
          method: 'post',
          url,
          description: `Quick set: ${quickSetExercise.name} ${weight}kg x ${reps}`,
        })
      }

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
        setTimeout(() => {
          setQuickSetExercise(null)
          setQuickSetNewPR(false)
        }, 1500)
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

  const reloadRoutine = () => api.get(`/routines/${id}`).then(r => {
    setRoutine(r.data)
    cacheSet(`routine_${id}`, r.data)
  })

  // ─── Rest Timer ───
  const startTimer = useCallback((seconds) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerSeconds(seconds)
    setTimerRunning(true)
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          setTimerRunning(false)
          // Vibrate when done
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setTimerRunning(false)
    setTimerSeconds(0)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ─── Drag-and-drop for day cards ───
  const handleDragDayStart = (idx) => { setDragIdx(idx) }
  const handleDragDayOver = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDragDayEnd = async () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx && !reordering) {
      setReordering(true)
      const items = [...sortedTrainingDays]
      const [moved] = items.splice(dragIdx, 1)
      items.splice(dragOverIdx, 0, moved)
      try {
        await api.put('/routines/reorder-days', { routine_id: routine.id, day_order: items.map(d => d.id) })
        await reloadRoutine()
      } catch {}
      setReordering(false)
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  // Touch drag for mobile (only on grip icon, with threshold)
  const dragActiveRef = useRef(false)
  const handleTouchStart = (e, idx) => {
    touchStartY.current = e.touches[0].clientY
    touchStartIdx.current = idx
    dragActiveRef.current = false // Don't activate drag until threshold met
  }
  const handleTouchMove = (e, currentIdx) => {
    if (touchStartY.current === null) return
    const touchY = e.touches[0].clientY
    const diff = Math.abs(touchY - touchStartY.current)
    // Only activate drag after 30px threshold to avoid interfering with scroll
    if (!dragActiveRef.current) {
      if (diff > 30) {
        dragActiveRef.current = true
        setDragIdx(touchStartIdx.current)
        e.preventDefault() // Prevent scroll only when dragging
      }
      return
    }
    e.preventDefault()
    // Find which card we're over
    for (let i = 0; i < dayCardsRef.current.length; i++) {
      const card = dayCardsRef.current[i]
      if (!card) continue
      const rect = card.getBoundingClientRect()
      if (touchY >= rect.top && touchY <= rect.bottom) {
        setDragOverIdx(i)
        break
      }
    }
  }
  const handleTouchEnd = async () => {
    if (dragActiveRef.current) {
      await handleDragDayEnd()
    } else {
      setDragIdx(null)
      setDragOverIdx(null)
    }
    touchStartY.current = null
    touchStartIdx.current = null
    dragActiveRef.current = false
  }

  const deleteExercise = async (exId) => {
    await api.delete(`/routines/exercises/${exId}`)
    await reloadRoutine()
  }

  // --- Move exercise up/down ---
  const moveExUp = async (exIdx, dayId, sortedExercises) => {
    if (exIdx === 0 || reordering) return
    setReordering(true)
    const items = [...sortedExercises]
    ;[items[exIdx - 1], items[exIdx]] = [items[exIdx], items[exIdx - 1]]
    await api.put('/routines/reorder-exercises', { day_id: dayId, exercise_order: items.map(e => e.id) })
    await reloadRoutine()
    setReordering(false)
  }

  const moveExDown = async (exIdx, dayId, sortedExercises) => {
    if (exIdx >= sortedExercises.length - 1 || reordering) return
    setReordering(true)
    const items = [...sortedExercises]
    ;[items[exIdx], items[exIdx + 1]] = [items[exIdx + 1], items[exIdx]]
    await api.put('/routines/reorder-exercises', { day_id: dayId, exercise_order: items.map(e => e.id) })
    await reloadRoutine()
    setReordering(false)
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {(() => {
                const rw = routine.rest_weekdays || [6]
                const wMap = getWeekdayMap(routine.days_per_week, rw)
                const wd = wMap[day.day_number]
                return wd !== undefined ? `${WEEKDAY_NAMES[wd]} - ${day.name}` : `Dia ${day.day_number}: ${day.name}`
              })()}
            </h2>
            {offlineMode && (
              <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
                <WifiOff size={12} /> Offline
              </span>
            )}
          </div>
          {day.focus && <p className="text-xs text-gray-400 mt-1">{day.focus}</p>}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-gray-400">{done}/{total}</span>
          </div>
        </div>

        {/* Rest Timer */}
        <div className="card">
          {timerRunning ? (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Timer size={18} className="text-brand-500" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descanso</span>
              </div>
              <p className={`text-4xl font-bold tabular-nums ${timerSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-brand-500'}`}>
                {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
              </p>
              <button onClick={stopTimer}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors">
                <Pause size={14} /> Cancelar
              </button>
            </div>
          ) : timerSeconds === 0 && !timerRunning ? (
            <div className="flex items-center gap-2">
              <Timer size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-400 flex-shrink-0">Descanso:</span>
              <div className="flex gap-1.5 flex-1">
                {[60, 120, 180].map(s => (
                  <button key={s} onClick={() => startTimer(s)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-brand-50 dark:bg-brand-500/10 text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20 active:scale-95 transition-all">
                    {s / 60} min
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {sortedExercises.map((ex, exIdx) => (
          <div
            key={ex.id}
            className={`card bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 transition-all ${
              checked[ex.id] ? 'opacity-40' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Move buttons */}
              <div className="flex flex-col items-center flex-shrink-0 -my-1">
                <button
                  onClick={() => moveExUp(exIdx, day.id, sortedExercises)}
                  disabled={exIdx === 0 || reordering}
                  className={`p-0.5 rounded transition-colors ${exIdx === 0 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:text-brand-600'}`}
                >
                  <ChevronUp size={14} />
                </button>
                <GripVertical size={12} className="text-gray-300 dark:text-gray-600" />
                <button
                  onClick={() => moveExDown(exIdx, day.id, sortedExercises)}
                  disabled={exIdx >= sortedExercises.length - 1 || reordering}
                  className={`p-0.5 rounded transition-colors ${exIdx >= sortedExercises.length - 1 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:text-brand-600'}`}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {/* Check button */}
              <button
                onClick={() => handleExerciseCheck(ex.id, ex.exercise_id, exDisplayName(ex.exercise))}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  checked[ex.id] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {checked[ex.id] && <Check size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${checked[ex.id] ? 'line-through text-gray-400' : ''}`}>
                      {exDisplayName(ex.exercise)}
                    </p>
                    {exSubtitle(ex.exercise) && (
                      <p className="text-[11px] text-gray-400 italic">{exSubtitle(ex.exercise)}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${MUSCLE_COLORS[ex.exercise?.muscle_group] || 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                        {MUSCLE_LABELS[ex.exercise?.muscle_group] || ex.exercise?.muscle_group}
                      </span>
                      <span className="text-[10px] text-gray-400">{ex.exercise?.equipment}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm ml-3">
                    <p className="font-medium">{ex.sets} x {ex.reps_min}-{ex.reps_max}</p>
                    <p className="text-xs text-gray-400">Descanso: {ex.rest_seconds}s</p>
                  </div>
                </div>
                {personalBests[ex.exercise_id] && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-lg">
                      <Trophy size={12} />
                      <span className="text-xs font-semibold">
                        PR: {personalBests[ex.exercise_id].weight_kg} kg × {personalBests[ex.exercise_id].reps}
                      </span>
                    </div>
                    {!checked[ex.id] && (() => {
                      const pb = personalBests[ex.exercise_id]
                      const suggestedWeight = pb.reps >= ex.reps_max ? pb.weight_kg + 2.5 : pb.weight_kg
                      const suggestedReps = pb.reps >= ex.reps_max ? ex.reps_min : Math.min(pb.reps + 1, ex.reps_max)
                      return (
                        <div className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-1 rounded-lg">
                          <TrendingUp size={12} />
                          <span className="text-xs font-semibold">
                            Hoy: {suggestedWeight} kg × {suggestedReps}
                          </span>
                        </div>
                      )
                    })()}
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
                <button onClick={() => setSwapExercise(ex)}
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

        <button onClick={() => setAddingToDay(day)}
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
                        <input type="number" className="input text-center text-lg font-bold" value={quickSetForm.weight_kg}
                          onChange={(e) => setQuickSetForm({ ...quickSetForm, weight_kg: e.target.value })} placeholder="0" inputMode="decimal" autoFocus />
                      </div>
                      <div>
                        <label className="label">Reps</label>
                        <input type="number" className="input text-center text-lg font-bold" value={quickSetForm.reps}
                          onChange={(e) => setQuickSetForm({ ...quickSetForm, reps: e.target.value })} placeholder="0" inputMode="numeric" />
                      </div>
                    </div>
                    <button onClick={submitQuickSet} className="btn-primary w-full flex items-center justify-center gap-2"
                      disabled={quickSetSaving || !quickSetForm.weight_kg || !quickSetForm.reps}>
                      {quickSetSaving ? 'Guardando...' : <><Check size={18} /> Guardar y completar</>}
                    </button>
                    <button onClick={skipQuickSet} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
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

        {/* Swap exercise modal */}
        {swapExercise && (
          <ExercisePickerModal
            title={`Reemplazar ${exDisplayName(swapExercise.exercise)}`}
            priorityMuscle={swapExercise.exercise?.muscle_group}
            onClose={() => setSwapExercise(null)}
            onSelect={async (exercise) => {
              try {
                await api.put(`/routines/exercises/${swapExercise.id}/swap?new_exercise_id=${exercise.id}`)
                await reloadRoutine()
                setSwapExercise(null)
              } catch (err) {
                alert(err.response?.data?.detail || 'Error al reemplazar ejercicio')
              }
            }}
          />
        )}

        {/* Add exercise modal */}
        {addingToDay && (
          <ExercisePickerModal
            title="Agregar ejercicio"
            showCustomize
            onClose={() => setAddingToDay(null)}
            onSelect={async (exercise, config) => {
              try {
                const nextOrder = (addingToDay.exercises?.length || 0) + 1
                await api.post(`/routines/days/${addingToDay.id}/exercises`, {
                  exercise_id: exercise.id,
                  order: nextOrder,
                  sets: config?.sets || 3,
                  reps_min: config?.reps_min || 8,
                  reps_max: config?.reps_max || 12,
                  rest_seconds: config?.rest_seconds || 90,
                })
                await reloadRoutine()
                setAddingToDay(null)
              } catch (err) {
                alert(err.response?.data?.detail || 'Error al agregar ejercicio')
              }
            }}
          />
        )}
      </div>
    )
  }

  // ─── Day cards view ───
  const restWeekdays = routine.rest_weekdays || [6] // default Sunday rest
  const weekdayMap = getWeekdayMap(routine.days_per_week, restWeekdays)
  const sortedDays = [...(routine.days || [])].sort((a, b) => {
    const wa = weekdayMap[a.day_number] ?? a.day_number
    const wb = weekdayMap[b.day_number] ?? b.day_number
    return wa - wb
  })
  // Training days only (for drag reorder)
  const sortedTrainingDays = sortedDays

  const todayWeekday = (new Date().getDay() + 6) % 7 // Monday=0

  const saveRestDays = async (newRest) => {
    try {
      await api.put(`/routines/${id}/schedule`, { rest_weekdays: newRest })
      setRoutine(r => ({ ...r, rest_weekdays: newRest }))
    } catch {}
  }

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
              <span>{routine.days_per_week} días/semana</span>
              {routine.generation_type === 'adaptativo' && (
                <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">Adaptativo</span>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setShowSchedule(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl transition-colors">
              <Calendar size={14} />
            </button>
            <button onClick={() => navigate('/routines/generate')}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 rounded-xl transition-colors">
              <Zap size={14} /> Nueva
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Config Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 animate-in">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">{routine.days_per_week >= 6 ? 'Elegir día de descanso' : 'Elegir días de descanso'}</h3>
              <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-400">Selecciona tus días de descanso. Los demás serán días de entrenamiento.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_NAMES.map((name, i) => {
                  const isRest = restWeekdays.includes(i)
                  const maxRest = 7 - routine.days_per_week
                  const canToggle = isRest || restWeekdays.length < maxRest
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (!canToggle && !isRest) return
                        const next = isRest
                          ? restWeekdays.filter(d => d !== i)
                          : [...restWeekdays, i]
                        saveRestDays(next)
                      }}
                      className={`py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                        isRest
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                          : 'bg-brand-500 text-white'
                      } ${!canToggle && !isRest ? 'opacity-40' : ''}`}
                    >
                      {WEEKDAY_SHORT[i]}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-gray-400">
                  <span className="inline-block w-3 h-3 rounded bg-brand-500 mr-1 align-middle" /> Entreno
                </span>
                <span className="text-gray-400">
                  <span className="inline-block w-3 h-3 rounded bg-gray-200 dark:bg-gray-700 mr-1 align-middle" /> Descanso
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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

          {/* Rest day cards for schedule context */}
          {(() => {
            // Build full week view: training days + rest days
            const weekCards = []
            let trainingIdx = 0
            for (let wd = 0; wd < 7; wd++) {
              const isRest = restWeekdays.includes(wd)
              if (isRest) {
                const isToday = wd === todayWeekday
                weekCards.push(
                  <div key={`rest-${wd}`}
                    className={`card bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-200 dark:border-gray-700 opacity-60 ${isToday ? 'ring-2 ring-green-400/50' : ''}`}>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <Moon size={16} className="text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-400">{WEEKDAY_NAMES[wd]} - Descanso</h3>
                          {isToday && <p className="text-[11px] text-green-500 font-medium">Hoy</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              } else {
                // Find the training day mapped to this weekday
                const dayEntry = sortedDays.find(d => weekdayMap[d.day_number] === wd)
                if (!dayEntry) continue

                const currentTrainingIdx = trainingIdx
                trainingIdx++

                const dayExIds = dayEntry.exercises?.map(e => e.id) || []
                const dayDone = dayExIds.filter(eId => checked[eId]).length
                const dayAllDone = dayExIds.length > 0 && dayDone === dayExIds.length
                const isToday = wd === todayWeekday
                const nextDate = getNextTrainingDate(wd)
                const nextDateStr = nextDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
                const isDragging = dragIdx === currentTrainingIdx
                const isDragOver = dragOverIdx === currentTrainingIdx

                weekCards.push(
                  <div key={dayEntry.id}
                    ref={el => dayCardsRef.current[currentTrainingIdx] = el}
                    draggable
                    onDragStart={() => handleDragDayStart(currentTrainingIdx)}
                    onDragOver={(e) => handleDragDayOver(e, currentTrainingIdx)}
                    onDragEnd={handleDragDayEnd}
                    onTouchStart={(e) => handleTouchStart(e, currentTrainingIdx)}
                    onTouchMove={(e) => handleTouchMove(e, currentTrainingIdx)}
                    onTouchEnd={handleTouchEnd}
                    className={`card hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-grab active:cursor-grabbing ${dayAllDone ? 'border border-green-500/30' : ''} ${isToday ? 'ring-2 ring-brand-500/40' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDragOver ? 'border-2 border-brand-500 border-dashed' : ''}`}>
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-gray-300 dark:text-gray-600 flex-shrink-0 touch-none" />
                      <button onClick={() => setSelectedDay(dayEntry.day_number)} className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isToday ? 'bg-brand-500 text-white' : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500'}`}>
                              <Dumbbell size={16} />
                            </div>
                            <div>
                              <h3 className="font-semibold">{WEEKDAY_NAMES[wd]} - {dayEntry.name}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isToday ? (
                                  <span className="text-[11px] text-brand-500 font-semibold">Hoy · {dayExIds.length} ejercicios</span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Próx: {nextDateStr} · {dayExIds.length} ejercicios</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${dayAllDone ? 'text-green-500' : 'text-gray-400'}`}>
                              {dayDone}/{dayExIds.length}
                            </span>
                            <ChevronRight size={18} className="text-gray-400" />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )
              }
            }
            return weekCards
          })()}
        </>
      )}
    </div>
  )
}


// ─── Exercise Picker Modal ─────────────────────────────────────

function ExercisePickerModal({ title, priorityMuscle, showCustomize, onClose, onSelect }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [config, setConfig] = useState({ sets: 3, reps_min: 8, reps_max: 12, rest_seconds: 90 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await api.get('/exercises')
        const list = Array.isArray(r.data) ? r.data : []
        if (!cancelled) setExercises(list)
        cacheSet('all_exercises', list)
      } catch (err) {
        console.error('Error loading exercises:', err)
        // Fall back to cached exercises
        const cached = cacheGet('all_exercises')
        if (!cancelled) setExercises(cached || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSelect = async (exercise) => {
    if (showCustomize) {
      setSelectedExercise(exercise)
      return
    }
    setSubmitting(true)
    try {
      await onSelect(exercise)
    } catch (err) {
      console.error('Error selecting exercise:', err)
      alert('Error al procesar ejercicio')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmAdd = async () => {
    if (!selectedExercise) return
    setSubmitting(true)
    try {
      await onSelect(selectedExercise, config)
    } catch (err) {
      console.error('Error adding exercise:', err)
      alert('Error al agregar ejercicio')
    } finally {
      setSubmitting(false)
    }
  }

  const term = searchTerm.toLowerCase()
  const filtered = exercises.filter(e =>
    (e.name || '').toLowerCase().includes(term) ||
    (e.name_es || '').toLowerCase().includes(term)
  )
  const grouped = {}
  filtered.forEach(e => {
    const g = e.muscle_group || 'other'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(e)
  })
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === priorityMuscle) return -1
    if (b === priorityMuscle) return 1
    return (MUSCLE_LABELS[a] || a).localeCompare(MUSCLE_LABELS[b] || b)
  })

  // Customize view
  if (selectedExercise) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedExercise(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h3 className="font-bold text-sm">{selectedExercise.name_es || selectedExercise.name}</h3>
                {selectedExercise.name_es && <p className="text-[11px] text-gray-400 italic">{selectedExercise.name}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Settings2 size={16} className="text-brand-500" />
              <span className="font-medium">Personalizar ejercicio</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Series</label>
                <input type="number" className="input text-center font-bold" value={config.sets}
                  onChange={e => setConfig({ ...config, sets: parseInt(e.target.value) || 1 })} min="1" max="20" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Descanso (s)</label>
                <input type="number" className="input text-center font-bold" value={config.rest_seconds}
                  onChange={e => setConfig({ ...config, rest_seconds: parseInt(e.target.value) || 30 })} min="10" max="600" step="10" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Reps mín</label>
                <input type="number" className="input text-center font-bold" value={config.reps_min}
                  onChange={e => setConfig({ ...config, reps_min: parseInt(e.target.value) || 1 })} min="1" max="100" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Reps máx</label>
                <input type="number" className="input text-center font-bold" value={config.reps_max}
                  onChange={e => setConfig({ ...config, reps_max: parseInt(e.target.value) || 1 })} min="1" max="100" inputMode="numeric" />
              </div>
            </div>
            <button onClick={handleConfirmAdd} disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {submitting ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><Plus size={16} /> Agregar {config.sets} x {config.reps_min}-{config.reps_max}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar ejercicio..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-9 text-sm" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : sortedGroups.length > 0 ? (
            sortedGroups.map(group => (
              <div key={group}>
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide py-2 sticky top-0 bg-white dark:bg-gray-900 z-10">
                  {MUSCLE_LABELS[group] || group}
                </p>
                {grouped[group].map(e => (
                  <button key={e.id} onClick={() => handleSelect(e)} disabled={submitting}
                    className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-1.5">
                    <p className="font-medium text-sm">{e.name_es || e.name}</p>
                    {e.name_es && <p className="text-[11px] text-gray-400 italic">{e.name}</p>}
                    <p className="text-xs text-gray-400">{e.category} · {e.equipment}</p>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-gray-400 py-8">No se encontraron ejercicios</p>
          )}
        </div>
      </div>
    </div>
  )
}
