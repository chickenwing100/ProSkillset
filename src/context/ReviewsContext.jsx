import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"

const ReviewsContext = createContext(null)
const STORAGE_KEY = "contractor_reviews_v1"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()
const clampRating = (value) => Math.max(1, Math.min(5, Number(value) || 0))

function normalizeReview(review) {
  return {
    id: review.id || `${review.jobId}-${normalizeEmail(review.contractorEmail)}-${normalizeEmail(review.clientEmail)}`,
    jobId: Number(review.jobId),
    contractorEmail: normalizeEmail(review.contractorEmail),
    clientEmail: normalizeEmail(review.clientEmail),
    rating: clampRating(review.rating),
    comment: String(review.comment || "").trim(),
    createdAt: review.createdAt || new Date().toISOString(),
    updatedAt: review.updatedAt || review.createdAt || new Date().toISOString()
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

  useEffect(() => {
    setReviews(readStoredReviews())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews))
  }, [isHydrated, reviews])

  const submitReview = ({ jobId, contractorEmail, clientEmail, rating, comment = "" }) => {
    const normalizedContractorEmail = normalizeEmail(contractorEmail)
    const normalizedClientEmail = normalizeEmail(clientEmail || user?.email)

    if (!normalizedContractorEmail || !normalizedClientEmail || !Number(jobId)) {
      throw new Error("Missing review details")
    }

    const normalizedRating = clampRating(rating)
    if (!normalizedRating) {
      throw new Error("A star rating is required")
    }

    const nextReview = normalizeReview({
      jobId,
      contractorEmail: normalizedContractorEmail,
      clientEmail: normalizedClientEmail,
      rating: normalizedRating,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    setReviews((previous) => {
      const existingIndex = previous.findIndex(
        (review) => review.jobId === nextReview.jobId && review.clientEmail === nextReview.clientEmail
      )

      if (existingIndex === -1) {
        return [...previous, nextReview]
      }

      const updated = [...previous]
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...nextReview,
        createdAt: updated[existingIndex].createdAt,
        updatedAt: new Date().toISOString()
      }
      return updated
    })
  }

  const getReviewForJob = (jobId, clientEmail = user?.email) => {
    const normalizedClientEmail = normalizeEmail(clientEmail)
    return reviews.find(
      (review) => review.jobId === Number(jobId) && review.clientEmail === normalizedClientEmail
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
