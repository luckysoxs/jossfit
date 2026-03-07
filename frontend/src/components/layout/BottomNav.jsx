import { NavLink } from 'react-router-dom'
import { useUnread } from '../../contexts/UnreadContext'
import {
  LayoutDashboard,
  Dumbbell,
  Bell,
  MessageCircle,
  User,
} from 'lucide-react'

export default function BottomNav() {
  const { notifications, support } = useUnread()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/workouts', icon: Dumbbell, label: 'Entreno', tour: 'nav-entreno' },
    { to: '/notifications', icon: Bell, label: 'Alertas', badge: notifications },
    { to: '/support', icon: MessageCircle, label: 'Ayuda', badge: support },
    { to: '/profile', icon: User, label: 'Perfil', tour: 'nav-perfil' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 pb-safe transition-colors duration-300">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label, tour, badge }) => (
          <NavLink
            key={to}
            to={to}
            data-tour={tour}
            className={({ isActive }) =>
              `nav-item relative ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
            }
          >
            <div className="relative">
              <Icon size={22} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
