import { createContext, useContext, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import useSmartPolling from '../hooks/useSmartPolling'
import api from '../services/api'

const UnreadContext = createContext({ notifications: 0, support: 0, walkie: 0, notes: 0 })

export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ notifications: 0, support: 0, walkie: 0, notes: 0 })

  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/unread-counts')
      setCounts(res.data)
    } catch {}
  }, [])

  // Single poll every 30s for ALL unread counts
  // Pauses automatically when tab is hidden or offline
  useSmartPolling(fetchCounts, 30000, { enabled: !!user })

  return (
    <UnreadContext.Provider value={{ ...counts, refreshUnread: fetchCounts }}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnread() {
  return useContext(UnreadContext)
}
