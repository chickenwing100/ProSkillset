import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useJobs } from "../context/JobsContext"

export default function PostedProjectsPage() {
  const { user, getUserProfile } = useAuth()
  const { getMyJobs } = useJobs()

  const getDisplayName = (email, fallbackLabel = "User") => {
    const profile = getUserProfile(email) || {}
    const candidate = String(profile.name || profile.full_name || profile.contractorName || profile.businessName || "").trim()
    return candidate || fallbackLabel
  }

  const projects = getMyJobs().sort(
    (a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0)
  )

  const statusBadge = (status) => {
    const map = {
      open: "bg-green-100 text-green-700",
      in_progress: "bg-orange-100 text-orange-700",
      completed: "bg-gray-100 text-gray-700",
      cancelled: "bg-red-100 text-red-700",
    }
    return map[status] || "bg-gray-100 text-gray-600"
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Posted Projects</h1>
          <p className="text-gray-600 mt-2">Manage and track all projects you've posted.</p>
        </div>
        <Link
          to="/post-job"
          className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-center"
        >
          + Post New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
          <div className="text-gray-400 text-5xl mb-3">📤</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No posted projects yet</h2>
          <p className="text-gray-500 mb-6">Post a project to find contractors and start getting bids.</p>
          <Link
            to="/post-job"
            className="inline-block px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
          >
            Post Your First Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 sm:p-6">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{project.title}</h2>
                  {project.poNumber && (
                    <p className="text-xs font-medium text-gray-500 mt-0.5">PO#: {project.poNumber}</p>
                  )}
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(project.status)}`}>
                  {(project.status || "open").replaceAll("_", " ")}
                </span>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{project.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                  <span>Budget</span>
                  <span className="font-medium text-green-600">${project.budget}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                  <span>Applicants</span>
                  <span className="font-medium">
                    {(project.applications || []).length}
                    {project.selectedContractor ? " · Contractor selected" : ""}
                  </span>
                </div>

                {project.selectedContractor && (
                  <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                    <span>Contractor</span>
                    <span className="font-medium text-orange-700">
                      {getDisplayName(project.selectedContractor, project.selectedContractorName || "Selected")}
                    </span>
                  </div>
                )}

                {project.location && (
                  <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                    <span>Location</span>
                    <span>📍 {project.location}</span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Number(project.progress || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-orange-500 transition-all"
                      style={{ width: `${Number(project.progress || 0)}%` }}
                    />
                  </div>
                </div>

                {project.progressNote && (
                  <p className="text-xs text-gray-500 italic">{project.progressNote}</p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  to={`/projects/${project.id}`}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors text-center"
                >
                  Manage Project
                </Link>
                <Link
                  to="/messages"
                  className="text-sm font-medium text-orange-700 hover:text-orange-900"
                >
                  Messages →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
