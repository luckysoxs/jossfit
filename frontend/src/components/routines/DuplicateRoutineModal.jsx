import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

import api from '../../services/api'

const NAME_MAX = 100

// Copia una rutina propia. destino="cliente" la deja en el panel de coach;
// destino="mia", en las rutinas propias. Al terminar abre la copia.
export default function DuplicateRoutineModal({ routine, destino, title, onClose }) {
  const navigate = useNavigate()
  const [name, setName] = useState(`${routine.name} (copia)`.slice(0, NAME_MAX))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Con la peticion en vuelo no se cierra: el POST terminaria navegando igual.
  const cerrar = () => { if (!saving) onClose() }

  const duplicar = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post(`/routines/${routine.id}/duplicate`, {
        destino,
        name: name.trim() || null,
      })
      onClose()
      navigate(`/routines/${data.id}`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'No pudimos duplicar la rutina')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={cerrar}>
      <div className="card w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold truncate">{title}</h3>
          <button onClick={cerrar} aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); duplicar() }}>
          <label className="block text-xs text-gray-400 mt-4 mb-1">Nombre de la copia</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            className="input w-full"
            autoFocus
          />

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={cerrar} className="btn-secondary flex-1 text-sm py-2">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm py-2">
              {saving ? 'Duplicando...' : 'Duplicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
