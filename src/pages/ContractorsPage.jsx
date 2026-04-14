import { useEffect, useMemo, useState } from 'react'
import ContractorCard from '../components/ContractorCard'
import { useSavedContractors } from '../context/SavedContractorsContext'
import { useJobs } from '../context/JobsContext'
import { useMessages } from '../context/MessagesContext'
import { useReviews } from '../context/ReviewsContext'
import { TRADE_CATEGORY_GROUPS, normalizeTradeCategories, getPrimaryTrade, tradeFilterOptions, toTradeValue } from '../lib/trades'

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()
const DAY_MS = 24 * 60 * 60 * 1000

const parseTimestamp = (value) => {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

const median = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

const toHourlyBucket = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return null
  const roundedHours = Math.round(ms / (60 * 60 * 1000))
  return Math.max(1, Math.min(12, roundedHours))
}

const toFriendlyResponseLabel = (hoursBucket) => {
  if (!Number.isFinite(hoursBucket)) {
    return 'Building response history'
  }

  if (hoursBucket === 1) return 'Usually replies in about 1 hour'
  if (hoursBucket <= 3) return `Usually replies in about ${hoursBucket} hours`
  if (hoursBucket <= 6) return `Typically replies within ${hoursBucket} hours`
  return `Often replies within ${hoursBucket} hours`
}

const computeResponseMetric = ({ contractorEmail, jobs, messages }) => {
  const normalizedContractorEmail = normalizeEmail(contractorEmail)
  if (!normalizedContractorEmail) {
    return { responseTime: 'Building response history', responseHoursBucket: null, responseSamples: 0 }
  }

  const normalizedJobs = Array.isArray(jobs) ? jobs : []
  const normalizedMessages = Array.isArray(messages) ? messages : []
  const jobsById = new Map()
  const relatedClientEmails = new Set()

  normalizedJobs.forEach((job) => {
    const jobId = Number(job?.id)
    const postedBy = normalizeEmail(job?.postedBy)
    const selectedContractor = normalizeEmail(job?.selectedContractor)
    const hasApplication = Array.isArray(job?.applications)
      ? job.applications.some((application) => normalizeEmail(application?.applicant) === normalizedContractorEmail)
      : false

    if (selectedContractor === normalizedContractorEmail || hasApplication) {
      if (Number.isFinite(jobId)) {
        jobsById.set(jobId, job)
      }
      if (postedBy) {
        relatedClientEmails.add(postedBy)
      }
    }
  })

  const relevantMessages = normalizedMessages
    .map((message) => ({
      ...message,
      from: normalizeEmail(message?.from),
      to: normalizeEmail(message?.to),
      timestamp: parseTimestamp(message?.createdAt),
      numericJobId: Number(message?.jobId)
    }))
    .filter((message) => message.timestamp != null)
    .filter((message) => message.from === normalizedContractorEmail || message.to === normalizedContractorEmail)
    .filter((message) => {
      const otherParty = message.from === normalizedContractorEmail ? message.to : message.from
      const linkedJob = jobsById.get(message.numericJobId)
      if (linkedJob) {
        return normalizeEmail(linkedJob.postedBy) === otherParty
      }
      return relatedClientEmails.has(otherParty)
    })
    .sort((a, b) => a.timestamp - b.timestamp)

  const pendingRequestsByThread = new Map()
  const responseSamples = []

  relevantMessages.forEach((message) => {
    const otherParty = message.from === normalizedContractorEmail ? message.to : message.from
    const threadKey = `${otherParty}:${Number.isFinite(message.numericJobId) ? message.numericJobId : 'direct'}`

    if (message.to === normalizedContractorEmail && message.from !== normalizedContractorEmail) {
      if (!pendingRequestsByThread.has(threadKey)) {
        pendingRequestsByThread.set(threadKey, {
          requestedAt: message.timestamp,
          jobId: Number.isFinite(message.numericJobId) ? message.numericJobId : null
        })
      }
      return
    }

    if (message.from === normalizedContractorEmail && message.to !== normalizedContractorEmail) {
      const pending = pendingRequestsByThread.get(threadKey)
      if (!pending) return

      const delta = message.timestamp - pending.requestedAt
      if (delta > 0) {
        responseSamples.push({
          delta,
          requestedAt: pending.requestedAt,
          jobId: pending.jobId
        })
      }
      pendingRequestsByThread.delete(threadKey)
    }
  })

  if (responseSamples.length === 0) {
    return { responseTime: 'Building response history', responseHoursBucket: null, responseSamples: 0 }
  }

  const now = Date.now()
  const recentThirtyDays = responseSamples.filter((sample) => now - sample.requestedAt <= 30 * DAY_MS)
  const sortedNewestFirst = [...responseSamples].sort((a, b) => b.requestedAt - a.requestedAt)
  const selectedWindow = recentThirtyDays.length >= 5 ? recentThirtyDays : sortedNewestFirst.slice(0, 10)

  const responseMedian = median(selectedWindow.map((sample) => sample.delta))
  const hoursBucket = toHourlyBucket(responseMedian)

  return {
    responseTime: toFriendlyResponseLabel(hoursBucket),
    responseHoursBucket: hoursBucket,
    responseSamples: selectedWindow.length
  }
}

