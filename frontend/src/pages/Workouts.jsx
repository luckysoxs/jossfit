import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PageTour from '../components/ui/PageTour'
import { Plus, Dumbbell, Calendar, Clock, ChevronRight, CheckCircle, Trophy, Flame, X, ChevronDown, ChevronUp } from 'lucide-react'

export default function Workouts() {
  const [workouts, setWorkouts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Routine-based workout
  const [routines, setRoutines] = useState([])
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)

  // Exercise-based sets: { [exerciseId]: [{ reps, weight_kg, rpe, completed }] }
  const [exerciseSets, setExerciseSets] = useState({})

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    notes: '',
  })

  // Extra exercise (manual add)
  const [showAddExtra, setShowAddExtra] = useState(false)
  const [extraExerciseId, setExtraExerciseId] = useState('')

  // Post-workout fatigue survey + summary
  const [showFatigueSurvey, setShowFatigueSurvey] = useState(false)
  const [pendingWorkoutData, setPendingWorkoutData] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState(null)

  // Collapsed exercises
  const [collapsedExercises, setCollapsedExercises] = useState({})

  useEffect(() => {
    Promise.all([
      api.get('/workouts/history'),
      api.get('/exercises'),
      api.get('/routines'),
    ]).then(([w, e, r]) => {
      setWorkouts(w.data)
      setExercises(e.data)
      setRoutines(r.data)
      // Auto-select first routine if only one
      if (r.data.length === 1) {
        setSelectedRoutine(r.data[0])
      }
    }).finally(() => setLoading(false))
  }, [])

  const startNewWorkout = () => {
    setShowForm(true)
    setSelectedDay(null)
    setExerciseSets({})
    setForm({
      date: new Date().toISOString().split('T')[0],
      duration_minutes: '',
      notes: '',
    })
  }

  const selectDay = (day) => {
    setSelectedDay(day)
    // Pre-populate sets from routine exercises
    const sets = {}
    day.exercises
      .sort((a, b) => a.order - b.order)
      .forEach((re) => {
        sets[re.exercise_id] = Array.from({ length: re.sets }, () => ({
          reps: '', weight_kg: '', rpe: '', completed: false,
        }))
      })
    setExerciseSets(sets)
    setCollapsedExercises({})
  }

  const updateSet = (exerciseId, setIndex, field, value) => {
    setExerciseSets((prev) => {
      const updated = { ...prev }
      updated[exerciseId] = [...updated[exerciseId]]
      updated[exerciseId][setIndex] = { ...updated[exerciseId][setIndex], [field]: value }
      return updated
    })
  }

  const toggleSetComplete = (exerciseId, setIndex) => {
    setExerciseSets((prev) => {
      const updated = { ...prev }
      updated[exerciseId] = [...updated[exerciseId]]
      const set = updated[exerciseId][setIndex]
      updated[exerciseId][setIndex] = { ...set, completed: !set.completed }
      return updated
    })
  }

  const addSetToExercise = (exerciseId) => {
    setExerciseSets((prev) => ({
      ...prev,
      [exerciseId]: [...(prev[exerciseId] || []), { reps: '', weight_kg: '', rpe: '', completed: false }],
    }))
  }

  const removeSetFromExercise = (exerciseId, setIndex) => {
    setExerciseSets((prev) => {
      const updated = { ...prev }
      updated[exerciseId] = updated[exerciseId].filter((_, i) => i !== setIndex)
      if (updated[exerciseId].length === 0) delete updated[exerciseId]
      return updated
    })
  }

  const addExtraExercise = () => {
    if (!extraExerciseId) return
    const eid = parseInt(extraExerciseId)
    if (exerciseSets[eid]) return // already exists
    setExerciseSets((prev) => ({
      ...prev,
      [eid]: [{ reps: '', weight_kg: '', rpe: '', completed: false }],
    }))
    setExtraExerciseId('')
    setShowAddExtra(false)
  }

  const toggleCollapse = (exerciseId) => {
    setCollapsedExercises((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }))
  }

  // Count total completed sets
  const totalCompletedSets = Object.values(exerciseSets).flat().filter((s) => s.completed).length
  const totalSets = Object.values(exerciseSets).flat().length

  const saveWorkout = () => {
    // Collect all completed sets
    const allSets = []
    let setNumber = 1
    Object.entries(exerciseSets).forEach(([exerciseId, sets]) => {
      sets.forEach((s) => {
        if (s.completed && s.reps && s.weight_kg) {
          allSets.push({
            exercise_id: parseInt(exerciseId),
            reps: parseInt(s.reps),
            weight_kg: parseFloat(s.weight_kg),
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            set_number: setNumber++,
            completed: true,
          })
        }
      })
    })

    if (allSets.length === 0) return

    // Store pending data and show fatigue survey
    setPendingWorkoutData({
      date: form.date,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      notes: form.notes,
      sets: allSets,
      dayName: selectedDay?.name || 'Entrenamiento',
    })
    setShowFatigueSurvey(true)
  }

  const submitWithFatigue = async (fatigueLevel) => {
    if (!pendingWorkoutData) return
    setSaving(true)
    try {
      const payload = {
        ...pendingWorkoutData,
        fatigue_level: fatigueLevel,
      }
      delete payload.dayName
      await api.post('/workouts', payload)
      const { data } = await api.get('/workouts/history')
      setWorkouts(data)

      const exercisesWorked = new Set(pendingWorkoutData.sets.map((s) => s.exercise_id)).size
      const totalVolume = pendingWorkoutData.sets.reduce((acc, s) => acc + s.reps * s.weight_kg, 0)
      setSummaryData({
        totalSets: pendingWorkoutData.sets.length,
        exercisesWorked,
        totalVolume: Math.round(totalVolume),
        duration: pendingWorkoutData.duration_minutes,
        fatigue: fatigueLevel,
        dayName: pendingWorkoutData.dayName,
      })

      setShowFatigueSurvey(false)
      setPendingWorkoutData(null)
      setShowSummary(true)
      setShowForm(false)
      setSelectedDay(null)
      setExerciseSets({})
      setForm({ date: new Date().toISOString().split('T')[0], duration_minutes: '', notes: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const getExerciseName = (id) => exercises.find((e) => e.id === parseInt(id))?.name || 'Ejercicio'

  const getFatigueEmoji = (level) => {
    const n = parseInt(level)
    if (n <= 3) return '😊'
    if (n <= 5) return '😐'
    if (n <= 7) return '😓'
    if (n <= 9) return '🥵'
    return '💀'
  }

  const getFatigueLabel = (level) => {
    const n = parseInt(level)
    if (n <= 2) return 'Muy ligero'
    if (n <= 4) return 'Moderado'
    if (n <= 6) return 'Intenso'
    if (n <= 8) return 'Muy intenso'
    return 'Al límite'
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entrenamientos</h1>
        <button data-tour="log-workout" onClick={startNewWorkout} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {/* New Workout Form */}
      {showForm && (
        <div className="space-y-4">
          {/* Day selector - if routine exists and no day selected */}
          {!selectedDay && selectedRoutine && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-lg">¿Qué día entrenas hoy?</h3>
              <p className="text-sm text-gray-500">{selectedRoutine.name} • {selectedRoutine.split_type}</p>
              <div className="grid gap-2">
                {selectedRoutine.days
                  ?.sort((a, b) => a.day_number - b.day_number)
                  .map((day) => (
                    <button
                      key={day.id}
                      onClick={() => selectDay(day)}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-brand-50 dark:hover:bg-brand-500/10 hover:border-brand-500 border border-transparent transition-all text-left"
                    >
                      <div>
                        <p className="font-medium">{day.name}</p>
                        {day.focus && <p className="text-xs text-gray-500 mt-0.5">{day.focus}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{day.exercises?.length || 0} ejercicios</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </button>
                  ))}
              </div>
              {routines.length > 1 && (
                <select
                  className="input text-sm"
                  value={selectedRoutine?.id || ''}
                  onChange={(e) => {
                    const r = routines.find((r) => r.id === parseInt(e.target.value))
                    setSelectedRoutine(r)
                  }}
                >
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* No routine fallback */}
          {!selectedDay && !selectedRoutine && routines.length === 0 && (
            <div className="card text-center py-8">
              <Dumbbell size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500 text-sm">No tienes una rutina activa</p>
              <p className="text-gray-400 text-xs mt-1">Crea una rutina primero para entrenar con ella</p>
            </div>
          )}

          {/* Workout logging - day selected */}
          {selectedDay && (
            <div className="space-y-3">
              {/* Header */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{selectedDay.name}</h3>
                    {selectedDay.focus && <p className="text-xs text-gray-500">{selectedDay.focus}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Progreso</p>
                    <p className="font-bold text-brand-500">{totalCompletedSets}/{totalSets}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalSets > 0 ? (totalCompletedSets / totalSets) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Date & Duration */}
              <div className="card">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Fecha</label>
                    <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Duración (min)</label>
                    <input type="number" className="input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} placeholder="60" inputMode="numeric" />
                  </div>
                </div>
              </div>

              {/* Exercise Cards */}
              {Object.entries(exerciseSets).map(([exerciseId, sets]) => {
                const routineExercise = selectedDay.exercises?.find((re) => re.exercise_id === parseInt(exerciseId))
                const exName = getExerciseName(exerciseId)
                const completedCount = sets.filter((s) => s.completed).length
                const isCollapsed = collapsedExercises[exerciseId]

                return (
                  <div key={exerciseId} className="card !p-0 overflow-hidden">
                    {/* Exercise header */}
                    <button
                      onClick={() => toggleCollapse(exerciseId)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          completedCount === sets.length && sets.length > 0
                            ? 'bg-green-100 dark:bg-green-500/10 text-green-500'
                            : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500'
                        }`}>
                          {completedCount === sets.length && sets.length > 0 ? <CheckCircle size={16} /> : completedCount + '/' + sets.length}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{exName}</p>
                          {routineExercise && (
                            <p className="text-xs text-gray-400">
                              {routineExercise.sets}×{routineExercise.reps_min}-{routineExercise.reps_max} · {routineExercise.rest_seconds}s descanso
                            </p>
                          )}
                        </div>
                      </div>
                      {isCollapsed ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronUp size={18} className="text-gray-400" />}
                    </button>

                    {/* Sets */}
                    {!isCollapsed && (
                      <div className="px-4 pb-4 space-y-2">
                        {/* Column headers */}
                        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-2 text-xs text-gray-400 font-medium px-1">
                          <span>Set</span>
                          <span>Reps</span>
                          <span>Kg</span>
                          <span>RPE</span>
                          <span></span>
                        </div>
                        {sets.map((s, si) => (
                          <div key={si} className={`grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-2 items-center ${s.completed ? 'opacity-60' : ''}`}>
                            <button
                              onClick={() => toggleSetComplete(parseInt(exerciseId), si)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                                s.completed
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                              }`}
                            >
                              {s.completed ? '✓' : si + 1}
                            </button>
                            <input
                              type="number"
                              className="input text-center text-sm !py-2 !min-h-0"
                              value={s.reps}
                              onChange={(e) => updateSet(parseInt(exerciseId), si, 'reps', e.target.value)}
                              placeholder={routineExercise ? `${routineExercise.reps_min}` : '10'}
                              inputMode="numeric"
                            />
                            <input
                              type="number"
                              className="input text-center text-sm !py-2 !min-h-0"
                              value={s.weight_kg}
                              onChange={(e) => updateSet(parseInt(exerciseId), si, 'weight_kg', e.target.value)}
                              placeholder="0"
                              inputMode="decimal"
                            />
                            <input
                              type="number"
                              className="input text-center text-sm !py-2 !min-h-0"
                              value={s.rpe}
                              onChange={(e) => updateSet(parseInt(exerciseId), si, 'rpe', e.target.value)}
                              placeholder="7"
                              inputMode="decimal"
                              min="1"
                              max="10"
                            />
                            <button
                              onClick={() => removeSetFromExercise(parseInt(exerciseId), si)}
                              className="text-red-400 hover:text-red-500 text-xs flex items-center justify-center"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addSetToExercise(parseInt(exerciseId))}
                          className="text-brand-500 text-xs font-medium w-full py-1.5 hover:bg-brand-50 dark:hover:bg-brand-500/5 rounded-lg transition-colors"
                        >
                          + Agregar serie
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add extra exercise */}
              {!showAddExtra ? (
                <button
                  onClick={() => setShowAddExtra(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 hover:text-brand-500 hover:border-brand-500 transition-colors"
                >
                  + Agregar ejercicio extra
                </button>
              ) : (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Agregar ejercicio</h4>
                    <button onClick={() => setShowAddExtra(false)} className="text-gray-400"><X size={16} /></button>
                  </div>
                  <select className="input" value={extraExerciseId} onChange={(e) => setExtraExerciseId(e.target.value)}>
                    <option value="">Seleccionar ejercicio...</option>
                    {exercises
                      .filter((ex) => !exerciseSets[ex.id])
                      .map((ex) => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                  </select>
                  <button onClick={addExtraExercise} className="btn-primary w-full text-sm" disabled={!extraExerciseId}>
                    Agregar
                  </button>
                </div>
              )}

              {/* Notes */}
              <div className="card">
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="¿Cómo te sentiste?" />
              </div>

              {/* Save */}
              <button
                onClick={saveWorkout}
                className="btn-primary w-full flex items-center justify-center gap-2 text-base py-4"
                disabled={saving || totalCompletedSets === 0}
              >
                {saving ? (
                  'Guardando...'
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Terminar Entrenamiento ({totalCompletedSets} series)
                  </>
                )}
              </button>

              <button
                onClick={() => { setShowForm(false); setSelectedDay(null); setExerciseSets({}) }}
                className="w-full text-center text-sm text-gray-400 py-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Workout History */}
      {!showForm && (
        <div data-tour="workout-history">
          {workouts.length === 0 ? (
            <div className="card text-center py-12">
              <Dumbbell size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No hay entrenamientos registrados</p>
              <p className="text-sm text-gray-400">Presiona "Nuevo" para empezar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => (
                <Link key={w.id} to={`/workouts/${w.id}`} className="card flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500">
                      <Dumbbell size={20} />
                    </div>
                    <div>
                      <p className="font-medium">
                        {w.sets?.length || 0} series registradas
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {new Date(w.date).toLocaleDateString('es-MX')}
                        </span>
                        {w.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {w.duration_minutes}min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <PageTour
        pageKey="workouts"
        steps={[
          { target: '[data-tour="log-workout"]', title: 'Registrar Entreno', description: 'Registra tu sesion de entrenamiento con series, peso y repeticiones.', position: 'bottom' },
          { target: '[data-tour="workout-history"]', title: 'Historial', description: 'Aqui puedes ver todos tus entrenamientos anteriores.', position: 'top' },
        ]}
      />

      {/* Fatigue Survey Modal */}
      {showFatigueSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-5 border border-gray-100 dark:border-gray-800 animate-in">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center mx-auto">
              <Flame size={32} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">¿Qué tan cansado estás?</h2>
              <p className="text-sm text-gray-500 mt-1">Selecciona tu nivel de fatiga</p>
            </div>
            <div className="space-y-2">
              {[
                { range: [1, 2], emoji: '😊', label: 'Ligero', color: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20' },
                { range: [3, 4], emoji: '💪', label: 'Moderado', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20' },
                { range: [5, 6], emoji: '😤', label: 'Intenso', color: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/20' },
                { range: [7, 8], emoji: '😓', label: 'Muy intenso', color: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20' },
                { range: [9, 10], emoji: '💀', label: 'Al límite', color: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20' },
              ].map(({ range, emoji, label, color }) => (
                <button
                  key={range[0]}
                  onClick={() => submitWithFatigue(range[1])}
                  disabled={saving}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${color} ${saving ? 'opacity-50' : ''}`}
                >
                  <span className="text-2xl">{emoji}</span>
                  <div className="text-left flex-1">
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs opacity-70">{range[0]}-{range[1]} / 10</p>
                  </div>
                </button>
              ))}
            </div>
            {saving && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
                Guardando...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Workout Summary Popup */}
      {showSummary && summaryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-5 border border-gray-100 dark:border-gray-800 animate-in">
            {/* Trophy icon */}
            <div className="w-20 h-20 bg-brand-50 dark:bg-brand-500/10 rounded-full flex items-center justify-center mx-auto">
              <Trophy size={40} className="text-brand-500" />
            </div>

            <div>
              <h2 className="text-xl font-bold">¡Entreno Completado!</h2>
              <p className="text-sm text-gray-500 mt-1">{summaryData.dayName}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {summaryData.duration && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <Clock size={20} className="text-brand-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">{summaryData.duration} min</p>
                  <p className="text-xs text-gray-500">Duración</p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <Flame size={20} className="text-orange-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{summaryData.fatigue}/10 {getFatigueEmoji(summaryData.fatigue)}</p>
                <p className="text-xs text-gray-500">Fatiga</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <Dumbbell size={20} className="text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{summaryData.totalSets}</p>
                <p className="text-xs text-gray-500">Series</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <Trophy size={20} className="text-yellow-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{summaryData.totalVolume.toLocaleString()} kg</p>
                <p className="text-xs text-gray-500">Volumen total</p>
              </div>
            </div>

            <p className="text-sm text-gray-400">{getFatigueLabel(summaryData.fatigue)} · {summaryData.exercisesWorked} ejercicios</p>

            <button
              onClick={() => setShowSummary(false)}
              className="btn-primary w-full"
            >
              ¡Listo! 💪
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
