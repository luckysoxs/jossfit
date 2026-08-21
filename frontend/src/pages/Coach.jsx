import { useState } from 'react'
import { Dumbbell, Users, MessageSquare } from 'lucide-react'

import CoachRoutinesTab from '../components/coach/CoachRoutinesTab'
import CoachClientsTab from '../components/coach/CoachClientsTab'
import CoachRequestsTab from '../components/coach/CoachRequestsTab'

const TABS = [
  { key: 'rutinas', label: 'Rutinas', icon: Dumbbell },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'solicitudes', label: 'Solicitudes', icon: MessageSquare },
]

export default function Coach() {
  const [tab, setTab] = useState('rutinas')

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Coach</h1>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-gray-900 text-brand-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'rutinas' && <CoachRoutinesTab />}
      {tab === 'clientes' && <CoachClientsTab />}
      {tab === 'solicitudes' && <CoachRequestsTab />}
    </div>
  )
}
