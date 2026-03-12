/**
 * Offline Cache Utility
 * - Caches API responses in localStorage for offline access
 * - Queues mutations (POST/PUT/DELETE) for sync when back online
 */

const CACHE_PREFIX = 'offline_cache_'
const QUEUE_KEY = 'offline_queue'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// ─── Cache read/write ───

export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }))
  } catch (e) {
    console.warn('Cache write failed:', e)
  }
}

export function cacheGet(key, maxAge = CACHE_TTL) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > maxAge) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function cacheRemove(key) {
  localStorage.removeItem(CACHE_PREFIX + key)
}

// ─── Offline mutation queue ───

export function queueAction(action) {
  // action = { id, method, url, data, description }
  try {
    const queue = getQueue()
    queue.push({
      ...action,
      id: action.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      queuedAt: new Date().toISOString(),
    })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    window.dispatchEvent(new Event('offline-queue-changed'))
    return true
  } catch (e) {
    console.warn('Queue write failed:', e)
    return false
  }
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export function clearQueue() {
  localStorage.setItem(QUEUE_KEY, '[]')
}

export function removeFromQueue(actionId) {
  const queue = getQueue().filter(a => a.id !== actionId)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/**
 * Sync all queued actions. Returns { synced, failed } counts.
 */
export async function syncQueue(api) {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const action of queue) {
    try {
      const { method, url, data } = action
      if (method === 'post') {
        await api.post(url, data)
      } else if (method === 'put') {
        await api.put(url, data)
      } else if (method === 'delete') {
        await api.delete(url)
      }
      removeFromQueue(action.id)
      synced++
    } catch (err) {
      console.error('Sync failed for action:', action.description, err)
      failed++
    }
  }

  return { synced, failed }
}
