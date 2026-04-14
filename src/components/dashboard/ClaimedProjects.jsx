import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useJobs } from '../../context/JobsContext'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../lib/dateTime'

export default function ClaimedProjects({ jobs }) {
  const { updateJobProgress } = useJobs()
  const { getUserProfile } = useAuth()
  const [updates, setUpdates] = useState({})

  const getDisplayName = (email, fallbackLabel = 'Client') => {
    const profile = getUserProfile(email) || {}
    const candidate = String(profile.name || profile.full_name || profile.contractorName || profile.businessName || '').trim()
    return candidate || fallbackLabel
  }

  const claimedProjects = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    client: getDisplayName(job.postedBy),
    status: Number(job.progress || 0) >= 100 ? 'Completed' : Number(job.progress || 0) > 0 ? 'In Progress' : 'Not Started',
    deadline: job.postedDate,
    progress: Number(job.progress || 0),
    progressNote: job.progressNote || ''
  }))

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'in progress':
        return 'bg-blue-100 text-blue-800'
      case 'review':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">My Projects</h3>
        <Link
          to="/my-projects"
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          View All →
        </Link>
      </div>

      <div className="mb-4 bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
        <div className="flex gap-2">
          <div className="text-orange-600 text-base">💡</div>
          <p className="text-xs text-orange-800">
            <span className="font-medium">Transparency builds trust:</span> Keep clients informed with clear updates on project details.
          </p>
        </div>
      </div>

      {claimedProjects.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">🎯</div>
          <p className="text-gray-500 text-sm">No claimed projects yet</p>
          <p className="text-gray-400 text-xs mt-1">Apply to projects to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claimedProjects.map((project) => (
            <div key={project.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">{project.title}</h4>
                  <p className="text-sm text-gray-600">{project.client}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Progress %"
                  value={updates[project.id]?.progress ?? ''}
                  onChange={(event) => setUpdates((prev) => ({
                    ...prev,
                    [project.id]: {
                      ...prev[project.id],
                      progress: event.target.value
                    }
                  }))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="Progress note"
                  value={updates[project.id]?.note ?? ''}
                  onChange={(event) => setUpdates((prev) => ({
                    ...prev,
                    [project.id]: {
                      ...prev[project.id],
                      note: event.target.value
                    }
                  }))}
                  className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <button
                onClick={() => {
                  updateJobProgress(
                    project.id,
                    updates[project.id]?.progress ?? project.progress,
                    updates[project.id]?.note ?? project.progressNote
                  )
                }}
                className="mb-3 bg-orange-600 text-white px-3 py-2 rounded-md text-sm hover:bg-orange-700 transition-colors"
              >
                Update Client Progress
              </button>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  Started: {formatDateTime(project.deadline)}
                </span>
                <Link
                  to={`/projects/${project.id}`}
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}