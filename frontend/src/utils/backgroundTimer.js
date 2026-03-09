/**
 * Background Timer Utilities
 *
 * Communicates with the service worker to schedule a push notification
 * when the rest timer expires while the app is in the background.
 *
 * Also requests Notification permission on first timer use.
 */

/** Request notification permission (safe to call multiple times) */
export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/** Tell the SW to schedule a notification after `remainingMs` milliseconds */
export async function scheduleSWNotification(remainingMs) {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'REST_TIMER_START', remainingMs })
  } catch (err) {
    console.warn('Could not schedule SW notification:', err)
  }
}

/** Tell the SW to cancel any scheduled rest-timer notification */
export async function cancelSWNotification() {
  try {
    const reg = await navigator.serviceWorker?.ready
    reg?.active?.postMessage({ type: 'REST_TIMER_CANCEL' })
  } catch (err) {
    console.warn('Could not cancel SW notification:', err)
  }
}
