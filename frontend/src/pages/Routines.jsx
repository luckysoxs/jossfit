import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Plus, Zap, Calendar, ChevronRight, Trash2 } from 'lucide-react'

export default function Routines() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/routines').then((r) => setRoutines(r.data)).finally(() => setLoading(false))
  }, [])

  const deleteRoutine = async (id) => {
    if (!confirm('¿Eliminar esta rutina?')) return
    await api.delete(`/routines/${id}`)
    setRoutines(routines.filter((r) => r.id !== id))
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Rutinas</h1>
        <div className="flex gap-2">
          <Link to="/routines/generate" className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
            <Zap size={16} /> Generar
          </Link>
        </div>
      </div>

      {routines.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No tienes rutinas creadas</p>
          <Link to="/routines/generate" className="text-brand-500 text-sm hover:underline mt-2 inline-block">
            Genera tu primera rutina
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <Link to={`/routines/${r.id}`} className="flex-1">
                  <h3 className="font-semibold">{r.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{r.split_type}</span>
                    <span>{r.days_per_week} días/semana</span>
                    {r.objective && <span>{r.objective}</span>}
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <button onClick={() => deleteRoutine(r.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                  <Link to={`/routines/${r.id}`}>
                    <ChevronRight size={18} className="text-gray-400" />
                  </Link>
                </div>
              </div>
              {r.days?.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {r.days.map((d) => (
                    <div key={d.id} className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-gray-400 ml-1">({d.exercises?.length || 0} ej.)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
