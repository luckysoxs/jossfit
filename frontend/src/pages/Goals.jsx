import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Target, Plus, Trash2 } from 'lucide-react'

const goalLabels = {
  fat_loss: 'Perder Grasa', muscle_gain: 'Ganar Músculo',
  recomposition: 'Recomposición', strength: 'Fuerza', endurance: 'Resistencia',
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    goal_type: 'muscle_gain', target_value: '', current_value: '', unit: 'kg', deadline: '',
  })

  const load = () => api.get('/goals').then((r) => setGoals(r.data)).finally(() => setLoading(false))
  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/goals', {
        ...form,
        target_value: parseFloat(form.target_value),
        current_value: parseFloat(form.current_value || 0),
        deadline: form.deadline || null,
      })
      setShowForm(false)
      setForm({ goal_type: 'muscle_gain', target_value: '', current_value: '', unit: 'kg', deadline: '' })
      load()
    } catch { alert('Error') }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Objetivos</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <select className="input" value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>
            {Object.entries(goalLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Meta</label>
              <input type="number" className="input" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} inputMode="decimal" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Actual</label>
              <input type="number" className="input" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} inputMode="decimal" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Unidad</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Fecha límite</label>
            <input type="date" className="input" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <button onClick={save} className="btn-primary w-full" disabled={saving || !form.target_value}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card text-center py-8">
          <Target size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 text-sm">No hay objetivos definidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-medium text-brand-500 uppercase">{goalLabels[g.goal_type] || g.goal_type}</span>
                  <p className="font-medium">{g.current_value} / {g.target_value} {g.unit}</p>
                </div>
                <button onClick={async () => { await api.delete(`/goals/${g.id}`); load() }} className="p-2 text-red-400"><Trash2 size={16} /></button>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${Math.min(g.progress_pct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{g.progress_pct}%</span>
                {g.deadline && <span>Meta: {new Date(g.deadline).toLocaleDateString('es-MX')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
