import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Plus, Dumbbell, Calendar, Clock, ChevronRight } from 'lucide-react'

export default function Workouts() {
  const [workouts, setWorkouts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    fatigue_level: 5,
    notes: '',
    sets: [],
  })

  const [currentSet, setCurrentSet] = useState({
    exercise_id: '', reps: '', weight_kg: '', rpe: '', set_number: 1,
  })

  useEffect(() => {
    Promise.all([
      api.get('/workouts/history'),
      api.get('/exercises'),
    ]).then(([w, e]) => {
      setWorkouts(w.data)
      setExercises(e.data)
    }).finally(() => setLoading(false))
  }, [])

  const addSet = () => {
    if (!currentSet.exercise_id || !currentSet.reps || !currentSet.weight_kg) return
    setForm({
      ...form,
      sets: [...form.sets, {
        ...currentSet,
        exercise_id: parseInt(currentSet.exercise_id),
        reps: parseInt(currentSet.reps),
        weight_kg: parseFloat(currentSet.weight_kg),
        rpe: currentSet.rpe ? parseFloat(currentSet.rpe) : null,
        set_number: form.sets.length + 1,
        completed: true,
      }],
    })
    setCurrentSet({ ...currentSet, reps: '', weight_kg: '', rpe: '', set_number: form.sets.length + 2 })
  }

  const saveWorkout = async () => {
    if (form.sets.length === 0) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
        fatigue_level: parseInt(form.fatigue_level),
      }
      await api.post('/workouts', payload)
      const { data } = await api.get('/workouts/history')
      setWorkouts(data)
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], duration_minutes: '', fatigue_level: 5, notes: '', sets: [] })
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entrenamientos</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {/* New Workout Form */}
      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-lg">Registrar Entrenamiento</h3>

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

          <div>
            <label className="label">Fatiga (1-10): {form.fatigue_level}</label>
            <input type="range" min="1" max="10" className="w-full accent-brand-500" value={form.fatigue_level} onChange={(e) => setForm({ ...form, fatigue_level: e.target.value })} />
          </div>

          {/* Add Sets */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
            <h4 className="font-medium text-sm">Agregar Serie</h4>
            <div>
              <select className="input" value={currentSet.exercise_id} onChange={(e) => setCurrentSet({ ...currentSet, exercise_id: e.target.value })}>
                <option value="">Seleccionar ejercicio...</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500">Reps</label>
                <input type="number" className="input text-center" value={currentSet.reps} onChange={(e) => setCurrentSet({ ...currentSet, reps: e.target.value })} placeholder="10" inputMode="numeric" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Peso (kg)</label>
                <input type="number" className="input text-center" value={currentSet.weight_kg} onChange={(e) => setCurrentSet({ ...currentSet, weight_kg: e.target.value })} placeholder="60" inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs text-gray-500">RPE</label>
                <input type="number" className="input text-center" value={currentSet.rpe} onChange={(e) => setCurrentSet({ ...currentSet, rpe: e.target.value })} placeholder="7" inputMode="decimal" min="1" max="10" />
              </div>
            </div>
            <button type="button" onClick={addSet} className="btn-secondary w-full text-sm">
              + Agregar Serie
            </button>
          </div>

          {/* Sets list */}
          {form.sets.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Series ({form.sets.length})</h4>
              {form.sets.map((s, i) => {
                const ex = exercises.find((e) => e.id === s.exercise_id)
                return (
                  <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium">{ex?.name || 'Ejercicio'}</span>
                    <span className="text-gray-500">{s.reps}r × {s.weight_kg}kg {s.rpe ? `@ RPE ${s.rpe}` : ''}</span>
                    <button onClick={() => setForm({ ...form, sets: form.sets.filter((_, j) => j !== i) })} className="text-red-400 text-xs">✕</button>
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="¿Cómo te sentiste?" />
          </div>

          <button onClick={saveWorkout} className="btn-primary w-full" disabled={saving || form.sets.length === 0}>
            {saving ? 'Guardando...' : 'Guardar Entrenamiento'}
          </button>
        </div>
      )}

      {/* Workout History */}
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
  )
}
