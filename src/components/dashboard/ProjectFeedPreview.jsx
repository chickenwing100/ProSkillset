import { Link } from 'react-router-dom'
import { formatDateTime } from '../../lib/dateTime'

export default function ProjectFeedPreview({ jobs }) {
  const recentJobs = jobs.slice(0, 3) // Show only first 3 jobs

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Latest Projects</h3>
        <Link
          to="/projects"
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          View All →
        </Link>
      </div>

      {recentJobs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📋</div>
          <p className="text-gray-500 text-sm">No projects available yet</p>
          <p className="text-gray-400 text-xs mt-1">Check back later for new opportunities</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentJobs.map((job) => (
            <div key={job.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">{job.title}</h4>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{job.description}</p>
                  <div className="mb-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {5 - (job.applications?.length || 0)} slots left
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {job.category}
                    </span>
                    {job.location && (
                      <span>📍 {job.location}</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-lg font-bold text-green-600">${job.budget}</div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(job.postedDate)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}