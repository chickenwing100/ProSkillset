import { createContext, useState, useContext, useEffect } from "react"
import { useAuth } from "./AuthContext"

const JobsContext = createContext()
const DEMO_CLIENT_EMAIL = "client@example.com"

const normalizePercent = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(0, Math.min(100, numeric))
}

const normalizePaymentSchedule = (
  value,
  fallback = { upfrontPercent: 0, progressPercent: 0, completionPercent: 100 },
  totalAmount = 0
) => {
  const mode = value?.mode === "amount" ? "amount" : "percent"

  if (mode === "amount") {
    const upfrontAmount = Number(value?.upfrontAmount || 0)
    const progressAmount = Number(value?.progressAmount || 0)
    const completionAmount = Number(value?.completionAmount || 0)
    const amountTotal = upfrontAmount + progressAmount + completionAmount

    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || amountTotal !== totalAmount) {
      return {
        ...fallback,
        mode: "percent"
      }
    }

    return {
      mode,
      upfrontAmount,
      progressAmount,
      completionAmount,
      upfrontPercent: normalizePercent((upfrontAmount / totalAmount) * 100, fallback.upfrontPercent),
      progressPercent: normalizePercent((progressAmount / totalAmount) * 100, fallback.progressPercent),
      completionPercent: normalizePercent((completionAmount / totalAmount) * 100, fallback.completionPercent)
    }
  }

  const upfrontPercent = normalizePercent(value?.upfrontPercent, fallback.upfrontPercent)
  const progressPercent = normalizePercent(value?.progressPercent, fallback.progressPercent)
  const completionPercent = normalizePercent(value?.completionPercent, fallback.completionPercent)
  const total = upfrontPercent + progressPercent + completionPercent

  if (total !== 100) {
    return {
      ...fallback,
      mode: "percent"
    }
  }

  return {
    mode,
    upfrontPercent,
    progressPercent,
    completionPercent
  }
}

const isImageDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/")

