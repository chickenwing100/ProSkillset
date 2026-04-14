import { useJobs } from "../../context/JobsContext"
import { useTheme } from "../../context/ThemeContext"
import { useAuth } from "../../context/AuthContext"
import { formatDateTime } from "../../lib/dateTime"

export default function ClientProjectsProgress({ jobs }) {
  const { getMyJobs } = useJobs()
  const { accentStyles } = useTheme()
  const { user } = useAuth()

  const myJobs = jobs || getMyJobs()
  const userTheme = user?.role === "contractor" ? "contractor" : "client"
  const progressTextClass = userTheme === "contractor" ? "text-orange-700" : "text-blue-700"
  const progressBarClass = userTheme === "contractor" ? "bg-orange-600" : "bg-blue-600"
  const emptyMessage = userTheme === "contractor" ? "No posted projects yet" : "No active projects yet"

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className={`text-lg font-semibold mb-4 ${accentStyles[userTheme]}`}>My Posted Projects Progress</h3>

      {myJobs.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📈</div>
          <p className="text-gray-500 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myJobs.map((job) => {
            const progress = Number(job.progress || 0)
            const hasContractor = job.applications.length > 0

            return (
              <div key={job.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{job.title}</h4>
                  <span className={`text-sm font-semibold ${progressTextClass}`}>{progress}%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                  <div
                    className={`${progressBarClass} h-2.5 rounded-full transition-all duration-300`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <p className="text-xs text-gray-600">
                  {hasContractor
                    ? (job.progressNote || "Contractor has not shared an update yet.")
                    : "No contractor has claimed this project yet."
                  }
                </p>

                {job.progressUpdatedBy && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last update by {job.progressUpdatedBy} on {formatDateTime(job.progressUpdatedAt)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
