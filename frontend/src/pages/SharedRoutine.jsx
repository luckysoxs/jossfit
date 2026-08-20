import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Calendar, Dumbbell, User as UserIcon, AlertCircle } from 'lucide-react'

import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { setPendingShare, clearPendingShare } from '../services/pendingShare'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const OBJECTIVE_LABELS = {
  hypertrophy: 'Hipertrofia',
  strength: 'Fuerza',
  fat_loss: 'Perdida de grasa',
  recomposition: 'Recomposicion',
  endurance: 'Resistencia',
}

const MENSAJES_ERROR = {
  no_existe: 'Este enlace no existe. Revisa que lo hayas copiado completo.',
  revocado: 'Tu coach desactivo este enlace.',
  expirado: 'Este enlace expiro. Pidele uno nuevo a tu coach.',
  lleno: 'Este enlace ya no tiene cupo. Pidele uno nuevo a tu coach.',
}

export default function SharedRoutine() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    setPendingShare(token)
    api.get(`/share/${token}`)
      .then(({ data }) => {
        setPreview(data)
        if (data.status !== 'valido') clearPendingShare()
      })
      .catch(() => setError('No pudimos cargar el enlace. Revisa tu conexion.'))
      .finally(() => setLoading(false))
  }, [token, authLoading])

  const reclamar = async () => {
    setClaiming(true)
    setError('')
    try {
      const { data } = await api.post(`/share/${token}/claim`)
      clearPendingShare()
      navigate(`/routines/${data.routine_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos agregar la rutina')
    } finally {
      setClaiming(false)
    }
  }

  if (authLoading || loading) return <LoadingSpinner />

  const invalido = preview && preview.status !== 'valido'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Flame size={40} className="text-brand-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">JOSSFITness</h1>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {invalido ? (
          <div className="card text-center py-10">
            <AlertCircle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              {MENSAJES_ERROR[preview.status] || 'Este enlace no esta disponible'}
            </p>
            <Link to="/" className="btn-secondary inline-block mt-5 text-sm py-2 px-4">
              Ir a la app
            </Link>
          </div>
        ) : preview ? (
          <div className="card">
            <p className="text-[11px] uppercase tracking-wide text-brand-500 font-semibold">
              Rutina de tu coach
            </p>
            <h2 className="text-xl font-bold mt-1">{preview.routine_name}</h2>

            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
              {preview.coach_name && (
                <span className="flex items-center gap-1">
                  <UserIcon size={11} /> {preview.coach_name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={11} /> {preview.days_per_week} dias/sem
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell size={11} /> {preview.total_exercises} ejercicios
              </span>
              {preview.objective && (
                <span>{OBJECTIVE_LABELS[preview.objective] || preview.objective}</span>
              )}
            </div>

            {preview.day_names?.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
                {preview.day_names.map((nombre, i) => (
                  <div key={i}
                    className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
                    {nombre}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              {preview.is_own ? (
                <p className="text-sm text-gray-500 text-center">
                  Esta rutina es tuya. Compartela con tus clientes.
                </p>
              ) : !user ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                    Entra con tu cuenta para empezar a entrenarla
                  </p>
                  <button
                    onClick={() => navigate(`/register?redirect=/r/${token}`)}
                    className="btn-primary w-full"
                  >
                    Crear cuenta
                  </button>
                  <button
                    onClick={() => navigate(`/login?redirect=/r/${token}`)}
                    className="btn-secondary w-full mt-2"
                  >
                    Ya tengo cuenta
                  </button>
                </>
              ) : preview.already_claimed ? (
                <button onClick={reclamar} className="btn-primary w-full" disabled={claiming}>
                  Ir a mi rutina
                </button>
              ) : (
                <button onClick={reclamar} className="btn-primary w-full" disabled={claiming}>
                  {claiming ? 'Agregando...' : 'Agregar a mis rutinas'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
