import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { formatDateTime } from "../lib/dateTime"

export default function AdminInsuranceReview() {
  const { user, isAdminUser, getAllProfiles, updateUserProfileByEmail } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeDocument, setActiveDocument] = useState(null)

  const pendingProfiles = useMemo(() => {
    const profiles = getAllProfiles() || []
    return profiles
      .filter((profile) => profile.role === "contractor")
      .filter((profile) => (profile.insuranceDocuments || []).length > 0)
      .sort((a, b) => {
        const aStatus = a.insuranceReviewStatus || "not_submitted"
        const bStatus = b.insuranceReviewStatus || "not_submitted"
        if (aStatus === bStatus) return (a.name || "").localeCompare(b.name || "")
        if (aStatus === "pending_review") return -1
        if (bStatus === "pending_review") return 1
        return aStatus.localeCompare(bStatus)
      })
  }, [getAllProfiles, refreshKey])

  if (!isAdminUser()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">Only admin accounts can review insurance submissions.</p>
        </div>
      </div>
    )
  }

  const updateStatus = (email, status) => {
    try {
      updateUserProfileByEmail(email, {
        insuranceReviewStatus: status,
        insuranceVerifiedByAdmin: status === "approved",
        insuranceReviewedAt: new Date().toISOString(),
        insuranceReviewedBy: user?.email || "admin"
      })
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      alert(error.message || "Failed to update insurance review status")
    }
  }

  const canPreviewDocument = (doc) => {
    if (!doc?.url) return false
    if (doc.type?.startsWith("image/")) return true
    if (doc.type === "application/pdf") return true
    if (doc.url.startsWith("data:image/")) return true
    if (doc.url.startsWith("data:application/pdf")) return true
    return false
  }

  const openDocument = (doc) => {
    if (!doc?.url) return
    setActiveDocument(doc)
  }

  const closeDocument = () => {
    setActiveDocument(null)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Insurance Review Queue</h1>
        <p className="text-sm text-gray-600 mt-1">Review contractor-submitted legal insurance documents.</p>
      </div>

      {pendingProfiles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-600">No contractor insurance submissions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingProfiles.map((profile) => {
            const status = profile.insuranceReviewStatus || "not_submitted"
            const docs = profile.insuranceDocuments || []

            return (
              <div key={profile.email} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{profile.name || profile.contractorName || profile.email}</h2>
                    <p className="text-sm text-gray-600">{profile.email}</p>
                    <p className="text-xs text-gray-500 mt-1">Status: {status.replace("_", " ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateStatus(profile.email, "pending_review")}
                      className="px-3 py-1.5 rounded bg-gray-200 text-gray-800 text-sm hover:bg-gray-300"
                    >
                      Mark Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(profile.email, "approved")}
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(profile.email, "rejected")}
                      className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                    >
                      Reject
                    </button>
                    <Link
                      to={`/profile/${profile.email}`}
                      className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                      Open Profile
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docs.map((doc) => (
                    <div key={doc.id} className="border border-gray-200 rounded p-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(doc.uploadedAt)}</p>
                      {doc.url ? (
                        <button
                          type="button"
                          onClick={() => openDocument(doc)}
                          className="inline-block mt-2 text-sm text-blue-700 hover:text-blue-900"
                        >
                          View Document
                        </button>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2">No preview URL available</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeDocument && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closeDocument}
        >
          <div className="w-full max-w-5xl bg-white rounded-lg overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900 truncate">{activeDocument.name}</p>
                <p className="text-xs text-gray-500">{activeDocument.type || "Unknown type"}</p>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                onClick={closeDocument}
              >
                Close
              </button>
            </div>

            <div className="p-4 bg-gray-50 max-h-[78vh] overflow-auto">
              {canPreviewDocument(activeDocument) ? (
                activeDocument.type?.startsWith("image/") || activeDocument.url.startsWith("data:image/") ? (
                  <img
                    src={activeDocument.url}
                    alt={activeDocument.name || "Insurance document"}
                    className="w-full max-h-[70vh] object-contain bg-white rounded border border-gray-200"
                  />
                ) : (
                  <iframe
                    title={activeDocument.name || "Insurance document"}
                    src={activeDocument.url}
                    className="w-full h-[70vh] rounded border border-gray-200 bg-white"
                  />
                )
              ) : (
                <div className="bg-white border border-gray-200 rounded p-4">
                  <p className="text-sm text-gray-700 mb-3">Preview is not supported for this file type in-browser.</p>
                  <a
                    href={activeDocument.url}
                    download={activeDocument.name || "insurance-document"}
                    className="inline-block px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >
                    Download Document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
