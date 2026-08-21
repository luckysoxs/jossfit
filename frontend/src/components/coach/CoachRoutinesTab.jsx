import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Zap, Users, Share2, Calendar, Dumbbell } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'
import ShareLinkModal from './ShareLinkModal'

export default function CoachRoutinesTab() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(null)

  useEffect(() => {
    api.get('/coach/routines')
      .then((r) => setRoutines(r.data))
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Link to="/routines/generate?para=cliente"
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
          <Zap size={14} /> Generar
        </Link>
        <Link to="/routines/create?para=cliente"
          className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
          <Plus size={14} /> Manual
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="card text-center py-12">
          <Dumbbell size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 font-medium">Aun no tienes rutinas para clientes</p>
          <p className="text-gray-400 text-sm mt-1">
            Crea una y compartela con un enlace
          </p>
        </div>
      ) : (
        routines.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/routines/${r.id}`} className="flex-1 min-w-0">
                <h3 className="font-bold text-base truncate">{r.name}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-gray-400">
                  <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full font-medium">
                    {r.split_type}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={10} /> {r.days_per_week} dias/sem
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} /> {r.clients_count} cliente{r.clients_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSharing(r)}
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 flex-shrink-0"
              >
                <Share2 size={13} /> Compartir
              </button>
            </div>
          </div>
        ))
      )}

      {sharing && (
        <ShareLinkModal routine={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  )
}
