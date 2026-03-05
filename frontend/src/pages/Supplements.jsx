import { useState, useEffect } from 'react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Pill, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'

export default function Supplements() {
  const [supps, setSupps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', dose: '', schedule: '', notes: '' })

  const load = () => api.get('/supplements').then((r) => setSupps(r.data)).finally(() => setLoading(false))
  useEffect(load, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/supplements', form)
      setShowForm(false)
      setForm({ name: '', dose: '', schedule: '', notes: '' })
      load()
    } catch { alert('Error') }
    setSaving(false)
  }

  const toggleActive = async (s) => {
    await api.put(`/supplements/${s.id}`, { active: !s.active })
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suplementos</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus size={18} /> Agregar
        </button>
      </div>

      {showForm && (
        <div className="card space-y-3">
          <input className="input" placeholder="Nombre (ej: Creatina)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Dosis (ej: 5g)" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} />
            <input className="input" placeholder="Horario (ej: Post-entreno)" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} />
          </div>
          <textarea className="input" rows={2} placeholder="Notas..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button onClick={save} className="btn-primary w-full" disabled={saving || !form.name}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      )}

      {supps.length === 0 ? (
        <div className="card text-center py-8">
          <Pill size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 text-sm">No hay suplementos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {supps.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleActive(s)}>
                  {s.active ? <CheckCircle2 size={20} className="text-green-500" /> : <XCircle size={20} className="text-gray-400" />}
                </button>
                <div>
                  <p className={`font-medium ${!s.active ? 'line-through text-gray-400' : ''}`}>{s.name}</p>
                  <p className="text-xs text-gray-400">{s.dose}{s.schedule ? ` · ${s.schedule}` : ''}</p>
                </div>
              </div>
              <button onClick={async () => { await api.delete(`/supplements/${s.id}`); load() }} className="p-2 text-red-400"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
