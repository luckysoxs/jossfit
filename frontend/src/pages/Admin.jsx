import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Shield, Users, Activity, UserPlus, Dumbbell, Search,
  ChevronLeft, ChevronRight, X, Trash2, ShieldCheck, ShieldOff,
  Calendar, Mail, Phone, Target, TrendingUp, Eye,
  Ruler, Weight, Brain, Moon, Pill, Trophy, BarChart3,
  Award, Plus, Edit3, ToggleLeft, ToggleRight, ExternalLink, Tag, Percent,
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, color = 'brand' }) {
  const colors = {
    brand: 'bg-brand-50 dark:bg-brand-500/10 text-brand-500',
    green: 'bg-green-50 dark:bg-green-500/10 text-green-500',
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-50 dark:bg-purple-500/10 text-purple-500',
    red: 'bg-red-50 dark:bg-red-500/10 text-red-500',
  }
  return (
    <div className="card p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}

function UserDetailModal({ userId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/admin/users/${userId}`)
        setDetail(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [userId])

  const toggleAdmin = async () => {
    try {
      await api.put(`/admin/users/${userId}`, { is_admin: !detail.user.is_admin })
      setDetail({ ...detail, user: { ...detail.user, is_admin: !detail.user.is_admin } })
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  const deleteUser = async () => {
    try {
      await api.delete(`/admin/users/${userId}`)
      onClose()
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-3 text-sm text-gray-500">Cargando datos...</p>
      </div>
    </div>
  )

  if (!detail) return null

  const { user, stats, workouts, routines, body_metrics, nutrition_logs, sleep_logs, supplements, goals } = detail

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: Users },
    { id: 'workouts', label: `Workouts (${stats.total_workouts})`, icon: Dumbbell },
    { id: 'routines', label: `Rutinas (${stats.total_routines})`, icon: BarChart3 },
    { id: 'metrics', label: `Métricas (${stats.total_body_metrics})`, icon: Ruler },
    { id: 'nutrition', label: `Nutrición (${stats.total_nutrition_logs})`, icon: Target },
    { id: 'sleep', label: `Sueño (${stats.total_sleep_logs})`, icon: Moon },
    { id: 'supplements', label: `Suplementos (${stats.total_supplements})`, icon: Pill },
    { id: 'goals', label: `Objetivos (${stats.total_goals})`, icon: Trophy },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center text-white text-lg font-bold">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{user.name}</h2>
                {user.is_admin && <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full">Admin</span>}
              </div>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
          {tabs.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <TabIcon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoItem label="Edad" value={`${user.age} años`} />
                <InfoItem label="Sexo" value={user.sex === 'male' ? 'Masculino' : 'Femenino'} />
                <InfoItem label="Altura" value={`${user.height_cm} cm`} />
                <InfoItem label="Peso" value={`${user.weight_kg} kg`} />
                <InfoItem label="Nivel" value={user.training_level} />
                <InfoItem label="Objetivo" value={user.fitness_goal || '-'} />
                <InfoItem label="Teléfono" value={user.phone ? `${user.country_code} ${user.phone}` : 'No registrado'} />
                <InfoItem label="Registrado" value={new Date(user.created_at).toLocaleDateString('es-MX')} />
                <InfoItem label="Total Workouts" value={stats.total_workouts} />
                <InfoItem label="Duración Promedio" value={stats.avg_workout_duration ? `${stats.avg_workout_duration} min` : '-'} />
                <InfoItem label="Último Workout" value={stats.last_workout_date || 'Ninguno'} />
                <InfoItem label="Último Peso" value={stats.latest_weight ? `${stats.latest_weight} kg` : '-'} />
              </div>

              {/* Admin Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={toggleAdmin} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-colors ${
                  user.is_admin
                    ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 hover:bg-yellow-100'
                    : 'bg-brand-50 dark:bg-brand-500/10 text-brand-500 hover:bg-brand-100'
                }`}>
                  {user.is_admin ? <><ShieldOff size={16} /> Quitar Admin</> : <><ShieldCheck size={16} /> Hacer Admin</>}
                </button>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={16} /> Eliminar Usuario
                  </button>
                ) : (
                  <button onClick={deleteUser} className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors">
                    <Trash2 size={16} /> Confirmar Eliminación
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'workouts' && (
            <DataList
              items={workouts}
              emptyText="Sin workouts registrados"
              renderItem={(w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{w.date}</p>
                    <p className="text-xs text-gray-500">{w.duration_minutes} min • Fatiga: {w.fatigue_level}/10</p>
                  </div>
                  {w.notes && <p className="text-xs text-gray-400 max-w-[200px] truncate">{w.notes}</p>}
                </div>
              )}
            />
          )}

          {activeTab === 'routines' && (
            <DataList
              items={routines}
              emptyText="Sin rutinas creadas"
              renderItem={(r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.split_type} • {r.days_per_week} días/semana</p>
                  </div>
                </div>
              )}
            />
          )}

          {activeTab === 'metrics' && (
            <DataList
              items={body_metrics}
              emptyText="Sin métricas corporales"
              renderItem={(m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{m.date}</p>
                    <p className="text-xs text-gray-500">
                      Peso: {m.weight_kg} kg
                      {m.body_fat_pct && ` • Grasa: ${m.body_fat_pct}%`}
                      {m.muscle_mass_kg && ` • Músculo: ${m.muscle_mass_kg} kg`}
                    </p>
                  </div>
                </div>
              )}
            />
          )}

          {activeTab === 'nutrition' && (
            <DataList
              items={nutrition_logs}
              emptyText="Sin registros de nutrición"
              renderItem={(n) => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{n.date} - {n.meal_type}</p>
                    <p className="text-xs text-gray-500">{n.calories} kcal • {n.protein_g}g proteína</p>
                  </div>
                </div>
              )}
            />
          )}

          {activeTab === 'sleep' && (
            <DataList
              items={sleep_logs}
              emptyText="Sin registros de sueño"
              renderItem={(s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{s.date}</p>
                    <p className="text-xs text-gray-500">{s.hours_slept}h • Calidad: {s.quality}/10</p>
                  </div>
                </div>
              )}
            />
          )}

          {activeTab === 'supplements' && (
            <DataList
              items={supplements}
              emptyText="Sin suplementos"
              renderItem={(s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.dose} • {s.active ? 'Activo' : 'Inactivo'}</p>
                  </div>
                </div>
              )}
            />
          )}

          {activeTab === 'goals' && (
            <DataList
              items={goals}
              emptyText="Sin objetivos"
              renderItem={(g) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <p className="font-medium text-sm">{g.goal_type}</p>
                    <p className="text-xs text-gray-500">
                      {g.current_value}/{g.target_value} • Estado: {g.status}
                    </p>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-medium text-sm capitalize">{value}</p>
    </div>
  )
}

function DataList({ items, emptyText, renderItem }) {
  if (!items || items.length === 0) {
    return <p className="text-center text-gray-400 py-8 text-sm">{emptyText}</p>
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>
}

const LEVEL_LABELS = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

const GOAL_LABELS = {
  hypertrophy: 'Músculo',
  fat_loss: 'Fat Loss',
  strength: 'Fuerza',
  recomposition: 'Recomp',
  endurance: 'Resistencia',
}

const PARTNER_CATEGORIES = [
  { value: 'suplementos', label: 'Suplementos' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'alimentos', label: 'Alimentos' },
  { value: 'equipo', label: 'Equipo' },
  { value: 'servicios', label: 'Servicios' },
  { value: 'otro', label: 'Otro' },
]

function PartnerModal({ partner, onClose, onSave }) {
  const isEdit = !!partner?.id
  const [form, setForm] = useState({
    name: partner?.name || '',
    description: partner?.description || '',
    discount_text: partner?.discount_text || '',
    promo_code: partner?.promo_code || '',
    external_url: partner?.external_url || '',
    category: partner?.category || 'suplementos',
    active: partner?.active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.external_url.trim()) return
    setSaving(true)
    try {
      await onSave(form, partner?.id)
      onClose()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al guardar')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold">{isEdit ? 'Editar Partner' : 'Nuevo Partner'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nombre *</label>
            <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del partner" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
            <input className="input w-full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción breve" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Texto Descuento</label>
              <input className="input w-full" value={form.discount_text} onChange={(e) => setForm({ ...form, discount_text: e.target.value })} placeholder="15% de descuento" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Código Promo</label>
              <input className="input w-full" value={form.promo_code} onChange={(e) => setForm({ ...form, promo_code: e.target.value })} placeholder="JOSSFIT15" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL Externa *</label>
            <input className="input w-full" value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Categoría</label>
              <select className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {PARTNER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  form.active ? 'bg-green-50 dark:bg-green-500/10 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}
              >
                {form.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {form.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PartnersSection() {
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPartner, setEditPartner] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const fetchPartners = async () => {
    try {
      const res = await api.get('/admin/partners')
      setPartners(res.data)
    } catch (err) {
      console.error('Partners error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPartners() }, [])

  const handleSave = async (form, id) => {
    if (id) {
      await api.put(`/admin/partners/${id}`, form)
    } else {
      await api.post('/admin/partners', form)
    }
    fetchPartners()
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/partners/${id}`)
      setConfirmDeleteId(null)
      fetchPartners()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  const toggleActive = async (partner) => {
    try {
      await api.put(`/admin/partners/${partner.id}`, {
        ...partner,
        active: !partner.active,
      })
      fetchPartners()
    } catch (err) {
      alert('Error al cambiar estado')
    }
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
    </div>
  )

  const categoryLabel = (cat) => PARTNER_CATEGORIES.find(c => c.value === cat)?.label || cat

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{partners.length} partners registrados</p>
        <button
          onClick={() => { setEditPartner(null); setShowModal(true) }}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Agregar Partner
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Award size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin partners</p>
          <p className="text-sm">Agrega tu primer partner para mostrar en Beneficios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((p) => (
            <div key={p.id} className="card flex items-center gap-4">
              {/* Partner Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm truncate">{p.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.active ? 'bg-green-50 dark:bg-green-500/10 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-500 font-medium">
                    {categoryLabel(p.category)}
                  </span>
                </div>
                {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  {p.promo_code && (
                    <span className="flex items-center gap-1"><Tag size={12} /> {p.promo_code}</span>
                  )}
                  {p.discount_text && (
                    <span className="flex items-center gap-1"><Percent size={12} /> {p.discount_text}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(p)}
                  className={`p-2 rounded-lg transition-colors ${
                    p.active ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={p.active ? 'Desactivar' : 'Activar'}
                >
                  {p.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                </button>
                <a
                  href={p.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Ver sitio"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => { setEditPartner(p); setShowModal(true) }}
                  className="p-2 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Editar"
                >
                  <Edit3 size={16} />
                </button>
                {confirmDeleteId === p.id ? (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors text-xs font-medium"
                    title="Confirmar eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PartnerModal
          partner={editPartner}
          onClose={() => { setShowModal(false); setEditPartner(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [mainTab, setMainTab] = useState('users')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 1, per_page: 20 })
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTimeout, setSearchTimeout] = useState(null)

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data)
    } catch (err) {
      console.error('Stats error:', err)
    }
  }

  const fetchUsers = useCallback(async (page = 1, searchTerm = '', level = '') => {
    try {
      const params = { page, per_page: 20 }
      if (searchTerm) params.search = searchTerm
      if (level) params.training_level = level
      const res = await api.get('/admin/users', { params })
      setUsers(res.data.users)
      setPagination({
        page: res.data.page,
        total: res.data.total,
        total_pages: res.data.total_pages,
        per_page: res.data.per_page,
      })
    } catch (err) {
      console.error('Users error:', err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchUsers()])
      setLoading(false)
    }
    init()
  }, [])

  const handleSearch = (value) => {
    setSearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => {
      fetchUsers(1, value, levelFilter)
    }, 400))
  }

  const handleLevelFilter = (value) => {
    setLevelFilter(value)
    fetchUsers(1, search, value)
  }

  const handleRefresh = () => {
    fetchStats()
    fetchUsers(pagination.page, search, levelFilter)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <Shield size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Panel de Administración</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Gestión completa de Fitness Jos</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-1">
        {[
          { id: 'users', label: 'Usuarios', icon: Users },
          { id: 'partners', label: 'Partners', icon: Award },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mainTab === id
                ? 'bg-brand-500 text-white'
                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <TabIcon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Partners Tab */}
      {mainTab === 'partners' && <PartnersSection />}

      {/* Users Tab */}
      {mainTab === 'users' && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Total Usuarios" value={stats.total_users} color="brand" />
          <StatCard icon={Activity} label="Activos Hoy" value={stats.active_users_today} color="green" />
          <StatCard icon={Dumbbell} label="Workouts Semana" value={stats.workouts_this_week} color="blue" />
          <StatCard icon={UserPlus} label="Nuevos Semana" value={stats.new_users_this_week} color="purple" />
          <StatCard icon={TrendingUp} label="Prom/Usuario" value={stats.avg_workouts_per_user} color="brand" />
          <StatCard icon={Calendar} label="Nuevos Mes" value={stats.new_users_this_month} color="green" />
        </div>
      )}

      {/* Distributions */}
      {mainTab === 'users' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Nivel de Entrenamiento</h3>
            {Object.entries(stats.training_level_distribution).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600 dark:text-gray-400 capitalize">{LEVEL_LABELS[level] || level}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Distribución por Sexo</h3>
            {Object.entries(stats.sex_distribution).map(([sex, count]) => (
              <div key={sex} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600 dark:text-gray-400">{sex === 'male' ? 'Masculino' : 'Femenino'}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-2">Objetivos</h3>
            {Object.entries(stats.goal_distribution).map(([goal, count]) => (
              <div key={goal} className="flex items-center justify-between text-sm py-1">
                <span className="text-gray-600 dark:text-gray-400">{GOAL_LABELS[goal] || goal}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Section */}
      {mainTab === 'users' && <div className="card">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 w-full"
                placeholder="Buscar por nombre, email o teléfono..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-full sm:w-40"
              value={levelFilter}
              onChange={(e) => handleLevelFilter(e.target.value)}
            >
              <option value="">Todos los niveles</option>
              <option value="beginner">Principiante</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-2">{pagination.total} usuarios encontrados</p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="p-3 font-medium">Usuario</th>
                <th className="p-3 font-medium hidden sm:table-cell">Teléfono</th>
                <th className="p-3 font-medium">Nivel</th>
                <th className="p-3 font-medium hidden md:table-cell">Registro</th>
                <th className="p-3 font-medium text-center">Workouts</th>
                <th className="p-3 font-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 text-xs font-bold shrink-0">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-medium truncate">{u.name}</p>
                          {u.is_admin && <Shield size={12} className="text-brand-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell text-gray-500">
                    {u.phone ? `${u.country_code} ${u.phone}` : '-'}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.training_level === 'advanced'
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                        : u.training_level === 'intermediate'
                        ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600'
                        : 'bg-green-50 dark:bg-green-500/10 text-green-500'
                    }`}>
                      {LEVEL_LABELS[u.training_level] || u.training_level}
                    </span>
                  </td>
                  <td className="p-3 hidden md:table-cell text-gray-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="p-3 text-center font-semibold">
                    {u.total_workouts}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedUserId(u.id) }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-brand-500"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">No se encontraron usuarios</p>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => fetchUsers(pagination.page - 1, search, levelFilter)}
              disabled={pagination.page <= 1}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span className="text-sm text-gray-500">
              Página {pagination.page} de {pagination.total_pages}
            </span>
            <button
              onClick={() => fetchUsers(pagination.page + 1, search, levelFilter)}
              disabled={pagination.page >= pagination.total_pages}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>}

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
