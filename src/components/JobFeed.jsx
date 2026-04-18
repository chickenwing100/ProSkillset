import { useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useJobs } from "../context/JobsContext"
import { formatDateTime } from "../lib/dateTime"

export default function JobFeed({ jobs, showMyJobs = false }) {
  const { user, getUserProfile } = useAuth()
  const { buttonStyles } = useTheme()
  const { applyToJob, deleteJob, acceptApplication, confirmJobCompletion } = useJobs()
  const [applyingTo, setApplyingTo] = useState(null)
  const [applicationMessage, setApplicationMessage] = useState("")
  const [bidMin, setBidMin] = useState("")
  const [bidMax, setBidMax] = useState("")
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedApplication, setSelectedApplication] = useState(null)

  const userTheme = user?.role === "client" ? "client" : "contractor"
  const focusRingClass = userTheme === "contractor" ? "focus:ring-orange-500" : "focus:ring-blue-500"
  const getDisplayName = (email, fallbackLabel = "User") => {
    const profile = getUserProfile(email) || {}
    const candidate = String(profile.name || profile.full_name || profile.contractorName || profile.businessName || "").trim()
    return candidate || fallbackLabel
  }

  const formatMoney = (value) => Number(value || 0).toFixed(2)

  const getMilestoneLabel = (application) => {
    const schedule = application?.paymentSchedule || {}
    if (schedule.mode === "amount") {
      return `Deposit $${formatMoney(schedule.upfrontAmount)} | Progression $${formatMoney(schedule.progressAmount)} | Final $${formatMoney(schedule.completionAmount)}`
    }
    return `Deposit ${Number(schedule.upfrontPercent || 0)}% | Progression ${Number(schedule.progressPercent || 0)}% | Final ${Number(schedule.completionPercent || 0)}%`
  }

  const handleApply = async (jobId) => {
    if (!applicationMessage.trim()) {
      alert("Please enter a message with your application")
      return
    }

    const minBid = Number(bidMin)
    const maxBid = Number(bidMax)

    if (!minBid || !maxBid || minBid <= 0 || maxBid <= 0) {
      alert("Please enter a valid bid range")
      return
    }

    if (maxBid < minBid) {
      alert("Maximum bid must be greater than or equal to minimum bid")
      return
    }

    setApplyingTo(jobId)
    try {
      await applyToJob(jobId, {
        message: applicationMessage,
        applicantName: user.name,
        bidAmount: maxBid,
        bidMin: minBid,
        bidMax: maxBid
      })
      setApplicationMessage("")
      setBidMin("")
      setBidMax("")
      alert("Application submitted successfully!")
    } catch (error) {
      console.error("Error applying to job:", error)
      alert(error.message || "Failed to submit application")
    } finally {
      setApplyingTo(null)
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          {showMyJobs ? "You haven't posted any projects yet." : "No jobs available at the moment."}
        </p>
      </div>
    )
  }

  return (
    <>
    <div className="space-y-4">
      {jobs.map(job => {
        const hasReachedClaimLimit = job.applications.length >= 5
        const hasApplied = job.applications.some(app => app.applicant === user?.email)
        const isDeletionLocked = Boolean(job.selectedContractor) || ["in_progress", "pending_client_confirmation", "completed"].includes(job.status)
        const canShowApplySection = !showMyJobs && !hasReachedClaimLimit

        return (
          <div key={job.id} className="bg-white rounded-lg p-4 shadow-md sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Posted by {getDisplayName(job.postedBy, "Project Owner")} • {formatDateTime(job.postedDate)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold text-green-600">${job.budget}</p>
              {Number(job.budgetMin || 0) > 0 && Number(job.budgetMax || 0) > 0 && (
                <p className="text-xs text-gray-500">Range: ${Number(job.budgetMin)} - ${Number(job.budgetMax)}</p>
              )}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                job.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {job.status}
              </span>
            </div>
          </div>

          <p className="text-gray-700 mb-4">{job.description}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {job.category}
            </span>
            {!showMyJobs && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                {5 - job.applications.length} slots left
              </span>
            )}
            {job.location && (
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                📍 {job.location}
              </span>
            )}
          </div>

          {job.photos && job.photos.length > 0 && (
            <div className="mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {job.photos.map(photo => (
                  <img
                    key={photo.id}
                    src={photo.data || photo.url}
                    alt={photo.name}
                    className="w-full h-32 object-cover rounded-md border cursor-pointer hover:opacity-80"
                    onClick={() => setSelectedPhoto(photo.data || photo.url)}
                  />
                ))}
              </div>
            </div>
          )}

          {showMyJobs && (
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Link
                to={`/projects/${job.id}`}
                className="rounded bg-blue-600 px-4 py-2 text-center text-sm text-white transition hover:bg-blue-700"
              >
                Manage Project
              </Link>
              {job.completionRequested && !job.completionConfirmed && (
                <button
                  onClick={async () => {
                    try {
                      await confirmJobCompletion(job.id)
                    } catch (error) {
                      alert(error.message || "Unable to confirm completion")
                    }
                  }}
                  className="rounded bg-green-600 px-4 py-2 text-center text-sm text-white transition hover:bg-green-700"
                >
                  Confirm Completion
                </button>
              )}
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure you want to remove this job posting? This action cannot be undone.')) {
                    try {
                      await deleteJob(job.id)
                    } catch (error) {
                      alert(error.message || "Unable to remove post")
                    }
                  }
                }}
                disabled={isDeletionLocked}
                className="rounded bg-red-600 px-4 py-2 text-center text-sm text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={isDeletionLocked ? "Cannot delete an accepted or completed project" : "Remove job post"}
              >
                Remove Post
              </button>
            </div>
          )}

          {showMyJobs ? (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Applications ({job.applications.length})</h4>
              {job.applications.length === 0 ? (
                <p className="text-gray-500 text-sm">No applications yet</p>
              ) : (
                <div className="space-y-2">
                  {job.applications.map(app => (
                    <div key={app.id} className="bg-gray-50 p-3 rounded">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-medium">{app.applicantName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-700 font-medium">
                            Bid Range: ${Number(app.bidMin || app.bidAmount || 0)} - ${Number(app.bidMax || app.bidAmount || 0)}
                          </span>
                          {!job.selectedContractor && (
                            <button
                              onClick={async () => {
                                try {
                                  await acceptApplication(job.id, app.id)
                                } catch (error) {
                                  alert(error.message || "Unable to accept application")
                                }
                              }}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              Accept
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedApplication({ jobTitle: job.title, poNumber: job.poNumber, application: app })}
                            className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-black transition-colors"
                          >
                            View Application
                          </button>
                          <Link
                            to={`/profile/${encodeURIComponent(app.applicant)}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Status: {app.status || 'pending'}</p>
                      <p className="text-sm text-gray-600">{app.message}</p>
                      <p className="text-xs text-gray-500 mt-1">Milestones: {getMilestoneLabel(app)}</p>
                      <p className="text-xs text-gray-500">
                        Applied on {formatDateTime(app.appliedDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            canShowApplySection && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Apply for this job</h4>
                <p className="text-xs text-gray-500 mb-2">
                  Claims: {job.applications.length}/5
                </p>
                <p className="text-sm font-medium text-gray-700 mb-2">Your Bid Range (USD)</p>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="1"
                      value={bidMin}
                      onChange={(e) => setBidMin(e.target.value)}
                      placeholder="Min bid"
                      className={`w-full rounded-md border border-gray-300 py-3 pl-8 pr-3 focus:outline-none focus:ring-2 ${focusRingClass}`}
                      disabled={hasApplied}
                    />
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="1"
                      value={bidMax}
                      onChange={(e) => setBidMax(e.target.value)}
                      placeholder="Max bid"
                      className={`w-full rounded-md border border-gray-300 py-3 pl-8 pr-3 focus:outline-none focus:ring-2 ${focusRingClass}`}
                      disabled={hasApplied}
                    />
                  </div>
                </div>
                <textarea
                  value={applicationMessage}
                  onChange={(e) => setApplicationMessage(e.target.value)}
                  placeholder="Tell the project owner why you're a good fit for this job..."
                  className={`w-full p-3 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 ${focusRingClass}`}
                  rows={3}
                  disabled={hasApplied}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={() => handleApply(job.id)}
                    disabled={applyingTo === job.id || hasApplied}
                    className={`rounded-md px-6 py-2 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 sm:w-auto ${buttonStyles[userTheme]}`}
                  >
                    {hasApplied
                      ? "Already Applied"
                      : applyingTo === job.id
                          ? "Applying..."
                          : "Apply Now"
                    }
                  </button>
                  <Link
                    to={`/projects/${job.id}`}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            )
          )}
          </div>
        )
      })}
    </div>
    {selectedPhoto && (
      <div
        className="fixed inset-0 z-50 bg-black/80 p-4 md:p-8 flex items-center justify-center"
        onClick={() => setSelectedPhoto(null)}
      >
        <button
          type="button"
          className="absolute top-4 right-4 text-white text-sm md:text-base bg-black/40 px-3 py-1 rounded"
          onClick={() => setSelectedPhoto(null)}
        >
          Close
        </button>
        <img
          src={selectedPhoto}
          alt="Job preview"
          className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    )}
    {selectedApplication && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setSelectedApplication(null)}
      >
        <div
          className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Application Details</h3>
              <p className="text-sm text-gray-600">{selectedApplication.jobTitle}</p>
              {selectedApplication.poNumber && (
                <p className="text-xs text-gray-500">PO#: {selectedApplication.poNumber}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedApplication(null)}
              className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <p><span className="font-medium">Applicant:</span> {selectedApplication.application.applicantName}</p>
            <p><span className="font-medium">Bid Range:</span> ${Number(selectedApplication.application.bidMin || selectedApplication.application.bidAmount || 0)} - ${Number(selectedApplication.application.bidMax || selectedApplication.application.bidAmount || 0)}</p>
            <p><span className="font-medium">Status:</span> {selectedApplication.application.status || "pending"}</p>
            <p><span className="font-medium">Applied:</span> {formatDateTime(selectedApplication.application.appliedDate)}</p>
            <p><span className="font-medium">Milestones:</span> {getMilestoneLabel(selectedApplication.application)}</p>
          </div>

          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cover Message</p>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{selectedApplication.application.message || "No message provided."}</p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}