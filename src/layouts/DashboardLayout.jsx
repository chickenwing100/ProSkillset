import { useState } from 'react'
import Sidebar from './Sidebar'
import { Link } from 'react-router-dom'

export default function DashboardLayout({ children }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {isMobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="flex-1 bg-black/40"
              aria-label="Close navigation"
            />
            <div className="h-full bg-white shadow-xl">
              <Sidebar mobile onNavigate={() => setIsMobileSidebarOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 lg:justify-end">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="lg:hidden inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Open navigation"
              >
                ☰ Menu
              </button>
              <Link
                to="/how-it-works"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                How It Works
              </Link>
            </div>
          </header>
          <main className="flex-1 relative overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}