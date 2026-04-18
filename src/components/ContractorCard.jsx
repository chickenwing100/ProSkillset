import { Link } from 'react-router-dom'
import { useSavedContractors } from '../context/SavedContractorsContext'

export default function ContractorCard({ contractor }) {
  const { saveContractor, unsaveContractor, isContractorSaved } = useSavedContractors()

  // Fallback values are only used when profile data is missing.
  const defaultContractor = {
    id: contractor?.id || contractor?.email || "",
    name: contractor?.name || 'Sarah Johnson',
    trade: contractor?.trade || 'Plumbing',
    rating: Number(contractor?.rating || 5),
    reviewCount: Number(contractor?.reviewCount || 0),
    location: contractor?.location || 'Portland, OR',
    photo: contractor?.photo || '/api/placeholder/150/150',
    description: contractor?.description || 'Licensed plumber with 8+ years experience. Specializing in residential repairs and installations.',
    verified: contractor?.verified || true,
    responseTime: contractor?.responseTime || 'Building response history',
    completedProjects: Number(contractor?.completedProjects || 0)
  }

  const contractorData = { ...defaultContractor, ...contractor }
  const visibleTradeRoles = Array.isArray(contractorData.tradeCategories)
    ? contractorData.tradeCategories.slice(0, 2)
    : []
  const additionalTradeCount = Array.isArray(contractorData.tradeCategories)
    ? Math.max(0, contractorData.tradeCategories.length - visibleTradeRoles.length)
    : 0
  const profileTarget = contractorData?.email
    ? `/profile/${encodeURIComponent(contractorData.email)}`
    : `/profile`

  const handleSaveToggle = () => {
    if (isContractorSaved(contractorData.id)) {
      unsaveContractor(contractorData.id)
    } else {
      saveContractor(contractorData)
    }
  }

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400">★</span>
      )
    }

    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">☆</span>
      )
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">☆</span>
      )
    }

    return stars
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        {/* Header with photo and basic info */}
        <div className="flex items-start space-x-4 mb-4">
          <div className="relative">
            <img
              src={contractorData.photo}
              alt={contractorData.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
            />
            {contractorData.verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {contractorData.name}
              </h3>
              {contractorData.verified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Verified
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-blue-600 mb-1">
              {visibleTradeRoles.length > 0
                ? `${visibleTradeRoles.join(', ')}${additionalTradeCount > 0 ? ` +${additionalTradeCount}` : ''}`
                : contractorData.trade}
            </p>

            <div className="flex items-center space-x-1 mb-2">
              <div className="flex items-center">
                {renderStars(contractorData.rating)}
              </div>
              <span className="text-sm text-gray-600 ml-1">
                {contractorData.rating} ({contractorData.reviewCount} reviews)
              </span>
            </div>

            <div className="flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {contractorData.location}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {contractorData.description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {contractorData.completedProjects}
            </div>
            <div className="text-xs text-gray-500">
              Projects Completed
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900 leading-tight">
              {contractorData.responseTime}
            </div>
            <div className="text-xs text-gray-500">
              Response Time
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex space-x-3">
          <Link
            to={profileTarget}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center"
          >
            View Profile
          </Link>
          <button
            onClick={handleSaveToggle}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isContractorSaved(contractorData.id)
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isContractorSaved(contractorData.id) ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}