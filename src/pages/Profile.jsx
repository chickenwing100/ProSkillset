import { useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import UserProfile from "../components/UserProfile"
import ContractorProfilePage from "../components/ContractorProfilePage"
import ClientPasswordPanel from "../components/ClientPasswordPanel"
import { hasAcceptedTerms } from "../lib/termsAcceptance"
import { hasAcceptedContractorAgreement } from "../lib/contractorAgreementAcceptance"

const normalizeEmail = (value) => (value || "").trim().toLowerCase()

export default function Profile() {
  const { email } = useParams()
  const { user, getUserProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // If no email in params, show current user's profile.
  const profileEmail = normalizeEmail(email || user?.email)
  const currentUserEmail = normalizeEmail(user?.email)
  const storedProfile = profileEmail ? getUserProfile(profileEmail) : null
  const isOwnProfile = Boolean(profileEmail && currentUserEmail && profileEmail === currentUserEmail)
  const profileUser = storedProfile || (isOwnProfile ? user : null)
  const query = new URLSearchParams(location.search)
  const isSetupFlow = query.get("setup") === "1"
  const isConfirmed = query.get("confirmed") === "1"
  const termsAccepted = Boolean(profileUser?.termsAcceptedAt) || hasAcceptedTerms(currentUserEmail)
  const contractorAgreementAccepted = Boolean(profileUser?.contractorAgreementAcceptedAt) || hasAcceptedContractorAgreement(currentUserEmail)

  useEffect(() => {
    if (!isOwnProfile || !isSetupFlow || !isConfirmed || !currentUserEmail) return
    if (termsAccepted) return

    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    navigate(`/terms-and-conditions?setup=1&confirmed=1&returnTo=${returnTo}`, { replace: true })
  }, [currentUserEmail, isConfirmed, isOwnProfile, isSetupFlow, location.pathname, location.search, navigate, termsAccepted])

  useEffect(() => {
    if (!isOwnProfile || !isSetupFlow || !isConfirmed || !currentUserEmail) return
    if (profileUser?.role !== "contractor") return
    if (contractorAgreementAccepted) return

    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    navigate(`/contractor-agreement?setup=1&confirmed=1&returnTo=${returnTo}`, { replace: true })
  }, [
    currentUserEmail,
    isConfirmed,
    isOwnProfile,
    isSetupFlow,
    location.pathname,
    location.search,
    navigate,
    profileUser?.role,
    contractorAgreementAccepted
  ])

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h2>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
        {isOwnProfile && isSetupFlow && (
          <div className={`mb-6 rounded-lg border px-4 py-3 ${isConfirmed ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
            {isConfirmed
              ? "Email confirmed. Finish setting up your profile to get the most out of ProSkillset."
              : "Complete your profile setup to get the most out of ProSkillset."}
          </div>
        )}
        {profileUser.role === "contractor" && (
          <ContractorProfilePage user={profileUser} isOwnProfile={isOwnProfile} />
        )}
        {profileUser.role !== "contractor" && (
          <div className="space-y-6">
            <UserProfile user={profileUser} isOwnProfile={isOwnProfile} />
            {isOwnProfile && profileUser.role === "client" && <ClientPasswordPanel />}
          </div>
        )}
      </div>
    </div>
  )
}