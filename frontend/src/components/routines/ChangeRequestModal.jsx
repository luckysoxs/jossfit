import { useState } from 'react'
import { X, Send } from 'lucide-react'

import api from '../../services/api'

export default function ChangeRequestModal({ routineId, exerciseId = null, exerciseName = null, onClose }) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const enviar = async () => {
    if (!content.trim()) { setError('Escribe que necesitas cambiar'); return }
    setSending(true)
    setError('')
    try {
      await api.post(`/routines/${routineId}/change-request`, {
        routine_exercise_id: exerciseId,
        content: content.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos enviar tu solicitud')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4"
      onClick={onClose}>
      <div className="card w-full max-w-sm mb-4 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">Pedir un cambio</h3>
            {exerciseName && (
              <p className="text-[11px] text-gray-400 mt-0.5">{exerciseName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Listo, tu coach ya recibio tu solicitud.
            </p>
            <button onClick={onClose} className="btn-primary w-full mt-4">Cerrar</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-lg text-xs mt-3">
                {error}
              </div>
            )}
            <textarea
              className="input mt-3 h-28 resize-none"
              maxLength={1000}
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ej: este ejercicio me lastima la rodilla, prefiero otro"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{content.length}/1000</p>
            <button onClick={enviar} className="btn-primary w-full mt-3 flex items-center justify-center gap-1.5"
              disabled={sending}>
              <Send size={14} /> {sending ? 'Enviando...' : 'Enviar a mi coach'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
