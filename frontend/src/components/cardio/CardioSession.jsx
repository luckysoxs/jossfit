import { useEffect } from 'react'
import { X, Volume2, VolumeX, Pause, Play, Square, Music } from 'lucide-react'
import useCardioTimer from '../../hooks/useCardioTimer'
import api from '../../services/api'

export default function CardioSession({ intervals, equipment, cardioType, level, duration, unit, onExit }) {
  const timer = useCardioTimer(intervals)

  useEffect(() => { timer.start() }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : sec
  }

  const openSpotify = () => {
    window.open('https://open.spotify.com', '_blank')
  }

  const saveSession = async () => {
    try {
      await api.post('/cardio', {
        date: new Date().toISOString().split('T')[0],
        cardio_type: cardioType,
        equipment,
        duration_minutes: duration,
        level,
      })
    } catch {}
    onExit()
  }

  if (timer.finished) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold">¡Sesión Completada!</h2>
        <div className="card space-y-3">
          <div className="flex justify-between"><span className="text-gray-400">Tipo</span><span className="font-medium">{cardioType.toUpperCase()}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Duración</span><span className="font-medium">{duration} min</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Nivel</span><span className="font-medium">{level}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Tiempo real</span><span className="font-medium">{Math.floor(timer.totalElapsed / 60)}:{String(timer.totalElapsed % 60).padStart(2, '0')}</span></div>
        </div>
        <button onClick={saveSession} className="btn-primary w-full">Guardar Sesión</button>
        <button onClick={onExit} className="btn-secondary w-full">Volver</button>
      </div>
    )
  }

  const current = timer.currentInterval
  const next = timer.nextInterval
  const isWork = current?.type === 'work'
  const isRecovery = current?.type === 'recovery'

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={timer.stop} className="p-2 text-gray-400 hover:text-white"><X size={24} /></button>
        <span className="font-medium text-sm text-gray-400">
          {cardioType.toUpperCase()} {duration}' · Nivel {level}
        </span>
        <button onClick={timer.toggleVoice} className="p-2 text-gray-400 hover:text-white">
          {timer.voiceEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>

      {/* Countdown Circle */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className={`w-40 h-40 rounded-full border-4 flex items-center justify-center ${
          isWork ? 'border-red-500' : isRecovery ? 'border-green-500' : 'border-brand-500'
        }`}>
          <span className="text-6xl font-bold tabular-nums">{formatTime(timer.secondsLeft)}</span>
        </div>

        {/* Type Badge */}
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
          isWork ? 'bg-red-500/20 text-red-400' : isRecovery ? 'bg-green-500/20 text-green-400' : 'bg-brand-500/20 text-brand-400'
        }`}>
          {isWork ? 'Trabajo' : isRecovery ? 'Recuperación' : 'Estable'}
        </span>

        {/* Current Range */}
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Velocidad actual</p>
          <p className="text-3xl font-bold mt-1">{current?.range[0]}-{current?.range[1]} {unit}</p>
          {next && (
            <p className="text-sm text-gray-500 mt-2">
              próxima: {next.range[0]}-{next.range[1]} {unit}
            </p>
          )}
        </div>
      </div>

      {/* Interval Bars */}
      <div className="flex items-end gap-0.5 h-16 mb-4 px-2">
        {intervals.map((interval, i) => {
          const maxDur = Math.max(...intervals.map(x => x.duration))
          const height = (interval.duration / maxDur) * 100
          const isCurrent = i === timer.currentIndex
          const isPast = i < timer.currentIndex
          return (
            <div
              key={i}
              className={`flex-1 rounded-t transition-all ${
                interval.type === 'work' ? 'bg-red-500' : interval.type === 'recovery' ? 'bg-green-500' : 'bg-brand-500'
              } ${isPast ? 'opacity-30' : isCurrent ? 'opacity-100 scale-y-110' : 'opacity-50'}`}
              style={{ height: `${height}%` }}
            />
          )
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${timer.progress * 100}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pb-4">
        <button onClick={openSpotify} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-white text-sm font-medium transition-colors">
          <Music size={18} /> Spotify
        </button>
        {timer.isPaused ? (
          <button onClick={timer.resume} className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center text-white">
            <Play size={28} fill="white" />
          </button>
        ) : (
          <button onClick={timer.pause} className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center text-white">
            <Pause size={28} />
          </button>
        )}
        <button onClick={timer.stop} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-medium transition-colors">
          <Square size={16} fill="white" /> Detener
        </button>
      </div>
    </div>
  )
}
