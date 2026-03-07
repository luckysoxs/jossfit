import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, Check, X } from 'lucide-react'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import { getQueue, syncQueue } from '../../services/offlineCache'
import api from '../../services/api'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  const [queueCount, setQueueCount] = useState(() => getQueue().length)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [showReconnect, setShowReconnect] = useState(false)

  // Refresh queue count only when connectivity changes (no polling!)
  useEffect(() => {
    setQueueCount(getQueue().length)
  }, [online])

  // When we come back online, auto-sync
  useEffect(() => {
    if (online && queueCount > 0) {
      setShowReconnect(true)
      handleSync()
    }
    if (online && queueCount === 0) {
      // Show brief "back online" then hide
      if (showReconnect) {
        const t = setTimeout(() => setShowReconnect(false), 3000)
        return () => clearTimeout(t)
      }
    }
  }, [online])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncQueue(api)
      setQueueCount(getQueue().length)
      setSyncResult(result)
      if (result.failed === 0) {
        setTimeout(() => {
          setSyncResult(null)
          setShowReconnect(false)
        }, 3000)
      }
    } catch {
      setSyncResult({ synced: 0, failed: queueCount })
    } finally {
      setSyncing(false)
    }
  }

  // Nothing to show
  if (online && !showReconnect && queueCount === 0) return null

  // Offline banner
  if (!online) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in">
        <WifiOff size={16} />
        <span>Sin conexion — Modo offline</span>
        {queueCount > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {queueCount} pendiente{queueCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  // Reconnected + syncing/synced
  if (showReconnect) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in">
        {syncing ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            <span>Sincronizando...</span>
          </>
        ) : syncResult ? (
          syncResult.failed > 0 ? (
            <>
              <X size={16} />
              <span>{syncResult.synced} sincronizados, {syncResult.failed} fallaron</span>
              <button onClick={handleSync} className="bg-white/20 px-2 py-0.5 rounded-full text-xs hover:bg-white/30">
                Reintentar
              </button>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>De vuelta online — Todo sincronizado</span>
            </>
          )
        ) : (
          <>
            <Check size={16} />
            <span>Conexion restaurada</span>
          </>
        )}
      </div>
    )
  }

  return null
}
