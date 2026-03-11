import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { cacheSet, cacheGet, queueAction } from '../services/offlineCache'
import useOnlineStatus from '../hooks/useOnlineStatus'
import { useRestTimer } from '../contexts/RestTimerContext'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import OneRMCalculator from '../components/routines/OneRMCalculator'
import ExercisePickerModal from '../components/routines/ExercisePickerModal'
import PageTour from '../components/ui/PageTour'
import { MUSCLE_LABELS, MUSCLE_COLORS, WEEKDAY_NAMES, getWeekdayMap, exDisplayName, exSubtitle } from '../utils/routineConstants'
import { CARDIO_TYPES } from '../data/cardioProtocols'
import {
  ArrowLeft, Play, Check, Calculator, RefreshCw, X, Trash2, Plus, Trophy,
  Dumbbell, GripVertical, ChevronUp, ChevronDown, WifiOff, TrendingUp,
  Timer, Pause, HeartPulse, Music, Pencil, Save,
} from 'lucide-react'

const isCardioExercise = (exercise) =>
  exercise?.muscle_group === 'cardio' && exercise?.category === 'cardio'

const getCardioTypeFromExercise = (exercise) => {
  const name = (exercise?.name || '').toLowerCase()
  if (name.includes('hiit')) return 'hiit'
  if (name.includes('liss')) return 'liss'
  if (name.includes('steady')) return 'steady'
  return null
}

