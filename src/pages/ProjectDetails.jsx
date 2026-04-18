import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useJobs } from "../context/JobsContext"
import { useMessages } from "../context/MessagesContext"
import { useReviews } from "../context/ReviewsContext"
import { formatDateTime } from "../lib/dateTime"

const MAX_PROGRESS_PHOTOS = 8
const MAX_PROGRESS_PHOTO_SIZE = 8 * 1024 * 1024
const sameJobId = (left, right) => String(left || "").trim() === String(right || "").trim()

function toBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxDimension = 1400
        const quality = 0.75
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

export default function ProjectDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    getJobById,
    applyToJob,
    acceptApplication,
    addProgressUpdate,
    markJobComplete,
    confirmJobCompletion
  } = useJobs()
  const { messages, sendMessage } = useMessages()
  const { getReviewForJob, submitReview } = useReviews()

  const [applicationMessage, setApplicationMessage] = useState("")
  const [bidMin, setBidMin] = useState("")
  const [bidMax, setBidMax] = useState("")
  const [milestoneMode, setMilestoneMode] = useState("percent")
  const [upfrontPercent, setUpfrontPercent] = useState("0")
  const [progressPercent, setProgressPercent] = useState("0")
  const [completionPercent, setCompletionPercent] = useState("100")
  const [upfrontAmount, setUpfrontAmount] = useState("0")
  const [progressAmount, setProgressAmount] = useState("0")
  const [completionAmount, setCompletionAmount] = useState("0")
  const [progressValue, setProgressValue] = useState("")
  const [progressNote, setProgressNote] = useState("")
  const [progressPhotos, setProgressPhotos] = useState([])
  const [messageText, setMessageText] = useState("")
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState("")
  const [previewState, setPreviewState] = useState({ photos: [], index: -1 })
  const [touchStartX, setTouchStartX] = useState(null)
  const [selectedApplication, setSelectedApplication] = useState(null)

  const job = getJobById(id)

  const roleTheme = user?.role === "contractor"
    ? {
        button: "bg-orange-600 hover:bg-orange-700",
        accent: "text-orange-700",
        ring: "focus:ring-orange-500"
      }
    : {
        button: "bg-blue-600 hover:bg-blue-700",
        accent: "text-blue-700",
        ring: "focus:ring-blue-500"
      }

  const myApplication = useMemo(
    () => job?.applications?.find((app) => app.applicant === user?.email),
    [job, user]
  )
  const existingReview = useMemo(
    () => getReviewForJob(job?.id, user?.email),
    [getReviewForJob, job?.id, user?.email]
  )

  const projectParticipants = useMemo(
    () => [job?.postedBy, job?.selectedContractor].filter(Boolean),
    [job]
  )

  const projectThreadMessages = useMemo(
    () => messages
      .filter((message) =>
        sameJobId(message.jobId, job?.id) &&
        projectParticipants.includes(message.from) &&
        projectParticipants.includes(message.to)
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages, job, projectParticipants]
  )

  useEffect(() => {
    if (!existingReview) return
    setReviewRating(Number(existingReview.rating || 5))
    setReviewComment(existingReview.comment || "")
  }, [existingReview])

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <button
            onClick={() => navigate("/projects")}
            className="mt-2 bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            Back to Project Feed
          </button>
        </div>
      </div>
    )
  }

  const isClientOwner = user?.email === job.postedBy
  const isAcceptedContractor = user?.email === job.selectedContractor
  const claimLimitReached = (job.applications || []).length >= 5
  const canApply = user?.role === "contractor" && !isClientOwner && !job.selectedContractor && !claimLimitReached

  const formatMoney = (value) => Number(value || 0).toFixed(2)

  const handleApply = async () => {
    if (!applicationMessage.trim()) {
      alert("Please include a message with your application")
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

    let paymentSchedule
    if (milestoneMode === "amount") {
      const upfront = Number(upfrontAmount || 0)
      const progress = Number(progressAmount || 0)
      const completion = Number(completionAmount || 0)
      const amountTotal = upfront + progress + completion

      if (upfront < 0 || progress < 0 || completion < 0) {
        alert("Milestone amounts cannot be negative")
        return
      }

      if (amountTotal !== maxBid) {
        alert("Milestone amounts must add up to your maximum bid")
        return
      }

      paymentSchedule = {
        mode: "amount",
        upfrontAmount: upfront,
        progressAmount: progress,
        completionAmount: completion,
        upfrontPercent: Number(((upfront / maxBid) * 100).toFixed(2)),
        progressPercent: Number(((progress / maxBid) * 100).toFixed(2)),
        completionPercent: Number(((completion / maxBid) * 100).toFixed(2))
      }
    } else {
      const milestoneTotal = Number(upfrontPercent || 0) + Number(progressPercent || 0) + Number(completionPercent || 0)
      if (milestoneTotal !== 100) {
        alert("Payment milestones in your bid must total 100%")
        return
      }

      const upfront = Number(((Number(upfrontPercent || 0) / 100) * maxBid).toFixed(2))
      const progress = Number(((Number(progressPercent || 0) / 100) * maxBid).toFixed(2))
      const completion = Number((maxBid - upfront - progress).toFixed(2))

      paymentSchedule = {
        mode: "percent",
        upfrontPercent: Number(upfrontPercent || 0),
        progressPercent: Number(progressPercent || 0),
        completionPercent: Number(completionPercent || 0),
        upfrontAmount: upfront,
        progressAmount: progress,
        completionAmount: completion
      }
    }

    try {
      await applyToJob(job.id, {
        message: applicationMessage,
        applicantName: user.name,
        bidAmount: maxBid,
        bidMin: minBid,
        bidMax: maxBid,
        paymentSchedule
      })
      setApplicationMessage("")
      setBidMin("")
      setBidMax("")
      setMilestoneMode("percent")
      setUpfrontPercent("0")
      setProgressPercent("0")
      setCompletionPercent("100")
      setUpfrontAmount("0")
      setProgressAmount("0")
      setCompletionAmount("0")
      alert("Application and bid submitted")
    } catch (error) {
      alert(error.message || "Failed to apply")
    }
  }

  const handleProgressUpdate = async () => {
    try {
      await addProgressUpdate(job.id, {
        progress: progressValue === "" ? job.progress : Number(progressValue),
        note: progressNote,
        photos: progressPhotos
      })

      setProgressValue("")
      setProgressNote("")
      setProgressPhotos([])
      alert("Progress update posted")
    } catch (error) {
      alert(error.message || "Failed to post progress update")
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim()) return

    const recipient = isClientOwner ? job.selectedContractor : job.postedBy
    if (!recipient) {
      alert("No participant found for messaging yet")
      return
    }

    try {
      await sendMessage({
        to: recipient,
        text: messageText,
        jobId: job.id,
        jobTitle: job.title,
        poNumber: job.poNumber
      })
      setMessageText("")
    } catch (error) {
      alert(error.message || "Unable to send message")
    }
  }

  const handleSubmitReview = async () => {
    if (!isClientOwner || job.status !== "completed" || !job.selectedContractor) {
      return
    }

    try {
      await submitReview({
        jobId: job.id,
        contractorEmail: job.selectedContractor,
        clientEmail: user.email,
        rating: reviewRating,
        comment: reviewComment
      })
      alert(existingReview ? "Contractor rating updated" : "Contractor rated successfully")
    } catch (error) {
      alert(error.message || "Unable to save contractor rating")
    }
  }

  const handleProgressPhotoSelection = async (event) => {
    try {
      const files = Array.from(event.target.files || [])
      if (progressPhotos.length + files.length > MAX_PROGRESS_PHOTOS) {
        alert(`You can attach up to ${MAX_PROGRESS_PHOTOS} progress photos per update`)
        return
      }

      const oversized = files.find((file) => file.size > MAX_PROGRESS_PHOTO_SIZE)
      if (oversized) {
        alert(`Photo ${oversized.name} is too large. Max size is ${Math.round(MAX_PROGRESS_PHOTO_SIZE / (1024 * 1024))}MB.`)
        return
      }

      const convertedPhotos = await Promise.all(
        files.map(async (file) => ({
          id: Date.now() + Math.random(),
          name: file.name,
          data: await toBase64(file),
          type: file.type
        }))
      )
      setProgressPhotos((prev) => [...prev, ...convertedPhotos])
      event.target.value = ""
    } catch (error) {
      alert("Failed to prepare selected photos")
    }
  }

  const removePendingProgressPhoto = (photoId) => {
    setProgressPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
  }

  const getPhotoSrc = (photo) => photo?.data || photo?.url || ""

  const openPhotoPreview = (photos, index) => {
    if (!Array.isArray(photos) || photos.length === 0) return
    if (index < 0 || index >= photos.length) return

    setPreviewState({
      photos,
      index
    })
  }

  const closePhotoPreview = () => {
    setPreviewState({ photos: [], index: -1 })
    setTouchStartX(null)
  }

  const showPreviousPreview = () => {
    const total = previewState.photos.length
    if (total <= 1) return
    setPreviewState((prev) => ({
      ...prev,
      index: prev.index <= 0 ? total - 1 : prev.index - 1
    }))
  }

  const showNextPreview = () => {
    const total = previewState.photos.length
    if (total <= 1) return
    setPreviewState((prev) => ({
      ...prev,
      index: prev.index >= total - 1 ? 0 : prev.index + 1
    }))
  }

  const handlePreviewTouchStart = (event) => {
    setTouchStartX(event.touches?.[0]?.clientX ?? null)
  }

  const handlePreviewTouchEnd = (event) => {
    if (touchStartX == null) return
    const touchEndX = event.changedTouches?.[0]?.clientX
    if (typeof touchEndX !== "number") return

    const delta = touchEndX - touchStartX
    if (Math.abs(delta) < 40) return

    if (delta > 0) {
      showPreviousPreview()
    } else {
      showNextPreview()
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">{job.title}</h1>
          <span className={`text-sm font-medium ${roleTheme.accent}`}>{job.status}</span>
        </div>

        <p className="text-gray-700 mb-4">{job.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <p><span className="font-medium">Category:</span> {job.category}</p>
          <p><span className="font-medium">PO#:</span> {job.poNumber || "N/A"}</p>
          <p><span className="font-medium">Location:</span> {job.location || "N/A"}</p>
          <p><span className="font-medium">Budget:</span> ${job.budget}</p>
          {Number(job.budgetMin || 0) > 0 && Number(job.budgetMax || 0) > 0 && (
            <p><span className="font-medium">Price Range:</span> ${Number(job.budgetMin)} - ${Number(job.budgetMax)}</p>
          )}
          <p><span className="font-medium">Posted:</span> {formatDateTime(job.postedDate)}</p>
          {job.acceptedAt && <p><span className="font-medium">Bid Accepted:</span> {formatDateTime(job.acceptedAt)}</p>}
          {job.completionRequestedAt && <p><span className="font-medium">Completion Requested:</span> {formatDateTime(job.completionRequestedAt)}</p>}
          {job.completionConfirmedAt && <p><span className="font-medium">Completion Confirmed:</span> {formatDateTime(job.completionConfirmedAt)}</p>}
        </div>

        {job.acceptedBid > 0 && (
          <p className="mt-3 text-sm text-green-700 font-medium">Accepted Bid: ${job.acceptedBid}</p>
        )}

        <div className="mt-4 border border-gray-100 rounded-md p-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-900 mb-2">Payment Milestones</p>
          {job.paymentSchedule?.mode === "amount" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700">
              <p>Up Front: ${formatMoney(job.paymentSchedule?.upfrontAmount)}</p>
              <p>Progress: ${formatMoney(job.paymentSchedule?.progressAmount)}</p>
              <p>Completion: ${formatMoney(job.paymentSchedule?.completionAmount)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-700">
              <p>Up Front: {Number(job.paymentSchedule?.upfrontPercent || 0)}%</p>
              <p>Progress: {Number(job.paymentSchedule?.progressPercent || 0)}%</p>
              <p>Completion: {Number(job.paymentSchedule?.completionPercent || 0)}%</p>
            </div>
          )}
        </div>

        {job.photos?.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900 mb-2">Job Photos</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {job.photos.map((photo, index) => (
                <img
                  key={photo.id}
                  src={getPhotoSrc(photo)}
                  alt={photo.name}
                  className="w-full h-24 object-cover rounded-md border cursor-pointer hover:opacity-90"
                  onClick={() => openPhotoPreview(job.photos, index)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {canApply && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Apply to Job</h2>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-900">Your Bid Range (USD)</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="1"
                    value={bidMin}
                    onChange={(event) => setBidMin(event.target.value)}
                    placeholder="Min bid"
                    className={`w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                    disabled={Boolean(myApplication)}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="1"
                    value={bidMax}
                    onChange={(event) => setBidMax(event.target.value)}
                    placeholder="Max bid"
                    className={`w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                    disabled={Boolean(myApplication)}
                  />
                </div>
              </div>
            </div>
            <textarea
              value={applicationMessage}
              onChange={(event) => setApplicationMessage(event.target.value)}
              placeholder="Tell the project owner why you're a good fit..."
              rows={4}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
              disabled={Boolean(myApplication)}
            />
            <div className="border border-gray-100 rounded-md p-3 bg-gray-50">
              <div className="mb-3 flex items-center gap-3 text-sm">
                <label className="font-medium text-gray-900">Milestone Input Type:</label>
                <select
                  value={milestoneMode}
                  onChange={(event) => setMilestoneMode(event.target.value)}
                  className={`rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                  disabled={Boolean(myApplication)}
                >
                  <option value="percent">Percent (%)</option>
                  <option value="amount">Dollar Amount ($)</option>
                </select>
              </div>

              {milestoneMode === "amount" ? (
                <>
                  <p className="text-sm font-medium text-gray-900 mb-2">Your Proposed Payment Milestones ($)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Deposit</label>
                      <input
                        type="number"
                        min="0"
                        value={upfrontAmount}
                        onChange={(event) => setUpfrontAmount(event.target.value)}
                        placeholder="Deposit $"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Progression</label>
                      <input
                        type="number"
                        min="0"
                        value={progressAmount}
                        onChange={(event) => setProgressAmount(event.target.value)}
                        placeholder="Progression $"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Final</label>
                      <input
                        type="number"
                        min="0"
                        value={completionAmount}
                        onChange={(event) => setCompletionAmount(event.target.value)}
                        placeholder="Final $"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Must total your maximum bid amount.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900 mb-2">Your Proposed Payment Milestones (%)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Deposit</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={upfrontPercent}
                        onChange={(event) => setUpfrontPercent(event.target.value)}
                        placeholder="Deposit %"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Progression</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={progressPercent}
                        onChange={(event) => setProgressPercent(event.target.value)}
                        placeholder="Progression %"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">Final</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={completionPercent}
                        onChange={(event) => setCompletionPercent(event.target.value)}
                        placeholder="Final %"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
                        disabled={Boolean(myApplication)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Must total 100%.</p>
                </>
              )}
            </div>
            <button
              onClick={handleApply}
              disabled={Boolean(myApplication)}
              className={`text-white px-4 py-2 rounded-lg transition-colors ${roleTheme.button} disabled:opacity-50`}
            >
              {myApplication ? "Already Applied" : "Submit Application"}
            </button>
          </div>
        </div>
      )}

      {isClientOwner && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Applications & Bids</h2>
          {job.applications.length === 0 ? (
            <p className="text-gray-500">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {job.applications.map((application) => (
                <div key={application.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium text-gray-900">{application.applicantName}</p>
                    <span className="text-sm text-gray-700">
                      Bid Range: ${Number(application.bidMin || application.bidAmount || 0)} - ${Number(application.bidMax || application.bidAmount || 0)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{application.message}</p>
                  {application.paymentSchedule?.mode === "amount" ? (
                    <p className="text-xs text-gray-500 mb-2">
                      Milestones: Upfront ${formatMoney(application.paymentSchedule?.upfrontAmount)} | Progress ${formatMoney(application.paymentSchedule?.progressAmount)} | Completion ${formatMoney(application.paymentSchedule?.completionAmount)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mb-2">
                      Milestones: Upfront {Number(application.paymentSchedule?.upfrontPercent || 0)}% | Progress {Number(application.paymentSchedule?.progressPercent || 0)}% | Completion {Number(application.paymentSchedule?.completionPercent || 0)}%
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mb-2">Applied: {formatDateTime(application.appliedDate)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{application.status || "pending"}</span>
                    {!job.selectedContractor && (
                      <button
                        onClick={async () => {
                          try {
                            await acceptApplication(job.id, application.id)
                          } catch (error) {
                            alert(error.message || "Unable to accept bid")
                          }
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Accept Bid
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedApplication(application)}
                      className="bg-gray-900 text-white px-3 py-1 rounded text-sm hover:bg-black transition-colors"
                    >
                      View Application
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(isAcceptedContractor || isClientOwner) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Shared My Projects Updates</h2>

          {isAcceptedContractor && (
            <div className="space-y-3 mb-5 pb-5 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Post Progress Update</h3>
              <input
                type="number"
                min="0"
                max="100"
                value={progressValue}
                onChange={(event) => setProgressValue(event.target.value)}
                placeholder="Progress percentage"
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
              />
              <textarea
                value={progressNote}
                onChange={(event) => setProgressNote(event.target.value)}
                placeholder="Progress note"
                rows={3}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
              />
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleProgressPhotoSelection}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {progressPhotos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {progressPhotos.map((photo, index) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={getPhotoSrc(photo)}
                        alt={photo.name}
                        className="w-full h-24 object-cover rounded-md border cursor-pointer hover:opacity-90"
                        onClick={() => openPhotoPreview(progressPhotos, index)}
                      />
                      <button
                        type="button"
                        onClick={() => removePendingProgressPhoto(photo.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleProgressUpdate}
                  className={`text-white px-4 py-2 rounded-lg transition-colors ${roleTheme.button}`}
                >
                  Post Update
                </button>
                {job.status !== "completed" && (
                  <button
                    onClick={async () => {
                      try {
                        await markJobComplete(job.id)
                      } catch (error) {
                        alert(error.message || "Unable to mark job complete")
                      }
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark Job Complete
                  </button>
                )}
              </div>
            </div>
          )}

          {isClientOwner && job.completionRequested && !job.completionConfirmed && (
            <div className="mb-4">
              <button
                onClick={async () => {
                  try {
                    await confirmJobCompletion(job.id)
                  } catch (error) {
                    alert(error.message || "Unable to confirm job completion")
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm Job Completion
              </button>
            </div>
          )}

          {job.progressUpdates.length === 0 ? (
            <p className="text-gray-500">No progress updates yet.</p>
          ) : (
            <div className="space-y-4">
              {job.progressUpdates.map((update) => (
                <div key={update.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{update.contractorName}</p>
                    <span className="text-sm text-gray-600">{update.progress}%</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Updated: {formatDateTime(update.createdAt)}</p>
                  <p className="text-sm text-gray-700 mb-2">{update.note}</p>
                  {update.photos?.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {update.photos.map((photo, index) => (
                        <img
                          key={photo.id}
                          src={getPhotoSrc(photo)}
                          alt={photo.name}
                          className="w-full h-24 object-cover rounded-md border cursor-pointer hover:opacity-90"
                          onClick={() => openPhotoPreview(update.photos, index)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(isClientOwner || isAcceptedContractor) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Project Messages</h2>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 mb-3 space-y-2">
            {projectThreadMessages.length === 0 ? (
              <p className="text-sm text-gray-500">No project messages yet.</p>
            ) : (
              projectThreadMessages.map((message) => {
                const mine = message.from === user?.email
                return (
                  <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? `${roleTheme.button.split(" ")[0]} text-white` : "bg-gray-100 text-gray-800"}`}>
                      <p>{message.text}</p>
                      <p className={`text-xs mt-1 ${mine ? "text-white/80" : "text-gray-500"}`}>
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Send a message..."
              className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
            />
            <button
              onClick={handleSendMessage}
              className={`text-white px-4 py-2 rounded-lg transition-colors ${roleTheme.button}`}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {isClientOwner && job.status === "completed" && job.selectedContractor && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Rate Contractor</h2>
          <p className="text-sm text-gray-600 mb-4">
            Share a rating for {job.selectedContractorName || job.selectedContractor} now that this project is complete.
          </p>
          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setReviewRating(star)}
                className={`text-3xl ${star <= reviewRating ? "text-yellow-400" : "text-gray-300"}`}
                aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
              >
                ★
              </button>
            ))}
            <span className="text-sm text-gray-600 ml-2">{reviewRating.toFixed(1)} / 5</span>
          </div>
          <textarea
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            rows={4}
            placeholder="Optional feedback about the contractor's work, communication, and professionalism"
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-gray-500">
              {existingReview ? "You can update your previous rating for this completed project." : "Each completed project can be rated once by the client."}
            </p>
            <button
              type="button"
              onClick={handleSubmitReview}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              {existingReview ? "Update Rating" : "Submit Rating"}
            </button>
          </div>
        </div>
      )}

      {previewState.index >= 0 && previewState.photos[previewState.index] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closePhotoPreview}
        >
          <div
            className="max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handlePreviewTouchStart}
            onTouchEnd={handlePreviewTouchEnd}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-white/90">
                Photo {previewState.index + 1} of {previewState.photos.length}
              </p>
              <button
                type="button"
                className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                onClick={closePhotoPreview}
              >
                Close
              </button>
            </div>
            <img
              src={getPhotoSrc(previewState.photos[previewState.index])}
              alt={previewState.photos[previewState.index]?.name || "Project photo"}
              className="w-full max-h-[80vh] object-contain rounded-lg bg-black"
            />
            {previewState.photos.length > 1 && (
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                  onClick={showPreviousPreview}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                  onClick={showNextPreview}
                >
                  Next
                </button>
              </div>
            )}
          </div>
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
                <h3 className="text-lg font-semibold text-gray-900">Application Review</h3>
                <p className="text-sm text-gray-600">{selectedApplication.applicantName}</p>
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
              <p><span className="font-medium">Bid Range:</span> ${Number(selectedApplication.bidMin || selectedApplication.bidAmount || 0)} - ${Number(selectedApplication.bidMax || selectedApplication.bidAmount || 0)}</p>
              <p><span className="font-medium">Status:</span> {selectedApplication.status || "pending"}</p>
              <p><span className="font-medium">Applied:</span> {formatDateTime(selectedApplication.appliedDate)}</p>
              {selectedApplication.paymentSchedule?.mode === "amount" ? (
                <p>
                  <span className="font-medium">Milestones:</span> Deposit ${formatMoney(selectedApplication.paymentSchedule?.upfrontAmount)} | Progression ${formatMoney(selectedApplication.paymentSchedule?.progressAmount)} | Final ${formatMoney(selectedApplication.paymentSchedule?.completionAmount)}
                </p>
              ) : (
                <p>
                  <span className="font-medium">Milestones:</span> Deposit {Number(selectedApplication.paymentSchedule?.upfrontPercent || 0)}% | Progression {Number(selectedApplication.paymentSchedule?.progressPercent || 0)}% | Final {Number(selectedApplication.paymentSchedule?.completionPercent || 0)}%
                </p>
              )}
            </div>

            <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application Message</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{selectedApplication.message || "No message provided."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
