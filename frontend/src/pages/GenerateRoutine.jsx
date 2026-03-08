import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Zap, Loader2, ShieldAlert, Plus, X, Pencil, Save, CheckCircle2 } from 'lucide-react'
import PageTour from '../components/ui/PageTour'

const MUSCLES = ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abs', 'calves']
const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', quadriceps: 'Cuádriceps',
  hamstrings: 'Isquiotibiales', glutes: 'Glúteos', biceps: 'Bíceps', triceps: 'Tríceps',
  abs: 'Abdominales', calves: 'Pantorrillas',
}

export default function GenerateRoutine() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [form, setForm] = useState({
    objective: user?.fitness_goal || 'hypertrophy',
    days_per_week: 4,
    training_level: user?.training_level || 'intermediate',
    priority_muscles: [],
    split_preference: null,
  })
  const [customDays, setCustomDays] = useState([
    { name: 'Día 1', muscles: [] },
    { name: 'Día 2', muscles: [] },
    { name: 'Día 3', muscles: [] },
  ])
  const [editingDayIndex, setEditingDayIndex] = useState(null)

  const toggleMuscle = (m) => {
    setForm({
      ...form,
      priority_muscles: form.priority_muscles.includes(m)
        ? form.priority_muscles.filter((x) => x !== m)
        : [...form.priority_muscles, m],
    })
  }

  const toggleCustomMuscle = (dayIdx, muscle) => {
    setCustomDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        muscles: d.muscles.includes(muscle)
          ? d.muscles.filter(m => m !== muscle)
          : [...d.muscles, muscle],
      }
    }))
  }

  const updateCustomDayName = (dayIdx, name) => {
    setCustomDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, name } : d))
  }

  const addCustomDay = () => {
    setCustomDays(prev => [...prev, { name: `Día ${prev.length + 1}`, muscles: [] }])
    setForm({ ...form, days_per_week: customDays.length + 1 })
  }

  const removeCustomDay = (idx) => {
    if (customDays.length <= 2) return
    setCustomDays(prev => prev.filter((_, i) => i !== idx))
    setForm({ ...form, days_per_week: customDays.length - 1 })
  }

  const isCustom = form.split_preference === 'custom'

  const [success, setSuccess] = useState(null) // { id, name }

  const generate = async () => {
    if (!routineName.trim()) {
      alert('Dale un nombre a tu rutina')
      return
    }
    setLoading(true)
    try {
      const payload = { ...form, name: routineName.trim() }
      if (isCustom) {
        payload.custom_days = customDays
        payload.days_per_week = customDays.length
      }
      const { data } = await api.post('/ai/generate-routine', payload)
      setSuccess({ id: data.id, name: data.name })
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──
  if (success) {
    return (
      <div className="space-y-6 max-w-lg mx-auto text-center py-12">
        <CheckCircle2 size={56} className="text-green-500 mx-auto" />
        <div>
          <h1 className="text-2xl font-bold">Rutina Guardada</h1>
          <p className="text-gray-400 mt-1">{success.name}</p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(`/routines/${success.id}`, { replace: true })}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Zap size={18} /> Ver Rutina
          </button>
          <button
            onClick={() => navigate('/routines', { replace: true })}
            className="btn-secondary w-full"
          >
            Ir a Mis Rutinas
          </button>
          <button
            onClick={() => { setSuccess(null); setRoutineName('') }}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            Generar otra rutina
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto overflow-hidden">
      <div className="text-center">
        <Zap size={40} className="text-purple-500 mx-auto mb-2" />
        <h1 className="text-2xl font-bold">Generar Rutina</h1>
        <p className="text-gray-500 text-sm">Crea tu rutina inteligente personalizada</p>
      </div>

      {user?.has_condition && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-300 text-sm">Modo Adaptativo Activo</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Tu rutina sera adaptada a tus condiciones medicas. Se ajustara el volumen, intensidad y descanso automaticamente.</p>
              {user.pathologies?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {user.pathologies.map((p, i) => (
                    <span key={i} className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-xs">{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div data-tour="gen-form" className="card space-y-5">
        <div>
          <label className="label">Nombre de la rutina *</label>
          <input
            className="input"
            value={routineName}
            onChange={e => setRoutineName(e.target.value)}
            placeholder="ej: Mi rutina de fuerza"
          />
          <p className="text-[11px] text-gray-400 mt-1">Ponle un nombre para encontrarla fácilmente</p>
        </div>

        <div>
          <label className="label">Objetivo</label>
          <select className="input" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
            <option value="hypertrophy">Ganar Músculo</option>
            <option value="strength">Fuerza</option>
            <option value="fat_loss">Perder Grasa</option>
            <option value="recomposition">Recomposición</option>
            <option value="endurance">Resistencia</option>
          </select>
        </div>

        {!isCustom && (
          <div>
            <label className="label">Días por semana: {form.days_per_week}</label>
            <input type="range" min="3" max="6" className="w-full accent-brand-500" value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: parseInt(e.target.value) })} />
            <div className="flex justify-between text-xs text-gray-400">
              <span>3</span><span>4</span><span>5</span><span>6</span>
            </div>
          </div>
        )}

        <div>
          <label className="label">Nivel</label>
          <select className="input" value={form.training_level} onChange={(e) => setForm({ ...form, training_level: e.target.value })}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        <div>
          <label className="label">Split preferido</label>
          <select className="input" value={form.split_preference || ''} onChange={(e) => setForm({ ...form, split_preference: e.target.value || null })}>
            <option value="">Automático</option>
            <option value="ppl">Push Pull Legs</option>
            <option value="upper_lower">Upper Lower</option>
            <option value="full_body">Full Body</option>
            <option value="bro_split">Bodybuilding Split</option>
            <option value="chest_back_legs_shoulders">Pecho/Espalda - Pierna - Hombro/Brazo</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {/* Custom split builder */}
        {isCustom && (
          <div className="space-y-3">
            <label className="label">Configura tus días ({customDays.length} días)</label>
            {customDays.map((day, idx) => (
              <div key={idx} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  {editingDayIndex === idx ? (
                    <input
                      className="input py-1 text-sm flex-1 mr-2"
                      value={day.name}
                      onChange={(e) => updateCustomDayName(idx, e.target.value)}
                      onBlur={() => setEditingDayIndex(null)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingDayIndex(null)}
                      autoFocus
                    />
                  ) : (
                    <button onClick={() => setEditingDayIndex(idx)} className="flex items-center gap-1.5 text-sm font-semibold">
                      {day.name} <Pencil size={12} className="text-gray-400" />
                    </button>
                  )}
                  {customDays.length > 2 && (
                    <button onClick={() => removeCustomDay(idx)} className="text-red-400 hover:text-red-500">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleCustomMuscle(idx, m)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        day.muscles.includes(m)
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {MUSCLE_LABELS[m]}
                    </button>
                  ))}
                </div>
                {day.muscles.length === 0 && (
                  <p className="text-[11px] text-red-400">Selecciona al menos 1 músculo</p>
                )}
              </div>
            ))}
            {customDays.length < 7 && (
              <button onClick={addCustomDay} type="button"
                className="w-full py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-400 hover:text-brand-500 hover:border-brand-500 transition-colors flex items-center justify-center gap-1.5">
                <Plus size={16} /> Agregar día
              </button>
            )}
          </div>
        )}

        {!isCustom && (
          <div>
            <label className="label">Músculos prioritarios</label>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMuscle(m)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    form.priority_muscles.includes(m)
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {MUSCLE_LABELS[m] || m}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={loading || !routineName.trim() || (isCustom && customDays.some(d => d.muscles.length === 0))}
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generando...</>
          ) : (
            <><Zap size={18} /> Generar Rutina</>
          )}
        </button>
      </div>

      <PageTour pageKey="generate-routine" steps={[
        { target: '[data-tour="gen-form"]', title: 'Configura tu rutina', description: 'Elige tu objetivo, días, nivel y tipo de split. Puedes crear uno personalizado eligiendo músculos por día.' },
      ]} />
    </div>
  )
}
