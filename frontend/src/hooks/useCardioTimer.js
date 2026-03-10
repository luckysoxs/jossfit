import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ensureNotificationPermission,
  scheduleCardioNotification,
  cancelCardioNotification,
} from '../utils/backgroundTimer'
import { playBoxingBell } from '../utils/bellSound'

export default function useCardioTimer(intervals) {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(intervals[0]?.duration || 0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [finished, setFinished] = useState(false)

  const tickRef = useRef(null)
  const prevIndexRef = useRef(-1)

  // endTime-based tracking for background support
  const intervalEndTimeRef = useRef(null)   // absolute ms when current interval ends
  const pausedRemainingRef = useRef(null)   // ms remaining when paused
  const currentIndexRef = useRef(0)         // mirror for use in callbacks
  const isRunningRef = useRef(false)
  const isPausedRef = useRef(false)

  const totalDuration = intervals.reduce((sum, i) => sum + i.duration, 0)

  // ─── Sound: boxing bell on interval change / finish ───
  const playBeep = useCallback(() => {
    playBoxingBell(3)
  }, [])

  // ─── Speech synthesis ───
  const speak = useCallback((text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-MX'
    u.rate = 1.0
    window.speechSynthesis.speak(u)
  }, [voiceEnabled])

  // ─── Announce interval change (speech + beep + vibrate) ───
  useEffect(() => {
    if (!isRunning || currentIndex === prevIndexRef.current) return
    prevIndexRef.current = currentIndex
    const interval = intervals[currentIndex]
    if (!interval) return

    // Play sound + vibrate on every interval change (except the first one on start)
    if (currentIndex > 0) {
      playBeep()
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }

    if (interval.type === 'work') {
      speak(`Trabajo. ${interval.range[0]} a ${interval.range[1]}`)
    } else if (interval.type === 'recovery') {
      speak(`Recuperación. ${interval.range[0]} a ${interval.range[1]}`)
    } else if (interval.type === 'liss') {
      speak(`Mantén tu ritmo cardíaco entre ${interval.range[0]} y ${interval.range[1]} pulsaciones por minuto`)
    } else {
      speak(`Mantén ritmo. ${interval.range[0]} a ${interval.range[1]}`)
    }
  }, [currentIndex, isRunning, intervals, speak, playBeep])

  // ─── Helpers ───

  /** Calculate total elapsed seconds from current position */
  const calcTotalElapsed = useCallback((idx, endTime) => {
    let elapsed = 0
    for (let i = 0; i < idx && i < intervals.length; i++) {
      elapsed += intervals[i].duration
    }
    if (idx < intervals.length) {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      elapsed += intervals[idx].duration - remaining
    }
    return Math.max(0, elapsed)
  }, [intervals])

  /** Advance through intervals that have already passed, return new state */
  const advanceIntervals = useCallback(() => {
    let idx = currentIndexRef.current
    let endTime = intervalEndTimeRef.current
    if (!endTime) return null

    while (Date.now() >= endTime) {
      idx++
      if (idx >= intervals.length) {
        return { finished: true, idx: intervals.length - 1, endTime }
      }
      endTime += intervals[idx].duration * 1000
    }

    return { finished: false, idx, endTime }
  }, [intervals])

  /** Build notification body for the next interval */
  const getNextIntervalNotifBody = useCallback((fromIdx) => {
    const nextIdx = fromIdx + 1
    if (nextIdx >= intervals.length) {
      return '¡Sesión de cardio completada! Buen trabajo 💪'
    }
    const next = intervals[nextIdx]
    if (next.type === 'work') {
      return `¡Trabajo! Sube la intensidad 🔥 ${next.range[0]}-${next.range[1]}`
    } else if (next.type === 'recovery') {
      return `Recuperación 🧘 Baja el ritmo ${next.range[0]}-${next.range[1]}`
    }
    return `Mantén el ritmo ${next.range[0]}-${next.range[1]}`
  }, [intervals])

  // ─── Main timer tick (endTime-based) ───
  useEffect(() => {
    if (!isRunning || isPaused) {
      if (tickRef.current) clearInterval(tickRef.current)
      return
    }

    tickRef.current = setInterval(() => {
      const result = advanceIntervals()
      if (!result) return

      if (result.finished) {
        // Session complete
        clearInterval(tickRef.current)
        tickRef.current = null
        intervalEndTimeRef.current = null
        isRunningRef.current = false
        setIsRunning(false)
        setFinished(true)
        cancelCardioNotification()
        playBeep()
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
        speak('Sesión completada. Buen trabajo.')
        setSecondsLeft(0)
        setTotalElapsed(totalDuration)
        return
      }

      // Update endTime and index
      intervalEndTimeRef.current = result.endTime
      if (result.idx !== currentIndexRef.current) {
        currentIndexRef.current = result.idx
        setCurrentIndex(result.idx)
      }

      const remaining = Math.max(0, Math.ceil((result.endTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setTotalElapsed(calcTotalElapsed(result.idx, result.endTime))

      // Countdown speech "3, 2, 1"
      if (remaining === 4) speak('3, 2, 1')
    }, 1000)

    return () => clearInterval(tickRef.current)
  }, [isRunning, isPaused, intervals, speak, playBeep, advanceIntervals, calcTotalElapsed, totalDuration])

  // ─── Background/foreground sync ───
  useEffect(() => {
    const handleVisibility = () => {
      if (!isRunningRef.current || isPausedRef.current || !intervalEndTimeRef.current) return

      if (document.hidden) {
        // Going to background → schedule push notification for next interval change
        const remainingMs = intervalEndTimeRef.current - Date.now()
        if (remainingMs > 0) {
          const body = getNextIntervalNotifBody(currentIndexRef.current)
          scheduleCardioNotification(remainingMs, body)
        }
      } else {
        // Returning to foreground → cancel scheduled notification, catch up
        cancelCardioNotification()

        const result = advanceIntervals()
        if (!result) return

        if (result.finished) {
          if (tickRef.current) clearInterval(tickRef.current)
          tickRef.current = null
          intervalEndTimeRef.current = null
          isRunningRef.current = false
          setIsRunning(false)
          setFinished(true)
          playBeep()
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
          speak('Sesión completada. Buen trabajo.')
          setSecondsLeft(0)
          setTotalElapsed(totalDuration)
          return
        }

        intervalEndTimeRef.current = result.endTime
        currentIndexRef.current = result.idx
        setCurrentIndex(result.idx)
        const remaining = Math.max(0, Math.ceil((result.endTime - Date.now()) / 1000))
        setSecondsLeft(remaining)
        setTotalElapsed(calcTotalElapsed(result.idx, result.endTime))
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [intervals, advanceIntervals, getNextIntervalNotifBody, speak, playBeep, calcTotalElapsed, totalDuration])

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelCardioNotification()
  }, [])

  // ─── Controls ───
  const start = () => {
    ensureNotificationPermission()
    const endTime = Date.now() + (intervals[0]?.duration || 0) * 1000
    intervalEndTimeRef.current = endTime
    currentIndexRef.current = 0
    isRunningRef.current = true
    isPausedRef.current = false
    pausedRemainingRef.current = null
    prevIndexRef.current = -1
    setIsRunning(true)
    setIsPaused(false)
    setCurrentIndex(0)
    setSecondsLeft(intervals[0]?.duration || 0)
    setTotalElapsed(0)
    setFinished(false)
  }

  const pause = () => {
    setIsPaused(true)
    isPausedRef.current = true
    pausedRemainingRef.current = intervalEndTimeRef.current - Date.now()
    cancelCardioNotification()
  }

  const resume = () => {
    intervalEndTimeRef.current = Date.now() + (pausedRemainingRef.current || 0)
    pausedRemainingRef.current = null
    setIsPaused(false)
    isPausedRef.current = false
  }

  const stop = () => {
    setIsRunning(false)
    isRunningRef.current = false
    setIsPaused(false)
    isPausedRef.current = false
    setFinished(true)
    intervalEndTimeRef.current = null
    pausedRemainingRef.current = null
    cancelCardioNotification()
    window.speechSynthesis?.cancel()
  }

  const toggleVoice = () => setVoiceEnabled(v => !v)

  return {
    isRunning, isPaused, finished,
    currentIndex, secondsLeft, totalElapsed, totalDuration,
    currentInterval: intervals[currentIndex] || null,
    nextInterval: intervals[currentIndex + 1] || null,
    voiceEnabled,
    start, pause, resume, stop, toggleVoice,
    progress: totalDuration > 0 ? totalElapsed / totalDuration : 0,
  }
}
