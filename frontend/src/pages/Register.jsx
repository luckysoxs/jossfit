import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Flame, ArrowLeft, ArrowRight } from 'lucide-react'

export default function Register() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    email: '', password: '', name: '', age: '',
    sex: 'male', height_cm: '', weight_kg: '',
    training_level: 'beginner', fitness_goal: 'hypertrophy',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

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
      })
      navigate('/')
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
              <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={() => setStep(2)}>
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
                <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={() => setStep(3)}>
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
    </div>
  )
}
