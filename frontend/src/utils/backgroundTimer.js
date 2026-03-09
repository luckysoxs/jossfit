/**
 * Background Timer Utilities
 *
 * Communicates with the service worker to schedule push notifications
 * when timers expire while the app is in the background.
 *
 * Supports both rest timers (between sets) and cardio interval timers.
 */

/** Request notification permission (safe to call multiple times) */
export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// ─── Rest Timer ───

/** Tell the SW to schedule a rest-timer notification after `remainingMs` ms */
export async function scheduleSWNotification(remainingMs) {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'REST_TIMER_START', remainingMs })
  } catch (err) {
    console.warn('Could not schedule SW notification:', err)
  }
}

/** Cancel any scheduled rest-timer notification */
export async function cancelSWNotification() {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'REST_TIMER_CANCEL' })
  } catch (err) {
    console.warn('Could not cancel SW notification:', err)
  }
}

// ─── Cardio Timer ───

/** Tell the SW to schedule a cardio notification after `remainingMs` ms with a custom body */
export async function scheduleCardioNotification(remainingMs, body) {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'CARDIO_TIMER_START', remainingMs, body })
  } catch (err) {
    console.warn('Could not schedule cardio notification:', err)
  }
}

/** Cancel any scheduled cardio notification */
export async function cancelCardioNotification() {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'CARDIO_TIMER_CANCEL' })
  } catch (err) {
    console.warn('Could not cancel cardio notification:', err)
  }
}
