import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { User, LogOut, Sun, Moon, Save, Mail, Ruler, Weight, Calendar, CheckCircle, Palette } from 'lucide-react'
import { ACCENT_COLORS, applyAccentColor } from '../data/accentColors'

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    age: user?.age || '',
    height_cm: user?.height_cm || '',
    weight_kg: user?.weight_kg || '',
    training_level: user?.training_level || 'beginner',
    fitness_goal: user?.fitness_goal || '',
    accent_color: user?.accent_color || 'blue',
  })

  const save = async () => {
    setSaving(true)
    try {
      await updateUser({
        ...form,
        age: parseInt(form.age),
        height_cm: parseFloat(form.height_cm),
        weight_kg: parseFloat(form.weight_kg),
      })
      setEditing(false)
    } catch { alert('Error al actualizar') }
    setSaving(false)
  }

  const levelLabels = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{user?.name}</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <span className="inline-block mt-2 px-3 py-1 bg-brand-50 dark:bg-brand-500/10 text-brand-500 rounded-full text-xs font-medium">
          {levelLabels[user?.training_level] || user?.training_level}
        </span>
      </div>

      {/* Theme Toggle */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          <span className="font-medium">Modo {theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
        </div>
        <button
          onClick={toggleTheme}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            theme === 'dark' ? 'bg-brand-500' : 'bg-gray-300'
          }`}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            theme === 'dark' ? 'translate-x-7' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Accent Color */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <Palette size={20} />
          <span className="font-medium">Color de la App</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {Object.entries(ACCENT_COLORS).map(([name, palette]) => (
            <button
              key={name}
              onClick={async () => {
                applyAccentColor(name)
                setForm({ ...form, accent_color: name })
                try {
                  await updateUser({ accent_color: name })
                } catch {}
              }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                (user?.accent_color || 'blue') === name ? 'ring-2 ring-offset-2 ring-offset-gray-950 ring-white scale-110' : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: palette[500] }}
            >
              {(user?.accent_color || 'blue') === name && <CheckCircle size={16} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!editing && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Datos Personales</h3>
            <button onClick={() => setEditing(true)} className="text-brand-500 text-sm font-medium">Editar</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Calendar, label: 'Edad', value: `${user?.age} años` },
              { icon: Ruler, label: 'Altura', value: `${user?.height_cm} cm` },
              { icon: Weight, label: 'Peso', value: `${user?.weight_kg} kg` },
              { icon: User, label: 'Sexo', value: user?.sex === 'male' ? 'Masculino' : 'Femenino' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <Icon size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-medium text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Editar Perfil</h3>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Edad</label>
              <input type="number" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} inputMode="numeric" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Altura (cm)</label>
              <input type="number" className="input" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} inputMode="decimal" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Peso (kg)</label>
              <input type="number" className="input" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} inputMode="decimal" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Nivel</label>
            <select className="input" value={form.training_level} onChange={(e) => setForm({ ...form, training_level: e.target.value })}>
              <option value="beginner">Principiante</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={save} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 p-3 text-red-500 font-medium bg-red-50 dark:bg-red-500/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
      >
        <LogOut size={18} /> Cerrar Sesión
      </button>
    </div>
  )
}
