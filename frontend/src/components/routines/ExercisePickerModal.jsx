import { useState, useEffect } from 'react'
import api from '../../services/api'
import { cacheSet, cacheGet } from '../../services/offlineCache'
import { MUSCLE_LABELS } from '../../utils/routineConstants'
import { CARDIO_TYPES } from '../../data/cardioProtocols'
import { ArrowLeft, X, Search, Plus, Settings2 } from 'lucide-react'

// Map cardio type IDs to exercise names in DB
const CARDIO_EXERCISE_NAMES = {
  hiit: 'HIIT Cardio',
  liss: 'LISS Cardio',
  steady: 'Steady State Cardio',
}

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Cable', 'Machine', 'Bodyweight', 'Smith Machine', 'Kettlebell', 'Bands']
const CATEGORY_OPTIONS = [
  { value: 'compound', label: 'Compuesto' },
  { value: 'isolation', label: 'Aislamiento' },
]

export default function ExercisePickerModal({ title, priorityMuscle, showCustomize, onClose, onSelect }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [config, setConfig] = useState({ sets: '3', reps_min: '8', reps_max: '12', rest_seconds: '90' })
  const [submitting, setSubmitting] = useState(false)

  // Parse config values for submission (convert strings to numbers with defaults)
  const parsedConfig = {
    sets: parseInt(config.sets) || 3,
    reps_min: parseInt(config.reps_min) || 8,
    reps_max: parseInt(config.reps_max) || 12,
    rest_seconds: parseInt(config.rest_seconds) || 90,
  }
  const [showCreate, setShowCreate] = useState(false)
  const [newEx, setNewEx] = useState({
    name: '', muscle_group: priorityMuscle || 'chest', category: 'compound', equipment: 'Barbell',
  })

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
    // Cardio exercises skip customize — add with defaults directly
    if (exercise.muscle_group === 'cardio' && exercise.category === 'cardio') {
      setSubmitting(true)
      try {
        await onSelect(exercise, { sets: 1, reps_min: 1, reps_max: 1, rest_seconds: 0 })
      } catch (err) {
        console.error('Error adding cardio:', err)
        alert('Error al agregar cardio')
      } finally {
        setSubmitting(false)
      }
      return
    }
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

  const handleCreateExercise = async () => {
    if (!newEx.name.trim()) return
    setSubmitting(true)
    try {
      const r = await api.post('/exercises', newEx)
      const created = r.data
      const updated = [...exercises, created]
      setExercises(updated)
      cacheSet('all_exercises', updated)
      setShowCreate(false)
      await handleSelect(created)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al crear ejercicio'
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmAdd = async () => {
    if (!selectedExercise) return
    setSubmitting(true)
    try {
      await onSelect(selectedExercise, parsedConfig)
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

  // Create exercise view
  if (showCreate) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-bold text-sm">Crear ejercicio</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="label">Nombre</label>
              <input type="text" className="input text-sm" placeholder="Ej: Sentadilla Sumo con Mancuerna"
                value={newEx.name} onChange={e => setNewEx({ ...newEx, name: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="label">Grupo muscular</label>
              <select className="input text-sm" value={newEx.muscle_group}
                onChange={e => setNewEx({ ...newEx, muscle_group: e.target.value })}>
                {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select className="input text-sm" value={newEx.category}
                  onChange={e => setNewEx({ ...newEx, category: e.target.value })}>
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Equipo</label>
                <select className="input text-sm" value={newEx.equipment}
                  onChange={e => setNewEx({ ...newEx, equipment: e.target.value })}>
                  {EQUIPMENT_OPTIONS.map(eq => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleCreateExercise} disabled={submitting || !newEx.name.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {submitting ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><Plus size={16} /> Crear y agregar</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Customize view
  if (selectedExercise) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
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
                  onFocus={e => e.target.select()}
                  onChange={e => setConfig({ ...config, sets: e.target.value })}
                  onBlur={e => { if (!e.target.value) setConfig(c => ({ ...c, sets: '3' })) }}
                  min="1" max="20" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Descanso (s)</label>
                <input type="number" className="input text-center font-bold" value={config.rest_seconds}
                  onFocus={e => e.target.select()}
                  onChange={e => setConfig({ ...config, rest_seconds: e.target.value })}
                  onBlur={e => { if (!e.target.value) setConfig(c => ({ ...c, rest_seconds: '90' })) }}
                  min="10" max="600" step="10" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Reps min</label>
                <input type="number" className="input text-center font-bold" value={config.reps_min}
                  onFocus={e => e.target.select()}
                  onChange={e => setConfig({ ...config, reps_min: e.target.value })}
                  onBlur={e => { if (!e.target.value) setConfig(c => ({ ...c, reps_min: '8' })) }}
                  min="1" max="100" inputMode="numeric" />
              </div>
              <div>
                <label className="label">Reps max</label>
                <input type="number" className="input text-center font-bold" value={config.reps_max}
                  onFocus={e => e.target.select()}
                  onChange={e => setConfig({ ...config, reps_max: e.target.value })}
                  onBlur={e => { if (!e.target.value) setConfig(c => ({ ...c, reps_max: '12' })) }}
                  min="1" max="100" inputMode="numeric" />
              </div>
            </div>
            <button onClick={handleConfirmAdd} disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {submitting ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><Plus size={16} /> Agregar {parsedConfig.sets} x {parsedConfig.reps_min}-{parsedConfig.reps_max}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[75dvh] flex flex-col shadow-2xl" style={{ maxHeight: '75dvh' }}>
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
                {group === 'cardio' ? (
                  /* Special cardio rendering: show HIIT/LISS/Steady with emojis */
                  CARDIO_TYPES.map(ct => {
                    const matchingEx = exercises.find(e => e.name === CARDIO_EXERCISE_NAMES[ct.id])
                    if (!matchingEx) return null
                    return (
                      <button key={ct.id} onClick={() => handleSelect(matchingEx)} disabled={submitting}
                        className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{ct.emoji}</span>
                          <div>
                            <p className="font-medium text-sm">{ct.label}</p>
                            <p className="text-xs text-gray-400">{ct.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  grouped[group].map(e => (
                    <button key={e.id} onClick={() => handleSelect(e)} disabled={submitting}
                      className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-1.5">
                      <p className="font-medium text-sm">{e.name_es || e.name}</p>
                      {e.name_es && <p className="text-[11px] text-gray-400 italic">{e.name}</p>}
                      <p className="text-xs text-gray-400">{e.category} · {e.equipment}</p>
                    </button>
                  ))
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 mb-3">No se encontraron ejercicios</p>
              <button onClick={() => { setNewEx({ ...newEx, name: searchTerm }); setShowCreate(true) }}
                className="text-sm font-medium text-brand-500 hover:text-brand-400 inline-flex items-center gap-1.5">
                <Plus size={14} /> Crear "{searchTerm || 'nuevo'}"
              </button>
            </div>
          )}
          {/* Always show create button at bottom */}
          {!loading && sortedGroups.length > 0 && (
            <button onClick={() => { setNewEx({ ...newEx, name: searchTerm }); setShowCreate(true) }}
              className="w-full py-3 text-sm font-medium text-brand-500 hover:text-brand-400 flex items-center justify-center gap-1.5 border-t border-gray-100 dark:border-gray-800 mt-2">
              <Plus size={14} /> Crear ejercicio nuevo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
