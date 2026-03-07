import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { User, LogOut, Sun, Moon, Save, Mail, Ruler, Weight, Calendar, CheckCircle, Palette, Bell, BellOff, HeartPulse, X, Plus } from 'lucide-react'
import { ACCENT_COLORS, applyAccentColor } from '../data/accentColors'
import PageTour from '../components/ui/PageTour'
import { requestNotificationPermission, subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '../services/pushNotifications'

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
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

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled)
  }, [])

  const togglePush = async () => {
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        const permitted = await requestNotificationPermission()
        if (permitted) {
          const ok = await subscribeToPush()
          setPushEnabled(ok)
        }
      }
    } catch {}
    setPushLoading(false)
  }

  // Medical conditions state
  const [medicalForm, setMedicalForm] = useState({
    has_condition: user?.has_condition || false,
    pathologies: user?.pathologies || [],
    medications: user?.medications || [],
    mobility_limitations: user?.mobility_limitations || [],
  })
  const [medicalEditing, setMedicalEditing] = useState(false)
  const [medicalSaving, setMedicalSaving] = useState(false)
  const [medicalTagInputs, setMedicalTagInputs] = useState({ pathologies: '', medications: '', mobility_limitations: '' })

  const addMedicalTag = (field) => {
    const val = medicalTagInputs[field].trim()
    if (!val || medicalForm[field].includes(val)) return
    setMedicalForm({ ...medicalForm, [field]: [...medicalForm[field], val] })
    setMedicalTagInputs({ ...medicalTagInputs, [field]: '' })
  }

  const removeMedicalTag = (field, idx) => {
    setMedicalForm({ ...medicalForm, [field]: medicalForm[field].filter((_, i) => i !== idx) })
  }

  const saveMedical = async () => {
    setMedicalSaving(true)
    try {
      await updateUser(medicalForm)
      setMedicalEditing(false)
    } catch { alert('Error al actualizar') }
    setMedicalSaving(false)
  }

  const PATHOLOGY_SUGGESTIONS = ['Diabetes T2', 'Hipertension', 'Artritis reumatoide', 'Fibromialgia', 'Osteoporosis', 'Hernia discal']
  const MEDICATION_SUGGESTIONS = ['Metformina', 'Estatinas', 'Insulina', 'Beta bloqueadores', 'Corticosteroides', 'Antidepresivos']
  const LIMITATION_SUGGESTIONS = ['Rodilla', 'Espalda baja', 'Hombro', 'Cadera', 'Tobillo', 'Cuello']

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

      {/* Push Notifications */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          {pushEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          <span className="font-medium">Notificaciones</span>
        </div>
        <button
          onClick={togglePush}
          disabled={pushLoading}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            pushEnabled ? 'bg-brand-500' : 'bg-gray-300'
          }`}
        >
          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
            pushEnabled ? 'translate-x-7' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Accent Color */}
      <div data-tour="personalization" className="card">
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

      {/* Medical Conditions */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <HeartPulse size={20} className="text-red-500" />
            <span className="font-medium">Condiciones Medicas</span>
          </div>
          {!medicalEditing && (
            <button onClick={() => setMedicalEditing(true)} className="text-brand-500 text-sm font-medium">Editar</button>
          )}
        </div>

        {!medicalEditing ? (
          <div>
            {medicalForm.has_condition ? (
              <div className="space-y-2">
                {medicalForm.pathologies?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Patologias</p>
                    <div className="flex flex-wrap gap-1.5">
                      {medicalForm.pathologies.map((p, i) => (
                        <span key={i} className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-xs">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {medicalForm.medications?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Medicamentos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {medicalForm.medications.map((m, i) => (
                        <span key={i} className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs">{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                {medicalForm.mobility_limitations?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Limitaciones de movilidad</p>
                    <div className="flex flex-wrap gap-1.5">
                      {medicalForm.mobility_limitations.map((l, i) => (
                        <span key={i} className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin condiciones medicas registradas</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Tengo condicion medica</span>
              <button
                onClick={() => setMedicalForm({ ...medicalForm, has_condition: !medicalForm.has_condition })}
                className={`relative w-14 h-7 rounded-full transition-colors ${medicalForm.has_condition ? 'bg-red-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${medicalForm.has_condition ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {medicalForm.has_condition && (
              <div className="space-y-4">
                {[
                  { field: 'pathologies', label: 'Patologias', suggestions: PATHOLOGY_SUGGESTIONS, tagClass: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
                  { field: 'medications', label: 'Medicamentos', suggestions: MEDICATION_SUGGESTIONS, tagClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                  { field: 'mobility_limitations', label: 'Limitaciones de movilidad', suggestions: LIMITATION_SUGGESTIONS, tagClass: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' },
                ].map(({ field, label, suggestions, tagClass }) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {medicalForm[field].map((tag, i) => (
                        <span key={i} className={`${tagClass} px-2 py-0.5 rounded-full text-xs flex items-center gap-1`}>
                          {tag}
                          <button onClick={() => removeMedicalTag(field, i)} className="hover:opacity-70"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        value={medicalTagInputs[field]}
                        onChange={(e) => setMedicalTagInputs({ ...medicalTagInputs, [field]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMedicalTag(field))}
                        placeholder={`Agregar ${label.toLowerCase()}...`}
                      />
                      <button onClick={() => addMedicalTag(field)} className="btn-secondary px-3"><Plus size={16} /></button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestions.filter(s => !medicalForm[field].includes(s)).map(s => (
                        <button key={s} onClick={() => setMedicalForm({ ...medicalForm, [field]: [...medicalForm[field], s] })}
                          className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => {
                setMedicalEditing(false)
                setMedicalForm({ has_condition: user?.has_condition || false, pathologies: user?.pathologies || [], medications: user?.medications || [], mobility_limitations: user?.mobility_limitations || [] })
              }} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={saveMedical} className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={medicalSaving}>
                <Save size={16} /> {medicalSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
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

      {/* App Tour */}
      <div className="text-center">
        <button
          onClick={() => {
            localStorage.removeItem('tour_completed')
            navigate('/')
          }}
          className="text-sm text-brand-500 hover:underline"
        >
          Ver tour de la app
        </button>
      </div>

      <PageTour
        pageKey="profile"
        steps={[
          { target: '[data-tour="personalization"]', title: 'Personalizacion', description: 'Cambia el color de la app y modo oscuro/claro.', position: 'bottom' },
        ]}
      />

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
