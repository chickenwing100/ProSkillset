import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useJobs } from "../context/JobsContext"

export default function MyProjects() {
  const { user, getUserProfile } = useAuth()
  const { getMyJobs, getClaimedJobs } = useJobs()

  const getDisplayName = (email, fallbackLabel = "User") => {
    const profile = getUserProfile(email) || {}
    const candidate = String(profile.name || profile.full_name || profile.contractorName || profile.businessName || "").trim()
    return candidate || fallbackLabel
  }

  const roleTheme = user?.role === "contractor"
    ? {
        accent: "text-orange-700",
        button: "bg-orange-600 hover:bg-orange-700",
        badge: "bg-orange-100 text-orange-700"
      }
    : {
        accent: "text-blue-700",
        button: "bg-blue-600 hover:bg-blue-700",
        badge: "bg-blue-100 text-blue-700"
      }

  const projects = (user?.role === "contractor"
    ? getClaimedJobs()
    : getMyJobs().filter((job) => job.selectedContractor || job.completionRequested || job.completionConfirmed)
  ).sort((a, b) => Number(a.progress || 0) - Number(b.progress || 0))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
        <p className="text-gray-600 mt-2">
          {user?.role === "contractor"
            ? "Track your active, pending, and completed work."
            : "Review active jobs, contractor progress, and completed projects."
          }
        </p>
      </div>

      {user?.role === "contractor" && (
        <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
          <div className="flex gap-3">
            <div className="text-orange-600 text-lg">💡</div>
            <div>
              <p className="text-sm font-medium text-orange-900">Foster Client Trust Through Transparency</p>
              <p className="text-sm text-orange-800 mt-1">
                Please be as transparent as possible when updating project details. Transparency will build trust, help keep clients on the platform, and may influence new clients to join.
              </p>
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-5xl mb-3">📁</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h2>
          <p className="text-gray-500">
            {user?.role === "contractor"
              ? "Accepted projects will appear here once a client chooses your bid."
              : "Projects with an accepted contractor will appear here."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3 gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{project.title}</h2>
                  {project.poNumber && (
                    <p className="text-xs font-medium text-gray-500 mt-1">PO#: {project.poNumber}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {user?.role === "contractor"
                      ? `Client: ${getDisplayName(project.postedBy, "Client")}`
                      : `Contractor: ${project.selectedContractorName || "Pending selection"}`
                    }
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${roleTheme.badge}`}>
                  {project.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <p className="text-sm text-gray-600">Budget: ${project.budget}</p>
                {project.acceptedBid > 0 && (
                  <p className="text-sm text-gray-600">Accepted Bid: ${project.acceptedBid}</p>
                )}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Number(project.progress || 0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${user?.role === "contractor" ? "bg-orange-500" : "bg-blue-600"}`}
                      style={{ width: `${Number(project.progress || 0)}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {project.progressNote || "No progress notes yet."}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Link
                  to={`/projects/${project.id}`}
                  className={`text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${roleTheme.button}`}
                >
                  Open Project
                </Link>
                <Link
                  to="/messages"
                  className={`text-sm font-medium ${roleTheme.accent}`}
                >
                  Messages →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-gray-200 pt-4">
        <p className="text-center text-xs text-gray-500">
          ProSkillset connects clients with independent contractors. We do not perform or guarantee services.
        </p>
      </div>
    </div>
  )
}
