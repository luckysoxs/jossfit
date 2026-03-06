import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ArrowLeft, Play } from 'lucide-react'

export default function RoutineDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/routines/${id}`)
      .then((r) => setRoutine(r.data))
      .catch(() => navigate('/routines'))
      .finally(() => setLoading(false))
  }, [id])

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

      {routine.days?.map((day) => (
        <div key={day.id} className="card">
          <h3 className="font-semibold text-lg mb-1">Dia {day.day_number}: {day.name}</h3>
          {day.focus && <p className="text-xs text-gray-400 mb-3">{day.focus}</p>}

          <div className="space-y-2">
            {day.exercises?.map((ex) => (
              <div key={ex.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ex.exercise?.name || 'Ejercicio'}</p>
                    <p className="text-xs text-gray-400">
                      {ex.exercise?.muscle_group} · {ex.exercise?.equipment}
                    </p>
                  </div>
                  <div className="text-right text-sm ml-3">
                    <p className="font-medium">{ex.sets} x {ex.reps_min}-{ex.reps_max}</p>
                    <p className="text-xs text-gray-400">Descanso: {ex.rest_seconds}s</p>
                  </div>
                </div>
                {ex.exercise?.name && (
                  <a
                    href={getYoutubeUrl(ex.exercise.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
                  >
                    <Play size={14} fill="currentColor" />
                    VER VIDEO
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
