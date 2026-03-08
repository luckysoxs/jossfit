import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Shield, Users, Activity, UserPlus, Dumbbell, Search,
  ChevronLeft, ChevronRight, X, Trash2, ShieldCheck, ShieldOff,
  Calendar, Mail, Phone, Target, TrendingUp, Eye,
  Ruler, Weight, Brain, Moon, Pill, Trophy, BarChart3,
  Award, Plus, Edit3, ToggleLeft, ToggleRight, ExternalLink, Tag, Percent,
  Bell, Send, MessageCircle, ChevronUp, ChevronDown, GripVertical, BookOpen, Clock,
  Lightbulb, Wrench, Bug, HelpCircle, CheckCircle2, MessageSquare,
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
    image_url: partner?.image_url || '',
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
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL Imagen / Foto</label>
            <input className="input w-full" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://ejemplo.com/foto.jpg" />
            {form.image_url && (
              <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
              </div>
            )}
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
  const [partnerStats, setPartnerStats] = useState({})
  const [expandedPartner, setExpandedPartner] = useState(null)
  const [partnerDetail, setPartnerDetail] = useState(null)

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

  const fetchPartnerStats = async () => {
    try {
      const res = await api.get('/benefits/partners/all-stats')
      setPartnerStats(res.data)
    } catch {}
  }

  const fetchPartnerDetail = async (partnerId) => {
    if (expandedPartner === partnerId) {
      setExpandedPartner(null)
      setPartnerDetail(null)
      return
    }
    try {
      const res = await api.get(`/benefits/partners/${partnerId}/stats`)
      setPartnerDetail(res.data)
      setExpandedPartner(partnerId)
    } catch {}
  }

  useEffect(() => { fetchPartners(); fetchPartnerStats() }, [])

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

  const movePartner = async (index, direction) => {
    const newList = [...partners]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newList.length) return
    ;[newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]]
    setPartners(newList)
    try {
      await api.put('/admin/partners/reorder', newList.map(p => p.id))
    } catch {
      fetchPartners() // revert on error
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
          {partners.map((p, idx) => {
            const pStats = partnerStats[String(p.id)]
            return (
              <div key={p.id} className="card">
                <div className="flex items-center gap-3">
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => movePartner(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded text-gray-400 hover:text-brand-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Subir"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => movePartner(idx, 1)}
                      disabled={idx === partners.length - 1}
                      className="p-1 rounded text-gray-400 hover:text-brand-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Bajar"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Image */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex') }} />
                    ) : (
                      <Award size={20} className="text-gray-400" />
                    )}
                  </div>

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

                {/* Stats bar */}
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => fetchPartnerDetail(p.id)}
                    className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors w-full"
                  >
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> {pStats?.unique_users || 0} usuarios
                    </span>
                    <span className="flex items-center gap-1">
                      <ExternalLink size={12} /> {pStats?.total_clicks || 0} clicks
                    </span>
                  </button>

                  {/* Expanded user details */}
                  {expandedPartner === p.id && partnerDetail && (
                    <div className="mt-2 space-y-1">
                      {partnerDetail.users.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic">Nadie ha hecho click en este enlace aún</p>
                      ) : (
                        partnerDetail.users.map(u => (
                          <div key={u.user_id} className="flex items-center justify-between text-[10px] bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                            <span className="font-medium text-gray-600 dark:text-gray-300">{u.user_name}</span>
                            <div className="flex items-center gap-3 text-gray-400">
                              <span>{u.clicks} {u.clicks === 1 ? 'click' : 'clicks'}</span>
                              <span>{new Date(u.last_click).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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

function NotificationsSection() {
  const [form, setForm] = useState({ title: '', body: '', url: '/' })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderResult, setReminderResult] = useState(null)

  const handleSend = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await api.post('/admin/notifications/send', form)
      setResult({ ok: true, sent: res.data.sent })
      setForm({ title: '', body: '', url: '/' })
    } catch (err) {
      setResult({ ok: false, msg: err.response?.data?.detail || 'Error al enviar' })
    }
    setSending(false)
  }

  const handleDailyReminder = async () => {
    setSendingReminder(true)
    setReminderResult(null)
    try {
      const res = await api.post('/admin/notifications/daily-reminder')
      setReminderResult({ ok: true, reminded: res.data.reminded, sent: res.data.sent })
    } catch (err) {
      setReminderResult({ ok: false, msg: err.response?.data?.detail || 'Error' })
    }
    setSendingReminder(false)
  }

  return (
    <div className="space-y-4">
      {/* Manual Push Sender */}
      <div className="card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Send size={18} /> Enviar Notificación Push
        </h3>
        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Título *</label>
            <input
              className="input w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Nueva función disponible!"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mensaje *</label>
            <textarea
              className="input w-full"
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Ej: Ya puedes crear rutinas manuales. Pruébalo ahora!"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL de destino</label>
            <input
              className="input w-full"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="/"
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={sending}
          >
            <Send size={16} /> {sending ? 'Enviando...' : 'Enviar a todos'}
          </button>
          {result && (
            <p className={`text-sm text-center ${result.ok ? 'text-green-500' : 'text-red-500'}`}>
              {result.ok ? `Enviado a ${result.sent} dispositivos` : result.msg}
            </p>
          )}
        </form>
      </div>

      {/* Daily Reminder */}
      <div className="card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Bell size={18} /> Recordatorio Diario
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Envía un push a usuarios que no han entrenado hoy.
        </p>
        <button
          onClick={handleDailyReminder}
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={sendingReminder}
        >
          <Bell size={16} /> {sendingReminder ? 'Enviando...' : 'Enviar recordatorio'}
        </button>
        {reminderResult && (
          <p className={`text-sm text-center mt-2 ${reminderResult.ok ? 'text-green-500' : 'text-red-500'}`}>
            {reminderResult.ok
              ? `${reminderResult.reminded} usuarios recordados (${reminderResult.sent} pushes enviados)`
              : reminderResult.msg}
          </p>
        )}
      </div>
    </div>
  )
}

function ChatSection() {
  const [conversations, setConversations] = useState([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [selectedChatUser, setSelectedChatUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const chatBottomRef = useRef(null)

  const fetchConversations = async () => {
    try {
      const res = await api.get('/admin/support/conversations')
      setConversations(res.data)
    } catch (err) {
      console.error('Conversations error:', err)
    } finally {
      setLoadingConvs(false)
    }
  }

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 15000)
    return () => clearInterval(interval)
  }, [])

  const openChat = async (userId) => {
    setSelectedChatUser(conversations.find(c => c.user_id === userId) || { user_id: userId })
    setLoadingChat(true)
    try {
      const res = await api.get(`/admin/support/conversations/${userId}`)
      setMessages(res.data)
      fetchConversations()
    } catch (err) {
      console.error(err)
    }
    setLoadingChat(false)
  }

  useEffect(() => {
    if (!selectedChatUser) return
    const interval = setInterval(() => {
      api.get(`/admin/support/conversations/${selectedChatUser.user_id}`)
        .then(res => setMessages(res.data))
        .catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [selectedChatUser])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleReply = async (e) => {
    e.preventDefault()
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      await api.post(`/admin/support/conversations/${selectedChatUser.user_id}`, {
        content: reply.trim(),
      })
      setReply('')
      const res = await api.get(`/admin/support/conversations/${selectedChatUser.user_id}`)
      setMessages(res.data)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar')
    }
    setSending(false)
  }

  if (loadingConvs) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (selectedChatUser) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedChatUser(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-500 transition-colors"
        >
          <ChevronLeft size={16} /> Volver a conversaciones
        </button>

        <div className="card">
          <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold">
              {selectedChatUser.user_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-semibold text-sm">{selectedChatUser.user_name || 'Usuario'}</p>
              <p className="text-xs text-gray-500">{selectedChatUser.user_email || ''}</p>
            </div>
          </div>

          <div className="p-4 max-h-[50vh] overflow-y-auto flex flex-col gap-3">
            {loadingChat ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Sin mensajes</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.is_from_admin
                      ? 'self-end bg-brand-500 text-white rounded-tr-sm'
                      : 'self-start bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${msg.is_from_admin ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <form onSubmit={handleReply} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Escribe tu respuesta..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                maxLength={1000}
              />
              <button
                type="submit"
                className="btn-primary px-4 flex items-center gap-2"
                disabled={sending || !reply.trim()}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{conversations.length} conversaciones</p>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin conversaciones</p>
          <p className="text-sm">Cuando un usuario envie un mensaje aparecera aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.user_id}
              onClick={() => openChat(conv.user_id)}
              className="w-full card p-4 flex items-center gap-3 text-left hover:ring-2 hover:ring-brand-500/30 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold shrink-0">
                {conv.user_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate">{conv.user_name}</p>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                    {new Date(conv.last_message_at).toLocaleString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{conv.last_message}</p>
              </div>
              {conv.unread_count > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const NOTE_CATEGORIES = ['general', 'nutricion', 'entrenamiento', 'suplementos', 'salud', 'motivacion']

function formatReadTime(seconds) {
  if (!seconds || seconds === 0) return '0s'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function NotesSection() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', category: 'general', scheduled_at: '', send_push: true })
  const [saving, setSaving] = useState(false)
  const [allStats, setAllStats] = useState({})
  const [expandedStats, setExpandedStats] = useState(null)
  const [detailStats, setDetailStats] = useState(null)

  const fetchNotes = async () => {
    try {
      const res = await api.get('/notes')
      setNotes(res.data)
    } catch (err) {
      console.error('Notes error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllStats = async () => {
    try {
      const res = await api.get('/notes/all-stats')
      setAllStats(res.data)
    } catch {}
  }

  const fetchDetailStats = async (noteId) => {
    if (expandedStats === noteId) {
      setExpandedStats(null)
      setDetailStats(null)
      return
    }
    try {
      const res = await api.get(`/notes/${noteId}/stats`)
      setDetailStats(res.data)
      setExpandedStats(noteId)
    } catch {}
  }

  useEffect(() => { fetchNotes(); fetchAllStats() }, [])

  const saveNote = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        content: form.content,
        category: form.category,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        send_push: form.send_push,
      }
      if (editing) {
        await api.put(`/notes/${editing}`, payload)
      } else {
        await api.post('/notes', payload)
      }
      setForm({ title: '', content: '', category: 'general', scheduled_at: '', send_push: true })
      setEditing(null)
      fetchNotes()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return
    await api.delete(`/notes/${id}`)
    fetchNotes()
  }

  // API returns naive UTC strings (no 'Z') — append 'Z' so JS interprets as UTC
  const asUTC = (str) => {
    if (!str) return null
    return str.endsWith('Z') || str.includes('+') ? str : str + 'Z'
  }

  const toLocalDatetime = (utcStr) => {
    if (!utcStr) return ''
    const d = new Date(asUTC(utcStr))
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${mo}-${da}T${h}:${mi}`
  }

  const fmtDate = (utcStr, opts) => {
    if (!utcStr) return ''
    return new Date(asUTC(utcStr)).toLocaleDateString('es-MX', opts)
  }

  const startEdit = (note) => {
    setEditing(note.id)
    setForm({
      title: note.title,
      content: note.content,
      category: note.category,
      scheduled_at: toLocalDatetime(note.scheduled_at),
      send_push: note.send_push !== false,
    })
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Cargando...</div>

  return (
    <div className="space-y-4">
      {/* Create/Edit form */}
      <div className="card space-y-3">
        <h3 className="font-bold text-sm">{editing ? 'Editar Nota' : 'Nueva Nota'}</h3>
        <input className="input" placeholder="Título de la nota" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <textarea className="input min-h-[120px]" placeholder="Contenido de la nota..." value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            <Calendar size={14} /> Programar publicación (opcional)
          </label>
          <input
            type="datetime-local"
            className="input text-sm"
            value={form.scheduled_at}
            onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
          />
          {form.scheduled_at && (
            <button onClick={() => setForm({ ...form, scheduled_at: '' })}
              className="text-[11px] text-red-400 hover:text-red-500 mt-1">
              Quitar programación (publicar ahora)
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.send_push}
            onChange={e => setForm({ ...form, send_push: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Enviar push notification</span>
        </label>
        <div className="flex gap-2">
          <button onClick={saveNote} disabled={saving || !form.title.trim() || !form.content.trim()}
            className="btn-primary flex items-center gap-2">
            <Send size={14} /> {saving ? 'Guardando...' : (editing ? 'Actualizar' : (form.scheduled_at ? 'Programar nota' : (form.send_push ? 'Publicar y notificar' : 'Publicar (solo in-app)')))}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ title: '', content: '', category: 'general', scheduled_at: '', send_push: true }) }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">Cancelar</button>
          )}
        </div>
        {!editing && !form.scheduled_at && form.send_push && <p className="text-[11px] text-gray-400">Se enviará push notification + notificación in-app a todos los usuarios.</p>}
        {!editing && !form.scheduled_at && !form.send_push && <p className="text-[11px] text-gray-400">Solo se creará notificación in-app (sin push notification).</p>}
        {!editing && form.scheduled_at && <p className="text-[11px] text-amber-500">La nota se publicará automáticamente en la fecha indicada. {form.send_push ? 'Se enviará push al publicarse.' : 'Solo notificación in-app al publicarse.'}</p>}
      </div>

      {/* Notes list */}
      <div className="space-y-2">
        {notes.map(note => {
          const isPending = note.scheduled_at && !note.published
          const stats = allStats[String(note.id)]
          return (
            <div key={note.id} className={`card ${isPending ? 'border border-amber-400/30 bg-amber-50/30 dark:bg-amber-500/5' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-semibold text-sm">{note.title}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500">{note.category}</span>
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Calendar size={10} /> Programada
                      </span>
                    )}
                    {note.published && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                        Publicada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{note.content}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-[10px] text-gray-400">
                      Creada: {fmtDate(note.created_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {note.updated_at && (
                      <p className="text-[10px] text-blue-400">
                        · Editada: {fmtDate(note.updated_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {isPending && (
                      <p className="text-[10px] text-amber-500 font-medium">
                        · Publica: {fmtDate(note.scheduled_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {note.published && note.scheduled_at && (
                      <p className="text-[10px] text-green-500">
                        · Publicada: {fmtDate(note.scheduled_at, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => startEdit(note)} className="p-1.5 text-gray-400 hover:text-brand-500"><Edit3 size={14} /></button>
                  <button onClick={() => deleteNote(note.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Stats bar */}
              {note.published && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => fetchDetailStats(note.id)}
                    className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors w-full"
                  >
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> {stats?.unique_readers || 0} lectores
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 size={12} /> {stats?.total_opens || 0} aperturas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {formatReadTime(stats?.avg_read_seconds || 0)} prom.
                    </span>
                  </button>

                  {/* Expanded reader details */}
                  {expandedStats === note.id && detailStats && (
                    <div className="mt-2 space-y-1">
                      {detailStats.readers.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic">Nadie ha abierto esta nota aún</p>
                      ) : (
                        detailStats.readers.map(r => (
                          <div key={r.user_id} className="flex items-center justify-between text-[10px] bg-gray-50 dark:bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                            <span className="font-medium text-gray-600 dark:text-gray-300">{r.user_name}</span>
                            <div className="flex items-center gap-3 text-gray-400">
                              <span>{r.opens} {r.opens === 1 ? 'vez' : 'veces'}</span>
                              <span>{formatReadTime(r.total_seconds)}</span>
                              <span>{fmtDate(r.last_opened, { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No hay notas publicadas</div>
        )}
      </div>
    </div>
  )
}

const MUSCLE_LABELS = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Abdominales',
  traps: 'Trapecios', forearms: 'Antebrazos', cardio: 'Cardio', full_body: 'Cuerpo Completo',
}
const CATEGORY_LABELS = { compound: 'Compuesto', isolation: 'Aislamiento', cardio: 'Cardio', mobility: 'Movilidad' }
const EQUIPMENT_LIST = ['Barbell', 'Dumbbells', 'Cable', 'Machine', 'Bodyweight', 'Smith Machine', 'Kettlebell', 'Bands', 'EZ Bar']

function ExercisesSection() {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [muscleFilter, setMuscleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEx, setEditingEx] = useState(null)
  const [form, setForm] = useState({ name: '', name_es: '', muscle_group: 'chest', category: 'compound', equipment: 'Barbell', secondary_muscles: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const fetchExercises = async () => {
    try {
      const res = await api.get('/exercises')
      setExercises(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Exercises error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchExercises() }, [])

  const openCreate = () => {
    setEditingEx(null)
    setForm({ name: '', name_es: '', muscle_group: 'chest', category: 'compound', equipment: 'Barbell', secondary_muscles: '' })
    setShowForm(true)
  }

  const openEdit = (ex) => {
    setEditingEx(ex)
    setForm({
      name: ex.name || '',
      name_es: ex.name_es || '',
      muscle_group: ex.muscle_group || 'chest',
      category: ex.category || 'compound',
      equipment: ex.equipment || 'Barbell',
      secondary_muscles: ex.secondary_muscles || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingEx) {
        await api.put(`/exercises/${editingEx.id}`, {
          name: form.name,
          name_es: form.name_es || null,
          muscle_group: form.muscle_group,
          category: form.category,
          equipment: form.equipment || null,
          secondary_muscles: form.secondary_muscles || null,
        })
      } else {
        await api.post('/exercises', {
          name: form.name,
          name_es: form.name_es || null,
          muscle_group: form.muscle_group,
          category: form.category,
          equipment: form.equipment || null,
        })
      }
      setShowForm(false)
      fetchExercises()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al guardar ejercicio')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/exercises/${id}`)
      setConfirmDeleteId(null)
      fetchExercises()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  const term = searchTerm.toLowerCase()
  let filtered = exercises.filter(e =>
    (e.name || '').toLowerCase().includes(term) ||
    (e.name_es || '').toLowerCase().includes(term)
  )
  if (muscleFilter) filtered = filtered.filter(e => e.muscle_group === muscleFilter)
  if (categoryFilter) filtered = filtered.filter(e => e.category === categoryFilter)

  // Group by muscle
  const grouped = {}
  filtered.forEach(e => {
    const g = e.muscle_group || 'other'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(e)
  })
  const sortedGroups = Object.keys(grouped).sort((a, b) =>
    (MUSCLE_LABELS[a] || a).localeCompare(MUSCLE_LABELS[b] || b)
  )

  return (
    <div className="space-y-4">
      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Ejercicios</h2>
          <p className="text-xs text-gray-400">{exercises.length} ejercicios en total</p>
        </div>
        <button onClick={openCreate}
          className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card p-3 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Buscar ejercicio..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} className="input pl-9 w-full text-sm" />
        </div>
        <div className="flex gap-2">
          <select className="input text-xs flex-1" value={muscleFilter}
            onChange={e => setMuscleFilter(e.target.value)}>
            <option value="">Todos los músculos</option>
            {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="input text-xs flex-1" value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Exercises List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map(group => (
            <div key={group}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-brand-500 uppercase tracking-wide">
                  {MUSCLE_LABELS[group] || group}
                </p>
                <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {grouped[group].length}
                </span>
              </div>
              <div className="space-y-1.5">
                {grouped[group].map(ex => (
                  <div key={ex.id} className="card p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ex.name_es || ex.name}</p>
                      {ex.name_es && <p className="text-[11px] text-gray-400 italic truncate">{ex.name}</p>}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">{CATEGORY_LABELS[ex.category] || ex.category}</span>
                        {ex.equipment && <span className="text-[10px] text-gray-400">· {ex.equipment}</span>}
                        {ex.secondary_muscles && <span className="text-[10px] text-gray-300">· {ex.secondary_muscles}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button onClick={() => openEdit(ex)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-brand-500 transition-colors">
                        <Edit3 size={14} />
                      </button>
                      {confirmDeleteId === ex.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(ex.id)}
                            className="text-[10px] text-red-500 font-bold px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded">
                            Sí
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] text-gray-400 font-bold px-2 py-1">
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(ex.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sortedGroups.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No se encontraron ejercicios</p>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 animate-in">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold">{editingEx ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre (EN)</label>
                <input type="text" className="input text-sm" placeholder="Ej: Dumbbell Sumo Squat"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nombre (ES)</label>
                <input type="text" className="input text-sm" placeholder="Ej: Sentadilla Sumo con Mancuerna"
                  value={form.name_es} onChange={e => setForm({ ...form, name_es: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Grupo Muscular</label>
                  <select className="input text-sm" value={form.muscle_group}
                    onChange={e => setForm({ ...form, muscle_group: e.target.value })}>
                    {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Categoría</label>
                  <select className="input text-sm" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Equipo</label>
                  <select className="input text-sm" value={form.equipment}
                    onChange={e => setForm({ ...form, equipment: e.target.value })}>
                    <option value="">Sin equipo</option>
                    {EQUIPMENT_LIST.map(eq => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Músc. Secundarios</label>
                  <input type="text" className="input text-sm" placeholder="Ej: glutes,hamstrings"
                    value={form.secondary_muscles} onChange={e => setForm({ ...form, secondary_muscles: e.target.value })} />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
                {saving ? (
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>{editingEx ? <Edit3 size={16} /> : <Plus size={16} />} {editingEx ? 'Guardar Cambios' : 'Crear Ejercicio'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────
   SUGGESTIONS SECTION
   ────────────────────────────────────────────────────────────────── */

const SUGGESTION_CATS = {
  mejora: { label: 'Mejora', icon: Wrench, color: 'bg-blue-500' },
  idea: { label: 'Idea', icon: Lightbulb, color: 'bg-yellow-500' },
  bug: { label: 'Bug', icon: Bug, color: 'bg-red-500' },
  otro: { label: 'Otro', icon: HelpCircle, color: 'bg-gray-500' },
}
const SUGGESTION_STATUS = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  visto: { label: 'Visto', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  implementado: { label: 'Implementado', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
}

function SuggestionsSection() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSuggestions = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await api.get('/admin/suggestions', { params })
      setSuggestions(res.data)
    } catch (err) {
      console.error('Error fetching suggestions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchSuggestions()
  }, [filter])

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/admin/suggestions/${id}`, { status })
      fetchSuggestions()
    } catch (err) {
      alert('Error al actualizar')
    }
  }

  const sendReply = async (id) => {
    if (!replyText.trim() || saving) return
    setSaving(true)
    try {
      await api.put(`/admin/suggestions/${id}`, { admin_reply: replyText.trim(), status: 'visto' })
      setReplyingId(null)
      setReplyText('')
      fetchSuggestions()
    } catch (err) {
      alert('Error al responder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'pendiente', label: 'Pendientes' },
          { id: 'visto', label: 'Vistas' },
          { id: 'implementado', label: 'Implementadas' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{suggestions.length} sugerencias</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="card p-8 text-center">
          <Lightbulb size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No hay sugerencias {filter !== 'all' ? 'con este filtro' : 'aún'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(s => {
            const cat = SUGGESTION_CATS[s.category] || SUGGESTION_CATS.otro
            const statusCfg = SUGGESTION_STATUS[s.status] || SUGGESTION_STATUS.pendiente
            const CatIcon = cat.icon
            return (
              <div key={s.id} className="card p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg ${cat.color} flex items-center justify-center`}>
                      <CatIcon size={14} className="text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-medium">{s.user_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{cat.label}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-700 dark:text-gray-300">{s.content}</p>
                <p className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>

                {/* Admin reply (if exists) */}
                {s.admin_reply && (
                  <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                    <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">Tu respuesta:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{s.admin_reply}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {s.status === 'pendiente' && (
                    <button onClick={() => updateStatus(s.id, 'visto')}
                      className="text-xs px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors flex items-center gap-1">
                      <Eye size={12} /> Marcar visto
                    </button>
                  )}
                  {s.status !== 'implementado' && (
                    <button onClick={() => updateStatus(s.id, 'implementado')}
                      className="text-xs px-3 py-1 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors flex items-center gap-1">
                      <CheckCircle2 size={12} /> Implementado
                    </button>
                  )}
                  <button onClick={() => { setReplyingId(replyingId === s.id ? null : s.id); setReplyText(s.admin_reply || '') }}
                    className="text-xs px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1">
                    <MessageSquare size={12} /> {s.admin_reply ? 'Editar respuesta' : 'Responder'}
                  </button>
                </div>

                {/* Reply form */}
                {replyingId === s.id && (
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      rows={2}
                      className="input flex-1 text-sm resize-none"
                    />
                    <button onClick={() => sendReply(s.id)} disabled={!replyText.trim() || saving}
                      className="btn-primary px-3 self-end">
                      {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Send size={16} />}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [mainTab, setMainTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    return ['users', 'partners', 'notifications', 'chat', 'notes', 'exercises', 'suggestions'].includes(tab) ? tab : 'users'
  })
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Gestión completa de JOSSFITness</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-1">
        {[
          { id: 'users', label: 'Usuarios', icon: Users },
          { id: 'partners', label: 'Partners', icon: Award },
          { id: 'notes', label: 'Notas', icon: BookOpen },
          { id: 'notifications', label: 'Push', icon: Bell },
          { id: 'chat', label: 'Chat', icon: MessageCircle },
          { id: 'exercises', label: 'Ejercicios', icon: Dumbbell },
          { id: 'suggestions', label: 'Ideas', icon: Lightbulb },
        ].map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => setMainTab(id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              mainTab === id
                ? 'bg-brand-500 text-white'
                : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <TabIcon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Notes Tab */}
      {mainTab === 'notes' && <NotesSection />}

      {/* Partners Tab */}
      {mainTab === 'partners' && <PartnersSection />}

      {/* Notifications Tab */}
      {mainTab === 'notifications' && <NotificationsSection />}

      {/* Chat Tab */}
      {mainTab === 'chat' && <ChatSection />}

      {/* Exercises Tab */}
      {mainTab === 'exercises' && <ExercisesSection />}

      {/* Suggestions Tab */}
      {mainTab === 'suggestions' && <SuggestionsSection />}

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
