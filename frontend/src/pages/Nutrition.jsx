import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Plus, UtensilsCrossed, Trash2 } from 'lucide-react'

export default function Nutrition() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    meal_type: 'breakfast', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '',
  })

  const loadDay = async (d) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/nutrition/summary/${d}`)
      setSummary(data)
    } catch { setSummary(null) }
    setLoading(false)
  }

  useEffect(() => { loadDay(date) }, [date])

  const saveMeal = async () => {
    setSaving(true)
    try {
      await api.post('/nutrition', {
        ...form, date,
        calories: form.calories ? parseFloat(form.calories) : null,
        protein_g: form.protein_g ? parseFloat(form.protein_g) : null,
        carbs_g: form.carbs_g ? parseFloat(form.carbs_g) : null,
        fat_g: form.fat_g ? parseFloat(form.fat_g) : null,
      })
      setShowForm(false)
      setForm({ meal_type: 'breakfast', description: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
      loadDay(date)
    } catch (err) { alert('Error al guardar') }
    setSaving(false)
  }

  const deleteMeal = async (id) => {
    await api.delete(`/nutrition/${id}`)
    loadDay(date)
  }

  const mealLabels = { breakfast: 'Desayuno', lunch: 'Comida', dinner: 'Cena', snack: 'Snack' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrición</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Agregar
        </button>
      </div>

      <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />

      {/* Daily Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Calorías', value: Math.round(summary.total_calories), color: 'text-brand-500' },
            { label: 'Proteína', value: `${Math.round(summary.total_protein)}g`, color: 'text-red-500' },
            { label: 'Carbos', value: `${Math.round(summary.total_carbs)}g`, color: 'text-blue-500' },
            { label: 'Grasa', value: `${Math.round(summary.total_fat)}g`, color: 'text-yellow-500' },
          ].map((s) => (
            <div key={s.label} className="card text-center py-3">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="card space-y-3">
          <select className="input" value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })}>
            <option value="breakfast">Desayuno</option>
            <option value="lunch">Comida</option>
            <option value="dinner">Cena</option>
            <option value="snack">Snack</option>
          </select>
          <input className="input" placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="input" placeholder="Calorías" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} inputMode="numeric" />
            <input type="number" className="input" placeholder="Proteína (g)" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} inputMode="decimal" />
            <input type="number" className="input" placeholder="Carbos (g)" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value })} inputMode="decimal" />
            <input type="number" className="input" placeholder="Grasa (g)" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} inputMode="decimal" />
          </div>
          <button onClick={saveMeal} className="btn-primary w-full" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Meals List */}
      {loading ? <LoadingSpinner /> : (
        summary?.meals?.length > 0 ? (
          <div className="space-y-2">
            {summary.meals.map((m) => (
              <div key={m.id} className="card flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-brand-500 uppercase">{mealLabels[m.meal_type]}</span>
                  <p className="font-medium text-sm">{m.description || '—'}</p>
                  <p className="text-xs text-gray-400">{m.calories || 0} cal · {m.protein_g || 0}p · {m.carbs_g || 0}c · {m.fat_g || 0}g</p>
                </div>
                <button onClick={() => deleteMeal(m.id)} className="p-2 text-red-400"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-8">
            <UtensilsCrossed size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 text-sm">No hay comidas registradas</p>
          </div>
        )
      )}
    </div>
  )
}
