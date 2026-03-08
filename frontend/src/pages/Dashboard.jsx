import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUnread } from '../contexts/UnreadContext'
import api from '../services/api'
import { cacheSet, cacheGet } from '../services/offlineCache'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import AppTour from '../components/ui/AppTour'
import { requestNotificationPermission, subscribeToPush, isPushSubscribed } from '../services/pushNotifications'
import {
  Dumbbell, Flame, Timer, TrendingUp, Heart, Moon, Scale, Zap,
  ChevronRight, Target, HeartPulse, Award, BookOpen, Shield,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function Dashboard() {
  const { user } = useAuth()
  const { notes: unreadNotes } = useUnread()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTour, setShowTour] = useState(false)
  const [strengthScore, setStrengthScore] = useState(null)

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => {
        setData(res.data)
        cacheSet('dashboard_summary', res.data)
      })
      .catch(() => {
        const cached = cacheGet('dashboard_summary')
        if (cached) setData(cached)
      })
      .finally(() => setLoading(false))

    api.get('/dashboard/strength-score')
      .then((res) => {
        setStrengthScore(res.data)
        cacheSet('strength_score', res.data)
      })
      .catch(() => {
        const cached = cacheGet('strength_score')
        if (cached) setStrengthScore(cached)
      })
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('tour_completed')) setShowTour(true)
  }, [])

  // Auto-subscribe to push notifications by default
  useEffect(() => {
    const autoSubscribe = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return
      const already = await isPushSubscribed()
      if (already) return
      const permitted = await requestNotificationPermission()
      if (permitted) await subscribeToPush()
    }
    autoSubscribe()
  }, [])

  if (loading) return <LoadingSpinner />

  const d = data || {}

  const quickLinks = [
    d.active_routine_id
      ? { to: '/routines', icon: Dumbbell, label: 'Mis Rutinas', color: 'bg-brand-500', tour: 'link-rutina' }
      : { to: '/routines/generate', icon: Dumbbell, label: 'Crear Rutina', color: 'bg-brand-500', tour: 'link-rutina' },
    { to: '/cardio', icon: HeartPulse, label: 'Cardio', color: 'bg-red-500', tour: 'link-cardio' },
    { to: '/goals', icon: Target, label: 'Objetivos', color: 'bg-green-500' },
    { to: '/benefits', icon: Award, label: 'Beneficios', color: 'bg-purple-500' },
    { to: '/notes', icon: BookOpen, label: 'Notas', color: 'bg-amber-500', badge: unreadNotes },
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
      <div data-tour="quick-links" className="grid grid-cols-5 gap-2">
        {quickLinks.map(({ to, icon: Icon, label, color, tour, badge }) => (
          <Link
            key={to}
            to={to}
            data-tour={tour}
            className="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:scale-[1.02] transition-transform"
          >
            <div className={`relative p-2 rounded-xl ${color} text-white`}>
              <Icon size={18} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div data-tour="stats" className="grid grid-cols-2 gap-3">
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

      {/* Strength Score Card */}
      {strengthScore && strengthScore.total_score > 0 && (() => {
        const ss = strengthScore
        const CAT_COLORS = { push: 'bg-blue-500', pull: 'bg-green-500', legs: 'bg-purple-500', core: 'bg-amber-500' }
        const CAT_TEXT = { push: 'text-blue-500', pull: 'text-green-500', legs: 'text-purple-500', core: 'text-amber-500' }
        const maxCat = Math.max(...ss.categories.map(c => c.total_1rm), 1)
        return (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield size={18} className="text-brand-500" /> Strength Score
              </h3>
              <div className="text-right">
                <span className="text-2xl font-bold">{Math.round(ss.total_score)}</span>
                <span className="text-xs text-gray-400 ml-1">kg</span>
              </div>
            </div>

            {/* Change & ratio */}
            <div className="flex items-center gap-3 mb-4 text-xs">
              {ss.change_pct != null && (
                <span className={`font-medium ${ss.change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {ss.change_pct >= 0 ? '↑' : '↓'} {Math.abs(ss.change_pct)}% vs hace 30d
                </span>
              )}
              {ss.strength_ratio && (
                <span className="text-gray-400">
                  Ratio: <span className="font-semibold text-gray-600 dark:text-gray-300">{ss.strength_ratio}x</span> peso corporal
                </span>
              )}
            </div>

            {/* Category bars */}
            <div className="space-y-3">
              {ss.categories.filter(c => c.exercise_count > 0).map(cat => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${CAT_TEXT[cat.category]}`}>{cat.label}</span>
                    <span className="text-xs text-gray-500">{Math.round(cat.total_1rm)} kg</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${CAT_COLORS[cat.category]}`}
                      style={{ width: `${(cat.total_1rm / maxCat) * 100}%` }}
                    />
                  </div>
                  {cat.top_exercise && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Mejor: {cat.top_exercise} — {Math.round(cat.top_1rm)} kg
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
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

      {showTour && (
        <AppTour
          onComplete={() => {
            setShowTour(false)
            localStorage.setItem('tour_completed', 'true')
          }}
        />
      )}
    </div>
  )
}
