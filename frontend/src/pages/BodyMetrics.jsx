import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Scale, Plus, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function BodyMetrics() {
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], weight_kg: '', body_fat_pct: '',
    muscle_mass_kg: '', waist_cm: '', chest_cm: '', arm_cm: '', leg_cm: '', notes: '',
  })

  const load = () => api.get('/body-metrics').then((r) => setMetrics(r.data)).finally(() => setLoading(false))
  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = { date: form.date }
      for (const [k, v] of Object.entries(form)) {
        if (k === 'date' || k === 'notes') continue
        payload[k] = v ? parseFloat(v) : null
      }
      payload.notes = form.notes || null
      await api.post('/body-metrics', payload)
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], weight_kg: '', body_fat_pct: '', muscle_mass_kg: '', waist_cm: '', chest_cm: '', arm_cm: '', leg_cm: '', notes: '' })
      load()
    } catch { alert('Error') }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const chartData = [...metrics].reverse().filter(m => m.weight_kg).map(m => ({
    date: new Date(m.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
    peso: m.weight_kg,
    grasa: m.body_fat_pct,
  }))

  const fields = [
    { key: 'weight_kg', label: 'Peso (kg)' }, { key: 'body_fat_pct', label: 'Grasa (%)' },
    { key: 'muscle_mass_kg', label: 'Músculo (kg)' }, { key: 'waist_cm', label: 'Cintura (cm)' },
    { key: 'chest_cm', label: 'Pecho (cm)' }, { key: 'arm_cm', label: 'Brazos (cm)' },
    { key: 'leg_cm', label: 'Piernas (cm)' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mediciones</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Registrar
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Evolución</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Line type="monotone" dataKey="peso" stroke="#f97316" strokeWidth={2} name="Peso" />
              {chartData.some(d => d.grasa) && <Line type="monotone" dataKey="grasa" stroke="#ef4444" strokeWidth={2} name="Grasa %" />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500">{f.label}</label>
                <input type="number" className="input" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} inputMode="decimal" />
              </div>
            ))}
          </div>
          <textarea className="input" rows={2} placeholder="Notas..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button onClick={save} className="btn-primary w-full" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="card text-center py-8"><Scale size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" /><p className="text-gray-500 text-sm">No hay mediciones</p></div>
      ) : (
        <div className="space-y-2">
          {metrics.map((m) => (
            <div key={m.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{m.weight_kg ? `${m.weight_kg} kg` : '—'}{m.body_fat_pct ? ` · ${m.body_fat_pct}% grasa` : ''}</p>
                <p className="text-xs text-gray-400">{new Date(m.date).toLocaleDateString('es-MX')}</p>
              </div>
              <button onClick={async () => { await api.delete(`/body-metrics/${m.id}`); load() }} className="p-2 text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
