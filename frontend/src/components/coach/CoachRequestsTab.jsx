import { useState, useEffect } from 'react'
import { MessageSquare, Check, X, Users } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

const ETIQUETAS = { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada' }

export default function CoachRequestsTab() {
  const [requests, setRequests] = useState([])
  const [routineCounts, setRoutineCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [replyFor, setReplyFor] = useState(null)
  const [reply, setReply] = useState('')

  const cargar = () => {
    Promise.all([
      api.get('/coach/change-requests'),
      api.get('/coach/routines').catch(() => ({ data: [] })),
    ])
      .then(([reqs, rutinas]) => {
        setRequests(reqs.data)
        const counts = {}
        rutinas.data.forEach((r) => { counts[r.id] = r.clients_count })
        setRoutineCounts(counts)
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const responder = async (req, status) => {
    await api.put(`/coach/change-requests/${req.id}`, { status, coach_reply: reply.trim() || null })
    setReplyFor(null)
    setReply('')
    cargar()
  }

  if (loading) return <LoadingSpinner />

  if (requests.length === 0) {
    return (
      <div className="card text-center py-12">
        <MessageSquare size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 font-medium">Sin solicitudes</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const usandola = routineCounts[r.routine_id] || 0
        return (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">{r.client_name}</h3>
                <p className="text-[11px] text-gray-400 truncate">
                  {r.routine_name}{r.exercise_name ? ` · ${r.exercise_name}` : ''}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                r.status === 'pendiente'
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {ETIQUETAS[r.status] || r.status}
              </span>
            </div>

            <p className="text-sm mt-2.5 text-gray-700 dark:text-gray-300">{r.content}</p>

            {r.coach_reply && (
              <p className="text-xs mt-2 text-gray-500 border-l-2 border-brand-500 pl-2">
                {r.coach_reply}
              </p>
            )}

            {r.status === 'pendiente' && (
              <>
                {usandola > 1 && (
                  <div className="flex items-start gap-1.5 mt-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-lg text-[11px]">
                    <Users size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Esta rutina la estan usando {usandola} personas. Si la editas, les cambia
                      a todas. Si el cambio es solo para {r.client_name}, arma una rutina aparte.
                    </span>
                  </div>
                )}

                {replyFor === r.id ? (
                  <div className="mt-3">
                    <textarea className="input h-20 resize-none" autoFocus value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Tu respuesta para el cliente" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => responder(r, 'aceptada')}
                        className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1">
                        <Check size={13} /> Aceptar
                      </button>
                      <button onClick={() => responder(r, 'rechazada')}
                        className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1">
                        <X size={13} /> Rechazar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReplyFor(r.id); setReply('') }}
                    className="btn-secondary w-full text-xs py-2 mt-3">
                    Responder
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
