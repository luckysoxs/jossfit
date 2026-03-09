import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dumbbell, ChevronRight } from 'lucide-react'
import api from '../../services/api'
import { cacheSet, cacheGet } from '../../services/offlineCache'
import { getWeekdayMap } from '../../utils/routineConstants'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Global banner that shows today's training day.
 * Uses the user's accent color + subtle pulsing glow.
 * Tapping navigates to the routine day exercises.
 */
export default function TodayRoutineBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [todayInfo, setTodayInfo] = useState(null) // { routineId, dayId, dayName, routineName }

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

      // Use the most recently created routine (last one)
      const routine = routines[routines.length - 1]
      const restWeekdays = routine.rest_weekdays || [6]
      const weekdayMap = getWeekdayMap(routine.days_per_week, restWeekdays)

      // Today's weekday: 0=Mon..6=Sun
      const todayWeekday = (new Date().getDay() + 6) % 7

      // Find which day_number maps to today
      const entry = Object.entries(weekdayMap).find(([, wd]) => wd === todayWeekday)
      if (!entry) {
        setTodayInfo(null) // rest day
        return
      }

      const dayNumber = parseInt(entry[0], 10)
      const day = routine.days?.find(d => d.day_number === dayNumber)
      if (!day) {
        setTodayInfo(null)
        return
      }

      setTodayInfo({
        routineId: routine.id,
        dayId: day.id,
        dayName: day.name,
        routineName: routine.name,
      })
    }

    load()
  }, [user])

  // Don't show if no routine today, no user, or already on a routine day detail page
  if (!todayInfo || !user) return null
  if (location.pathname.includes(`/routines/${todayInfo.routineId}/day/${todayInfo.dayId}`)) return null

  return (
    <button
      onClick={() => navigate(`/routines/${todayInfo.routineId}/day/${todayInfo.dayId}`)}
      className="
        relative w-full flex items-center justify-between gap-2
        px-4 py-2.5
        bg-[var(--brand-500)]/10
        border-b border-[var(--brand-500)]/20
        transition-all duration-300
        hover:bg-[var(--brand-500)]/15
        active:bg-[var(--brand-500)]/20
        group
      "
    >
      {/* Subtle pulsing glow overlay */}
      <div className="absolute inset-0 bg-[var(--brand-500)]/5 animate-[pulse-glow_3s_ease-in-out_infinite] pointer-events-none" />

      <div className="relative flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--brand-500)]/20 shrink-0">
          <Dumbbell size={16} className="text-[var(--brand-500)]" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium text-[var(--brand-500)]/70 leading-tight truncate">
            Hoy te toca
          </p>
          <p className="text-sm font-bold text-[var(--brand-500)] leading-tight truncate">
            {todayInfo.dayName}
          </p>
        </div>
      </div>

      <div className="relative flex items-center gap-1 shrink-0">
        <span className="text-xs font-medium text-[var(--brand-500)]/70 hidden sm:inline">
          Ir a ejercicios
        </span>
        <ChevronRight size={16} className="text-[var(--brand-500)] group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  )
}
