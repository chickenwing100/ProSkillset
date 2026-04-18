import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMessages } from '../context/MessagesContext'

export default function Sidebar({ mobile = false, onNavigate }) {
  const { user, logout } = useAuth()
  const { getTotalUnreadCount } = useMessages()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const userTheme = user?.role === "client" ? "client" : "contractor"
  const activeColors = userTheme === "contractor"
    ? "bg-orange-50 text-orange-700 border-r-2 border-orange-700"
    : "bg-blue-50 text-blue-700 border-r-2 border-blue-700"

  const contractorNavigation = [
    { name: 'Project Feed', href: '/projects', icon: '📋' },
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Posted Projects', href: '/posted-projects', icon: '📤' },
    { name: 'My Projects', href: '/my-projects', icon: '📁' },
    { name: 'Messages', href: '/messages', icon: '💬' },
    { name: 'Contractors', href: '/contractors', icon: '👷' },
    { name: 'Profile', href: '/profile', icon: '👤' },
    { name: 'Account Settings', href: '/account-settings', icon: '⚙️' },
  ]

  const adminNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'ProSkillset', href: '/admin/proskillset', icon: '🧭' },
    { name: 'Messages', href: '/messages', icon: '💬' },
    { name: 'Insurance Review', href: '/admin/insurance-review', icon: '🛡️' },
    { name: 'Profile', href: '/profile', icon: '👤' },
  ]

  const clientNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Post a Project', href: '/post-job', icon: '➕' },
    { name: 'My Projects', href: '/my-projects', icon: '📁' },
    { name: 'Messages', href: '/messages', icon: '💬' },
    { name: 'Contractors', href: '/contractors', icon: '👷' },
    { name: 'Profile', href: '/profile', icon: '👤' },
  ]

  const navigation = user?.role === 'admin'
    ? adminNavigation
    : (user?.role === 'contractor' ? contractorNavigation : clientNavigation)
  const unreadCount = getTotalUnreadCount()

  const handleLogout = () => {
    logout()
    navigate('/')
    onNavigate?.()
  }

  const isCompact = !mobile && isCollapsed
  const sidebarWidth = isCompact ? 'w-20' : 'w-64'

  return (
    <div className={`h-full flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${mobile ? 'w-72 max-w-[85vw]' : sidebarWidth}`}>
      <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
        <div className={`flex items-center flex-shrink-0 ${isCompact ? 'px-2 justify-center' : 'px-4'}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PS</span>
          </div>
          {!isCompact && <span className="ml-2 text-xl font-bold text-gray-900">ProSkillset</span>}
        </div>

        {!mobile && (
          <div className={`mt-4 ${isCompact ? 'px-2' : 'px-4'}`}>
            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span>{isCompact ? '➡️' : '⬅️'}</span>
              {!isCompact && <span>Collapse</span>}
            </button>
          </div>
        )}

        <div className="mt-8 flex-grow flex flex-col">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => onNavigate?.()}
                  className={`group flex items-center ${isCompact ? 'justify-center' : ''} px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? activeColors
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={item.name}
                >
                  <span className={`text-lg ${isCompact ? '' : 'mr-3'}`}>{item.icon}</span>
                  {!isCompact && (
                    <span className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.href === '/messages' && unreadCount > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${userTheme === 'contractor' ? 'bg-orange-600' : 'bg-blue-600'}`}>
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center w-full">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              </div>
              {!isCompact && (
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate capitalize">
                    {user?.role || 'User'}
                  </p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className={`p-1 text-gray-400 hover:text-gray-600 transition-colors ${isCompact ? '' : 'ml-2'}`}
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}