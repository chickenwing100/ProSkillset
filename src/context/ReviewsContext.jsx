import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

const ReviewsContext = createContext(null)
const STORAGE_KEY = "contractor_reviews_v1"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()
const clampRating = (value) => Math.max(1, Math.min(5, Number(value) || 0))
const normalizeJobId = (value) => {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

function normalizeReview(review) {
  const jobId = normalizeJobId(review.jobId)
  return {
    id: review.id || `${jobId}-${normalizeEmail(review.contractorEmail)}-${normalizeEmail(review.clientEmail)}`,
    jobId,
    contractorEmail: normalizeEmail(review.contractorEmail),
    clientEmail: normalizeEmail(review.clientEmail),
    rating: clampRating(review.rating),
    comment: String(review.comment || "").trim(),
    createdAt: review.createdAt || new Date().toISOString(),
    updatedAt: review.updatedAt || review.createdAt || new Date().toISOString()
  }
}

function mapDatabaseRowToReview(row) {
  if (!row || typeof row !== "object") return null

  return normalizeReview({
    id: row.id,
    jobId: row.job_id ?? row.jobId,
    contractorEmail: row.contractor_email || row.contractorEmail,
    clientEmail: row.client_email || row.clientEmail,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  })
}

function serializeReviewForDatabase(review) {
  return {
    id: review.id,
    job_id: normalizeJobId(review.jobId),
    contractor_email: normalizeEmail(review.contractorEmail),
    client_email: normalizeEmail(review.clientEmail),
    rating: clampRating(review.rating),
    comment: String(review.comment || "").trim(),
    created_at: review.createdAt || new Date().toISOString(),
    updated_at: review.updatedAt || new Date().toISOString()
  }
}

function readStoredReviews() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(raw) ? raw.map(normalizeReview) : []
  } catch {
    return []
  }
}

export function ReviewsProvider({ children }) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)

  const loadReviewsFromSupabase = async () => {
    if (!isSupabaseConfigured) return null

    try {
      const { data, error } = await supabase
        .from("contractor_reviews")
        .select("*")

      if (error) return null

      return (Array.isArray(data) ? data : [])
        .map(mapDatabaseRowToReview)
        .filter(Boolean)
    } catch {
      return null
    }
  }

  const persistReviewToSupabase = async (review) => {
    if (!isSupabaseConfigured || !review) return

    try {
      await supabase
        .from("contractor_reviews")
        .upsert(serializeReviewForDatabase(review), { onConflict: "id" })
    } catch {
      // No-op: local state remains the fallback source.
    }
  }

  useEffect(() => {
    const hydrate = async () => {
      const supabaseReviews = await loadReviewsFromSupabase()
      const nextReviews = supabaseReviews ?? readStoredReviews()
      setReviews(nextReviews)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReviews))
      setIsHydrated(true)
    }

    void hydrate()
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  }, [isHydrated, reviews])

  useEffect(() => {
    if (!isHydrated || !user) return

    const hydrate = async () => {
      const supabaseReviews = await loadReviewsFromSupabase()
      if (!supabaseReviews) return

      setReviews(supabaseReviews)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(supabaseReviews))
    }

    void hydrate()
  }, [isHydrated, user])

  const submitReview = ({ jobId, contractorEmail, clientEmail, rating, comment = "" }) => {
    const normalizedContractorEmail = normalizeEmail(contractorEmail)
    const normalizedClientEmail = normalizeEmail(clientEmail || user?.email)
    const normalizedJobId = normalizeJobId(jobId)

    if (!normalizedContractorEmail || !normalizedClientEmail || !normalizedJobId) {
      throw new Error("Missing review details")
    }

    const normalizedRating = clampRating(rating)
    if (!normalizedRating) {
      throw new Error("A star rating is required")
    }

    const nextReview = normalizeReview({
      jobId: normalizedJobId,
      contractorEmail: normalizedContractorEmail,
      clientEmail: normalizedClientEmail,
      rating: normalizedRating,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    let finalReview = nextReview

    setReviews((previous) => {
      const existingIndex = previous.findIndex(
        (review) => review.jobId === nextReview.jobId && review.clientEmail === nextReview.clientEmail
      )

      if (existingIndex === -1) {
        finalReview = nextReview
        return [...previous, nextReview]
      }

      const updated = [...previous]
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...nextReview,
        createdAt: updated[existingIndex].createdAt,
        updatedAt: new Date().toISOString()
      }
      finalReview = updated[existingIndex]
      return updated
    })

    void persistReviewToSupabase(finalReview)
  }

  const getReviewForJob = (jobId, clientEmail = user?.email) => {
    const normalizedClientEmail = normalizeEmail(clientEmail)
    const normalizedJobId = normalizeJobId(jobId)
    return reviews.find(
      (review) => review.jobId === normalizedJobId && review.clientEmail === normalizedClientEmail
    ) || null
  }

  const getContractorReviews = (contractorEmail) => {
    const normalizedContractorEmail = normalizeEmail(contractorEmail)
    return reviews.filter((review) => review.contractorEmail === normalizedContractorEmail)
  }

  const getContractorRating = (contractorEmail) => {
    const contractorReviews = getContractorReviews(contractorEmail)
    if (contractorReviews.length === 0) {
      return {
        average: 5,
        reviewCount: 0
      }
    }

    const total = contractorReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0)
    return {
      average: Number((total / contractorReviews.length).toFixed(1)),
      reviewCount: contractorReviews.length
    }
  }

  return (
    <ReviewsContext.Provider
      value={{
        reviews,
        submitReview,
        getReviewForJob,
        getContractorReviews,
        getContractorRating
      }}
    >
      {children}
    </ReviewsContext.Provider>
  )
}

export function useReviews() {
  const context = useContext(ReviewsContext)
  if (!context) {
    throw new Error("useReviews must be used within a ReviewsProvider")
  }
  return context
}
