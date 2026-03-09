import TopBar from './TopBar'
import BottomNav from './BottomNav'
import TodayRoutineBanner from './TodayRoutineBanner'
import OfflineBanner from '../ui/OfflineBanner'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <TopBar />
      <TodayRoutineBanner />
      <main className="flex-1 px-4 py-4 pb-28 max-w-7xl mx-auto w-full overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
