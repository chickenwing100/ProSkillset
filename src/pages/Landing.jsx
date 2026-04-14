import { useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"

export default function Landing() {
  const { user } = useAuth()
  const { buttonStyles, accentStyles } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate("/dashboard")
    }
  }, [user, navigate])

  if (user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 text-center sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col items-center justify-center">
      <p className={`mb-8 max-w-md text-base sm:text-lg ${accentStyles.neutral}`}>
        Rebuilding the economy.
      </p>

      <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:gap-6">
        <Link
          to="/signup"
          className={`w-full rounded-lg px-8 py-3 font-semibold transition hover:shadow-lg sm:w-auto ${buttonStyles.neutral}`}
        >
          Get Started
        </Link>
      </div>

      <div className="mt-6">
        <Link
          to="/login"
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Already have an account? Sign in
        </Link>
      </div>
      </div>
    </div>
  )
}