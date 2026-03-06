import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Flame, ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react'

const COUNTRY_CODES = [
  { code: '+52', label: '🇲🇽 MX +52' },
  { code: '+1', label: '🇺🇸 US +1' },
  { code: '+34', label: '🇪🇸 ES +34' },
  { code: '+57', label: '🇨🇴 CO +57' },
  { code: '+54', label: '🇦🇷 AR +54' },
  { code: '+56', label: '🇨🇱 CL +56' },
  { code: '+55', label: '🇧🇷 BR +55' },
  { code: '+51', label: '🇵🇪 PE +51' },
]

export default function Register() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    email: '', password: '', name: '', age: '',
    sex: 'male', height_cm: '', weight_kg: '',
    training_level: 'beginner', fitness_goal: 'hypertrophy',
    phone: '', country_code: '+52',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [registeredData, setRegisteredData] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const validateStep1 = () => {
    if (!form.name.trim()) { setError('Ingresa tu nombre'); return false }
    if (!form.email.trim()) { setError('Ingresa tu email'); return false }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return false }
    setError('')
    return true
  }

  const validateStep2 = () => {
    if (!form.age || parseInt(form.age) < 13 || parseInt(form.age) > 100) { setError('Ingresa una edad válida (13-100)'); return false }
    if (!form.height_cm || parseFloat(form.height_cm) < 100 || parseFloat(form.height_cm) > 250) { setError('Ingresa una altura válida (100-250 cm)'); return false }
    if (!form.weight_kg || parseFloat(form.weight_kg) < 30 || parseFloat(form.weight_kg) > 300) { setError('Ingresa un peso válido (30-300 kg)'); return false }
    setError('')
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({
        ...form,
        age: parseInt(form.age),
        height_cm: parseFloat(form.height_cm),
        weight_kg: parseFloat(form.weight_kg),
        phone: form.phone || null,
      })
      setRegisteredData({ email: form.email, password: form.password })
      setShowSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Flame size={40} className="text-brand-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Crear Cuenta</h1>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-10 rounded-full transition-colors ${
                  s <= step ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={set('name')} placeholder="Tu nombre" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" required />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div>
                <label className="label">Teléfono <span className="text-gray-400 text-xs">(opcional)</span></label>
                <div className="flex gap-2">
                  <select
                    className="input w-32 text-sm"
                    value={form.country_code}
                    onChange={set('country_code')}
                  >
                    {COUNTRY_CODES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <input
                    className="input flex-1"
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="55 1234 5678"
                    inputMode="tel"
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={() => validateStep1() && setStep(2)}
              >
                Siguiente <ArrowRight size={18} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Edad</label>
                  <input className="input" type="number" value={form.age} onChange={set('age')} placeholder="25" required inputMode="numeric" />
                </div>
                <div>
                  <label className="label">Sexo</label>
                  <select className="input" value={form.sex} onChange={set('sex')}>
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Altura (cm)</label>
                  <input className="input" type="number" value={form.height_cm} onChange={set('height_cm')} placeholder="175" required inputMode="decimal" />
                </div>
                <div>
                  <label className="label">Peso (kg)</label>
                  <input className="input" type="number" value={form.weight_kg} onChange={set('weight_kg')} placeholder="75" required inputMode="decimal" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={() => setStep(1)}>
                  <ArrowLeft size={18} /> Atrás
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  onClick={() => validateStep2() && setStep(3)}
                >
                  Siguiente <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="label">Nivel de entrenamiento</label>
                <select className="input" value={form.training_level} onChange={set('training_level')}>
                  <option value="beginner">Principiante</option>
                  <option value="intermediate">Intermedio</option>
                  <option value="advanced">Avanzado</option>
                </select>
              </div>
              <div>
                <label className="label">Objetivo principal</label>
                <select className="input" value={form.fitness_goal} onChange={set('fitness_goal')}>
                  <option value="hypertrophy">Ganar Músculo</option>
                  <option value="fat_loss">Perder Grasa</option>
                  <option value="strength">Mejorar Fuerza</option>
                  <option value="recomposition">Recomposición Corporal</option>
                  <option value="endurance">Mejorar Resistencia</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1 flex items-center justify-center gap-2" onClick={() => setStep(2)}>
                  <ArrowLeft size={18} /> Atrás
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-brand-500 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 border border-gray-100 dark:border-gray-800 animate-in">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={36} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold">¡Registro Exitoso!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tu cuenta ha sido creada correctamente</p>

            <div className="space-y-3 text-left bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p>
                <p className="font-medium text-sm">{registeredData?.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Contraseña</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm font-mono tracking-wider">
                    {showPassword ? registeredData?.password : '••••••••'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="btn-primary w-full"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
