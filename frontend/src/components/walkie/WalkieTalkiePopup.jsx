import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useUnread } from '../../contexts/UnreadContext'
import useSmartPolling from '../../hooks/useSmartPolling'
import api from '../../services/api'
import {
  Radio, Plus, X, Mic, Users, MessageSquare,
  AlertTriangle, Play, Pause, Volume2,
} from 'lucide-react'

export default function WalkieTalkiePopup({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { refreshUnread } = useUnread()

  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
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

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const streamRef = useRef(null)
  const isRecordingRef = useRef(false)
  const pendingStopRef = useRef(false)
  const recordingDurationRef = useRef(0)

  // Audio playback
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)
  const [audioDurations, setAudioDurations] = useState({})
  const lastPlayedIdRef = useRef(null)
  const autoPlayEnabledRef = useRef(true)

  const bottomRef = useRef(null)

  // --- Fetch chats ---
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get('/admin/walkie-talkie/chats')
      setChats(res.data)
      if (!activeChat && res.data.length > 0) {
        setActiveChat(res.data[0])
      }
    } catch (err) {
      console.error('Walkie chats error:', err)
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
      console.error('Walkie messages error:', err)
    }
  }, [activeChat?.id])

  useSmartPolling(fetchMessages, 5000, { enabled: !!activeChat })

  // --- Auto-play incoming voice ---
  useEffect(() => {
    if (!activeChat || messages.length === 0 || !autoPlayEnabledRef.current) return
    const maxId = Math.max(...messages.map((m) => m.id))
    if (lastPlayedIdRef.current === null) {
      lastPlayedIdRef.current = maxId
      return
    }
    const newVoice = messages.filter(
      (msg) => msg.message_type === 'voice' && msg.sender_id !== user.id && msg.id > lastPlayedIdRef.current
    )
    if (newVoice.length > 0) {
      const latest = newVoice[newVoice.length - 1]
      lastPlayedIdRef.current = latest.id
      if (!isRecording) togglePlayAudio(latest.id, latest.audio_url)
    }
  }, [messages, activeChat, user?.id, isRecording])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // SW relay
  useEffect(() => {
    if (!activeChat) return
    const handler = (e) => {
      if (e.data?.type === 'WALKIE_VOICE_RECEIVED') fetchMessages()
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [activeChat, fetchMessages])

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      stopRecording()
    }
  }, [])

  // --- Voice recording ---
  const startRecording = useCallback(async () => {
    if (!activeChat || isRecordingRef.current) return
    isRecordingRef.current = true
    pendingStopRef.current = false
    recordingDurationRef.current = 0
    setIsRecording(true)
    setRecordingDuration(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (pendingStopRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        isRecordingRef.current = false
        setIsRecording(false)
        return
      }
      streamRef.current = stream
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      })
      mediaRecorderRef.current = mr
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      const chatId = activeChat.id
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 500) { isRecordingRef.current = false; setIsRecording(false); setRecordingDuration(0); return }
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          setSending(true)
          try {
            await api.post('/admin/walkie-talkie/chats/' + chatId + '/voice', { audio_base64: base64, duration: recordingDurationRef.current })
            await fetchMessages()
            await fetchChats()
          } catch (err) { alert(err.response?.data?.detail || 'Error al enviar voz') }
          setSending(false)
        }
        reader.readAsDataURL(blob)
        isRecordingRef.current = false
        setIsRecording(false)
        setRecordingDuration(0)
      }
      mr.start(250)
      const startTime = Date.now()
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        recordingDurationRef.current = elapsed
        setRecordingDuration(elapsed)
        if (elapsed >= 90) stopRecording()
      }, 100)
    } catch (err) {
      console.error('Mic error:', err)
      alert('No se pudo acceder al micr\u00f3fono')
      isRecordingRef.current = false
      setIsRecording(false)
    }
  }, [activeChat])

  const stopRecording = useCallback(() => {
    pendingStopRef.current = true
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
  }, [])

  const cancelRecording = useCallback(() => {
    pendingStopRef.current = true
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    audioChunksRef.current = []
    isRecordingRef.current = false
    setIsRecording(false)
    setRecordingDuration(0)
  }, [])

  // --- Audio playback ---
  const togglePlayAudio = useCallback(async (msgId, audioUrl) => {
    if (playingId === msgId) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      setPlayingId(null)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    try {
      const res = await api.get(audioUrl, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingId(msgId)
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0)
          setAudioDurations((prev) => ({ ...prev, [msgId]: audio.duration }))
      })
      audio.onended = () => {
        if (audio.currentTime > 0) setAudioDurations((prev) => ({ ...prev, [msgId]: audio.currentTime }))
        setPlayingId(null); audioRef.current = null; URL.revokeObjectURL(url)
      }
      audio.onerror = () => { setPlayingId(null); audioRef.current = null; URL.revokeObjectURL(url) }
      audio.play()
    } catch { setPlayingId(null) }
  }, [playingId])

  // --- Helpers ---
  const getChatName = (chat) => {
    if (chat.is_group) return chat.name || 'Grupo'
    const other = chat.members?.find((m) => m.user_id !== user.id)
    return other?.user_name || 'Admin'
  }

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return m + ':' + s.toString().padStart(2, '0')
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
      await fetchChats()
      const r2 = await api.get('/admin/walkie-talkie/chats')
      setChats(r2.data)
      const chat = r2.data.find((c) => c.id === res.data.id)
      if (chat) setActiveChat(chat)
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  const handleCreateGroup = async () => {
    if (!newChatName.trim() || selectedIds.size < 1) return
    setCreating(true)
    try {
      const res = await api.post('/admin/walkie-talkie/chats', { name: newChatName.trim(), member_ids: [...selectedIds] })
      setShowNewChat(false)
      await fetchChats()
      const r2 = await api.get('/admin/walkie-talkie/chats')
      setChats(r2.data)
      const chat = r2.data.find((c) => c.id === res.data.id)
      if (chat) setActiveChat(chat)
    } catch (err) { alert(err.response?.data?.detail || 'Error') }
    setCreating(false)
  }

  // --- Render ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <Radio size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Walkie Talkie</h2>
              <p className="text-gray-400 text-xs">
                {chats.length > 0 ? chats.length + ' canal' + (chats.length > 1 ? 'es' : '') : 'Push-to-talk'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openNewChat}
              className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Channel chips */}
        {chats.length > 0 && (
          <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat)
                  setMessages([])
                  lastPlayedIdRef.current = null
                }}
                className={'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ' +
                  (activeChat?.id === chat.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700')
                }
              >
                {chat.is_group ? '\ud83d\udc65' : '\ud83d\udcac'} {getChatName(chat)}
                {chat.unread_count > 0 && (
                  <span className="ml-1.5 w-4 h-4 inline-flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full">
                    {chat.unread_count > 9 ? '9+' : chat.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : !activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <Radio size={32} className="text-blue-500" />
            </div>
            <p className="text-gray-300 text-sm mb-2">Sin canales</p>
            <p className="text-gray-500 text-xs mb-4">Crea un chat para empezar</p>
            <button onClick={openNewChat} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl font-semibold">
              Nuevo Chat
            </button>
          </div>
        ) : (
          <>
            {/* PTT Area */}
            <div className="flex-1 flex flex-col items-center justify-center py-6 px-4">
              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-semibold">Grabando</span>
                  <span className="text-gray-400 text-xs">{formatDuration(recordingDuration)}</span>
                  <button onClick={cancelRecording} className="ml-2 text-gray-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Recent voice messages (compact) */}
              <div className="w-full max-h-32 overflow-y-auto mb-4 space-y-1.5 no-scrollbar">
                {messages.filter((m) => m.message_type === 'voice').slice(-5).map((msg) => {
                  const isMine = msg.sender_id === user.id
                  return (
                    <div
                      key={msg.id}
                      className={'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs ' +
                        (isMine ? 'bg-blue-500/20 ml-auto' : 'bg-gray-800 mr-auto')
                      }
                      style={{ maxWidth: '80%' }}
                    >
                      <button
                        onClick={() => togglePlayAudio(msg.id, msg.audio_url)}
                        className="w-6 h-6 rounded-full bg-blue-500/30 flex items-center justify-center flex-shrink-0"
                      >
                        {playingId === msg.id
                          ? <Pause size={10} className="text-white" />
                          : <Play size={10} className="text-white ml-0.5" />
                        }
                      </button>
                      <span className="text-gray-300 truncate">
                        {isMine ? 'T\u00fa' : msg.sender_name}
                      </span>
                      <span className="text-gray-500 ml-auto flex-shrink-0">
                        {formatDuration(audioDurations[msg.id] || msg.audio_duration || 0)}
                      </span>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Big PTT button */}
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); if (!isRecordingRef.current) startRecording() }}
                onMouseUp={() => { if (isRecordingRef.current) stopRecording() }}
                onMouseLeave={() => { if (isRecordingRef.current) stopRecording() }}
                onTouchStart={(e) => { e.preventDefault(); if (!isRecordingRef.current) startRecording() }}
                onTouchEnd={(e) => { e.preventDefault(); if (isRecordingRef.current) stopRecording() }}
                disabled={sending}
                className={'w-36 h-36 rounded-full flex flex-col items-center justify-center select-none transition-all duration-200 shadow-lg ' +
                  (isRecording
                    ? 'bg-red-500 scale-110 shadow-red-500/30'
                    : 'bg-blue-500 hover:bg-blue-600 active:scale-95 shadow-blue-500/30')
                }
              >
                <Mic size={36} className="text-white mb-1" />
                <span className="text-white text-xs font-bold tracking-wider uppercase">
                  {isRecording ? 'Soltar' : 'Mantener'}
                </span>
              </button>

              {/* Channel label */}
              <p className="text-gray-400 text-xs mt-3">
                Canal: {getChatName(activeChat)}
              </p>

              {/* Auto-play badge */}
              <div className="flex items-center gap-1 text-[10px] text-green-400 mt-1">
                <Volume2 size={10} />
                <span>Auto-play activado</span>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-around px-4 py-4 border-t border-gray-800">
              <button
                onClick={sendAlert}
                disabled={alertSending || alertSent}
                className={'flex flex-col items-center gap-1 text-xs font-medium transition-colors ' +
                  (alertSent ? 'text-green-400' : 'text-red-400 hover:text-red-300')
                }
              >
                <AlertTriangle size={20} />
                {alertSent ? 'Enviada' : 'Alertar'}
              </button>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className="flex flex-col items-center gap-1 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                <Users size={20} />
                Usuarios
              </button>
              <button
                onClick={() => { onClose(); navigate('/admin/walkie-talkie') }}
                className="flex flex-col items-center gap-1 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                <MessageSquare size={20} />
                Historial
              </button>
            </div>
          </>
        )}

        {/* Members panel */}
        {showMembers && activeChat && (
          <div className="absolute inset-0 bg-gray-900/95 rounded-3xl flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Miembros</h3>
              <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeChat.members?.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
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
          <div className="absolute inset-0 bg-gray-900/95 rounded-3xl flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-bold">Nuevo Chat</h3>
              <button onClick={() => { setShowNewChat(false); setSelectedIds(new Set()); setNewChatName('') }} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              {[{ id: 'dm', label: 'Individual' }, { id: 'group', label: 'Grupo' }].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setNewChatTab(t.id); setSelectedIds(new Set()) }}
                  className={'flex-1 py-3 text-xs font-semibold transition-colors ' +
                    (newChatTab === t.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {newChatTab === 'group' && (
              <div className="px-4 pt-3">
                <input
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nombre del grupo..."
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                  className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ' +
                    (selectedIds.has(a.id) ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-gray-800 hover:bg-gray-700')
                  }
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">
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
              <div className="p-4 border-t border-gray-800">
                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newChatName.trim()}
                  className="w-full py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
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
