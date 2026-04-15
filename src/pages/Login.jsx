import { useState } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { getTermsRedirectPath } from "../lib/termsAcceptance"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isConfirmed = new URLSearchParams(location.search).get("confirmed") === "1"

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")

    const result = await login(email, password)
    setLoading(false)

    if (result.success) {
      navigate("/dashboard")
    } else {
      setError(result.error)
    }
  }

  const handleResendConfirmation = async () => {
    const normalizedEmail = String(email || "").trim().toLowerCase()
    if (!normalizedEmail) {
      setError("Enter your email above, then click Resend confirmation email.")
      setInfo("")
      return
    }

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured for email confirmation.")
      setInfo("")
      return
    }

    setResending(true)
    setError("")
    setInfo("")

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}${getTermsRedirectPath()}`
      }
    })

    if (resendError) {
      setError(resendError.message || "Could not resend confirmation email")
      setResending(false)
      return
    }

    setInfo("Confirmation email sent. Check inbox/spam, then click the link and sign in.")
    setResending(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full space-y-8 rounded-lg bg-white p-6 shadow-md sm:p-8">
          <div>
            <h2 className="mt-4 text-center text-2xl font-extrabold text-gray-900 sm:mt-6 sm:text-3xl">
              Sign in to ProSkillset
            </h2>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {isConfirmed && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                Email confirmed. Sign in with your new account.
              </div>
            )}
            {info && (
              <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                {info}
              </div>
            )}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending || loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {resending ? "Sending confirmation..." : "Resend confirmation email"}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/signup"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Don't have an account? Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}