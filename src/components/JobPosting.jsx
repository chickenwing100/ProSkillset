import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../context/ThemeContext"
import { useJobs } from "../context/JobsContext"
import { useAuth } from "../context/AuthContext"
import { TRADE_CATEGORY_GROUPS } from "../lib/trades"

function fileToCompressedDataUrl(file, maxDimension = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (event) => resolve(event.target?.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("Canvas context unavailable"))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      image.onerror = reject
      image.src = String(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function JobPosting() {
  const { buttonStyles } = useTheme()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    title: "",
    poNumber: "",
    description: "",
    budgetMin: "",
    budgetMax: "",
    category: "Plumbing",
    location: "",
    photos: []
  })
  const [loading, setLoading] = useState(false)
  const { createJob } = useJobs()
  const navigate = useNavigate()

  const userTheme = user?.role === "client" ? "client" : "contractor"
  const ringClass = userTheme === "contractor" ? "focus:ring-orange-500" : "focus:ring-blue-500"
  const isContractorPoster = user?.role === "contractor"

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    const maxFiles = 5
    const maxSize = 5 * 1024 * 1024 // 5MB per file

    if (formData.photos.length + files.length > maxFiles) {
      alert(`You can upload a maximum of ${maxFiles} photos`)
      return
    }

    for (const file of files) {
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 5MB`)
        continue
      }

      try {
        const compressedPhoto = await fileToCompressedDataUrl(file)
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, {
            id: Date.now() + Math.random(),
            name: file.name,
            data: compressedPhoto,
            type: file.type
          }]
        }))
      } catch (error) {
        alert(`Failed to process ${file.name}`)
      }
    }
  }

  const removePhoto = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(photo => photo.id !== photoId)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.poNumber.trim()) {
      alert("PO# / Job Name is required")
      return
    }

    const budgetMin = Number(formData.budgetMin)
    const budgetMax = Number(formData.budgetMax)

    if (!budgetMin || !budgetMax || budgetMin <= 0 || budgetMax <= 0) {
      alert("Please enter a valid price range")
      return
    }

    if (budgetMax < budgetMin) {
      alert("Maximum price must be greater than or equal to minimum price")
      return
    }

    setLoading(true)

    try {
      await createJob({
        ...formData,
        budget: budgetMax,
        budgetMin,
        budgetMax
      })
      navigate("/dashboard")
    } catch (error) {
      console.error("Error creating job:", error)
      alert(error.message || "Failed to create job")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="rounded-lg bg-white p-5 shadow-md sm:p-6">
        <h2 className="text-2xl font-bold mb-2">Post a New Project</h2>
        <p className="text-sm text-gray-600 mb-6">
          {isContractorPoster
            ? "Create a project request using the contractor workflow and theme."
            : "Create a project request and collect contractor applications."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Job Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
              placeholder="e.g., Kitchen Remodel, Patio Extension"
            />
          </div>

          <div>
            <label htmlFor="poNumber" className="block text-sm font-medium text-gray-700 mb-2">
              PO# / Job Name
            </label>
            <input
              type="text"
              id="poNumber"
              name="poNumber"
              required
              value={formData.poNumber}
              onChange={handleChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
              placeholder="e.g., Johnson-Kitchen Remodel, Oak-Street Bathroom Upgrade"
            />
            <p className="text-xs text-gray-500 mt-2">
              Examples: LastName-Project (Smith-Basement Finish) or StreetName-Project (MapleAve-Roof Replacement).
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Job Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
              placeholder="Describe the scope, timeline, site details, and what you're looking for..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="budgetMin" className="block text-sm font-medium text-gray-700 mb-2">
                Price Range Min ($)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  id="budgetMin"
                  name="budgetMin"
                  required
                  min="1"
                  value={formData.budgetMin}
                  onChange={handleChange}
                  className={`w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 focus:outline-none focus:ring-2 ${ringClass}`}
                  placeholder="2500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="budgetMax" className="block text-sm font-medium text-gray-700 mb-2">
                Price Range Max ($)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  id="budgetMax"
                  name="budgetMax"
                  required
                  min="1"
                  value={formData.budgetMax}
                  onChange={handleChange}
                  className={`w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 focus:outline-none focus:ring-2 ${ringClass}`}
                  placeholder="5000"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
            >
              {TRADE_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="estimatedBudget" className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Budget (Auto)
              </label>
              <div id="estimatedBudget" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                ${formData.budgetMax || "0"}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
              placeholder="e.g., Remote, New York, NY"
            />
          </div>

          <div>
            <label htmlFor="photos" className="block text-sm font-medium text-gray-700 mb-2">
              Photos (Recommended) - Max 5 photos, 5MB each
            </label>
            <input
              type="file"
              id="photos"
              name="photos"
              multiple
              accept="image/*"
              onChange={handlePhotoUpload}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${ringClass}`}
            />
            {formData.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.photos.map(photo => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.data}
                      alt={photo.name}
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2 px-4 rounded-md hover:shadow-md focus:outline-none focus:ring-2 ${ringClass} disabled:opacity-50 transition ${buttonStyles[userTheme]}`}
            >
              {loading ? "Posting..." : "Post Project"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-gray-200 pt-4">
          <p className="text-center text-xs text-gray-500">
            ProSkillset connects clients with independent contractors. We do not perform or guarantee services.
          </p>
        </div>
      </div>
    </div>
  )
}