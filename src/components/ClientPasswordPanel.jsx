import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { isSupabaseConfigured } from "../lib/supabase"

export default function ClientPasswordPanel() {
  const { updatePassword } = useAuth()
  const { buttonStyles } = useTheme()
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: "", message: "" })

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!formData.newPassword || formData.newPassword.length < 6) {
      setStatus({ type: "error", message: "New password must be at least 6 characters." })
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setStatus({ type: "error", message: "New password and confirmation do not match." })
      return
    }

    setSaving(true)
    setStatus({ type: "info", message: "Updating password..." })

    try {
      const result = await updatePassword(formData.currentPassword, formData.newPassword)

      if (!result?.success) {
        setStatus({ type: "error", message: result?.error || "Unable to update password." })
        return
      }

      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setStatus({
        type: "success",
        message: isSupabaseConfigured
          ? "Password updated in Supabase."
          : "Password updated locally."
      })
    } catch (error) {
      setStatus({ type: "error", message: error?.message || "Unable to update password." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Password</h2>
        <p className="text-gray-600 mt-1">Update the password for your client account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords.currentPassword ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={isSupabaseConfigured ? "Optional" : "Current password"}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("currentPassword")}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPasswords.currentPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPasswords.newPassword ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("newPassword")}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPasswords.newPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPasswords.confirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirmPassword")}
                className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
              >
                {showPasswords.confirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className={`text-sm ${status.type === "error" ? "text-red-600" : status.type === "success" ? "text-green-600" : "text-gray-500"}`}>
            {status.message || (isSupabaseConfigured
              ? "This updates your Supabase-authenticated login password."
              : "This updates your local development password.")}
          </p>
          <button
            type="submit"
            disabled={saving}
            className={`px-4 py-2 rounded transition disabled:opacity-60 ${buttonStyles.client}`}
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>
    </section>
  )
}