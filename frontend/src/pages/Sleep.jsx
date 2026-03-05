import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Moon, Plus, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Sleep() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], hours_slept: '', quality: 7, bedtime: '', wake_time: '', notes: '',
  })

  const load = () => {
    api.get('/sleep').then((r) => setLogs(r.data)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/sleep', {
        ...form,
        hours_slept: parseFloat(form.hours_slept),
        quality: parseInt(form.quality),
        bedtime: form.bedtime || null,
        wake_time: form.wake_time || null,
      })
      setShowForm(false)
      setForm({ date: new Date().toISOString().split('T')[0], hours_slept: '', quality: 7, bedtime: '', wake_time: '', notes: '' })
      load()
    } catch { alert('Error') }
    setSaving(false)
  }

  if (loading) return <LoadingSpinner />

  const chartData = [...logs].reverse().map((l) => ({
    date: new Date(l.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
    hours: l.hours_slept,
    quality: l.quality,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sueño</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Registrar
        </button>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Tendencia de Sueño</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={2} name="Horas" />
              <Line type="monotone" dataKey="quality" stroke="#f97316" strokeWidth={2} name="Calidad" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {showForm && (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Horas dormidas</label>
              <input type="number" className="input" value={form.hours_slept} onChange={(e) => setForm({ ...form, hours_slept: e.target.value })} placeholder="7.5" inputMode="decimal" step="0.5" />
            </div>
          </div>
          <div>
            <label className="label">Calidad (1-10): {form.quality}</label>
            <input type="range" min="1" max="10" className="w-full accent-brand-500" value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hora de dormir</label>
              <input type="time" className="input" value={form.bedtime} onChange={(e) => setForm({ ...form, bedtime: e.target.value })} />
            </div>
            <div>
              <label className="label">Hora de despertar</label>
              <input type="time" className="input" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} />
            </div>
          </div>
          <textarea className="input" rows={2} placeholder="Notas..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button onClick={save} className="btn-primary w-full" disabled={saving || !form.hours_slept}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {logs.length === 0 ? (
        <div className="card text-center py-8">
          <Moon size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 text-sm">No hay registros de sueño</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{l.hours_slept}h · Calidad {l.quality}/10</p>
                <p className="text-xs text-gray-400">
                  {new Date(l.date).toLocaleDateString('es-MX')}
                  {l.bedtime && ` · ${l.bedtime} → ${l.wake_time}`}
                </p>
              </div>
              <button onClick={async () => { await api.delete(`/sleep/${l.id}`); load() }} className="p-2 text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
