import { useEffect, useRef, useCallback } from 'react'

/**
 * Smart polling hook that saves data by:
 * 1. Pausing when the tab is hidden (user switched to another tab/app)
 * 2. Pausing when offline (no internet)
 * 3. Running the callback immediately when the tab becomes visible again
 * 4. Cleaning up properly on unmount
 *
 * @param {Function} callback - async function to call on each poll
 * @param {number} intervalMs - polling interval in milliseconds
 * @param {Object} options - { enabled: boolean } to conditionally enable/disable
 */
export default function useSmartPolling(callback, intervalMs, options = {}) {
  const { enabled = true } = options
  const callbackRef = useRef(callback)
  const intervalRef = useRef(null)

  // Keep callback ref up to date without re-running effect
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const startPolling = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        callbackRef.current()
      }
    }, intervalMs)
  }, [intervalMs])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopPolling()
      return
    }

    // Run immediately on mount
    callbackRef.current()
    startPolling()

    // Pause/resume on visibility change
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        // Tab became visible — fetch immediately then resume
        callbackRef.current()
        stopPolling()
        startPolling()
      }
      // When hidden, the interval check inside will skip API calls
    }

    // Pause when offline, resume when online
    const onOnline = () => {
      callbackRef.current()
      stopPolling()
      startPolling()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled, startPolling, stopPolling])
}
