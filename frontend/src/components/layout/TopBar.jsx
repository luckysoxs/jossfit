import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { Sun, Moon, Flame } from 'lucide-react'

export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div className="flex items-center justify-between px-4 h-14 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Flame size={24} className="text-brand-500" />
          <span className="text-lg font-bold tracking-tight">Fitness Jos</span>
        </div>
        <div className="flex items-center gap-3">
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
