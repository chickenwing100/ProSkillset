import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMessages } from '../context/MessagesContext'
import { useSavedContractors } from '../context/SavedContractorsContext'

export default function Navbar() {
  const { user } = useAuth()
  const { getTotalUnreadCount } = useMessages()
  const { savedContractors } = useSavedContractors()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const unreadCount = getTotalUnreadCount()

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PS</span>
              </div>
              <span className="text-xl font-bold text-gray-900">ProSkillset</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/how-it-works"
              className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              How it Works
            </Link>

            {user && (
              <Link
                to="/messages"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors relative"
              >
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}

            {user && (
              <Link
                to="/contractors"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors relative"
              >
                Saved Contractors
                {savedContractors.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {savedContractors.length}
                  </span>
                )}
              </Link>
            )}

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </button>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-3 space-y-2">
            <Link
              to="/how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-gray-700 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
            >
              How it Works
            </Link>

            {user && (
              <Link
                to="/messages"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Messages {unreadCount > 0 ? `(${unreadCount})` : ''}
              </Link>
            )}

            {user && (
              <Link
                to="/contractors"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-gray-700 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Saved Contractors {savedContractors.length > 0 ? `(${savedContractors.length})` : ''}
              </Link>
            )}

            {user ? (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  navigate('/dashboard')
                }}
                className="w-full text-left bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Dashboard
              </button>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}