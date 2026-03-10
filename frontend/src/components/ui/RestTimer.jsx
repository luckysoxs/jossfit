import { useState, useEffect, useRef, useCallback } from 'react'
import { Timer, X, RotateCcw, Play, Pause } from 'lucide-react'
import { ensureNotificationPermission, scheduleSWNotification, cancelSWNotification } from '../../utils/backgroundTimer'
import { playBoxingBell } from '../../utils/bellSound'

/**
 * Rest Timer — appears after completing an exercise.
 * Optional: user can skip/dismiss at any time.
 * Vibrates + plays sound when done.
 * Supports background: keeps counting when app is minimized and sends push notification.
 */
export default function RestTimer({ seconds, exerciseName, onClose }) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [running, setRunning] = useState(true)
  const intervalRef = useRef(null)
  const endTimeRef = useRef(Date.now() + seconds * 1000)

  const totalSeconds = seconds
  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 100

  const minutes = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference - (progress / 100) * circumference

  // Request notification permission on mount
  useEffect(() => { ensureNotificationPermission() }, [])

  // Play finish sound + vibrate
  const onFinish = useCallback(() => {
    cancelSWNotification()
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
    // Boxing bell sound 🥊
    playBoxingBell(3)
  }, [])

  // endTime-based interval: survives background correctly
  useEffect(() => {
    if (!running) return

    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(intervalRef.current)
        setRunning(false)
        onFinish()
      }
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [running, onFinish])

  // Background/foreground sync
  useEffect(() => {
    const handleVisibility = () => {
      if (!endTimeRef.current) return

      if (document.hidden) {
        // Schedule SW notification when going to background
        const remainingMs = endTimeRef.current - Date.now()
        if (remainingMs > 0 && running) {
          scheduleSWNotification(remainingMs)
        }
      } else {
        // Returning to foreground
        cancelSWNotification()
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        setTimeLeft(remaining)
        if (remaining <= 0 && running) {
          clearInterval(intervalRef.current)
          setRunning(false)
          onFinish()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [running, onFinish])

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelSWNotification()
  }, [])

  const togglePause = () => {
    setRunning(r => {
      if (r) {
        // Pausing — cancel any scheduled notification
        cancelSWNotification()
      } else {
        // Resuming — recalculate endTime from current timeLeft
        endTimeRef.current = Date.now() + timeLeft * 1000
      }
      return !r
    })
  }

  const restart = () => {
    clearInterval(intervalRef.current)
    cancelSWNotification()
    endTimeRef.current = Date.now() + totalSeconds * 1000
    setTimeLeft(totalSeconds)
    setRunning(true)
  }

  const handleClose = () => {
    cancelSWNotification()
    onClose()
  }

  const isFinished = timeLeft === 0

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-xs shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-in">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-brand-500" />
            <span className="font-semibold text-sm">Descanso</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Timer circle */}
        <div className="p-8 flex flex-col items-center gap-4">
          <div className="relative w-36 h-36">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-gray-100 dark:text-gray-800"
              />
              {/* Progress arc */}
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className={`transition-all duration-1000 ease-linear ${
                  isFinished ? 'text-green-500' : timeLeft <= 10 ? 'text-red-500' : 'text-brand-500'
                }`}
              />
            </svg>
            {/* Time display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold tabular-nums ${isFinished ? 'text-green-500' : ''}`}>
                {minutes}:{secs.toString().padStart(2, '0')}
              </span>
              {isFinished && (
                <span className="text-xs font-medium text-green-500 mt-1">¡Listo!</span>
              )}
            </div>
          </div>

          {/* Exercise name */}
          <p className="text-xs text-gray-400 text-center truncate max-w-full">
            {exerciseName}
          </p>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={restart}
              className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-brand-500 transition-colors"
              title="Reiniciar"
            >
              <RotateCcw size={20} />
            </button>
            {!isFinished && (
              <button
                onClick={togglePause}
                className="p-4 rounded-2xl bg-brand-500 text-white shadow-lg hover:bg-brand-600 transition-colors"
              >
                {running ? <Pause size={24} /> : <Play size={24} />}
              </button>
            )}
            <button
              onClick={handleClose}
              className={`px-5 py-3 rounded-xl text-sm font-medium transition-colors ${
                isFinished
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700'
              }`}
            >
              {isFinished ? 'Siguiente' : 'Saltar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
