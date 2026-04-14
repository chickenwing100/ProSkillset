import { Link } from 'react-router-dom'
import { useSavedContractors } from '../../context/SavedContractorsContext'

export default function SavedContractors() {
  const { savedContractors, unsaveContractor } = useSavedContractors()

  const renderStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={i} className="text-yellow-400 text-sm">★</span>
      )
    }

    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400 text-sm">☆</span>
      )
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300 text-sm">☆</span>
      )
    }

    return stars
  }

  if (savedContractors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Contractors</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 text-3xl mb-3">📋</div>
          <p className="text-gray-600 mb-4">No saved contractors yet</p>
          <Link
            to="/contractors"
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Browse contractors →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Saved Contractors</h3>
        <Link
          to="/contractors"
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          View all →
        </Link>
      </div>

      <div className="space-y-4">
        {savedContractors.slice(0, 3).map((contractor) => (
          <div key={contractor.id} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
            <img
              src={contractor.photo}
              alt={contractor.name}
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {contractor.name}
                </h4>
                {contractor.verified && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    ✓
                  </span>
                )}
              </div>

              <p className="text-xs text-orange-600 font-medium">
                {contractor.trade}
              </p>

              <div className="flex items-center space-x-1 mt-1">
                <div className="flex items-center">
                  {renderStars(contractor.rating)}
                </div>
                <span className="text-xs text-gray-600">
                  {contractor.rating}
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <Link
                to={`/contractor/${contractor.id}`}
                className="text-xs bg-orange-600 text-white px-3 py-1 rounded font-medium hover:bg-orange-700 transition-colors text-center"
              >
                View
              </Link>
              <button
                onClick={() => unsaveContractor(contractor.id)}
                className="text-xs border border-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {savedContractors.length > 3 && (
          <div className="text-center pt-2">
            <Link
              to="/contractors"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              View {savedContractors.length - 3} more →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}