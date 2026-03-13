import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { Sun, Moon, Shield, Lightbulb, RotateCw } from 'lucide-react'

export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (!user) return
    const seen = localStorage.getItem('suggestions_tooltip_seen')
    if (!seen) {
      // Small delay so the header renders first
      const t1 = setTimeout(() => setShowTooltip(true), 1500)
      const t2 = setTimeout(() => {
        setShowTooltip(false)
        localStorage.setItem('suggestions_tooltip_seen', '1')
      }, 7000)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [user])

  const dismissTooltip = () => {
    setShowTooltip(false)
    localStorage.setItem('suggestions_tooltip_seen', '1')
  }

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/icon-96x96.png" alt="JossFit" className="w-7 h-7 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">JOSSFITness</span>
        </Link>
        <div className="flex items-center gap-3">
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
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            aria-label="Recargar página"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {/* Suggestion icon with first-use tooltip */}
          <div className="relative">
            <Link
              to="/suggestions"
              onClick={dismissTooltip}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-yellow-500"
              aria-label="Sugerencias"
            >
              <Lightbulb size={20} />
            </Link>
            {showTooltip && (
              <div
                onClick={dismissTooltip}
                className="absolute right-0 top-full mt-2 w-44 p-2.5 rounded-xl bg-yellow-500 text-white text-xs font-medium shadow-lg animate-bounce cursor-pointer z-50"
              >
                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-yellow-500 rotate-45" />
                <span className="flex items-center gap-1.5">
                  <Lightbulb size={14} />
                  ¿Tienes ideas? ¡Dinos!
                </span>
              </div>
            )}
          </div>
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
