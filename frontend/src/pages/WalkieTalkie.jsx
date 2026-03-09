import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import useSmartPolling from '../hooks/useSmartPolling'
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
  Mic,
  Play,
  Pause,
  Square,
  AlertTriangle,
  Volume2,
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

  // ─── Voice recording state ─────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const streamRef = useRef(null)
  // Refs for synchronous checks (state updates are async → race conditions)
  const isRecordingRef = useRef(false)
  const pendingStopRef = useRef(false)
  const recordingDurationRef = useRef(0)

  // ─── Audio playback state ──────────────────────────────────
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)
  const [audioDurations, setAudioDurations] = useState({}) // detected durations {msgId: secs}

  // ─── Auto-play tracking ────────────────────────────────────
  const lastPlayedIdRef = useRef(null) // null = not initialized, number = highest played ID
  const autoPlayEnabledRef = useRef(true)

  // ─── Fetch chat list ─────────────────────────────────────
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get('/admin/walkie-talkie/chats')
      setChats(res.data)
    } catch (err) {
      console.error('Walkie chats error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll chats every 15s, pauses when tab hidden/offline
  useSmartPolling(fetchChats, 15000)

  // ─── Fetch messages for active chat ──────────────────────
  const fetchMessages = useCallback(async () => {
    if (!activeChat) return
    try {
      const res = await api.get(`/admin/walkie-talkie/chats/${activeChat.id}/messages`)
      setMessages(res.data)
      api.put(`/admin/walkie-talkie/chats/${activeChat.id}/read`).catch(() => {})
    } catch (err) {
      console.error('Walkie messages error:', err)
    }
  }, [activeChat?.id])

  // Poll messages every 5s for real-time feel, pauses when tab hidden/offline
  useSmartPolling(fetchMessages, 5000, { enabled: !!activeChat })

  // ─── Auto-play incoming voice messages (Zello-style) ──────
  useEffect(() => {
    if (!activeChat || messages.length === 0 || !autoPlayEnabledRef.current) return

    const maxId = Math.max(...messages.map((m) => m.id))

    // First load: initialize lastPlayedId to max existing ID (don't replay old)
    if (lastPlayedIdRef.current === null) {
      lastPlayedIdRef.current = maxId
      return
    }

    // Find new voice messages from OTHER users since last check
    const newVoiceMessages = messages.filter(
      (msg) =>
        msg.message_type === 'voice' &&
        msg.sender_id !== user.id &&
        msg.id > lastPlayedIdRef.current
    )

    if (newVoiceMessages.length > 0) {
      // Only auto-play the LAST one
      const latest = newVoiceMessages[newVoiceMessages.length - 1]
      lastPlayedIdRef.current = latest.id

      // Don't auto-play if user is currently recording
      if (isRecording) return

      togglePlayAudio(latest.id, latest.audio_url)
    }
  }, [messages, activeChat, user.id, isRecording])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Pre-warm mic permission once so the browser remembers the grant
  // and doesn't prompt on every recording
  useEffect(() => {
    if (!activeChat) return
    if (localStorage.getItem('jf_mic_ok')) return
    ;(async () => {
      try {
        // Check if already granted via Permissions API
        const p = await navigator.permissions?.query({ name: 'microphone' })
        if (p?.state === 'granted') { localStorage.setItem('jf_mic_ok', '1'); return }
      } catch {}
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(t => t.stop())
        localStorage.setItem('jf_mic_ok', '1')
      } catch {}
    })()
  }, [activeChat])

  // Listen for SW messages — when a walkie-talkie push arrives,
  // the SW relays it here so we can fetch + auto-play even if tab is hidden
  useEffect(() => {
    if (!activeChat) return

    const handleSWMessage = (event) => {
      if (event.data?.type === 'WALKIE_VOICE_RECEIVED') {
        fetchMessages()
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
  }, [activeChat, fetchMessages])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      stopRecording()
    }
  }, [])

  // ─── Send alert (per-chat) ──────────────────────────────────
  const sendAlert = async () => {
    if (alertSending || !activeChat) return
    setAlertSending(true)
    try {
      await api.post(`/admin/walkie-talkie/chats/${activeChat.id}/alert`)
      setAlertSent(true)
      setTimeout(() => setAlertSent(false), 3000)
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al enviar alerta')
    }
    setAlertSending(false)
  }

  // ─── Send text message ─────────────────────────────────────
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

  // ─── Voice recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!activeChat || isRecordingRef.current) return

    // Set flags SYNCHRONOUSLY before the async getUserMedia call
    // so that onTouchEnd can detect we're recording even if mic prompt is showing
    isRecordingRef.current = true
    pendingStopRef.current = false
    recordingDurationRef.current = 0
    setIsRecording(true)
    setRecordingDuration(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // User released button while waiting for mic permission
      if (pendingStopRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        isRecordingRef.current = false
        setIsRecording(false)
        return
      }

      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      const chatId = activeChat.id // capture for onstop closure
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (blob.size < 500) {
          isRecordingRef.current = false
          setIsRecording(false)
          setRecordingDuration(0)
          return
        }

        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          setSending(true)
          try {
            await api.post(`/admin/walkie-talkie/chats/${chatId}/voice`, {
              audio_base64: base64,
              duration: recordingDurationRef.current, // ref has live value, not stale closure
            })
            await fetchMessages()
            await fetchChats()
          } catch (err) {
            alert(err.response?.data?.detail || 'Error al enviar voz')
          }
          setSending(false)
        }
        reader.readAsDataURL(blob)

        isRecordingRef.current = false
        setIsRecording(false)
        setRecordingDuration(0)
      }

      mediaRecorder.start(250)

      // Duration timer
      const startTime = Date.now()
      recordingTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        recordingDurationRef.current = elapsed
        setRecordingDuration(elapsed)
        if (elapsed >= 90) stopRecording()
      }, 100)
    } catch (err) {
      console.error('Mic error:', err)
      alert('No se pudo acceder al micrófono')
      isRecordingRef.current = false
      setIsRecording(false)
    }
  }, [activeChat])

  const stopRecording = useCallback(() => {
    pendingStopRef.current = true
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const cancelRecording = useCallback(() => {
    pendingStopRef.current = true
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    audioChunksRef.current = []
    isRecordingRef.current = false
    setIsRecording(false)
    setRecordingDuration(0)
  }, [])

  // ─── Audio playback ───────────────────────────────────────
  const togglePlayAudio = useCallback(async (msgId, audioUrl) => {
    if (playingId === msgId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingId(null)
      return
    }

    // Stop previous
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    try {
      const res = await api.get(audioUrl, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingId(msgId)

      // Detect real duration from audio element (fixes old messages with duration=0)
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          setAudioDurations(prev => ({ ...prev, [msgId]: audio.duration }))
        }
      })

      audio.onended = () => {
        // Fallback: use currentTime at end as duration
        if (audio.currentTime > 0) {
          setAudioDurations(prev => ({ ...prev, [msgId]: audio.currentTime }))
        }
        setPlayingId(null)
        audioRef.current = null
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setPlayingId(null)
        audioRef.current = null
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch {
      // Silently fail for auto-play (browser may block)
      setPlayingId(null)
    }
  }, [playingId])

  // ─── Open/close chat ──────────────────────────────────────
  const openChat = (chat) => {
    setActiveChat(chat)
    setMessages([])
    lastPlayedIdRef.current = null // Will initialize on first message load
  }

  const goBack = () => {
    cancelRecording()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingId(null)
    setActiveChat(null)
    setMessages([])
    lastPlayedIdRef.current = null
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

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
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
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gray-400">
                {activeChat.is_group
                  ? `${activeChat.members.length} miembros`
                  : 'Mensaje directo'}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-green-500">
                <Volume2 size={10} />
                <span>Auto-play</span>
              </div>
            </div>
          </div>
          <button
            onClick={sendAlert}
            disabled={alertSending || alertSent}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              alertSent
                ? 'bg-green-50 dark:bg-green-500/10 text-green-500'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20'
            }`}
            title="Alertar que quieres hablar"
          >
            {alertSent ? (
              <>✓</>
            ) : alertSending ? (
              <div className="animate-spin w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full" />
            ) : (
              <><AlertTriangle size={14} /> Alerta</>
            )}
          </button>
        </div>

        {/* Messages */}
        <div className="card p-4 min-h-[55vh] max-h-[60vh] overflow-y-auto flex flex-col gap-3">
          {/* Ephemeral notice */}
          <div className="text-center py-1">
            <p className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full inline-block">
              Los mensajes se borran automáticamente cada 24h
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 px-4">
                <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
                  <Radio size={28} className="text-brand-500" />
                </div>
                <p className="text-sm text-gray-500">
                  Mantén presionado el micrófono para hablar
                </p>
                <p className="text-xs text-gray-400">
                  El audio se reproduce automáticamente al recibirlo
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user.id
              const isVoice = msg.message_type === 'voice'

              return (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    isMine
                      ? 'self-end bg-brand-500 text-white rounded-tr-sm'
                      : 'self-start bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
                  }`}
                >
                  {!isMine && activeChat.is_group && (
                    <p className={`text-[10px] font-semibold mb-1 ${isMine ? 'text-white/80' : 'text-brand-500'}`}>
                      {msg.sender_name}
                    </p>
                  )}

                  {isVoice ? (
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <button
                        onClick={() => togglePlayAudio(msg.id, msg.audio_url)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isMine
                            ? 'bg-white/20 hover:bg-white/30'
                            : 'bg-brand-500/10 hover:bg-brand-500/20'
                        }`}
                      >
                        {playingId === msg.id ? (
                          <Pause size={16} className={isMine ? 'text-white' : 'text-brand-500'} />
                        ) : (
                          <Play size={16} className={`${isMine ? 'text-white' : 'text-brand-500'} ml-0.5`} />
                        )}
                      </button>
                      <div className="flex-1 space-y-1">
                        {/* Waveform */}
                        <div className="flex items-center gap-0.5 h-5">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 rounded-full transition-all ${
                                isMine ? 'bg-white/40' : 'bg-gray-400/40 dark:bg-gray-500/40'
                              } ${
                                playingId === msg.id ? 'animate-pulse' : ''
                              }`}
                              style={{
                                height: `${Math.max(4, Math.sin(i * 0.8) * 12 + Math.random() * 8 + 6)}px`,
                              }}
                            />
                          ))}
                        </div>
                        <p className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
                          {formatDuration(audioDurations[msg.id] || msg.audio_duration || 0)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  )}

                  <p
                    className={`text-[10px] mt-1 ${
                      isMine ? 'text-white/60' : 'text-gray-400'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area — mic button stays at same DOM position for touch events */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex gap-2">
            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <button type="button" onClick={cancelRecording} className="text-red-400 hover:text-red-500">
                  <X size={16} />
                </button>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-500">Grabando</span>
                <span className="text-xs text-gray-500 ml-auto">{formatDuration(recordingDuration)}</span>
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex-1 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Escribe o mantén el mic..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={2000}
                />
                {input.trim() && (
                  <button
                    type="submit"
                    className="btn-primary px-4 flex items-center gap-2"
                    disabled={sending}
                  >
                    <Send size={18} />
                  </button>
                )}
              </form>
            )}
          </div>
          {/* Mic button — ALWAYS at same position in DOM tree */}
          {(!input.trim() || isRecording) && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                if (!isRecordingRef.current) startRecording()
              }}
              onMouseUp={() => {
                if (isRecordingRef.current) stopRecording()
              }}
              onMouseLeave={() => {
                if (isRecordingRef.current) stopRecording()
              }}
              onTouchStart={(e) => {
                e.preventDefault()
                if (!isRecordingRef.current) startRecording()
              }}
              onTouchEnd={(e) => {
                e.preventDefault()
                if (isRecordingRef.current) stopRecording()
              }}
              className={`px-4 py-3 rounded-xl flex items-center gap-2 select-none transition-colors ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'btn-primary'
              }`}
              disabled={sending}
            >
              <Mic size={18} />
            </button>
          )}
        </div>
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
              Push-to-talk entre admins
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

      {/* Info banner */}
      <div className="flex items-center gap-3 bg-brand-50 dark:bg-brand-500/10 rounded-xl p-3">
        <Volume2 size={18} className="text-brand-500 flex-shrink-0" />
        <p className="text-xs text-brand-600 dark:text-brand-400">
          Los audios se reproducen automáticamente al recibirlos. Los mensajes se borran cada 24h.
        </p>
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
