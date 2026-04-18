import { createContext, useState, useContext, useEffect } from "react"
import { useAuth } from "./AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

const JobsContext = createContext()
const DEMO_CLIENT_EMAIL = "client@example.com"
const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

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

// Photo storage helpers: minimize localStorage by stripping base64 data
const stripPhotoData = (photos) => {
  if (!Array.isArray(photos)) return []
  try {
    return photos.map(photo => {
      if (!photo) return photo
      // Keep all properties except the base64 data
      const { data, ...photoWithoutData } = photo
      return photoWithoutData
    })
  } catch (err) {
    console.warn("Error stripping photo data:", err)
    return photos // Return original if stripping fails
  }
}

const stripProgressUpdatePhotos = (updates) => {
  if (!Array.isArray(updates)) return []
  try {
    return updates.map(update => {
      if (!update) return update
      return {
        ...update,
        photos: stripPhotoData(update.photos)
      }
    })
  } catch (err) {
    console.warn("Error stripping progress update photos:", err)
    return updates // Return original if stripping fails
  }
}

const toDatabasePhotos = (photos) => stripPhotoData(photos)

const toDatabaseProgressUpdates = (updates) => {
  if (!Array.isArray(updates)) return []
  return updates.map((update) => ({
    ...update,
    photos: toDatabasePhotos(update?.photos)
  }))
}

