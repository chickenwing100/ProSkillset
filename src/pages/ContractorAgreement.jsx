import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  acceptContractorAgreementForEmail,
  hasAcceptedContractorAgreement
} from "../lib/contractorAgreementAcceptance"

export default function ContractorAgreement() {
  const { user, updateProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [agreed, setAgreed] = useState(false)

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const setup = query.get("setup") === "1"
  const confirmed = query.get("confirmed") === "1"
  const returnTo = query.get("returnTo") || "/profile?setup=1&confirmed=1"
  const alreadyAccepted = Boolean(user?.contractorAgreementAcceptedAt) || hasAcceptedContractorAgreement(user?.email)

  const handleAgree = async () => {
    if (!user?.email) {
      navigate("/login")
      return
    }

    if (!agreed && !alreadyAccepted) return

    acceptContractorAgreementForEmail(user.email)
    await Promise.resolve(updateProfile({
      contractorAgreementAcceptedAt: new Date().toISOString(),
      contractorAgreementVersion: 1
    }))
    navigate(returnTo)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Contractor Agreement</h1>
        <p className="mt-2 text-sm text-gray-600">Effective Date: [Insert Date]</p>

        {(setup || confirmed) && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            One more step: accept the contractor agreement to continue to profile setup.
          </div>
        )}

        <div className="mt-6 space-y-5 text-sm leading-6 text-gray-700">
          <p>By registering as a contractor on ProSkillset, you agree to the following:</p>

          <section>
            <h2 className="text-base font-semibold text-gray-900">1. Independent Business</h2>
            <p>
              You confirm that you are an independent contractor or business and not an employee or agent of ProSkillset.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">2. Owner-Operated Requirement</h2>
            <p>You agree that:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your business is owner-operated</li>
              <li>You fall within your selected tier (maximum 15 employees)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">3. Accuracy of Information</h2>
            <p>You agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide truthful business details</li>
              <li>Not misrepresent licensing, insurance, or experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">4. Compliance</h2>
            <p>You are responsible for:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Meeting all local and state requirements</li>
              <li>Maintaining any required licenses</li>
              <li>Carrying appropriate insurance where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">5. Platform Conduct</h2>
            <p>You agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Communicate professionally</li>
              <li>Not mislead or harass users</li>
              <li>Not manipulate the claim system</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">6. Subscription Compliance</h2>
            <p>You agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Maintain an active subscription</li>
              <li>Stay within allowed user and session limits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">7. Work Responsibility</h2>
            <p>You are solely responsible for:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>The quality of your work</li>
              <li>Agreements with homeowners</li>
              <li>Resolving disputes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">8. Account Actions</h2>
            <p>ProSkillset may suspend or remove accounts for violations.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">9. Acknowledgment</h2>
            <p>You acknowledge that ProSkillset is a connection platform, not a service provider.</p>
          </section>

          <p className="pt-2 text-sm font-medium text-gray-800">
            By joining ProSkillset, you are participating in a local network built to support independent contractors and strengthen community economies.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <label className="flex items-start gap-3 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={alreadyAccepted || agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
              disabled={alreadyAccepted}
            />
            <span>I have read and agree to the ProSkillset Contractor Agreement.</span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAgree}
              disabled={!alreadyAccepted && !agreed}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Agree and Continue to Profile Setup
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
