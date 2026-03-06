import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { Sun, Moon, Shield, MessageCircle } from 'lucide-react'
import api from '../../services/api'

export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [unreadSupport, setUnreadSupport] = useState(0)

  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      try {
        const res = await api.get('/support/unread-count')
        setUnreadSupport(res.data.unread)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/icon-96x96.png" alt="JossFit" className="w-7 h-7 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">Fitness Jos</span>
        </Link>
        <div className="flex items-center gap-3">
          {user && (
            <Link
              to="/support"
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              aria-label="Chat de Ayuda"
            >
              <MessageCircle size={20} />
              {unreadSupport > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadSupport > 9 ? '9+' : unreadSupport}
                </span>
              )}
            </Link>
          )}
          {user?.is_admin && (
            <Link
              to="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-brand-500"
              aria-label="Admin Panel"
            >
              <Shield size={20} />
            </Link>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {user && (
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
              {user.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
