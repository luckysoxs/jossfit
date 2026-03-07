import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  Radio,
  Plus,
  Send,
  ChevronLeft,
  Users,
  X,
  MessageCircle,
  User as UserIcon,
  Search,
} from 'lucide-react'

export default function WalkieTalkie() {
  const { user } = useAuth()
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const bottomRef = useRef(null)

  // ─── Fetch chat list ─────────────────────────────────────
  const fetchChats = async () => {
    try {
      const res = await api.get('/admin/walkie-talkie/chats')
      setChats(res.data)
    } catch (err) {
      console.error('Walkie chats error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChats()
    const interval = setInterval(fetchChats, 8000)
    return () => clearInterval(interval)
  }, [])

  // ─── Fetch messages for active chat ──────────────────────
  const fetchMessages = async () => {
    if (!activeChat) return
    try {
      const res = await api.get(`/admin/walkie-talkie/chats/${activeChat.id}/messages`)
      setMessages(res.data)
      api.put(`/admin/walkie-talkie/chats/${activeChat.id}/read`).catch(() => {})
    } catch (err) {
      console.error('Walkie messages error:', err)
    }
  }

  useEffect(() => {
    if (!activeChat) return
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [activeChat?.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Refresh on focus
  useEffect(() => {
    const onFocus = () => {
      fetchChats()
      if (activeChat) fetchMessages()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [activeChat])

  // ─── Send message ────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending || !activeChat) return
    setSending(true)
    try {
      await api.post(`/admin/walkie-talkie/chats/${activeChat.id}/messages`, {
        content: input.trim(),
      })
      setInput('')
      await fetchMessages()
      await fetchChats()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar')
    }
    setSending(false)
  }

  // ─── Open chat ───────────────────────────────────────────
  const openChat = (chat) => {
    setActiveChat(chat)
    setMessages([])
  }

  const goBack = () => {
    setActiveChat(null)
    setMessages([])
    fetchChats()
  }

  // ─── Chat display name ──────────────────────────────────
  const getChatName = (chat) => {
    if (chat.is_group) return chat.name || 'Grupo'
    const other = chat.members.find((m) => m.user_id !== user.id)
    return other?.user_name || 'Admin'
  }

  const getChatInitial = (chat) => {
    return getChatName(chat)[0]?.toUpperCase() || '?'
  }

  // ─── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // ─── Chat View (messages) ───────────────────────────────
  if (activeChat) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
              activeChat.is_group
                ? 'bg-purple-500/10 text-purple-500'
                : 'bg-brand-500/10 text-brand-500'
            }`}
          >
            {activeChat.is_group ? <Users size={18} /> : getChatInitial(activeChat)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{getChatName(activeChat)}</p>
            <p className="text-[10px] text-gray-400">
              {activeChat.is_group
                ? `${activeChat.members.length} miembros`
                : 'Mensaje directo'}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="card p-4 min-h-[55vh] max-h-[60vh] overflow-y-auto flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 px-4">
                <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
                  <MessageCircle size={28} className="text-brand-500" />
                </div>
                <p className="text-sm text-gray-500">
                  Inicia la conversación
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.sender_id === user.id
                    ? 'self-end bg-brand-500 text-white rounded-tr-sm'
                    : 'self-start bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.sender_id !== user.id && activeChat.is_group && (
                  <p className="text-[10px] font-semibold text-brand-500 mb-1">
                    {msg.sender_name}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    msg.sender_id === user.id ? 'text-white/60' : 'text-gray-400'
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

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Escribe tu mensaje..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
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

  // ─── Chat List ──────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <Radio size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Walkie-Talkie</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Chat entre administradores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="btn-primary px-3 py-2 flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {/* Chat list */}
      {chats.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
            <Radio size={32} className="text-brand-500" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">
            Sin conversaciones
          </h3>
          <p className="text-sm text-gray-400">
            Crea un chat individual o grupal con otros admins
          </p>
          <button
            onClick={() => setShowNewChat(true)}
            className="btn-primary px-4 py-2 text-sm mx-auto flex items-center gap-2"
          >
            <Plus size={16} /> Nuevo Chat
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => openChat(chat)}
              className="card p-4 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    chat.is_group
                      ? 'bg-purple-500/10 text-purple-500'
                      : 'bg-brand-500/10 text-brand-500'
                  }`}
                >
                  {chat.is_group ? <Users size={18} /> : getChatInitial(chat)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">
                      {getChatName(chat)}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {chat.last_message_at && (
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">
                          {new Date(chat.last_message_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                      {chat.unread_count > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {chat.unread_count > 9 ? '9+' : chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {chat.last_message || 'Sin mensajes'}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New Chat Dialog */}
      {showNewChat && (
        <NewChatDialog
          userId={user.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(chatId) => {
            setShowNewChat(false)
            fetchChats().then(() => {
              const found = chats.find((c) => c.id === chatId)
              if (found) openChat(found)
              // If not found yet, refetch and try again
              api.get('/admin/walkie-talkie/chats').then((res) => {
                setChats(res.data)
                const chat = res.data.find((c) => c.id === chatId)
                if (chat) openChat(chat)
              })
            })
          }}
        />
      )}
    </div>
  )
}

// ─── New Chat Dialog ──────────────────────────────────────────

function NewChatDialog({ userId, onClose, onCreated }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dm') // 'dm' | 'group'
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .get('/admin/walkie-talkie/admins')
      .then((res) => setAdmins(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleAdmin = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateDM = async (recipientId) => {
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', {
        recipient_id: recipientId,
      })
      onCreated(res.data.id)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setCreating(false)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedIds.size < 1) return
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', {
        name: groupName.trim(),
        member_ids: [...selectedIds],
      })
      onCreated(res.data.id)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
    setCreating(false)
  }

  const filtered = admins.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-lg">Nuevo Chat</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {[
            { id: 'dm', label: 'Individual' },
            { id: 'group', label: 'Grupo' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                setSelectedIds(new Set())
              }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'text-brand-500 border-b-2 border-brand-500'
                  : 'text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Group name input */}
        {tab === 'group' && (
          <div className="px-4 pt-3">
            <input
              className="input text-sm"
              placeholder="Nombre del grupo..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className="input pl-9 text-sm"
              placeholder="Buscar admin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Admin list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              No hay otros administradores
            </p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  if (tab === 'dm') {
                    handleCreateDM(a.id)
                  } else {
                    toggleAdmin(a.id)
                  }
                }}
                disabled={creating}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  tab === 'group' && selectedIds.has(a.id)
                    ? 'bg-brand-500/10 ring-1 ring-brand-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-sm">
                  {a.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm truncate">{a.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{a.email}</p>
                </div>
                {tab === 'group' && (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(a.id)
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {selectedIds.has(a.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Group create button */}
        {tab === 'group' && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleCreateGroup}
              disabled={creating || !groupName.trim() || selectedIds.size < 1}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {creating ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <Users size={16} /> Crear Grupo ({selectedIds.size}{' '}
                  {selectedIds.size === 1 ? 'miembro' : 'miembros'})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