export default function ContractorsPage() {
  const { savedContractors, isContractorSaved } = useSavedContractors()
  const { jobs } = useJobs()
  const { messages } = useMessages()
  const { reviews } = useReviews()
  const [contractors, setContractors] = useState([])
  const [showSaved, setShowSaved] = useState(false)
  const [sortBy, setSortBy] = useState('rating')
  const [locationSearch, setLocationSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('all')
  const tradeValueToLabel = useMemo(() => new Map(
    tradeFilterOptions.map((option) => [option.value, option.category || ''])
  ), [])

  const readContractorsFromStorage = () => {
    try {
      const usersMap = JSON.parse(localStorage.getItem('users') || '{}')
      if (!usersMap || typeof usersMap !== 'object') return []

      return Object.values(usersMap)
        .filter((profile) => profile && typeof profile === 'object')
        .filter((profile) => normalizeEmail(profile.role) === 'contractor')
        .filter((profile) => !normalizeEmail(profile.email).endsWith('@example.com'))
        .map((profile) => {
          const email = normalizeEmail(profile.email)
          const metric = computeResponseMetric({ contractorEmail: email, jobs, messages })
          const contractorReviews = reviews.filter((review) => normalizeEmail(review?.contractorEmail) === email)
          const totalRating = contractorReviews.reduce((sum, review) => sum + Number(review?.rating || 0), 0)
          const reviewCount = contractorReviews.length
          const rating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 5
          const completedProjects = jobs.filter((job) =>
            normalizeEmail(job?.selectedContractor) === email &&
            (job?.status === 'completed' || job?.completionConfirmed)
          ).length

          const normalizedTradeCategories = normalizeTradeCategories(
            profile.tradeCategories ||
            profile.tradeCategory ||
            profile.trade ||
            profile.specialty ||
            profile.skills ||
            []
          )

          return {
            id: email,
            email,
            name: profile.name || profile.full_name || email,
            trade: getPrimaryTrade(normalizedTradeCategories),
            tradeCategories: normalizedTradeCategories,
            location: profile.location || profile.serviceArea || 'Location not set',
            description: profile.bio || profile.description || 'No profile description yet.',
            photo: profile.profilePhoto || profile.profilePhotoUrl || profile.avatar_url || '/api/placeholder/150/150',
            verified: Boolean(profile.insuranceVerified),
            responseTime: metric.responseTime,
            responseHoursBucket: metric.responseHoursBucket,
            responseSamples: metric.responseSamples,
            completedProjects,
            rating,
            reviewCount,
            saved: isContractorSaved(email)
          }
        })
    } catch {
      return []
    }
  }

  useEffect(() => {
    const hydrate = () => {
      setContractors(readContractorsFromStorage())
    }

    hydrate()
    window.addEventListener('storage', hydrate)
    return () => window.removeEventListener('storage', hydrate)
  }, [isContractorSaved, jobs, messages, reviews, savedContractors])

  const contractorsToShow = useMemo(() => {
    const contractorMapByEmail = new Map(
      contractors.map((contractor) => [normalizeEmail(contractor.email), contractor])
    )
    const source = showSaved
      ? savedContractors.map((saved) => contractorMapByEmail.get(normalizeEmail(saved.email)) || saved)
      : contractors

    return [...source]
      .filter((contractor) => {
        const selectedTradeLabel = tradeValueToLabel.get(tradeFilter)
        const normalizedContractorTrades = normalizeTradeCategories(
          contractor.tradeCategories || contractor.trade || contractor.specialty || []
        )

        const tradeMatches =
          tradeFilter === 'all' ||
          normalizedContractorTrades.includes(selectedTradeLabel)

        const locationMatches =
          !locationSearch ||
          String(contractor.location || '').toLowerCase().includes(locationSearch.toLowerCase())

        return tradeMatches && locationMatches
      })
      .sort((a, b) => {
        if (sortBy === 'reviews') {
          return Number(b.reviewCount || 0) - Number(a.reviewCount || 0)
        }

        if (sortBy === 'response') {
          const aBucket = Number(a.responseHoursBucket || 99)
          const bBucket = Number(b.responseHoursBucket || 99)
          return aBucket - bBucket
        }

        return Number(b.rating || 0) - Number(a.rating || 0)
      })
  }, [contractors, locationSearch, savedContractors, showSaved, sortBy, tradeFilter, tradeValueToLabel])

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {showSaved ? 'Saved Contractors' : 'Find Trusted Contractors'}
          </h1>
          <p className="text-base sm:text-lg text-gray-600">
            {showSaved
              ? 'Your saved contractors for future reference'
              : 'Connect with verified professionals in your area'
            }
          </p>
        </div>

        {/* Toggle between Browse and Saved */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-full max-w-md sm:max-w-none sm:w-auto">
            <button
              onClick={() => setShowSaved(false)}
              className={`w-full sm:w-auto px-4 sm:px-6 py-2 rounded-md font-medium transition-colors ${
                !showSaved
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Browse Contractors
            </button>
            <button
              onClick={() => setShowSaved(true)}
              className={`mt-1 sm:mt-0 w-full sm:w-auto px-4 sm:px-6 py-2 rounded-md font-medium transition-colors ${
                showSaved
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Saved Contractors ({savedContractors.length})
            </button>
          </div>
        </div>

        {/* Filter/Sort Options - only show when browsing */}
        {!showSaved && (
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <select
              value={tradeFilter}
              onChange={(event) => setTradeFilter(event.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Trades</option>
              {TRADE_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((trade) => (
                    <option key={trade} value={toTradeValue(trade)}>{trade}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="rating">Sort by Rating</option>
              <option value="reviews">Sort by Reviews</option>
              <option value="response">Sort by Fastest Response</option>
            </select>

            <input
              type="text"
              placeholder="Search location..."
              value={locationSearch}
              onChange={(event) => setLocationSearch(event.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={() => setContractors(readContractorsFromStorage())}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Contractor Grid */}
        {contractorsToShow.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contractorsToShow.map((contractor) => (
              <ContractorCard key={contractor.id} contractor={contractor} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              {showSaved ? 'No saved contractors yet' : 'No contractors found'}
            </h3>
            <p className="text-gray-600">
              {showSaved
                ? 'Start browsing contractors and save the ones you like for future reference.'
                : 'No signed-up contractor profiles are available yet.'
              }
            </p>
            {showSaved && (
              <button
                onClick={() => setShowSaved(false)}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Browse Contractors
              </button>
            )}
          </div>
        )}

        {/* Load More - only show when browsing and not all shown */}
        {!showSaved && contractorsToShow.length > 0 && (
          <div className="text-center mt-12">
            <button
              onClick={() => setContractors(readContractorsFromStorage())}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Refresh Contractor List
            </button>
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