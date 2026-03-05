import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Dumbbell,
  UtensilsCrossed,
  User,
  ShoppingBag,
  Target,
  Moon,
  BarChart3,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/workouts', icon: Dumbbell, label: 'Entreno' },
  { to: '/nutrition', icon: UtensilsCrossed, label: 'Nutrición' },
  { to: '/progress', icon: BarChart3, label: 'Progreso' },
  { to: '/profile', icon: User, label: 'Perfil' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 pb-safe transition-colors duration-300">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
            }
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
