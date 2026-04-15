import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "client"
  })

  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    // 🔴 VALIDATION
    if (formData.password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const result = await signup(
      formData.email,
      formData.password,
      formData.role,
      formData.name
    )

    setLoading(false)

    if (result.success) {
      navigate("/dashboard")
    } else {
      setError(result.error || "Signup failed")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:py-14">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full space-y-8 rounded-lg bg-white p-6 shadow-md sm:p-8">
          <div>
            <h2 className="mt-4 text-center text-2xl font-extrabold text-gray-900 sm:mt-6 sm:text-3xl">
              Create your account
            </h2>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* NAME */}
              <input
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Full Name"
              />

              {/* EMAIL */}
              <input
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Email address"
              />

              {/* PASSWORD */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                  placeholder="Password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 z-20 cursor-pointer"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md"
                  placeholder="Confirm Password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 z-20 cursor-pointer"
                >
                  {showConfirmPassword ? "🙈" : "👁"}
                </button>
              </div>

              {/* LIVE FEEDBACK */}
              {confirmPassword &&
                formData.password !== confirmPassword && (
                  <p className="text-red-500 text-sm">
                    Passwords do not match
                  </p>
                )}

              {/* ROLE */}
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="client">Client</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-500"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}