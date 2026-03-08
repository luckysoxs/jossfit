import TopBar from './TopBar'
import BottomNav from './BottomNav'
import OfflineBanner from '../ui/OfflineBanner'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBanner />
      <TopBar />
      <main className="flex-1 px-4 py-4 pb-20 max-w-7xl mx-auto w-full overflow-x-hidden">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
