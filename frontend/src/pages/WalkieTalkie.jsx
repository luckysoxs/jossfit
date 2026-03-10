import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import useSmartPolling from '../hooks/useSmartPolling'
import api from '../services/api'
import {
  MessageCircle, Plus, Send, ChevronLeft, Users, X,
  User as UserIcon, Search, AlertTriangle,
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
  const [alertSending, setAlertSending] = useState(false)
  const [alertSent, setAlertSent] = useState(false)
  const bottomRef = useRef(null)

  // --- Fetch chat list ---
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get('/admin/walkie-talkie/chats')
      setChats(res.data)
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useSmartPolling(fetchChats, 15000)

  // --- Fetch messages ---
  const fetchMessages = useCallback(async () => {
    if (!activeChat) return
    try {
      const res = await api.get('/admin/walkie-talkie/chats/' + activeChat.id + '/messages')
      setMessages(res.data)
      api.put('/admin/walkie-talkie/chats/' + activeChat.id + '/read').catch(() => {})
    } catch (err) {
      console.error('Messages error:', err)
    }
  }, [activeChat?.id])

  useSmartPolling(fetchMessages, 5000, { enabled: !!activeChat })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- Send alert ---
  const sendAlert = async () => {
    if (alertSending || !activeChat) return
    setAlertSending(true)
    try {
      await api.post('/admin/walkie-talkie/chats/' + activeChat.id + '/alert')
      setAlertSent(true)
      setTimeout(() => setAlertSent(false), 3000)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar alerta')
    }
    setAlertSending(false)
  }

  // --- Send text message ---
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || sending || !activeChat) return
    setSending(true)
    try {
      await api.post('/admin/walkie-talkie/chats/' + activeChat.id + '/messages', {
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

  // --- Helpers ---
  const openChat = (chat) => {
    setActiveChat(chat)
    setMessages([])
  }

  const goBack = () => {
    setActiveChat(null)
    setMessages([])
    fetchChats()
  }

  const getChatName = (chat) => {
    if (chat.is_group) return chat.name || 'Grupo'
    const other = chat.members.find((m) => m.user_id !== user.id)
    return other?.user_name || 'Admin'
  }

  const getChatInitial = (chat) => getChatName(chat)[0]?.toUpperCase() || '?'

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // --- Chat View ---
  if (activeChat) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft size={22} />
          </button>
          <div className={'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ' +
            (activeChat.is_group ? 'bg-purple-500/10 text-purple-500' : 'bg-brand-500/10 text-brand-500')
          }>
            {activeChat.is_group ? <Users size={18} /> : getChatInitial(activeChat)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{getChatName(activeChat)}</p>
            <p className="text-[10px] text-gray-400">
              {activeChat.is_group ? activeChat.members.length + ' miembros' : 'Mensaje directo'}
            </p>
          </div>
          <button
            onClick={sendAlert}
            disabled={alertSending || alertSent}
            className={'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ' +
              (alertSent
                ? 'bg-green-50 dark:bg-green-500/10 text-green-500'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20')
            }
          >
            {alertSent ? '\u2713' : <><AlertTriangle size={14} /> Alerta</>}
          </button>
        </div>

        {/* Messages */}
        <div className="card p-4 min-h-[55vh] max-h-[60vh] overflow-y-auto flex flex-col gap-3">
          <div className="text-center py-1">
            <p className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full inline-block">
              Los mensajes se borran cada 24h
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 px-4">
                <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
                  <MessageCircle size={28} className="text-brand-500" />
                </div>
                <p className="text-sm text-gray-500">Env&iacute;a un mensaje para empezar</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user.id
              const isVoice = msg.message_type === 'voice'
              return (
                <div
                  key={msg.id}
                  className={'max-w-[80%] p-3 rounded-2xl text-sm ' +
                    (isMine
                      ? 'self-end bg-brand-500 text-white rounded-tr-sm'
                      : 'self-start bg-gray-100 dark:bg-gray-800 rounded-tl-sm')
                  }
                >
                  {!isMine && activeChat.is_group && (
                    <p className={'text-[10px] font-semibold mb-1 ' + (isMine ? 'text-white/80' : 'text-brand-500')}>
                      {msg.sender_name}
                    </p>
                  )}
                  {isVoice ? (
                    <p className={'italic text-xs ' + (isMine ? 'text-white/70' : 'text-gray-400')}>[Mensaje de voz]</p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  <p className={'text-[10px] mt-1 ' + (isMine ? 'text-white/60' : 'text-gray-400')}>
                    {new Date(msg.created_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Escribe un mensaje..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" className="btn-primary px-4 flex items-center gap-2" disabled={!input.trim() || sending}>
            <Send size={18} />
          </button>
        </form>
      </div>
    )
  }

  // --- Chat List ---
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <MessageCircle size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Chat Admins</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Mensajes entre admins</p>
          </div>
        </div>
        <button onClick={() => setShowNewChat(true)} className="btn-primary px-3 py-2 flex items-center gap-2 text-sm">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      {chats.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
            <MessageCircle size={32} className="text-brand-500" />
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Sin conversaciones</h3>
          <p className="text-sm text-gray-400">Crea un chat individual o grupal con otros admins</p>
          <button onClick={() => setShowNewChat(true)} className="btn-primary px-4 py-2 text-sm mx-auto flex items-center gap-2">
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
                <div className={'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ' +
                  (chat.is_group ? 'bg-purple-500/10 text-purple-500' : 'bg-brand-500/10 text-brand-500')
                }>
                  {chat.is_group ? <Users size={18} /> : getChatInitial(chat)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{getChatName(chat)}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {chat.last_message_at && (
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">
                          {new Date(chat.last_message_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}
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

      {showNewChat && (
        <NewChatDialog
          userId={user.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(chatId) => {
            setShowNewChat(false)
            fetchChats().then(() => {
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

// --- New Chat Dialog ---
function NewChatDialog({ userId, onClose, onCreated }) {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dm')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/admin/walkie-talkie/admins')
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
      const res = await api.post('/admin/walkie-talkie/chats', { recipient_id: recipientId })
      onCreated(res.data.id)
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedIds.size < 1) return
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', { name: groupName.trim(), member_ids: [...selectedIds] })
      onCreated(res.data.id)
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  const filtered = admins.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-lg">Nuevo Chat</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          {[{ id: 'dm', label: 'Individual' }, { id: 'group', label: 'Grupo' }].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedIds(new Set()) }}
              className={'flex-1 py-3 text-sm font-semibold transition-colors ' +
                (tab === t.id ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-400')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'group' && (
          <div className="px-4 pt-3">
            <input className="input text-sm" placeholder="Nombre del grupo..." value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={100} />
          </div>
        )}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-sm" placeholder="Buscar admin..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No hay otros administradores</p>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => tab === 'dm' ? handleCreateDM(a.id) : toggleAdmin(a.id)}
                disabled={creating}
                className={'w-full flex items-center gap-3 p-3 rounded-xl transition-colors ' +
                  (tab === 'group' && selectedIds.has(a.id) ? 'bg-brand-500/10 ring-1 ring-brand-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50')
                }
              >
                <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-sm">
                  {a.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-sm truncate">{a.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{a.email}</p>
                </div>
                {tab === 'group' && (
                  <div className={'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ' +
                    (selectedIds.has(a.id) ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-gray-600')
                  }>
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
                <><Users size={16} /> Crear Grupo ({selectedIds.size})</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