const uploadPhotoToSupabase = async (photo, jobId, context = "job") => {
  if (!isSupabaseConfigured || !photo?.data) return photo
  try {
    const photoId = photo.id || `photo_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const filename = `${jobId}/${context}/${photoId}.jpg`
    
    // Convert data URL to blob
    const response = await fetch(photo.data)
    const blob = await response.blob()
    
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(filename, blob, { upsert: true })
    
    if (uploadError) {
      console.warn(`Photo upload failed for ${filename}:`, uploadError)
      return photo // Return original photo if upload fails
    }
    
    // Get public URL
    const { data } = supabase.storage
      .from("job-photos")
      .getPublicUrl(filename)
    
    return {
      ...photo,
      url: data?.publicUrl || null,
      uploadedToCloud: true
    }
  } catch (err) {
    console.warn("Error uploading photo:", err)
    return photo // Return original photo if error
  }
}

const uploadJobPhotosToSupabase = async (jobId, photos) => {
  if (!Array.isArray(photos)) return photos
  const uploadedPhotos = await Promise.all(
    photos.map(photo => uploadPhotoToSupabase(photo, jobId, "job"))
  )
  return uploadedPhotos
}

const uploadProgressUpdatePhotosToSupabase = async (jobId, updates) => {
  if (!Array.isArray(updates)) return updates
  return Promise.all(
    updates.map(async (update) => {
      if (!Array.isArray(update?.photos)) return update
      const uploadedPhotos = await Promise.all(
        update.photos.map((photo, idx) => uploadPhotoToSupabase(photo, jobId, `progress_${update.id}_${idx}`))
      )
      return { ...update, photos: uploadedPhotos }
    })
  )
}

export function JobsProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)
  const { user } = useAuth()

  const mapDatabaseRowToJob = (row) => {
    if (!row || typeof row !== "object") return null

    const mappedJob = {
      id: row.id,
      title: row.title || "",
      description: row.description || "",
      category: row.category || "",
      trade: row.trade || "",
      location: row.location || "",
      budget: Number(row.budget || row.budgetMax || row.budget_max || 0),
      budgetMin: Number(row.budget_min || row.budgetMin || 0),
      budgetMax: Number(row.budget_max || row.budgetMax || 0),
      timeline: row.timeline || "",
      urgency: row.urgency || "",
      requirements: row.requirements || "",
      postedBy: normalizeEmail(row.posted_by || row.postedBy || ""),
      postedByName: row.posted_by_name || row.postedByName || "",
      postedDate: row.posted_date || row.postedDate || row.created_at || new Date().toISOString(),
      status: row.status || "open",
      applications: Array.isArray(row.applications) ? row.applications : [],
      photos: Array.isArray(row.photos) ? row.photos : [],
      selectedContractor: row.selected_contractor || row.selectedContractor || "",
      selectedContractorName: row.selected_contractor_name || row.selectedContractorName || "",
      acceptedBid: Number(row.accepted_bid || row.acceptedBid || 0),
      acceptedAt: row.accepted_at || row.acceptedAt || "",
      progressUpdates: Array.isArray(row.progress_updates || row.progressUpdates)
        ? (row.progress_updates || row.progressUpdates)
        : [],
      completionRequested: Boolean(row.completion_requested || row.completionRequested),
      completionRequestedAt: row.completion_requested_at || row.completionRequestedAt || "",
      completionConfirmed: Boolean(row.completion_confirmed || row.completionConfirmed),
      completionConfirmedAt: row.completion_confirmed_at || row.completionConfirmedAt || "",
      progress: Number(row.progress || 0),
      progressNote: row.progress_note || row.progressNote || "",
      progressUpdatedBy: row.progress_updated_by || row.progressUpdatedBy || "",
      progressUpdatedAt: row.progress_updated_at || row.progressUpdatedAt || "",
      statusUpdatedAt: row.status_updated_at || row.statusUpdatedAt || row.updated_at || "",
      poNumber: row.po_number || row.poNumber || "",
      paymentSchedule: row.payment_schedule || row.paymentSchedule || {
        upfrontPercent: 0,
        progressPercent: 0,
        completionPercent: 100
      }
    }

    return normalizeJob(mappedJob)
  }

  const serializeJobForDatabase = (job) => ({
    id: job.id,
    title: job.title || "",
    description: job.description || "",
    category: job.category || "",
    trade: job.trade || "",
    location: job.location || "",
    budget: Number(job.budget || job.budgetMax || 0),
    budget_min: Number(job.budgetMin || 0),
    budget_max: Number(job.budgetMax || 0),
    timeline: job.timeline || "",
    urgency: job.urgency || "",
    requirements: job.requirements || "",
    posted_by: normalizeEmail(job.postedBy),
    posted_by_name: job.postedByName || "",
    posted_date: job.postedDate || new Date().toISOString(),
    status: job.status || "open",
    applications: Array.isArray(job.applications) ? job.applications : [],
    photos: toDatabasePhotos(job.photos),
    selected_contractor: job.selectedContractor || "",
    selected_contractor_name: job.selectedContractorName || "",
    accepted_bid: Number(job.acceptedBid || 0),
    accepted_at: job.acceptedAt || null,
    progress_updates: toDatabaseProgressUpdates(job.progressUpdates),
    completion_requested: Boolean(job.completionRequested),
    completion_requested_at: job.completionRequestedAt || null,
    completion_confirmed: Boolean(job.completionConfirmed),
    completion_confirmed_at: job.completionConfirmedAt || null,
    progress: Number(job.progress || 0),
    progress_note: job.progressNote || "",
    progress_updated_by: job.progressUpdatedBy || "",
    progress_updated_at: job.progressUpdatedAt || null,
    status_updated_at: job.statusUpdatedAt || null,
    po_number: String(job.poNumber || "").trim(),
    payment_schedule: job.paymentSchedule || {
      upfrontPercent: 0,
      progressPercent: 0,
      completionPercent: 100
    }
  })

  const normalizeJob = (job) => ({
    ...job,
    category: job.category || job.trade || "",
    postedBy: normalizeEmail(job.postedBy || "client@example.com"),
    postedByName: job.postedByName || "",
    postedDate: job.postedDate || new Date().toISOString(),
    status: job.status || "open",
    budget: Number(job.budget || job.budgetMax || 0),
    applications: Array.isArray(job.applications)
      ? job.applications.map((application) => ({
          ...application,
          applicant: normalizeEmail(application.applicant),
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
    try {
      const storedJobs = localStorage.getItem("jobs")
      if (!storedJobs) return null

      const parsedJobs = JSON.parse(storedJobs)
      if (!Array.isArray(parsedJobs)) return []

      return parsedJobs
        .filter((job) => normalizeEmail(job?.postedBy) !== DEMO_CLIENT_EMAIL)
        .map(normalizeJob)
    } catch {
      return null
    }
  }

  const loadJobsFromSupabase = async () => {
    if (!isSupabaseConfigured) return null

    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")

      if (error) return null

      return (Array.isArray(data) ? data : [])
        .map(mapDatabaseRowToJob)
        .filter(Boolean)
        .filter((job) => normalizeEmail(job?.postedBy) !== DEMO_CLIENT_EMAIL)
    } catch {
      return null
    }
  }

  const createJobInSupabase = async (job) => {
    if (!isSupabaseConfigured || !job) {
      return { success: true, error: null, jobId: job?.id }
    }

    try {
      const payload = serializeJobForDatabase(job)
      // Don't pass the ID - let Supabase auto-generate it to avoid UUID/bigint type conflicts
      const { id, ...payloadWithoutId } = payload
      
      const { data, error } = await supabase
        .from("jobs")
        .insert(payloadWithoutId)
        .select("id")
        .maybeSingle()

      if (error) {
        return {
          success: false,
          error: error.message || "Failed to create job in Supabase",
          jobId: job?.id
        }
      }

      // Return the Supabase-generated ID if available, otherwise use the original
      const generatedId = data?.id || job?.id
      return { success: true, error: null, jobId: generatedId }
    } catch (err) {
      console.error("Error in createJobInSupabase:", err)
      return {
        success: false,
        error: err?.message || "Failed to create job in Supabase",
        jobId: job?.id
      }
    }
  }

  const persistJobToSupabase = async (job) => {
    if (!isSupabaseConfigured || !job) return true

    try {
      const jobForDatabase = serializeJobForDatabase(job)
      
      // Upload job photos in background (fire-and-forget)
      // Don't wait for uploads to complete - persist job first, then upload photos
      if (Array.isArray(job.photos) && job.photos.some(p => p?.data)) {
        uploadJobPhotosToSupabase(job.id, job.photos)
          .then(uploadedPhotos => {
            // Update job with uploaded photo URLs
            supabase
              .from("jobs")
              .update({ photos: uploadedPhotos })
              .eq("id", job.id)
              .then(({ error }) => {
                if (error) {
                  console.error("Failed to update job photos:", error)
                }
              })
          })
          .catch(err => console.error("Failed to upload job photos:", err))
      }
      
      // Upload progress update photos in background
      if (Array.isArray(job.progressUpdates) && job.progressUpdates.some(u => Array.isArray(u?.photos) && u.photos.some(p => p?.data))) {
        uploadProgressUpdatePhotosToSupabase(job.id, job.progressUpdates)
          .then(uploadedUpdates => {
            supabase
              .from("jobs")
              .update({ progress_updates: uploadedUpdates })
              .eq("id", job.id)
              .then(({ error }) => {
                if (error) {
                  console.error("Failed to update progress photos:", error)
                }
              })
          })
          .catch(err => console.error("Failed to upload progress photos:", err))
      }
      
      // Persist existing jobs with update semantics so contractor-side writes satisfy RLS.
      const { id, ...jobUpdates } = jobForDatabase
      const { error } = await supabase
        .from("jobs")
        .update(jobUpdates)
        .eq("id", id)
      
      if (error) {
        throw new Error(error.message || "Failed to persist job to Supabase")
      }
      return true
    } catch (err) {
      console.error("Error in persistJobToSupabase:", err)
      return false
    }
  }

  const chooseBestJobs = (supabaseJobs, localJobs, currentJobs = []) => {
    const supabaseCount = Array.isArray(supabaseJobs) ? supabaseJobs.length : -1
    const localCount = Array.isArray(localJobs) ? localJobs.length : -1
    const currentCount = Array.isArray(currentJobs) ? currentJobs.length : -1

    if (Array.isArray(supabaseJobs) && supabaseCount > 0) return supabaseJobs
    if (Array.isArray(localJobs) && localCount > 0) return localJobs
    if (Array.isArray(currentJobs) && currentCount > 0) return currentJobs

    if (Array.isArray(supabaseJobs)) return supabaseJobs
    if (Array.isArray(localJobs)) return localJobs
    return []
  }

  const deleteJobFromSupabase = async (jobId) => {
    if (!isSupabaseConfigured) return

    try {
      await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId)
    } catch {
      // No-op: local deletion still succeeds when Supabase write fails.
    }
  }

  // Load jobs from localStorage on mount
  useEffect(() => {
    const hydrate = async () => {
      const supabaseJobs = await loadJobsFromSupabase()
      const localJobs = loadJobsFromStorage()
      const nextJobs = chooseBestJobs(supabaseJobs, localJobs)
      setJobs(nextJobs)
      
      // Strip photo data before storing in localStorage to avoid quota issues
      const jobsForStorage = nextJobs.map(job => ({
        ...job,
        photos: stripPhotoData(job.photos),
        progressUpdates: stripProgressUpdatePhotos(job.progressUpdates)
      }))
      localStorage.setItem("jobs", JSON.stringify(jobsForStorage))
      setIsHydrated(true)
    }

    void hydrate()
  }, [])

  // Save jobs to localStorage whenever jobs change
  useEffect(() => {
    if (!isHydrated) return
    // Strip photo data before storing in localStorage to avoid quota issues
    const jobsForStorage = jobs.map(job => ({
      ...job,
      photos: stripPhotoData(job.photos),
      progressUpdates: stripProgressUpdatePhotos(job.progressUpdates)
    }))
    localStorage.setItem("jobs", JSON.stringify(jobsForStorage))
  }, [jobs, isHydrated])

  // Ensure jobs state re-syncs when switching between demo accounts.
  useEffect(() => {
    if (!isHydrated || !user) return

    const hydrate = async () => {
      const supabaseJobs = await loadJobsFromSupabase()
      const localJobs = loadJobsFromStorage()
      const nextJobs = chooseBestJobs(supabaseJobs, localJobs, jobs)
      setJobs(nextJobs)
    }

    void hydrate()
  }, [user, isHydrated])

  useEffect(() => {
    if (!isHydrated) return

    migrateJobPhotosIfNeeded().catch(() => {
      // Migration failures should not block normal job usage.
    })
  }, [isHydrated])

  const persistJobs = (nextJobs) => {
    try {
      setJobs(nextJobs)
      // Persist to localStorage even if not hydrated yet - hydration flag shouldn't block writes
      const jobsForStorage = nextJobs.map(job => ({
        ...job,
        photos: stripPhotoData(job.photos),
        progressUpdates: stripProgressUpdatePhotos(job.progressUpdates)
      }))
      localStorage.setItem("jobs", JSON.stringify(jobsForStorage))
    } catch (err) {
      console.error("[JobsContext] Error persisting jobs:", err)
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

  const createJob = async (jobData) => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null")
    const effectiveUser = user || storedUser

    if (!effectiveUser?.email) {
      throw new Error("You must be logged in to post a job")
    }

    const postedBy = normalizeEmail(effectiveUser.email)

    const newJob = {
      id: Date.now(),
      ...jobData,
      category: jobData.category || jobData.trade || "",
      postedBy,
      postedByName: effectiveUser.name || "",
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
    const normalizedJob = normalizeJob(newJob)
    const nextJobs = [...jobs, normalizedJob]
    persistJobs(nextJobs)

    const cloudCreate = await createJobInSupabase(normalizedJob)
    if (!cloudCreate.success && isSupabaseConfigured) {
      throw new Error(cloudCreate.error || "Failed to save project to cloud")
    }

    // Track the actual job ID (from Supabase if different)
    let actualJobId = normalizedJob.id

    // If Supabase returned a different ID, update the job with it
    if (isSupabaseConfigured && cloudCreate.jobId && cloudCreate.jobId !== normalizedJob.id) {
      actualJobId = cloudCreate.jobId
      const updatedJob = { ...normalizedJob, id: cloudCreate.jobId }
      const updatedJobs = nextJobs.map(j => j.id === normalizedJob.id ? updatedJob : j)
      persistJobs(updatedJobs)
      setJobs(updatedJobs)
    }

    // Upload job photos after row exists, then patch row with photo URLs.
    // Use the actual Supabase ID for photo uploads
    if (isSupabaseConfigured && Array.isArray(normalizedJob.photos) && normalizedJob.photos.some((photo) => photo?.data)) {
      uploadJobPhotosToSupabase(actualJobId, normalizedJob.photos)
        .then(async (uploadedPhotos) => {
          const sanitizedPhotos = toDatabasePhotos(uploadedPhotos)
          await supabase
            .from("jobs")
            .update({ photos: sanitizedPhotos })
            .eq("id", actualJobId)
        })
        .catch((err) => {
          console.error("Failed to upload or persist job photos:", err)
        })
    }

    if (cloudCreate.success && isSupabaseConfigured) {
      const supabaseJobs = await loadJobsFromSupabase()
      const refreshedJobs = chooseBestJobs(supabaseJobs, nextJobs, jobs)
      setJobs(refreshedJobs)
      persistJobs(refreshedJobs)
    }

    return newJob
  }

  const applyToJob = (jobId, applicationData) => {
    if (!user?.email) {
      throw new Error("You must be logged in to claim projects")
    }

    const currentUserEmail = normalizeEmail(user.email)

    if (isSupabaseConfigured) {
      const claimInSupabase = async () => {
        const normalizedJobId = String(jobId || "").trim()
        if (!normalizedJobId) {
          throw new Error("Invalid project id")
        }

        const { data, error } = await supabase.rpc("claim_job", {
          target_job_id: normalizedJobId,
          application_payload: {
            message: applicationData.message || "",
            applicantName: applicationData.applicantName || user.name || "",
            bidAmount: Number(applicationData.bidAmount || 0),
            bidMin: Number(applicationData.bidMin || applicationData.bidAmount || 0),
            bidMax: Number(applicationData.bidMax || applicationData.bidAmount || 0),
            paymentSchedule: normalizePaymentSchedule(applicationData.paymentSchedule, {
              upfrontPercent: 0,
              progressPercent: 0,
              completionPercent: 100
            }, Number(applicationData.bidAmount || 0))
          }
        })

        if (error) {
          throw new Error(error.message || "Failed to claim project")
        }

        const updatedJob = mapDatabaseRowToJob(data)
        if (!updatedJob) {
          throw new Error("Project claim succeeded but refresh failed")
        }

        const nextJobs = jobs.map((job) => {
          if (String(job.id).trim() !== String(updatedJob.id).trim() && Number(job.id) !== Number(updatedJob.id)) {
            return job
          }
          return updatedJob
        })

        persistJobs(nextJobs)
        return updatedJob
      }

      return claimInSupabase()
    }

    let wasApplied = false

    const nextJobs = jobs.map(job => {
      if (String(job.id).trim() !== String(jobId).trim() && Number(job.id) !== Number(jobId)) return job

      const hasAlreadyApplied = job.applications.some(app => normalizeEmail(app.applicant) === currentUserEmail)
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

    const updatedJob = nextJobs.find((job) => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (updatedJob) {
      void persistJobToSupabase(updatedJob)
    }

    if (!wasApplied) {
      throw new Error("Job not found")
    }
  }

  const getMyJobs = () => {
    if (!user) return []
    const currentUserEmail = normalizeEmail(user.email)
    return jobs.filter(job => normalizeEmail(job.postedBy) === currentUserEmail)
  }

  const getAvailableJobs = () => {
    if (!user) return []
    const currentUserEmail = normalizeEmail(user.email)
    return jobs.filter(job => normalizeEmail(job.postedBy) !== currentUserEmail && job.status === "open" && job.applications.length < 5)
  }

  const getClaimedJobs = () => {
    if (!user) return []
    const currentUserEmail = normalizeEmail(user.email)
    return jobs.filter(job => normalizeEmail(job.selectedContractor) === currentUserEmail)
  }

  const getJobById = (jobId) => {
    if (!jobId) return null
    const idStr = String(jobId).trim()
    return jobs.find(job => {
      // Compare as strings since IDs can be numeric (Date.now()) or UUID (from Supabase)
      return String(job.id).trim() === idStr || Number(job.id) === Number(jobId)
    }) || null
  }

  const acceptApplication = (jobId, applicationId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (String(job.id).trim() !== String(jobId).trim() && Number(job.id) !== Number(jobId)) return job
      if (normalizeEmail(job.postedBy) !== normalizeEmail(user.email)) {
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

    const updatedJob = nextJobs.find((job) => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (updatedJob) {
      void persistJobToSupabase(updatedJob)
    }
  }

  const addProgressUpdate = (jobId, update) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (String(job.id).trim() !== String(jobId).trim() && Number(job.id) !== Number(jobId)) return job

      if (normalizeEmail(job.selectedContractor) !== normalizeEmail(user.email)) {
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

    const updatedJob = nextJobs.find((job) => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (updatedJob) {
      void persistJobToSupabase(updatedJob)
    }
  }

  const markJobComplete = (jobId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (String(job.id).trim() !== String(jobId).trim() && Number(job.id) !== Number(jobId)) return job

      if (normalizeEmail(job.selectedContractor) !== normalizeEmail(user.email)) {
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

    const updatedJob = nextJobs.find((job) => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (updatedJob) {
      void persistJobToSupabase(updatedJob)
    }
  }

  const confirmJobCompletion = (jobId) => {
    if (!user) return

    const nextJobs = jobs.map(job => {
      if (String(job.id).trim() !== String(jobId).trim() && Number(job.id) !== Number(jobId)) return job

      if (normalizeEmail(job.postedBy) !== normalizeEmail(user.email)) {
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

    const updatedJob = nextJobs.find((job) => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (updatedJob) {
      void persistJobToSupabase(updatedJob)
    }
  }

  const updateJobProgress = (jobId, progress, note = "") => {
    addProgressUpdate(jobId, { progress, note, photos: [] })
  }

  const deleteJob = (jobId) => {
    const targetJob = jobs.find(job => String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId))
    if (!targetJob) return

    const isLocked =
      targetJob.selectedContractor ||
      ["in_progress", "pending_client_confirmation", "completed"].includes(targetJob.status)

    if (isLocked) {
      throw new Error("This project can no longer be deleted because work has started or completed")
    }

    const nextJobs = jobs.filter(job => !(String(job.id).trim() === String(jobId).trim() || Number(job.id) === Number(jobId)))
    persistJobs(nextJobs)
    void deleteJobFromSupabase(jobId)
  }

  const refreshJobs = () => {
    const refresh = async () => {
      const supabaseJobs = await loadJobsFromSupabase()
      const localJobs = loadJobsFromStorage()
      const nextJobs = chooseBestJobs(supabaseJobs, localJobs, jobs)
      setJobs(nextJobs)
      persistJobs(nextJobs)
    }

    void refresh()
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