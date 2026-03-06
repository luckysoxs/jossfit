import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ArrowLeft, Play, Check } from 'lucide-react'

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState({})

  const todayKey = `routine_progress_${id}_${new Date().toISOString().split('T')[0]}`

  useEffect(() => {
    api.get(`/routines/${id}`)
      .then((r) => setRoutine(r.data))
      .catch(() => navigate('/routines'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const saved = localStorage.getItem(todayKey)
    if (saved) setChecked(JSON.parse(saved))
  }, [todayKey])

  const toggleExercise = (exId) => {
    const next = { ...checked, [exId]: !checked[exId] }
    setChecked(next)
    localStorage.setItem(todayKey, JSON.stringify(next))
  }

  const getYoutubeUrl = (name) => {
    const query = encodeURIComponent(`${name} ejercicio como hacerlo`)
    return `https://www.youtube.com/results?search_query=${query}`
  }

  if (loading) return <LoadingSpinner />
  if (!routine) return null

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="card">
        <h1 className="text-xl font-bold">{routine.name}</h1>
        <div className="flex gap-3 text-sm text-gray-400 mt-1">
          <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{routine.split_type}</span>
          <span>{routine.days_per_week} dias/semana</span>
        </div>
      </div>

      {(() => {
        const allIds = routine.days?.flatMap(d => d.exercises?.map(e => e.id) || []) || []
        const done = allIds.filter(eId => checked[eId]).length
        return allIds.length > 0 ? (
          <div className="card flex items-center justify-between">
            <span className="text-sm font-medium">Progreso de hoy</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(done / allIds.length) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-400 tabular-nums">{done}/{allIds.length}</span>
            </div>
          </div>
        ) : null
      })()}

      {routine.days?.map((day) => (
        <div key={day.id} className="card">
          <h3 className="font-semibold text-lg mb-1">Dia {day.day_number}: {day.name}</h3>
          {day.focus && <p className="text-xs text-gray-400 mb-3">{day.focus}</p>}

          <div className="space-y-2">
            {day.exercises?.map((ex) => (
              <div key={ex.id} className={`bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5 transition-opacity ${checked[ex.id] ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExercise(ex.id)}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked[ex.id] ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {checked[ex.id] && <Check size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${checked[ex.id] ? 'line-through text-gray-400' : ''}`}>{ex.exercise?.name || 'Ejercicio'}</p>
                        <p className="text-xs text-gray-400">{ex.exercise?.muscle_group} · {ex.exercise?.equipment}</p>
                      </div>
                      <div className="text-right text-sm ml-3">
                        <p className="font-medium">{ex.sets} x {ex.reps_min}-{ex.reps_max}</p>
                        <p className="text-xs text-gray-400">Descanso: {ex.rest_seconds}s</p>
                      </div>
                    </div>
                    {ex.exercise?.name && (
                      <a href={getYoutubeUrl(ex.exercise.name)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
                        <Play size={14} fill="currentColor" /> VER VIDEO
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
