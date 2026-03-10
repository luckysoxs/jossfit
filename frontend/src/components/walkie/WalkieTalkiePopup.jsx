import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUnread } from '../../contexts/UnreadContext'
import useSmartPolling from '../../hooks/useSmartPolling'
import api from '../../services/api'
import {
  MessageCircle, Plus, X, Users, Send, AlertTriangle,
} from 'lucide-react'

export default function WalkieTalkiePopup({ onClose }) {
  const { user } = useAuth()
  const { refreshUnread } = useUnread()

  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatName, setNewChatName] = useState('')
  const [newChatTab, setNewChatTab] = useState('dm')
  const [admins, setAdmins] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [creating, setCreating] = useState(false)
  const [alertSending, setAlertSending] = useState(false)
  const [alertSent, setAlertSent] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // --- Fetch chats ---
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get('/admin/walkie-talkie/chats')
      setChats(res.data)
      if (!activeChat && res.data.length > 0) {
        setActiveChat(res.data[0])
      }
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }, [activeChat])

  useSmartPolling(fetchChats, 15000)

  // --- Fetch messages ---
  const fetchMessages = useCallback(async () => {
    if (!activeChat) return
    try {
      const res = await api.get('/admin/walkie-talkie/chats/' + activeChat.id + '/messages')
      setMessages(res.data)
      api.put('/admin/walkie-talkie/chats/' + activeChat.id + '/read').catch(() => {})
      refreshUnread()
    } catch (err) {
      console.error('Messages error:', err)
    }
  }, [activeChat?.id])

  useSmartPolling(fetchMessages, 5000, { enabled: !!activeChat })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      inputRef.current?.focus()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar')
    }
    setSending(false)
  }

  // --- Helpers ---
  const getChatName = (chat) => {
    if (chat.is_group) return chat.name || 'Grupo'
    const other = chat.members?.find((m) => m.user_id !== user.id)
    return other?.user_name || 'Admin'
  }

  const sendAlert = async () => {
    if (alertSending || !activeChat) return
    setAlertSending(true)
    try {
      await api.post('/admin/walkie-talkie/chats/' + activeChat.id + '/alert')
      setAlertSent(true)
      setTimeout(() => setAlertSent(false), 3000)
    } catch (err) { alert(err.response?.data?.detail || 'Error al enviar alerta') }
    setAlertSending(false)
  }

  // --- New chat logic ---
  const openNewChat = async () => {
    setShowNewChat(true)
    try {
      const res = await api.get('/admin/walkie-talkie/admins')
      setAdmins(res.data)
    } catch {}
  }

  const handleCreateDM = async (recipientId) => {
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', { recipient_id: recipientId })
      setShowNewChat(false)
      const r2 = await api.get('/admin/walkie-talkie/chats')
      setChats(r2.data)
      const chat = r2.data.find((c) => c.id === res.data.id)
      if (chat) { setActiveChat(chat); setMessages([]) }
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  const handleCreateGroup = async () => {
    if (!newChatName.trim() || selectedIds.size < 1) return
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', { name: newChatName.trim(), member_ids: [...selectedIds] })
      setShowNewChat(false)
      const r2 = await api.get('/admin/walkie-talkie/chats')
      setChats(r2.data)
      const chat = r2.data.find((c) => c.id === res.data.id)
      if (chat) { setActiveChat(chat); setMessages([]) }
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  const formatTime = (iso) => {
    return new Date(iso).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  // --- Render ---
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-md bg-gray-900 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh', height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Chat Admins</h2>
              <p className="text-gray-500 text-[10px]">
                {chats.length > 0 ? chats.length + ' chat' + (chats.length > 1 ? 's' : '') : 'Mensajes'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {activeChat && (
              <button
                onClick={sendAlert}
                disabled={alertSending || alertSent}
                className={'w-7 h-7 rounded-full flex items-center justify-center transition-colors ' +
                  (alertSent ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-amber-400 hover:bg-gray-700')
                }
                title="Enviar alerta"
              >
                <AlertTriangle size={13} />
              </button>
            )}
            {activeChat && (
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <Users size={13} />
              </button>
            )}
            <button
              onClick={openNewChat}
              className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Channel chips */}
        {chats.length > 0 && (
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-gray-800/50">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => { setActiveChat(chat); setMessages([]); }}
                className={'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ' +
                  (activeChat?.id === chat.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700')
                }
              >
                {getChatName(chat)}
                {chat.unread_count > 0 && (
                  <span className="ml-1 w-3.5 h-3.5 inline-flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full">
                    {chat.unread_count > 9 ? '9+' : chat.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : !activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <MessageCircle size={28} className="text-blue-500" />
            </div>
            <p className="text-gray-300 text-sm mb-1">Sin chats</p>
            <p className="text-gray-500 text-xs mb-3">Crea un chat para empezar</p>
            <button onClick={openNewChat} className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg font-semibold">
              Nuevo Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {/* Ephemeral notice */}
              <div className="text-center py-1">
                <span className="text-[9px] text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Los mensajes se borran cada 24h
                </span>
              </div>

              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center pt-8">
                  <p className="text-gray-500 text-xs">Sin mensajes a&uacute;n</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user.id
                  const isVoice = msg.message_type === 'voice'
                  return (
                    <div
                      key={msg.id}
                      className={'max-w-[80%] px-3 py-2 rounded-2xl text-xs ' +
                        (isMine
                          ? 'ml-auto bg-blue-500 text-white rounded-br-sm'
                          : 'mr-auto bg-gray-800 text-gray-200 rounded-bl-sm')
                      }
                    >
                      {!isMine && activeChat.is_group && (
                        <p className={'text-[9px] font-semibold mb-0.5 ' + (isMine ? 'text-white/70' : 'text-blue-400')}>
                          {msg.sender_name}
                        </p>
                      )}
                      {isVoice ? (
                        <p className={'italic ' + (isMine ? 'text-white/70' : 'text-gray-400')}>
                          [Mensaje de voz]
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <p className={'text-[9px] mt-0.5 ' + (isMine ? 'text-white/50' : 'text-gray-500')}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="px-3 py-2.5 border-t border-gray-800 flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                placeholder="Escribe un mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center text-white disabled:opacity-30 hover:bg-blue-600 transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}

        {/* Members panel */}
        {showMembers && activeChat && (
          <div className="absolute inset-0 bg-gray-900/95 rounded-2xl flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-bold text-sm">Miembros</h3>
              <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {activeChat.members?.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-800">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                    {m.user_name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-gray-200 text-sm">{m.user_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New chat panel */}
        {showNewChat && (
          <div className="absolute inset-0 bg-gray-900/95 rounded-2xl flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-white font-bold text-sm">Nuevo Chat</h3>
              <button onClick={() => { setShowNewChat(false); setSelectedIds(new Set()); setNewChatName('') }} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex border-b border-gray-800">
              {[{ id: 'dm', label: 'Individual' }, { id: 'group', label: 'Grupo' }].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setNewChatTab(t.id); setSelectedIds(new Set()) }}
                  className={'flex-1 py-2.5 text-xs font-semibold transition-colors ' +
                    (newChatTab === t.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
            {newChatTab === 'group' && (
              <div className="px-3 pt-2.5">
                <input
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nombre del grupo..."
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {admins.filter((a) => a.id !== user.id).map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    if (newChatTab === 'dm') handleCreateDM(a.id)
                    else {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(a.id)) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }
                  }}
                  disabled={creating}
                  className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ' +
                    (selectedIds.has(a.id) ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-gray-800 hover:bg-gray-700')
                  }
                >
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                    {a.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-200 text-sm font-medium">{a.name}</p>
                    <p className="text-gray-500 text-[10px]">{a.email}</p>
                  </div>
                </button>
              ))}
            </div>
            {newChatTab === 'group' && selectedIds.size > 0 && (
              <div className="p-3 border-t border-gray-800">
                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newChatName.trim()}
                  className="w-full py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear Grupo (' + selectedIds.size + ')'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
