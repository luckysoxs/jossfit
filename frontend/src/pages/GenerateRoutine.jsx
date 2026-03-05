import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Zap, Loader2 } from 'lucide-react'

const MUSCLES = ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abs', 'calves']

export default function GenerateRoutine() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    objective: user?.fitness_goal || 'hypertrophy',
    days_per_week: 4,
    training_level: user?.training_level || 'intermediate',
    priority_muscles: [],
    split_preference: null,
  })

  const toggleMuscle = (m) => {
    setForm({
      ...form,
      priority_muscles: form.priority_muscles.includes(m)
        ? form.priority_muscles.filter((x) => x !== m)
        : [...form.priority_muscles, m],
    })
  }

  const generate = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/ai/generate-routine', form)
      navigate(`/routines/${data.id}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al generar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <Zap size={40} className="text-purple-500 mx-auto mb-2" />
        <h1 className="text-2xl font-bold">Generar Rutina</h1>
        <p className="text-gray-500 text-sm">Crea tu rutina inteligente personalizada</p>
      </div>

      <div className="card space-y-5">
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

        <div>
          <label className="label">Días por semana: {form.days_per_week}</label>
          <input type="range" min="3" max="6" className="w-full accent-brand-500" value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: parseInt(e.target.value) })} />
          <div className="flex justify-between text-xs text-gray-400">
            <span>3</span><span>4</span><span>5</span><span>6</span>
          </div>
        </div>

        <div>
          <label className="label">Nivel</label>
          <select className="input" value={form.training_level} onChange={(e) => setForm({ ...form, training_level: e.target.value })}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </div>

        <div>
          <label className="label">Split preferido (opcional)</label>
          <select className="input" value={form.split_preference || ''} onChange={(e) => setForm({ ...form, split_preference: e.target.value || null })}>
            <option value="">Automático</option>
            <option value="ppl">Push Pull Legs</option>
            <option value="upper_lower">Upper Lower</option>
            <option value="full_body">Full Body</option>
            <option value="bro_split">Bodybuilding Split</option>
          </select>
        </div>

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
                {m}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Generando...</>
          ) : (
            <><Zap size={18} /> Generar Rutina</>
          )}
        </button>
      </div>
    </div>
  )
}
