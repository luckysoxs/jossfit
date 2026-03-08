import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Lightbulb, Wrench, Bug, HelpCircle, Send, ChevronDown,
  MessageSquare, CheckCircle2, Eye, Clock,
} from 'lucide-react'

const CATEGORIES = [
  { id: 'mejora', label: 'Mejora', icon: Wrench, color: 'bg-blue-500' },
  { id: 'idea', label: 'Idea', icon: Lightbulb, color: 'bg-yellow-500' },
  { id: 'bug', label: 'Bug / Error', icon: Bug, color: 'bg-red-500' },
  { id: 'otro', label: 'Otro', icon: HelpCircle, color: 'bg-gray-500' },
]

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400', icon: Clock },
  visto: { label: 'Visto', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Eye },
  implementado: { label: 'Implementado', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', icon: CheckCircle2 },
}

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('mejora')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const fetchSuggestions = async () => {
    try {
      const res = await api.get('/suggestions')
      setSuggestions(res.data)
    } catch (err) {
      console.error('Error fetching suggestions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim() || sending) return
    setSending(true)
    try {
      await api.post('/suggestions', { category, content: content.trim() })
      setContent('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      fetchSuggestions()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
          <Lightbulb size={24} className="text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Buzón de Ideas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ayúdanos a mejorar la app</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Categoría
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              const isActive = category === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? `${cat.color} text-white shadow-lg scale-[1.02]`
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={16} />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Tu sugerencia
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={
              category === 'mejora' ? '¿Qué te gustaría que mejoremos?...' :
              category === 'idea' ? 'Cuéntanos tu idea...' :
              category === 'bug' ? 'Describe el error que encontraste...' :
              'Escribe aquí...'
            }
            maxLength={1000}
            rows={4}
            className="input w-full resize-none"
          />
          <div className="flex justify-between mt-1">
            <p className="text-xs text-gray-400">{content.length}/1000</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!content.trim() || sending}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {sending ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : success ? (
            <>
              <CheckCircle2 size={18} />
              ¡Enviado!
            </>
          ) : (
            <>
              <Send size={18} />
              Enviar Sugerencia
            </>
          )}
        </button>
      </form>

      {/* History */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <MessageSquare size={20} />
          Mis Sugerencias
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="card p-8 text-center">
            <Lightbulb size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Aún no has enviado sugerencias</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">¡Tu opinión nos ayuda a mejorar!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map(s => {
              const statusCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pendiente
              const catCfg = CATEGORIES.find(c => c.id === s.category) || CATEGORIES[3]
              const StatusIcon = statusCfg.icon
              const CatIcon = catCfg.icon
              return (
                <div key={s.id} className="card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${catCfg.color} flex items-center justify-center`}>
                        <CatIcon size={14} className="text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                        {catCfg.label}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusCfg.color}`}>
                      <StatusIcon size={12} />
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{s.content}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {s.admin_reply && (
                    <div className="mt-2 p-3 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                      <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">Respuesta del equipo:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{s.admin_reply}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
