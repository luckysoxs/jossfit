import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { cacheSet, cacheGet } from '../services/offlineCache'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import PageTour from '../components/ui/PageTour'
import { Plus, Zap, Calendar, ChevronRight, Trash2, Dumbbell, Clock, Pencil } from 'lucide-react'

const OBJECTIVE_LABELS = {
  hypertrophy: 'Hipertrofia',
  strength: 'Fuerza',
  fat_loss: 'Perdida de grasa',
  recomposition: 'Recomposicion',
  endurance: 'Resistencia',
}

export default function Routines() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    api.get('/routines')
      .then((r) => {
        setRoutines(r.data)
        cacheSet('routines_list', r.data)
      })
      .catch(() => {
        const cached = cacheGet('routines_list')
        if (cached) setRoutines(cached)
      })
      .finally(() => setLoading(false))
  }, [])

  const deleteRoutine = async (id) => {
    if (!confirm('Eliminar esta rutina?')) return
    await api.delete(`/routines/${id}`)
    setRoutines(routines.filter((r) => r.id !== id))
  }

  const saveRename = async (id) => {
    if (!editName.trim()) { setEditingId(null); return }
    try {
      await api.put(`/routines/${id}`, { name: editName.trim() })
      setRoutines(prev => prev.map(r => r.id === id ? { ...r, name: editName.trim() } : r))
    } catch {}
    setEditingId(null)
  }

  const fmtDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold truncate">Mis Rutinas</h1>
        <div className="flex gap-2 flex-shrink-0">
          <Link data-tour="generate-routine" to="/routines/generate" className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3 sm:px-4">
            <Zap size={14} /> Generar
          </Link>
          <Link to="/routines/create" className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3 sm:px-4">
            <Plus size={14} /> Manual
          </Link>
        </div>
      </div>

      {routines.length > 0 && (
        <p className="text-xs text-gray-400">{routines.length} rutina{routines.length !== 1 ? 's' : ''} guardada{routines.length !== 1 ? 's' : ''}</p>
      )}

      <div data-tour="routine-list">
      {routines.length === 0 ? (
        <div className="card text-center py-12">
          <Dumbbell size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 font-medium">No tienes rutinas creadas</p>
          <p className="text-gray-400 text-sm mt-1">Genera tu primera rutina con IA o creala manualmente</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link to="/routines/generate" className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4">
              <Zap size={14} /> Generar con IA
            </Link>
            <Link to="/routines/create" className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-4">
              <Plus size={14} /> Manual
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((r) => {
            const totalExercises = r.days?.reduce((sum, d) => sum + (d.exercises?.length || 0), 0) || 0
            return (
              <Link key={r.id} to={`/routines/${r.id}`} className="card block hover:ring-1 hover:ring-brand-500/30 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {editingId === r.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); saveRename(r.id) }}
                        onClick={(e) => e.preventDefault()}>
                        <input
                          autoFocus
                          className="input text-base font-bold py-1 w-full"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onBlur={() => saveRename(r.id)}
                          onKeyDown={e => e.key === 'Escape' && setEditingId(null)}
                        />
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base truncate">{r.name}</h3>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditName(r.name); setEditingId(r.id) }}
                          className="p-1 text-gray-300 hover:text-brand-500 transition-colors flex-shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full text-[11px] font-medium">
                        {r.split_type}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar size={10} /> {r.days_per_week} dias/sem
                      </span>
                      {r.objective && (
                        <span className="text-[11px] text-gray-400">
                          {OBJECTIVE_LABELS[r.objective] || r.objective}
                        </span>
                      )}
                      {r.generation_type === 'ai' && (
                        <span className="bg-purple-50 dark:bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5">
                          <Zap size={8} /> IA
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteRoutine(r.id) }}
                      className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </div>

                {/* Days summary */}
                {r.days?.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {r.days
                      .slice()
                      .sort((a, b) => a.day_number - b.day_number)
                      .map((d) => (
                        <div key={d.id} className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-[11px]">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-gray-400 ml-1">({d.exercises?.length || 0})</span>
                        </div>
                    ))}
                  </div>
                )}

                {/* Footer stats */}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Dumbbell size={10} /> {totalExercises} ejercicios
                  </span>
                  {r.created_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {fmtDate(r.created_at)}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      </div>

      <PageTour
        pageKey="routines"
        steps={[
          { target: '[data-tour="generate-routine"]', title: 'Generar Rutina', description: 'Crea una rutina personalizada con inteligencia artificial.', position: 'bottom' },
          { target: '[data-tour="routine-list"]', title: 'Tus Rutinas', description: 'Aqui aparecen todas tus rutinas creadas.', position: 'top' },
        ]}
      />
    </div>
  )
}
