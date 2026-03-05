import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  Dumbbell, Flame, Timer, TrendingUp, Heart, Moon, Scale, Zap,
  ChevronRight, Target, ShoppingBag, Award,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  const d = data || {}

  const quickLinks = [
    { to: '/workouts', icon: Dumbbell, label: 'Nuevo Entreno', color: 'bg-brand-500' },
    { to: '/routines/generate', icon: Zap, label: 'Generar Rutina', color: 'bg-purple-500' },
    { to: '/goals', icon: Target, label: 'Objetivos', color: 'bg-green-500' },
    { to: '/store', icon: ShoppingBag, label: 'Tienda', color: 'bg-blue-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          Hola, {user?.name?.split(' ')[0]} 💪
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-2">
        {quickLinks.map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-transform"
          >
            <div className={`p-2 rounded-xl ${color} text-white`}>
              <Icon size={18} />
            </div>
            <span className="text-xs font-medium text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Dumbbell} label="Entrenamientos" value={d.total_workouts || 0} color="brand" />
        <StatCard icon={Flame} label="Esta semana" value={d.workouts_this_week || 0} color="red" />
        <StatCard icon={Timer} label="Duración prom." value={`${d.avg_workout_duration || 0}m`} color="blue" />
        <StatCard icon={TrendingUp} label="Racha actual" value={`${d.current_streak || 0}d`} color="green" />
      </div>

      {/* Recovery Score */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Heart size={18} className="text-red-500" /> Recuperación
          </h3>
          <span className={`text-2xl font-bold ${
            (d.recovery_score || 0) >= 70 ? 'text-green-500' :
            (d.recovery_score || 0) >= 40 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {d.recovery_score || 0}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              (d.recovery_score || 0) >= 70 ? 'bg-green-500' :
              (d.recovery_score || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${d.recovery_score || 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Sueño: {d.avg_sleep_hours ? `${d.avg_sleep_hours}h` : '—'}</span>
          <span>Calidad: {d.avg_sleep_quality ? `${d.avg_sleep_quality}/10` : '—'}</span>
        </div>
      </div>

      {/* Strength Progress Chart */}
      {d.strength_progress?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-500" /> Progreso de Fuerza (1RM)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.strength_progress[0]?.dates?.map((date, i) => ({
              date: new Date(date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
              value: d.strength_progress[0].values[i],
            })) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              />
              <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 text-center mt-1">
            {d.strength_progress[0]?.exercise_name}
          </p>
        </div>
      )}

      {/* Weekly Volume */}
      {Object.keys(d.weekly_volume || {}).length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart size={18} className="text-blue-500" /> Volumen Semanal
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Object.entries(d.weekly_volume).map(([muscle, sets]) => ({
              muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
              sets,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="muscle" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="sets" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Body Weight Trend */}
      {d.body_weight_trend?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Scale size={18} className="text-purple-500" /> Peso Corporal
            </h3>
            <span className="text-lg font-bold">{d.latest_body_weight} kg</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={d.body_weight_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
              />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
              <Line type="monotone" dataKey="weight" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* More Links */}
      <div className="space-y-2">
        {[
          { to: '/body', icon: Scale, label: 'Mediciones Corporales' },
          { to: '/sleep', icon: Moon, label: 'Registro de Sueño' },
          { to: '/supplements', icon: Zap, label: 'Suplementación' },
          { to: '/benefits', icon: Award, label: 'Beneficios Partners' },
        ].map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="card flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <Icon size={20} className="text-gray-400" />
              <span className="font-medium">{label}</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
