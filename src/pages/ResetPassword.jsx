import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

const readRecoveryParams = (location) => {
  const searchParams = new URLSearchParams(location.search)
  const hashParams = new URLSearchParams(String(location.hash || "").replace(/^#/, ""))
  const type = hashParams.get("type") || searchParams.get("type") || ""
  const accessToken = hashParams.get("access_token") || searchParams.get("access_token") || ""
  const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token") || ""

  return {
    isRecovery: type === "recovery",
    hasTokens: Boolean(accessToken || refreshToken)
  }
}

export default function ResetPassword() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [saving, setSaving] = useState(false)

  const recoveryState = useMemo(() => readRecoveryParams(location), [location])

  useEffect(() => {
    if (!authLoading && !isSupabaseConfigured) {
      setError("Supabase is not configured for password recovery.")
    }
  }, [authLoading])

  const canResetPassword = Boolean(user) || recoveryState.isRecovery || recoveryState.hasTokens

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setInfo("")

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured for password recovery.")
      return
    }

    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message || "Could not update password")
      setSaving(false)
      return
    }

    setInfo("Password updated. Redirecting to sign in...")
    await supabase.auth.signOut()
    setSaving(false)
    navigate("/login?reset=1", { replace: true })
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-lg bg-white p-6 text-center shadow-md sm:p-8">
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">Preparing password reset...</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full space-y-8 rounded-lg bg-white p-6 shadow-md sm:p-8">
          <div>
            <h2 className="mt-4 text-center text-2xl font-extrabold text-gray-900 sm:mt-6 sm:text-3xl">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Choose a new password for your ProSkillset account.
            </p>
          </div>

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

          {!canResetPassword ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                This password reset link is invalid or has expired. Request a new one from the login page.
              </p>
              <Link
                to="/login"
                className="inline-flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div className="relative">
                  <input
                    id="new-password"
                    name="new-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="New password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 z-20"
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 z-20"
                  >
                    {showConfirmPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? "Updating password..." : "Update password"}
              </button>

              <div className="text-center">
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
