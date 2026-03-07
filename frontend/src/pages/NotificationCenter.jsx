import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Bell, CheckCheck, BookOpen, Megaphone } from 'lucide-react'

export default function NotificationCenter() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notification-center').then(r => setNotifications(r.data))
      .catch(() => {}).finally(() => setLoading(false))
  }, [])

  const markAllRead = async () => {
    await api.put('/notification-center/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await api.put(`/notification-center/${notif.id}/read`)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
    if (notif.url && notif.url !== '/') navigate(notif.url)
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
            <Bell size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notificaciones</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 rounded-xl transition-colors">
            <CheckCheck size={14} /> Marcar todas
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => (
            <button key={notif.id} onClick={() => handleClick(notif)}
              className={`card w-full text-left transition-colors ${
                notif.is_read ? 'opacity-60' : 'border-l-4 border-l-brand-500'
              }`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.is_read ? 'bg-gray-100 dark:bg-gray-800' : 'bg-brand-50 dark:bg-brand-500/10'
                }`}>
                  {notif.url?.startsWith('/notes') ? (
                    <BookOpen size={14} className="text-brand-500" />
                  ) : (
                    <Megaphone size={14} className="text-brand-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${notif.is_read ? '' : 'font-bold'}`}>{notif.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{notif.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(notif.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
