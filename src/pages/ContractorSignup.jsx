import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PublicLayout from '../layouts/PublicLayout'
import { queueAutomatedWelcomeMessages } from '../lib/automatedMessages'
import { getTermsRedirectPath } from '../lib/termsAcceptance'
import { TRADE_CATEGORY_GROUPS, normalizeTradeCategories } from '../lib/trades'

export default function ContractorSignup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    skills: '',
    tradeCategories: [],
    experience: '',
    hourlyRate: '',
    location: '',
    bio: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const contractorAgreementReturnTo = '/contractor-agreement?setup=1&confirmed=1'

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleTradeToggle = (tradeRole) => {
    setFormData((prev) => {
      const existing = normalizeTradeCategories(prev.tradeCategories)
      const hasTrade = existing.includes(tradeRole)
      return {
        ...prev,
        tradeCategories: hasTrade
          ? existing.filter((value) => value !== tradeRole)
          : [...existing, tradeRole]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    if ((formData.tradeCategories || []).length === 0) {
      setError('Select at least one trade role')
      setLoading(false)
      return
    }

    const selectedTrades = normalizeTradeCategories(formData.tradeCategories)
    const additionalSkills = String(formData.skills || '')
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
    const combinedSkills = Array.from(new Set([...selectedTrades, ...additionalSkills]))

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}${getTermsRedirectPath({ returnTo: contractorAgreementReturnTo })}`,
          data: {
            role: 'contractor',
            full_name: formData.fullName
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.fullName,
            role: 'contractor',
            bio: formData.bio,
            skills: combinedSkills,
            experience: formData.experience,
            hourly_rate: parseFloat(formData.hourlyRate) || null,
            location: formData.location
          })

        if (profileError) throw profileError

        queueAutomatedWelcomeMessages({
          email: formData.email,
          role: 'contractor'
        })

        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Error signing up:', error)
      setError(error.message || 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout>
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold">PS</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Join as a Contractor
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Create your account and start finding projects
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Trade Roles *
                </label>
                <div className="mt-2 space-y-3 rounded-md border border-gray-200 p-3">
                  {TRADE_CATEGORY_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-semibold text-gray-500">{group.label}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.options.map((tradeRole) => {
                          const checked = normalizeTradeCategories(formData.tradeCategories).includes(tradeRole)
                          return (
                            <label key={tradeRole} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${checked ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleTradeToggle(tradeRole)}
                              />
                              <span>{tradeRole}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="skills" className="block text-sm font-medium text-gray-700">
                  Additional Skills (optional)
                </label>
                <input
                  id="skills"
                  name="skills"
                  type="text"
                  value={formData.skills}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Custom specialties (comma-separated)"
                />
              </div>

              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-gray-700">
                  Years of Experience *
                </label>
                <select
                  id="experience"
                  name="experience"
                  required
                  value={formData.experience}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Select experience level</option>
                  <option value="0-2 years">0-2 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="6-10 years">6-10 years</option>
                  <option value="10+ years">10+ years</option>
                </select>
              </div>

              <div>
                <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                  Hourly Rate (USD) *
                </label>
                <input
                  id="hourlyRate"
                  name="hourlyRate"
                  type="number"
                  required
                  min="1"
                  value={formData.hourlyRate}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="50"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="New York, NY"
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  value={formData.bio}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Tell clients about yourself and your expertise..."
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Contractor Account'}
              </button>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-orange-600 hover:text-orange-500">
                  Sign in
                </Link>
              </span>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Looking to hire?{' '}
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                  Sign up as a client
                </Link>
              </span>
            </div>
          </form>
        </div>
        </div>
      </div>
    </PublicLayout>
  )
}