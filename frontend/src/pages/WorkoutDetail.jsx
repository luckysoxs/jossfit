import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ArrowLeft, Calendar, Clock, Gauge } from 'lucide-react'

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/workouts/${id}`)
      .then((res) => setWorkout(res.data))
      .catch(() => navigate('/workouts'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingSpinner />
  if (!workout) return null

  // Group sets by exercise
  const grouped = {}
  workout.sets?.forEach((s) => {
    const name = s.exercise?.name || `Exercise ${s.exercise_id}`
    if (!grouped[name]) grouped[name] = []
    grouped[name].push(s)
  })

  const totalVolume = workout.sets?.reduce((sum, s) => sum + (s.reps * s.weight_kg), 0) || 0

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft size={20} /> Volver
      </button>

      <div className="card">
        <h1 className="text-xl font-bold mb-3">Detalle del Entrenamiento</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(workout.date).toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          {workout.duration_minutes && <span className="flex items-center gap-1"><Clock size={14} /> {workout.duration_minutes} min</span>}
          {workout.fatigue_level && <span className="flex items-center gap-1"><Gauge size={14} /> Fatiga: {workout.fatigue_level}/10</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-lg font-bold">{workout.sets?.length || 0}</p>
            <p className="text-xs text-gray-400">Series</p>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-lg font-bold">{Object.keys(grouped).length}</p>
            <p className="text-xs text-gray-400">Ejercicios</p>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-lg font-bold">{Math.round(totalVolume)}</p>
            <p className="text-xs text-gray-400">Volumen (kg)</p>
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([name, sets]) => (
        <div key={name} className="card">
          <h3 className="font-semibold mb-3">{name}</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-2">
              <span>Set</span><span>Reps</span><span>Peso</span><span>RPE</span>
            </div>
            {sets.map((s) => (
              <div key={s.id} className={`grid grid-cols-4 text-sm px-2 py-1.5 rounded-lg ${s.completed ? '' : 'bg-red-50 dark:bg-red-500/5 text-red-500'}`}>
                <span>{s.set_number}</span>
                <span>{s.reps}</span>
                <span>{s.weight_kg} kg</span>
                <span>{s.rpe || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {workout.notes && (
        <div className="card">
          <h3 className="font-semibold mb-2">Notas</h3>
          <p className="text-sm text-gray-500">{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
