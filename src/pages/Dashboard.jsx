import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useJobs } from "../context/JobsContext"
import { useMessages } from "../context/MessagesContext"
import { useReviews } from "../context/ReviewsContext"
import JobFeed from "../components/JobFeed"
import ProjectFeedPreview from "../components/dashboard/ProjectFeedPreview"
import ClaimedProjects from "../components/dashboard/ClaimedProjects"
import SavedContractors from "../components/dashboard/SavedContractors"
import ClientProjectsProgress from "../components/dashboard/ClientProjectsProgress"
import UnreadMessagesNotice from "../components/dashboard/UnreadMessagesNotice"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

export default function Dashboard() {
  const { user } = useAuth()
  const { buttonStyles, accentStyles } = useTheme()
  const { jobs, getMyJobs, getClaimedJobs } = useJobs()
  const { getTotalUnreadCount } = useMessages()
  const { getContractorRating } = useReviews()
  const navigate = useNavigate()

  const userTheme = user?.role === 'contractor' ? 'contractor' : 'client'

  const renderRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span key={index} className={index < Math.round(rating) ? "text-yellow-400" : "text-gray-300"}>★</span>
    ))
  }

  useEffect(() => {
    // Theme is now always white background with colored accents
  }, [])

  const myJobs = getMyJobs()
  const dashboardMyJobs = useMemo(
    () => myJobs
      .filter((job) => job.status !== "completed")
      .sort((a, b) => Number(a.progress || 0) - Number(b.progress || 0)),
    [myJobs]
  )
  const availableJobs = useMemo(() => {
    if (!user) return []

    // Keep contractor dashboard feed in sync with the same source of truth as project feed.
    return jobs.filter((job) => {
      if (job.status !== "open") return false
      if ((job.applications || []).length >= 5) return false

      if (user.role === "contractor") {
        return normalizeEmail(job.postedBy) !== normalizeEmail(user.email)
      }

      return true
    })
  }, [jobs, user])
  const claimedJobs = getClaimedJobs()
  const unreadMessagesCount = getTotalUnreadCount()
  const contractorRating = useMemo(
    () => getContractorRating(user?.email),
    [getContractorRating, user?.email]
  )
  const dashboardClaimedJobs = useMemo(
    () => claimedJobs
      .filter((job) => job.status !== "completed")
      .sort((a, b) => Number(a.progress || 0) - Number(b.progress || 0)),
    [claimedJobs]
  )
  const dashboardPostedJobs = useMemo(
    () => myJobs
      .filter((job) => job.status !== "completed")
      .sort((a, b) => Number(a.progress || 0) - Number(b.progress || 0)),
    [myJobs]
  )

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Welcome back, {user?.name}!
          </h1>
        </div>

        {user?.role === "client" && (
          <div>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold sm:text-2xl">Client Dashboard</h2>
              <button
                onClick={() => navigate("/post-job")}
                className={`w-full rounded-lg px-6 py-3 font-semibold transition hover:shadow-lg sm:w-auto ${buttonStyles[userTheme]}`}
              >
                Post a Project
              </button>
            </div>

            <div className="mb-8">
              <h3 className={`text-xl font-medium mb-4 ${accentStyles[userTheme]}`}>Your Posted Jobs</h3>
              <JobFeed jobs={dashboardMyJobs} showMyJobs={true} />
            </div>

            <div className="mb-8">
              <ClientProjectsProgress jobs={dashboardMyJobs} />
            </div>

            <div className="mb-8">
              <UnreadMessagesNotice />
            </div>

            <div className="mb-8">
              <SavedContractors />
            </div>
          </div>
        )}

        {user?.role === "contractor" && (
          <div>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="mb-2 text-xl font-semibold text-gray-900 sm:text-2xl">Welcome back, {user?.name}!</h2>
                <p className="text-gray-600">Here's what's happening with your projects today.</p>
              </div>
              <button
                onClick={() => navigate("/post-job")}
                className={`w-full rounded-lg px-6 py-3 font-semibold transition hover:shadow-lg sm:w-auto ${buttonStyles[userTheme]}`}
              >
                Post a Project
              </button>
            </div>

            {/* Quick Stats */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <span className="text-orange-600 text-xl">📋</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Available Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{availableJobs.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-blue-600 text-xl">🎯</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Claimed Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardClaimedJobs.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <span className="text-orange-600 text-xl">🛠️</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Posted Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardPostedJobs.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-green-600 text-xl">💬</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">New Messages</p>
                    <p className="text-2xl font-bold text-gray-900">{unreadMessagesCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <span className="text-purple-600 text-xl">⭐</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Profile Rating</p>
                    <p className="text-2xl font-bold text-gray-900">{contractorRating.average.toFixed(1)}</p>
                    <div className="flex items-center">{renderRatingStars(contractorRating.average)}</div>
                    <p className="text-xs text-gray-500">
                      {contractorRating.reviewCount === 0
                        ? "No client reviews yet"
                        : `${contractorRating.reviewCount} review${contractorRating.reviewCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h3 className={`text-xl font-medium mb-4 ${accentStyles[userTheme]}`}>Your Posted Projects</h3>
                  <JobFeed jobs={dashboardPostedJobs} showMyJobs={true} />
                </div>

                <ClientProjectsProgress jobs={dashboardPostedJobs} />

                <ClaimedProjects jobs={dashboardClaimedJobs} />
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-8">
                <ProjectFeedPreview jobs={availableJobs} />
                <SavedContractors />
                <UnreadMessagesNotice />
              </div>
            </div>
          </div>
        )}

        {user?.role === "admin" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">ProSkillset Control Center</h2>
              <p className="text-gray-600 mb-4">Access platform-wide tools across client and contractor workflows, including broadcast messaging.</p>
              <button
                onClick={() => navigate("/admin/proskillset")}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-black transition-colors"
              >
                Open ProSkillset
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600 mb-4">Review contractor insurance documents and maintain trust verification.</p>
              <button
                onClick={() => navigate("/admin/insurance-review")}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Insurance Review Queue
              </button>
            </div>
          </div>
        )}

        <div className="mt-10 border-t border-gray-200 pt-4">
          <p className="text-center text-xs text-gray-500">
            ProSkillset connects clients with independent contractors. We do not perform or guarantee services.
          </p>
        </div>
      </div>
    </div>
  )
}