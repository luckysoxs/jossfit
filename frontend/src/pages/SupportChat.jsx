import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { MessageCircle, Send } from 'lucide-react'

export default function SupportChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const fetchMessages = async () => {
    try {
      const res = await api.get('/support/messages')
      setMessages(res.data)
    } catch (err) {
      console.error('Support messages error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onFocus = () => fetchMessages()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await api.post('/support/messages', { content: input.trim() })
      setInput('')
      await fetchMessages()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar')
    }
    setSending(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <MessageCircle size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Chat de Ayuda</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Escribe tu duda y te responderemos pronto
          </p>
        </div>
      </div>

      <div className="card p-4 min-h-[55vh] max-h-[60vh] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <MessageCircle size={40} className="mx-auto mb-3 opacity-40" />
              <p>No hay mensajes aun.</p>
              <p className="text-xs mt-1">Escribe tu primera pregunta abajo.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.is_from_admin
                  ? 'self-start bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
                  : 'self-end bg-brand-500 text-white rounded-tr-sm'
              }`}
            >
              {msg.is_from_admin && (
                <p className="text-[10px] font-semibold text-brand-500 mb-1">Soporte</p>
              )}
              <p>{msg.content}</p>
              <p
                className={`text-[10px] mt-1 ${
                  msg.is_from_admin ? 'text-gray-400' : 'text-white/60'
                }`}
              >
                {new Date(msg.created_at).toLocaleString('es-MX', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Escribe tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
        />
        <button
          type="submit"
          className="btn-primary px-4 flex items-center gap-2"
          disabled={sending || !input.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