const compressDataUrl = (dataUrl, maxDimension = 1400, quality = 0.75) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) {
      reject(new Error("Canvas context unavailable"))
      return
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL("image/jpeg", quality))
  }
  image.onerror = reject
  image.src = dataUrl
})

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)
  const { user } = useAuth()

  const normalizeJob = (job) => ({
    ...job,
    postedBy: job.postedBy || "client@example.com",
    postedDate: job.postedDate || new Date().toISOString(),
    status: job.status || "open",
    applications: Array.isArray(job.applications)
      ? job.applications.map((application) => ({
          ...application,
          bidAmount: Number(application.bidAmount || 0),
          bidMin: Number(application.bidMin || application.bidAmount || 0),
          bidMax: Number(application.bidMax || application.bidAmount || 0),
          paymentSchedule: normalizePaymentSchedule(application.paymentSchedule, {
            upfrontPercent: 0,
            progressPercent: 0,
            completionPercent: 100
          }, Number(application.bidAmount || 0))
        }))
      : [],
    photos: Array.isArray(job.photos) ? job.photos : [],
    selectedContractor: job.selectedContractor || "",
    selectedContractorName: job.selectedContractorName || "",
    acceptedBid: Number(job.acceptedBid || 0),
    acceptedAt: job.acceptedAt || "",
    progressUpdates: Array.isArray(job.progressUpdates) ? job.progressUpdates : [],
    completionRequested: Boolean(job.completionRequested),
    completionRequestedAt: job.completionRequestedAt || "",
    completionConfirmed: Boolean(job.completionConfirmed),
    completionConfirmedAt: job.completionConfirmedAt || "",
    progress: Number(job.progress || 0),
    progressNote: job.progressNote || "",
    progressUpdatedBy: job.progressUpdatedBy || "",
    progressUpdatedAt: job.progressUpdatedAt || "",
    statusUpdatedAt: job.statusUpdatedAt || job.postedDate || "",
    poNumber: (job.poNumber || "").trim(),
    paymentSchedule: normalizePaymentSchedule(job.paymentSchedule || {
      upfrontPercent: job.upfrontPercent,
      progressPercent: job.progressPercent,
      completionPercent: job.completionPercent
    }, {
      upfrontPercent: 0,
      progressPercent: 0,
      completionPercent: 100
    })
  })

  const loadJobsFromStorage = () => {
    const storedJobs = localStorage.getItem("jobs")
    if (!storedJobs) return null

    const parsedJobs = JSON.parse(storedJobs)
    if (!Array.isArray(parsedJobs)) return []

    return parsedJobs
      .filter((job) => String(job?.postedBy || "").trim().toLowerCase() !== DEMO_CLIENT_EMAIL)
      .map(normalizeJob)
  }

  // Load jobs from localStorage on mount
  useEffect(() => {
    const storedJobs = loadJobsFromStorage()
    if (storedJobs) {
      setJobs(storedJobs)
    } else {
      setJobs([])
      localStorage.setItem("jobs", JSON.stringify([]))
    }
    setIsHydrated(true)
  }, [])

  // Save jobs to localStorage whenever jobs change
  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem("jobs", JSON.stringify(jobs))
  }, [jobs, isHydrated])

  // Ensure jobs state re-syncs when switching between demo accounts.
  useEffect(() => {
    if (!isHydrated || !user) return
    const storedJobs = loadJobsFromStorage()
    if (storedJobs) {
      setJobs(storedJobs)
    }
  }, [user, isHydrated])

  useEffect(() => {
    if (!isHydrated) return

    migrateJobPhotosIfNeeded().catch(() => {
      // Migration failures should not block normal job usage.
    })
  }, [isHydrated])

  const persistJobs = (nextJobs) => {
    setJobs(nextJobs)
    if (isHydrated) {
      localStorage.setItem("jobs", JSON.stringify(nextJobs))
    }
  }

  const migrateJobPhotosIfNeeded = async () => {
    const migrationKey = "jobs_photo_migration_v1"
    if (localStorage.getItem(migrationKey)) return

    const storedJobs = loadJobsFromStorage()
    if (!storedJobs || storedJobs.length === 0) {
      localStorage.setItem(migrationKey, "done")
      return
    }

    let hasChanges = false
    const migratedJobs = []

    for (const storedJob of storedJobs) {
      const nextJob = { ...storedJob }

      if (Array.isArray(nextJob.photos)) {
        const migratedJobPhotos = []
        let jobPhotosChanged = false

        for (const photo of nextJob.photos) {
          if (photo?.data && isImageDataUrl(photo.data) && photo.data.length > 350000) {
            try {
              const compressed = await compressDataUrl(photo.data)
              migratedJobPhotos.push({ ...photo, data: compressed })
              jobPhotosChanged = true
            } catch {
              migratedJobPhotos.push(photo)
            }
          } else {
            migratedJobPhotos.push(photo)
          }
        }

        if (jobPhotosChanged) {
          nextJob.photos = migratedJobPhotos
          hasChanges = true
        }
      }

      if (Array.isArray(nextJob.progressUpdates)) {
        const migratedUpdates = []
        let updatesChanged = false

        for (const update of nextJob.progressUpdates) {
          if (!Array.isArray(update?.photos)) {
            migratedUpdates.push(update)
            continue
          }

          const migratedPhotos = []
          let updatePhotosChanged = false

          for (const photo of update.photos) {
            if (photo?.data && isImageDataUrl(photo.data) && photo.data.length > 350000) {
              try {
                const compressed = await compressDataUrl(photo.data)
                migratedPhotos.push({ ...photo, data: compressed })
                updatePhotosChanged = true
              } catch {
                migratedPhotos.push(photo)
              }
            } else {
              migratedPhotos.push(photo)
            }
          }

          if (updatePhotosChanged) {
            migratedUpdates.push({ ...update, photos: migratedPhotos })
            updatesChanged = true
          } else {
            migratedUpdates.push(update)
          }
        }

        if (updatesChanged) {
          nextJob.progressUpdates = migratedUpdates
          hasChanges = true
        }
      }

      migratedJobs.push(normalizeJob(nextJob))
    }

    if (hasChanges) {
      localStorage.setItem("jobs", JSON.stringify(migratedJobs))
      setJobs(migratedJobs)
    }

    localStorage.setItem(migrationKey, "done")
  }

  const createJob = (jobData) => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null")
    const effectiveUser = user || storedUser

    if (!effectiveUser?.email) {
      throw new Error("You must be logged in to post a job")
    }

    const newJob = {
      id: Date.now(),
      ...jobData,
      postedBy: effectiveUser.email,
      postedDate: new Date().toISOString(),
      status: "open",
      applications: [],
      photos: jobData.photos || [],
      selectedContractor: "",
      selectedContractorName: "",
      acceptedBid: 0,
      acceptedAt: "",
      progressUpdates: [],
      completionRequested: false,
      completionRequestedAt: "",
      completionConfirmed: false,
      completionConfirmedAt: "",
      progress: 0,
      progressNote: "",
      progressUpdatedBy: "",
      progressUpdatedAt: "",
      statusUpdatedAt: new Date().toISOString(),
      poNumber: String(jobData.poNumber || "").trim(),
      paymentSchedule: {
        upfrontPercent: 0,
        progressPercent: 0,
        completionPercent: 100
      }
    }
    const nextJobs = [...jobs, normalizeJob(newJob)]
    persistJobs(nextJobs)
    return newJob
  }

  const applyToJob = (jobId, applicationData) => {
    if (!user?.email) {
      throw new Error("You must be logged in to claim projects")
    }

    let wasApplied = false

    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job

      const hasAlreadyApplied = job.applications.some(app => app.applicant === user.email)
      if (hasAlreadyApplied) {
        throw new Error("You have already applied to this job")
      }

      if (job.applications.length >= 5) {
        throw new Error("This job has reached the maximum of 5 claims")
      }

      wasApplied = true

      return {
        ...job,
        applications: [...job.applications, {
          id: Date.now(),
          applicant: user.email,
          ...applicationData,
          bidAmount: Number(applicationData.bidAmount || 0),
          bidMin: Number(applicationData.bidMin || applicationData.bidAmount || 0),
          bidMax: Number(applicationData.bidMax || applicationData.bidAmount || 0),
          paymentSchedule: normalizePaymentSchedule(applicationData.paymentSchedule, {
            upfrontPercent: 0,
            progressPercent: 0,
            completionPercent: 100
          }, Number(applicationData.bidAmount || 0)),
          status: "pending",
          appliedDate: new Date().toISOString()
        }]
      }
    })

    persistJobs(nextJobs)

    if (!wasApplied) {
      throw new Error("Job not found")
    }
  }

  const getMyJobs = () => {
    if (!user) return []
    return jobs.filter(job => job.postedBy === user.email)
  }

  const getAvailableJobs = () => {
    if (!user) return []
    return jobs.filter(job => job.postedBy !== user.email && job.status === "open" && job.applications.length < 5)
  }

  const getClaimedJobs = () => {
    if (!user) return []
    return jobs.filter(job => job.selectedContractor === user.email)
  }

  const getJobById = (jobId) => {
    const numericId = Number(jobId)
    return jobs.find(job => Number(job.id) === numericId) || null
  }

  const acceptApplication = (jobId, applicationId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job
      if (job.postedBy !== user.email) {
        throw new Error("Only the user who posted this job can accept an application")
      }

      const acceptedApplication = job.applications.find(app => app.id === applicationId)
      if (!acceptedApplication) {
        throw new Error("Application not found")
      }

      return {
        ...job,
        status: "in_progress",
        selectedContractor: acceptedApplication.applicant,
        selectedContractorName: acceptedApplication.applicantName || acceptedApplication.applicant,
        acceptedBid: Number(acceptedApplication.bidAmount || 0),
        paymentSchedule: normalizePaymentSchedule(acceptedApplication.paymentSchedule, {
          upfrontPercent: 0,
          progressPercent: 0,
          completionPercent: 100
        }, Number(acceptedApplication.bidAmount || 0)),
        acceptedAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        applications: job.applications.map(app => ({
          ...app,
          status: app.id === applicationId ? "accepted" : "rejected"
        }))
      }
    })

    persistJobs(nextJobs)
  }

  const addProgressUpdate = (jobId, update) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job

      if (job.selectedContractor !== user.email) {
        throw new Error("Only the accepted contractor can update this job")
      }

      const newProgress = Math.max(0, Math.min(100, Number(update.progress ?? job.progress) || 0))

      const progressUpdate = {
        id: Date.now(),
        contractor: user.email,
        contractorName: user.name,
        note: update.note || "",
        progress: newProgress,
        photos: Array.isArray(update.photos) ? update.photos : [],
        createdAt: new Date().toISOString()
      }

      return {
        ...job,
        progress: newProgress,
        progressNote: progressUpdate.note,
        progressUpdatedBy: user.name,
        progressUpdatedAt: progressUpdate.createdAt,
        progressUpdates: [...job.progressUpdates, progressUpdate]
      }
    })

    persistJobs(nextJobs)
  }

  const markJobComplete = (jobId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job

      if (job.selectedContractor !== user.email) {
        throw new Error("Only the accepted contractor can mark this job complete")
      }

      return {
        ...job,
        status: "pending_client_confirmation",
        completionRequested: true,
        completionRequestedAt: new Date().toISOString(),
        progress: 100,
        progressNote: job.progressNote || "Contractor marked this job as complete.",
        progressUpdatedBy: user.name,
        progressUpdatedAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString()
      }
    })

    persistJobs(nextJobs)
  }

  const confirmJobCompletion = (jobId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job

      if (job.postedBy !== user.email) {
        throw new Error("Only the user who posted this job can confirm completion")
      }

      if (!job.completionRequested) {
        throw new Error("Contractor has not requested completion yet")
      }

      return {
        ...job,
        status: "completed",
        completionConfirmed: true,
        completionConfirmedAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString()
      }
    })

    persistJobs(nextJobs)
  }

  const updateJobProgress = (jobId, progress, note = "") => {
    addProgressUpdate(jobId, { progress, note, photos: [] })
  }

  const deleteJob = (jobId) => {
    const targetJob = jobs.find(job => job.id === jobId)
    if (!targetJob) return

    const isLocked =
      targetJob.selectedContractor ||
      ["in_progress", "pending_client_confirmation", "completed"].includes(targetJob.status)

    if (isLocked) {
      throw new Error("This project can no longer be deleted because work has started or completed")
    }

    const nextJobs = jobs.filter(job => job.id !== jobId)
    persistJobs(nextJobs)
  }

  const refreshJobs = () => {
    const storedJobs = loadJobsFromStorage()
    if (storedJobs) {
      setJobs(storedJobs)
    }
  }

  const value = {
    jobs,
    createJob,
    applyToJob,
    getMyJobs,
    getAvailableJobs,
    getClaimedJobs,
    getJobById,
    acceptApplication,
    addProgressUpdate,
    markJobComplete,
    confirmJobCompletion,
    updateJobProgress,
    deleteJob,
    refreshJobs
  }

  return (
    <JobsContext.Provider value={value}>
      {children}
    </JobsContext.Provider>
  )
}

export function useJobs() {
  return useContext(JobsContext)
}