export default function RoutineDayDetail() {
  const { id, dayId } = useParams()
  const navigate = useNavigate()
  const online = useOnlineStatus()

  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [offlineMode, setOfflineMode] = useState(false)
  const [personalBests, setPersonalBests] = useState({})

  const todayDate = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local time
  const todayKey = `routine_progress_${id}_${todayDate}`

  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(todayKey)
      if (saved) return JSON.parse(saved)
      // Migrate from old UTC-based key if exists
      const utcDate = new Date().toISOString().split('T')[0]
      const utcKey = `routine_progress_${id}_${utcDate}`
      const utcSaved = localStorage.getItem(utcKey)
      if (utcSaved) {
        const data = JSON.parse(utcSaved)
        localStorage.setItem(todayKey, utcSaved) // copy to new key
        return data
      }
      // Also check sessionStorage as fallback
      const session = sessionStorage.getItem(todayKey)
      if (session) return JSON.parse(session)
      return {}
    } catch { return {} }
  })

  const { timeLeft: timerSeconds, totalSeconds: timerTotal, isRunning: timerRunning, progress: timerProgress, startTimer, stopTimer } = useRestTimer()

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

  // 1RM calculator
  const [oneRMExercise, setOneRMExercise] = useState(null)

  // Edit exercise state
  const [editingExId, setEditingExId] = useState(null)
  const [editForm, setEditForm] = useState({ sets: '', reps_min: '', reps_max: '', rest_seconds: '' })
  const [editSaving, setEditSaving] = useState(false)

  // ─── Load data ───
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
        cacheSet(`routine_${id}`, r.data)
        cacheSet('personal_bests', bests)
      } catch {
        if (cancelled) return
        const cachedRoutine = cacheGet(`routine_${id}`)
        const cachedBests = cacheGet('personal_bests')
        if (cachedRoutine) {
          setRoutine(cachedRoutine)
          if (cachedBests) setPersonalBests(cachedBests)
          setOfflineMode(true)
        } else {
          navigate(`/routines/${id}`, { replace: true })
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

  // Persist checked progress
  useEffect(() => {
    if (Object.keys(checked).length > 0) {
      sessionStorage.setItem(todayKey, JSON.stringify(checked))
    }
  }, [checked, todayKey])

  // ─── Handlers ───
  const reloadRoutine = () => api.get(`/routines/${id}`).then(r => {
    setRoutine(r.data)
    cacheSet(`routine_${id}`, r.data)
  })

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

      let saved = false
      if (online) {
        try {
          await api.post(url)
          saved = true
        } catch (netErr) {
          // Network failed even though navigator.onLine was true — queue it
          const isNetworkError = !netErr.response // no server response = network issue
          if (isNetworkError) {
            queueAction({
              method: 'post',
              url,
              description: `Quick set: ${quickSetExercise.name} ${weight}kg x ${reps}`,
            })
          } else {
            throw netErr // real server error (4xx/5xx), re-throw
          }
        }
      } else {
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

  const deleteExercise = async (exId) => {
    try {
      await api.delete(`/routines/exercises/${exId}`)
      await reloadRoutine()
    } catch (err) {
      console.error('Error deleting exercise:', err)
      alert('Error al eliminar ejercicio')
    }
  }

  // Move exercise up/down
  const getErrMsg = (err) => {
    const d = err.response?.data?.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map(e => e.msg || JSON.stringify(e)).join(', ')
    return err.message || 'Error desconocido'
  }

  const startEditing = (ex) => {
    setEditingExId(ex.id)
    setEditForm({
      sets: ex.sets.toString(),
      reps_min: ex.reps_min.toString(),
      reps_max: ex.reps_max.toString(),
      rest_seconds: ex.rest_seconds.toString(),
    })
  }

  const cancelEditing = () => {
    setEditingExId(null)
    setEditForm({ sets: '', reps_min: '', reps_max: '', rest_seconds: '' })
  }

  const saveExerciseEdit = async (exId) => {
    setEditSaving(true)
    try {
      await api.put(`/routines/exercises/${exId}`, {
        sets: parseInt(editForm.sets, 10),
        reps_min: parseInt(editForm.reps_min, 10),
        reps_max: parseInt(editForm.reps_max, 10),
        rest_seconds: parseInt(editForm.rest_seconds, 10),
      })
      await reloadRoutine()
      setEditingExId(null)
    } catch (err) {
      alert('Error al guardar: ' + getErrMsg(err))
    } finally {
      setEditSaving(false)
    }
  }

  const moveExUp = async (exIdx, dId, sortedExercises) => {
    if (exIdx === 0 || reordering) return
    setReordering(true)
    try {
      const items = [...sortedExercises]
      ;[items[exIdx - 1], items[exIdx]] = [items[exIdx], items[exIdx - 1]]
      await api.put('/routines/reorder-exercises', { day_id: parseInt(dId, 10), exercise_order: items.map(e => parseInt(e.id, 10)) })
      await reloadRoutine()
    } catch (err) {
      console.error('Error reordering:', err)
      alert('Error al reordenar: ' + getErrMsg(err))
    } finally {
      setReordering(false)
    }
  }

  const moveExDown = async (exIdx, dId, sortedExercises) => {
    if (exIdx >= sortedExercises.length - 1 || reordering) return
    setReordering(true)
    try {
      const items = [...sortedExercises]
      ;[items[exIdx], items[exIdx + 1]] = [items[exIdx + 1], items[exIdx]]
      await api.put('/routines/reorder-exercises', { day_id: parseInt(dId, 10), exercise_order: items.map(e => parseInt(e.id, 10)) })
      await reloadRoutine()
    } catch (err) {
      console.error('Error reordering:', err)
      alert('Error al reordenar: ' + getErrMsg(err))
    } finally {
      setReordering(false)
    }
  }

  // ─── Render ───
  if (loading) return <LoadingSpinner />
  if (!routine) return null

  const numDayId = parseInt(dayId)
  const day = routine.days?.find(d => d.id === numDayId)

  if (!day) {
    // Day not found — go back to routine
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(`/routines/${id}`, { replace: true })} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} /> Volver
        </button>
        <div className="card text-center py-8">
          <p className="text-gray-400">Este dia no existe</p>
        </div>
      </div>
    )
  }

  const sortedExercises = [...(day.exercises || [])].sort((a, b) => a.order - b.order)
  const strengthExercises = sortedExercises.filter(e => !isCardioExercise(e.exercise))
  const dayExIds = strengthExercises.map(e => e.id)
  const done = dayExIds.filter(eId => checked[eId]).length
  const total = dayExIds.length
  const progress = total > 0 ? (done / total) * 100 : 0
  const firstUncheckedId = strengthExercises.find(e => !checked[e.id])?.id || null

  // Build day title with weekday if available
  const rw = routine.rest_weekdays || [6]
  const wMap = getWeekdayMap(routine.days_per_week, rw)
  const wd = wMap[day.day_number]
  const dayTitle = wd !== undefined ? `${WEEKDAY_NAMES[wd]} - ${day.name}` : `Dia ${day.day_number}: ${day.name}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/routines/${id}`)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft size={20} /> Volver a dias
        </button>
        <button
          onClick={() => { const t = Date.now(); window.location.href = 'spotify://'; setTimeout(() => { if (Date.now() - t < 2500) window.open('https://open.spotify.com', '_blank') }, 1500) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] rounded-full text-white text-sm font-medium transition-colors shadow-sm"
        >
          <Music size={16} /> Spotify
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{dayTitle}</h2>
          {offlineMode && (
            <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
              <WifiOff size={12} /> Offline
            </span>
          )}
        </div>
        {day.focus && <p className="text-xs text-gray-400 mt-1">{day.focus.split(',').map(m => MUSCLE_LABELS[m.trim()] || m.trim()).join(', ')}</p>}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-400">{done}/{total}</span>
        </div>
      </div>

      {/* Rest Timer */}
      <div data-tour="rest-timer" className="card">
        {timerRunning ? (
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="5"
                  stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                <circle cx="40" cy="40" r="34" fill="none" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={213.63}
                  strokeDashoffset={213.63 * (1 - timerProgress)}
                  style={{ stroke: 'hsl(' + Math.round(timerProgress * 130) + ', 75%, 48%)', transition: 'stroke-dashoffset 1s linear, stroke 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(' + Math.round(timerProgress * 130) + ', 75%, 48%)' }}>
                  {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descanso</p>
              <p className="text-xs text-gray-400 mt-1">
                {timerProgress < 0.5 ? 'Descansa...' : timerProgress < 0.85 ? 'Casi listo...' : 'A darle!'}
              </p>
              <button onClick={stopTimer}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors">
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        ) : !timerRunning ? (
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 flex-shrink-0">Descanso:</span>
            <div className="flex gap-1.5 flex-1">
              {[60, 90, 120, 180].map(s => (
                <button key={s} onClick={() => startTimer(s)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-brand-50 dark:bg-brand-500/10 text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20 active:scale-95 transition-all">
                  {s >= 120 ? (s / 60 + ' min') : (s + 's')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Exercise list */}
      {sortedExercises.map((ex, exIdx) => {
        const cardio = isCardioExercise(ex.exercise)
        const cardioTypeId = cardio ? getCardioTypeFromExercise(ex.exercise) : null
        const cardioInfo = cardio ? CARDIO_TYPES.find(t => t.id === cardioTypeId) : null

        // ── Cardio exercise card ──
        if (cardio) {
          return (
            <div key={ex.id} className="card bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                {/* Move buttons */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <button onClick={() => moveExUp(exIdx, day.id, sortedExercises)}
                    disabled={exIdx === 0 || reordering}
                    className={`p-2 rounded-lg transition-colors ${exIdx === 0 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:bg-brand-50 dark:active:bg-brand-500/10 active:text-brand-600'}`}>
                    <ChevronUp size={18} />
                  </button>
                  <GripVertical size={12} className="text-gray-300 dark:text-gray-600 -my-1" />
                  <button onClick={() => moveExDown(exIdx, day.id, sortedExercises)}
                    disabled={exIdx >= sortedExercises.length - 1 || reordering}
                    className={`p-2 rounded-lg transition-colors ${exIdx >= sortedExercises.length - 1 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:bg-brand-50 dark:active:bg-brand-500/10 active:text-brand-600'}`}>
                    <ChevronDown size={18} />
                  </button>
                </div>
                {/* Cardio emoji */}
                <span className="text-2xl flex-shrink-0">{cardioInfo?.emoji || '🏃'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{cardioInfo?.label || exDisplayName(ex.exercise)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{cardioInfo?.description || 'Cardio'}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${MUSCLE_COLORS.cardio}`}>
                    Cardio
                  </span>
                  <button
                    onClick={() => navigate('/cardio', { state: { preselectedType: cardioTypeId } })}
                    className="mt-2 w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                    <HeartPulse size={16} /> Empezar Cardio
                  </button>
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => setSwapExercise(ex)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">
                      <RefreshCw size={14} /> Reemplazar
                    </button>
                    <button onClick={() => { if (confirm('Eliminar este ejercicio?')) deleteExercise(ex.id) }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        // ── Regular strength exercise card ──
        return (
          <div
            key={ex.id}
            className={`card bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 transition-all ${
              checked[ex.id] ? 'opacity-40' : ex.id === firstUncheckedId ? 'ring-2 ring-brand-500/60 animate-pulse-subtle' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              {/* Move buttons */}
              <div className="flex flex-col items-center flex-shrink-0">
                <button
                  onClick={() => moveExUp(exIdx, day.id, sortedExercises)}
                  disabled={exIdx === 0 || reordering}
                  className={`p-2 rounded-lg transition-colors ${exIdx === 0 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:bg-brand-50 dark:active:bg-brand-500/10 active:text-brand-600'}`}
                >
                  <ChevronUp size={18} />
                </button>
                <GripVertical size={12} className="text-gray-300 dark:text-gray-600 -my-1" />
                <button
                  onClick={() => moveExDown(exIdx, day.id, sortedExercises)}
                  disabled={exIdx >= sortedExercises.length - 1 || reordering}
                  className={`p-2 rounded-lg transition-colors ${exIdx >= sortedExercises.length - 1 ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 hover:text-brand-500 active:bg-brand-50 dark:active:bg-brand-500/10 active:text-brand-600'}`}
                >
                  <ChevronDown size={18} />
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

                {/* Inline edit form */}
                {editingExId === ex.id && (
                  <div className="mt-2 p-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-xl space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Series</label>
                        <input type="number" inputMode="numeric" value={editForm.sets}
                          onChange={e => setEditForm(f => ({ ...f, sets: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Rep min</label>
                        <input type="number" inputMode="numeric" value={editForm.reps_min}
                          onChange={e => setEditForm(f => ({ ...f, reps_min: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Rep max</label>
                        <input type="number" inputMode="numeric" value={editForm.reps_max}
                          onChange={e => setEditForm(f => ({ ...f, reps_max: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 font-medium">Desc (s)</label>
                        <input type="number" inputMode="numeric" value={editForm.rest_seconds}
                          onChange={e => setEditForm(f => ({ ...f, rest_seconds: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={cancelEditing}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg transition-colors">
                        Cancelar
                      </button>
                      <button onClick={() => saveExerciseEdit(ex.id)} disabled={editSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                        <Save size={12} /> {editSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                )}

                {personalBests[ex.exercise_id] && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded-lg">
                      <Trophy size={12} />
                      <span className="text-xs font-semibold">
                        PR: {personalBests[ex.exercise_id].weight_kg} kg x {personalBests[ex.exercise_id].reps}
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
                            Hoy: {suggestedWeight} kg x {suggestedReps}
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
                <button onClick={() => startEditing(ex)}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={() => setSwapExercise(ex)}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-orange-500 hover:text-orange-400 transition-colors">
                  <RefreshCw size={14} /> Reemplazar
                </button>
                <button onClick={() => { if (confirm('Eliminar este ejercicio?')) deleteExercise(ex.id) }}
                  className="inline-flex items-center gap-1.5 mt-1 ml-3 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add exercise button */}
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
                <h3 className="text-xl font-bold">Nuevo PR!</h3>
                <p className="text-brand-500 font-bold text-lg">{quickSetForm.weight_kg} kg x {quickSetForm.reps} reps</p>
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
                        <p className="text-xs text-gray-400">Serie mas pesada de hoy</p>
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
                      <span className="font-medium">PR actual: {personalBests[quickSetExercise.exerciseId].weight_kg} kg x {personalBests[quickSetExercise.exerciseId].reps} reps</span>
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

      {/* 1RM Calculator */}
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
              alert(getErrMsg(err))
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
              alert(getErrMsg(err))
            }
          }}
        />
      )}
      <PageTour pageKey="routine-day" steps={[
        { target: '[data-tour="rest-timer"]', title: 'Cronometro de Descanso', description: 'Inicia un timer entre series. Se pinta de rojo a verde conforme se acerca tu turno. Suena una campana de box al terminar. Funciona aunque cambies de pagina o cierres la app.', position: 'top' },
      ]} />
    </div>
  )
}
