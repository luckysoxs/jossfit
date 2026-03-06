import { useState, useEffect, useRef, useCallback } from 'react'

export default function useCardioTimer(intervals) {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(intervals[0]?.duration || 0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [finished, setFinished] = useState(false)
  const intervalRef = useRef(null)
  const prevIndexRef = useRef(-1)

  const totalDuration = intervals.reduce((sum, i) => sum + i.duration, 0)

  const speak = useCallback((text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-MX'
    u.rate = 1.0
    window.speechSynthesis.speak(u)
  }, [voiceEnabled])

  useEffect(() => {
    if (!isRunning || currentIndex === prevIndexRef.current) return
    prevIndexRef.current = currentIndex
    const interval = intervals[currentIndex]
    if (!interval) return
    if (interval.type === 'work') {
      speak(`Trabajo. ${interval.range[0]} a ${interval.range[1]}`)
    } else if (interval.type === 'recovery') {
      speak(`Recuperación. ${interval.range[0]} a ${interval.range[1]}`)
    } else {
      speak(`Mantén ritmo. ${interval.range[0]} a ${interval.range[1]}`)
    }
  }, [currentIndex, isRunning, intervals, speak])

  useEffect(() => {
    if (!isRunning || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setCurrentIndex(idx => {
            const next = idx + 1
            if (next >= intervals.length) {
              setIsRunning(false)
              setFinished(true)
              speak('Sesión completada. Buen trabajo.')
              return idx
            }
            setSecondsLeft(intervals[next].duration)
            return next
          })
          return 0
        }
        if (prev === 4) speak('3, 2, 1')
        return prev - 1
      })
      setTotalElapsed(prev => prev + 1)
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [isRunning, isPaused, intervals, speak])

  const start = () => {
    setIsRunning(true)
    setIsPaused(false)
    setCurrentIndex(0)
    setSecondsLeft(intervals[0]?.duration || 0)
    setTotalElapsed(0)
    setFinished(false)
    prevIndexRef.current = -1
  }

  const pause = () => setIsPaused(true)
  const resume = () => setIsPaused(false)
  const stop = () => { setIsRunning(false); setIsPaused(false); setFinished(true); window.speechSynthesis?.cancel() }
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
