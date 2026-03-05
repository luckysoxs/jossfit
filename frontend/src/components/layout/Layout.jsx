import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 px-4 py-4 pb-20 max-w-7xl mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
