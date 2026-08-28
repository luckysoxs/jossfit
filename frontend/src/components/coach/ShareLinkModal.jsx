import { useState, useEffect } from 'react'
import { X, Copy, Check, Trash2, Eye, UserCheck } from 'lucide-react'

import api from '../../services/api'

const EXPIRACIONES = [
  { label: 'Nunca', value: null },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

export default function ShareLinkModal({ routine, onClose }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('personal')
  const [label, setLabel] = useState('')
  const [sinLimite, setSinLimite] = useState(false)
  const [maxClaims, setMaxClaims] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(null)

  const cargar = () => {
    api.get(`/coach/routines/${routine.id}/links`)
      .then((r) => setLinks(r.data))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [routine.id])

  const urlDe = (link) => `${window.location.origin}${link.path}`

  const crear = async () => {
    setCreating(true)
    setError('')
    try {
      await api.post(`/coach/routines/${routine.id}/links`, {
        kind,
        label: label.trim() || null,
        max_claims: kind === 'personal' ? 1 : (sinLimite ? null : Number(maxClaims)),
        expires_in_days: expiresInDays,
      })
      setLabel('')
      cargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos crear el enlace')
    } finally {
      setCreating(false)
    }
  }

  const copiar = async (link) => {
    try {
      await navigator.clipboard.writeText(urlDe(link))
      setCopiado(link.id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      setError('Tu navegador bloqueo el portapapeles. Copia el enlace a mano.')
    }
  }

  const revocar = async (link) => {
    if (!confirm('Desactivar este enlace? Quien ya lo reclamo conserva la rutina.')) return
    await api.delete(`/coach/links/${link.id}`)
    cargar()
  }

  const whatsapp = (link) =>
    `https://wa.me/?text=${encodeURIComponent(`Tu rutina: ${urlDe(link)}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold truncate">Compartir rutina</h3>
            <p className="text-[11px] text-gray-400 truncate">{routine.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-lg text-xs mt-3">
            {error}
          </div>
        )}

        {/* Crear enlace */}
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setKind('personal'); setMaxClaims(1); setSinLimite(false) }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                kind === 'personal'
                  ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              Personal (1 persona)
            </button>
            <button
              onClick={() => setKind('plantilla')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                kind === 'plantilla'
                  ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              Plantilla (varias)
            </button>
          </div>

          <div>
            <label className="label">Nombre del enlace</label>
            <input className="input" value={label} maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Rutina de Juan - solo lo ves tu" />
          </div>

          {kind === 'plantilla' && (
            <div>
              <label className="label">Limite de personas</label>
              <div className="flex items-center gap-3">
                <input type="number" min={1} className="input flex-1" value={maxClaims}
                  disabled={sinLimite}
                  onChange={(e) => setMaxClaims(e.target.value)} />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={sinLimite}
                    onChange={(e) => setSinLimite(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500" />
                  Sin limite
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="label">Expira</label>
            <div className="flex gap-1.5">
              {EXPIRACIONES.map((e) => (
                <button key={e.label} onClick={() => setExpiresInDays(e.value)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    expiresInDays === e.value
                      ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={crear} className="btn-primary w-full text-sm" disabled={creating}>
            {creating ? 'Creando...' : 'Crear enlace'}
          </button>
        </div>

        {/* Enlaces existentes */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
            Enlaces
          </p>
          {loading ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-gray-400">Todavia no has creado ninguno.</p>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id}
                  className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-3 ${l.revoked ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {l.label || (l.kind === 'personal' ? 'Enlace personal' : 'Plantilla')}
                        {l.revoked && ' · desactivado'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{urlDe(l)}</p>
                    </div>
                    {!l.revoked && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copiar(l)}
                          className="p-1.5 text-gray-400 hover:text-brand-500">
                          {copiado === l.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <a href={whatsapp(l)} target="_blank" rel="noreferrer"
                          className="p-1.5 text-gray-400 hover:text-green-500 text-[11px] font-bold">
                          WA
                        </a>
                        <button onClick={() => revocar(l)}
                          className="p-1.5 text-red-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Eye size={10} /> {l.visits} aperturas</span>
                    <span className="flex items-center gap-1"><UserCheck size={10} /> {l.claims} reclamados</span>
                    {l.remaining !== null && <span>quedan {l.remaining}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
