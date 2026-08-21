import { useState, useEffect } from 'react'
import { Users, AlertCircle, UserMinus } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

function fmtUltimo(iso) {
  if (!iso) return 'Nunca'
  const hoy = new Date()
  const d = new Date(`${iso}T00:00:00`)
  const dias = Math.round((hoy.setHours(0, 0, 0, 0) - d.getTime()) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} dias`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export default function CoachClientsTab() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = () => {
    api.get('/coach/clients')
      .then((r) => setClients(r.data))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const quitarAcceso = async (c) => {
    if (!confirm(`Quitarle el acceso a ${c.name}? Su historial de entrenos no se borra.`)) return
    await api.delete(`/coach/assignments/${c.assignment_id}`)
    cargar()
  }

  if (loading) return <LoadingSpinner />

  if (clients.length === 0) {
    return (
      <div className="card text-center py-12">
        <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 font-medium">Todavia no tienes clientes</p>
        <p className="text-gray-400 text-sm mt-1">
          Comparte el enlace de una rutina para que entren
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clients.map((c) => (
        <div key={c.assignment_id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{c.name}</h3>
              <p className="text-[11px] text-gray-400 truncate">{c.routine_name}</p>
            </div>
            <button onClick={() => quitarAcceso(c)}
              className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex-shrink-0">
              <UserMinus size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap text-[11px] text-gray-400">
            <span>Ultimo entreno: <b className="text-gray-600 dark:text-gray-300">{fmtUltimo(c.last_workout_date)}</b></span>
            <span>Esta semana: <b className="text-gray-600 dark:text-gray-300">{c.workouts_this_week} de {c.days_per_week}</b></span>
            {c.pending_requests > 0 && (
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <AlertCircle size={11} /> {c.pending_requests} solicitud{c.pending_requests !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
