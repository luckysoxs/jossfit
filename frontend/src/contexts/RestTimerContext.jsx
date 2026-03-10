import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { playBoxingBell, warmUpAudio } from "../utils/bellSound"
import {
  ensureNotificationPermission,
  scheduleSWNotification,
  cancelSWNotification,
} from "../utils/backgroundTimer"

const RestTimerCtx = createContext(null)
const LS_END = "rest_timer_end"
const LS_TOTAL = "rest_timer_total"

export function RestTimerProvider({ children }) {
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef(null)
  const endTimeRef = useRef(null)

  // Restore from localStorage on mount (survives page nav + app close)
  useEffect(() => {
    const storedEnd = localStorage.getItem(LS_END)
    const storedTotal = localStorage.getItem(LS_TOTAL)
    if (storedEnd) {
      const end = parseInt(storedEnd, 10)
      const total = parseInt(storedTotal, 10) || 0
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      if (remaining > 0) {
        endTimeRef.current = end
        setTotalSeconds(total)
        setTimeLeft(remaining)
        setIsRunning(true)
      } else {
        localStorage.removeItem(LS_END)
        localStorage.removeItem(LS_TOTAL)
        playBoxingBell(3)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
      }
    }
  }, [])

  const onFinish = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    endTimeRef.current = null
    setIsRunning(false)
    setTimeLeft(0)
    localStorage.removeItem(LS_END)
    localStorage.removeItem(LS_TOTAL)
    cancelSWNotification()
    playBoxingBell(3)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
  }, [])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) onFinish()
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [isRunning, onFinish])

  useEffect(() => {
    const handler = () => {
      if (!endTimeRef.current) return
      if (document.hidden) {
        const ms = endTimeRef.current - Date.now()
        if (ms > 0 && isRunning) scheduleSWNotification(ms)
      } else {
        cancelSWNotification()
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        setTimeLeft(remaining)
        if (remaining <= 0 && isRunning) onFinish()
      }
    }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [isRunning, onFinish])

  const startTimer = useCallback((seconds) => {
    warmUpAudio()
    ensureNotificationPermission()
    if (intervalRef.current) clearInterval(intervalRef.current)
    const end = Date.now() + seconds * 1000
    endTimeRef.current = end
    localStorage.setItem(LS_END, end.toString())
    localStorage.setItem(LS_TOTAL, seconds.toString())
    setTotalSeconds(seconds)
    setTimeLeft(seconds)
    setIsRunning(true)
  }, [])

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    endTimeRef.current = null
    setIsRunning(false)
    setTimeLeft(0)
    setTotalSeconds(0)
    localStorage.removeItem(LS_END)
    localStorage.removeItem(LS_TOTAL)
    cancelSWNotification()
  }, [])

  const progress = totalSeconds > 0 ? (totalSeconds - timeLeft) / totalSeconds : 0

  return (
    <RestTimerCtx.Provider value={{
      timeLeft, totalSeconds, isRunning, progress,
      startTimer, stopTimer,
    }}>
      {children}
    </RestTimerCtx.Provider>
  )
}

export function useRestTimer() {
  return useContext(RestTimerCtx)
}
