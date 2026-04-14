import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"

export default function UserProfile({ user: profileUser, isOwnProfile = false }) {
  const { user, updateProfile } = useAuth()
  const { buttonStyles } = useTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    skills: [],
    experience: "",
    portfolio: [],
    location: "",
    website: "",
    hourlyRate: "",
    company: ""
  })

  useEffect(() => {
    if (profileUser) {
      setFormData({
        name: profileUser.name || "",
        bio: profileUser.bio || "",
        skills: profileUser.skills || [],
        experience: profileUser.experience || "",
        portfolio: profileUser.portfolio || [],
        location: profileUser.location || "",
        website: profileUser.website || "",
        hourlyRate: profileUser.hourlyRate || "",
        company: profileUser.company || ""
      })
    }
  }, [profileUser])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSkillsChange = (e) => {
    const skills = e.target.value.split(',').map(skill => skill.trim()).filter(skill => skill)
    setFormData(prev => ({
      ...prev,
      skills
    }))
  }

  const handlePortfolioChange = (index, field, value) => {
    const updatedPortfolio = [...formData.portfolio]
    updatedPortfolio[index] = { ...updatedPortfolio[index], [field]: value }
    setFormData(prev => ({
      ...prev,
      portfolio: updatedPortfolio
    }))
  }

  const addPortfolioItem = () => {
    setFormData(prev => ({
      ...prev,
      portfolio: [...prev.portfolio, { title: "", description: "", url: "" }]
    }))
  }

  const removePortfolioItem = (index) => {
    setFormData(prev => ({
      ...prev,
      portfolio: prev.portfolio.filter((_, i) => i !== index)
    }))
  }

  const handleSave = () => {
    // Use the context function to update profile
    updateProfile(formData)
    setIsEditing(false)
  }

  if (!profileUser) {
    return <div>Loading profile...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{profileUser.name}</h1>
            <p className="text-gray-600">{profileUser.role === "contractor" ? "Freelance Contractor" : "Client"}</p>
            {profileUser.location && <p className="text-gray-500">📍 {profileUser.location}</p>}
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded hover:shadow-md transition ${buttonStyles[profileUser?.role === 'contractor' ? 'contractor' : 'client']}`}
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {profileUser.role === "contractor" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    name="hourlyRate"
                    value={formData.hourlyRate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.skills.join(', ')}
                    onChange={handleSkillsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="React, Node.js, Python, etc."
                  />
                </div>
              </>
            )}

            {profileUser.role === "client" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <textarea
                name="bio"
                rows={4}
                value={formData.bio}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
              <textarea
                name="experience"
                rows={3}
                value={formData.experience}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your experience and background..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://yourwebsite.com"
              />
            </div>

            {profileUser.role === "contractor" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Portfolio</label>
                {formData.portfolio.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                      <input
                        type="text"
                        placeholder="Project Title"
                        value={item.title}
                        onChange={(e) => handlePortfolioChange(index, 'title', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        placeholder="Project URL"
                        value={item.url}
                        onChange={(e) => handlePortfolioChange(index, 'url', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removePortfolioItem(index)}
                        className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      placeholder="Project Description"
                      value={item.description}
                      onChange={(e) => handlePortfolioChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                ))}
                <button
                  onClick={addPortfolioItem}
                  className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 shadow-md"
                >
                  Add Portfolio Item
                </button>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleSave}
                className={`px-6 py-2 rounded hover:shadow-md transition ${buttonStyles[profileUser?.role === 'contractor' ? 'contractor' : 'client']}`}
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {profileUser.bio && (
              <div>
                <h3 className="text-lg font-semibold mb-2">About</h3>
                <p className="text-gray-700">{profileUser.bio}</p>
              </div>
            )}

            {profileUser.role === "contractor" && profileUser.hourlyRate && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Rate</h3>
                <p className="text-2xl font-bold text-green-600">${profileUser.hourlyRate}/hour</p>
              </div>
            )}

            {profileUser.role === "client" && profileUser.company && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Company</h3>
                <p className="text-gray-700">{profileUser.company}</p>
              </div>
            )}

            {profileUser.skills && profileUser.skills.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {profileUser.skills.map((skill, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profileUser.experience && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Experience</h3>
                <p className="text-gray-700">{profileUser.experience}</p>
              </div>
            )}

            {profileUser.website && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Website</h3>
                <a
                  href={profileUser.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {profileUser.website}
                </a>
              </div>
            )}

            {profileUser.role === "contractor" && profileUser.portfolio && profileUser.portfolio.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Portfolio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profileUser.portfolio.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded p-4">
                      <h4 className="font-semibold">{item.title}</h4>
                      <p className="text-gray-600 text-sm mb-2">{item.description}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Project →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}