import api from './api'

export async function requestNotificationPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  return true
}

export async function subscribeToPush() {
  try {
    // Get VAPID public key from backend
    const { data } = await api.get('/notifications/vapid-public-key')
    const vapidPublicKey = data.public_key

    // Convert VAPID key to Uint8Array
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }
      return outputArray
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    // Send subscription to backend
    const subJSON = subscription.toJSON()
    await api.post('/notifications/subscribe', {
      endpoint: subJSON.endpoint,
      keys: subJSON.keys,
    })

    return true
  } catch (err) {
    console.error('Push subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      const subJSON = subscription.toJSON()
      await api.delete('/notifications/unsubscribe', {
        data: {
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        },
      })
      await subscription.unsubscribe()
    }

    return true
  } catch (err) {
    console.error('Push unsubscribe failed:', err)
    return false
  }
}

export async function isPushSubscribed() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}
