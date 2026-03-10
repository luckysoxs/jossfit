import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dumbbell, ChevronRight, Check, Timer } from 'lucide-react'
import api from '../../services/api'
import { cacheSet, cacheGet } from '../../services/offlineCache'
import { getWeekdayMap } from '../../utils/routineConstants'
import { useAuth } from '../../contexts/AuthContext'
import { useRestTimer } from '../../contexts/RestTimerContext'

/**
 * Global banner that shows today's training day.
 * Solid accent color background. Shows green progress when exercises are checked.
 */
export default function TodayRoutineBanner() {
  const { user } = useAuth()
  const rest = useRestTimer()
  const navigate = useNavigate()
  const location = useLocation()
  const [todayInfo, setTodayInfo] = useState(null)
  const [progress, setProgress] = useState(0) // 0-100

  useEffect(() => {
    if (!user) return

    const load = async () => {
      let routines = null
      try {
        const r = await api.get('/routines')
        routines = r.data
        cacheSet('routines_list', routines)
      } catch {
        routines = cacheGet('routines_list')
      }

      if (!routines || routines.length === 0) {
        setTodayInfo(null)
        return
      }

      const routine = routines[routines.length - 1]
      const restWeekdays = routine.rest_weekdays || [6]
      const weekdayMap = getWeekdayMap(routine.days_per_week, restWeekdays)
      const todayWeekday = (new Date().getDay() + 6) % 7
      const entry = Object.entries(weekdayMap).find(([, wd]) => wd === todayWeekday)
      if (!entry) { setTodayInfo(null); return }

      const dayNumber = parseInt(entry[0], 10)
      const day = routine.days?.find(d => d.day_number === dayNumber)
      if (!day) { setTodayInfo(null); return }

      // Count strength exercises (exclude cardio)
      const strengthExIds = (day.exercises || [])
        .filter(e => e.exercise?.muscle_group !== 'cardio' || e.exercise?.category !== 'cardio')
        .map(e => e.id)

      setTodayInfo({
        routineId: routine.id,
        dayId: day.id,
        dayName: day.name,
        routineName: routine.name,
        exerciseIds: strengthExIds,
      })

      // Calculate progress from localStorage
      calcProgress(routine.id, strengthExIds)
    }

    load()
  }, [user])

  // Re-check progress when navigating back (e.g. after checking exercises)
  useEffect(() => {
    if (!todayInfo) return
    calcProgress(todayInfo.routineId, todayInfo.exerciseIds)
  }, [location.pathname, todayInfo])

  // Listen for storage events (other tabs or same-tab updates)
  useEffect(() => {
    if (!todayInfo) return
    const handler = () => calcProgress(todayInfo.routineId, todayInfo.exerciseIds)
    window.addEventListener('storage', handler)
    // Also poll every 2s to catch same-tab localStorage writes
    const interval = setInterval(handler, 2000)
    return () => { window.removeEventListener('storage', handler); clearInterval(interval) }
  }, [todayInfo])

  const calcProgress = (routineId, exIds) => {
    if (!exIds || exIds.length === 0) { setProgress(0); return }
    const todayDate = new Date().toLocaleDateString('en-CA')
    const key = 'routine_progress_' + routineId + '_' + todayDate
    try {
      const saved = localStorage.getItem(key)
      if (!saved) { setProgress(0); return }
      const checked = JSON.parse(saved)
      const done = exIds.filter(id => checked[id]).length
      setProgress(Math.round((done / exIds.length) * 100))
    } catch { setProgress(0) }
  }

  if (!todayInfo || !user) return null
  if (location.pathname.includes('/routines/' + todayInfo.routineId + '/day/' + todayInfo.dayId)) return null

  const completed = progress === 100
  const inProgress = progress > 0 && progress < 100

  return (
    <button
      onClick={() => navigate('/routines/' + todayInfo.routineId + '/day/' + todayInfo.dayId)}
      data-tour="today-banner"
      className="relative w-full flex items-center justify-between gap-2 px-4 py-2.5 overflow-hidden group transition-all duration-300"
      style={{
        backgroundColor: completed ? '#16a34a' : 'var(--brand-500)',
      }}
    >
      {/* Progress fill (green overlay from left) */}
      {inProgress && (
        <div
          className="absolute inset-y-0 left-0 bg-green-600/40 transition-all duration-700 ease-out"
          style={{ width: progress + '%' }}
        />
      )}

      <div className="relative flex items-center gap-2.5 min-w-0">
        <div className={'flex items-center justify-center w-8 h-8 rounded-full shrink-0 ' +
          (completed ? 'bg-white/20' : 'bg-white/15')
        }>
          {completed
            ? <Check size={16} className="text-white" />
            : <Dumbbell size={16} className="text-white" />
          }
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium text-white/70 leading-tight truncate">
            {completed ? 'Completado' : 'Hoy te toca'}
          </p>
          <p className="text-sm font-bold text-white leading-tight truncate">
            {todayInfo.dayName}
          </p>
        </div>
      </div>

      <div className="relative flex items-center gap-2 shrink-0">
        {rest && rest.isRunning && (
          <div className="flex items-center gap-1.5 bg-black/20 rounded-full px-2 py-0.5 mr-1">
            <div className="relative w-5 h-5">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2" stroke="rgba(255,255,255,0.2)" />
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={50.27}
                  strokeDashoffset={50.27 * (1 - rest.progress)}
                  style={{ stroke: 'hsl(' + Math.round(rest.progress * 130) + ', 75%, 60%)', transition: 'stroke-dashoffset 1s linear, stroke 1s linear' }}
                />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-white tabular-nums">
              {Math.floor(rest.timeLeft / 60)}:{String(rest.timeLeft % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        {inProgress && (
          <span className="text-xs font-bold text-white/80 tabular-nums">
            {progress}%
          </span>
        )}
        {completed && (
          <span className="text-xs font-bold text-white/80">
            100%
          </span>
        )}
        <ChevronRight size={16} className="text-white/80 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  )
}
