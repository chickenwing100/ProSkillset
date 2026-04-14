import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { acceptTermsForEmail, hasAcceptedTerms } from "../lib/termsAcceptance"

export default function TermsAndConditions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [agreed, setAgreed] = useState(false)

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const setup = query.get("setup") === "1"
  const confirmed = query.get("confirmed") === "1"
  const returnTo = query.get("returnTo") || "/profile?setup=1&confirmed=1"
  const alreadyAccepted = hasAcceptedTerms(user?.email)

  const handleAgree = () => {
    if (!user?.email) {
      navigate("/login")
      return
    }

    if (!agreed && !alreadyAccepted) return

    acceptTermsForEmail(user.email)
    navigate(returnTo)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-600">Effective Date: [Insert Date]</p>
        <p className="mt-2 text-sm text-gray-600">
          Welcome to ProSkillset.
        </p>
        <p className="mt-1 text-sm text-gray-600">
          ProSkillset exists to support local, owner-operated contractors and connect them directly with homeowners and property managers - without lead fees, bidding wars, or corporate interference.
        </p>

        {(setup || confirmed) && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Your email has been verified. Accept terms to continue to profile setup.
          </div>
        )}

        <div className="mt-6 space-y-5 text-sm text-gray-700 leading-6">
          <section>
            <h2 className="text-base font-semibold text-gray-900">1. Platform Role</h2>
            <p>
              ProSkillset is a connection platform designed to strengthen local economies by enabling direct relationships between homeowners and independent contractors.
            </p>
            <p className="mt-2">
              We do not employ contractors, perform services, or control project outcomes. All work is completed by independent, owner-operated businesses.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">2. User Responsibilities</h2>
            <p>By using ProSkillset, you agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide accurate information</li>
              <li>Use the platform in good faith</li>
              <li>Not misrepresent projects or services</li>
              <li>Communicate respectfully with other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">3. Contractor Independence</h2>
            <p>Contractors on ProSkillset:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Are not employees of ProSkillset</li>
              <li>Operate as independent businesses</li>
              <li>Are solely responsible for their work, licensing, and compliance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">4. Project Claim System</h2>
            <p>ProSkillset uses a 5-claim cap system:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Each project may be claimed by up to 5 contractors</li>
              <li>Once the limit is reached, the project is closed to additional claims</li>
            </ul>
            <p className="mt-2">
              This system is designed to ensure fair access and reduce competition overload.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">5. Payments</h2>
            <p>
              ProSkillset does not process payments between users unless explicitly stated in future features.
            </p>
            <p className="mt-2">All payment agreements are made directly between homeowners and contractors.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">6. Subscription Terms (Contractors)</h2>
            <p>Contractors agree to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Maintain an active subscription</li>
              <li>Comply with team size and usage limits</li>
              <li>Provide accurate business information</li>
            </ul>
            <p className="mt-2">Failure to comply may result in suspension or removal.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">7. Limitation of Liability</h2>
            <p>
              ProSkillset does not guarantee the quality, safety, legality, or completion of any work performed through the platform.
            </p>
            <p className="mt-2">
              All agreements, payments, and project outcomes are the sole responsibility of the users involved.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">8. Termination</h2>
            <p>We reserve the right to suspend or remove accounts for misuse or violations.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900">9. Changes to Terms</h2>
            <p>
              We may update these terms at any time. Continued use of the platform constitutes acceptance of those changes.
            </p>
          </section>

          <p className="pt-2 text-sm font-medium text-gray-800">Built for the people who build our communities.</p>

          <section className="pt-5 border-t border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Privacy Agreement</h2>
            <p className="mt-1 text-sm text-gray-600">Effective Date: [Insert Date]</p>

            <p className="mt-3">ProSkillset respects your privacy.</p>

            <div className="mt-4 space-y-5">
              <section>
                <h3 className="text-base font-semibold text-gray-900">1. Information We Collect</h3>
                <p>We may collect:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Account details</li>
                  <li>Project information</li>
                  <li>Usage data</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">2. How We Use Information</h3>
                <p>We use your data to:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Operate and improve the platform</li>
                  <li>Connect users</li>
                  <li>Communicate important updates</li>
                  <li>Maintain platform security</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">3. Data Sharing</h3>
                <p>We do not sell your data.</p>
                <p className="mt-2">We may share information:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Between users to facilitate projects</li>
                  <li>With service providers (hosting, analytics, payment systems)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">4. Data Security</h3>
                <p>
                  We take reasonable measures to protect your information but cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">5. User Rights</h3>
                <p>You may:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Request access to your data</li>
                  <li>Request deletion of your account</li>
                </ul>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">6. Cookies</h3>
                <p>We may use cookies to improve functionality and user experience.</p>
              </section>

              <section>
                <h3 className="text-base font-semibold text-gray-900">7. Changes</h3>
                <p>We may update this policy as needed. Continued use of the platform constitutes acceptance.</p>
              </section>
            </div>

            <p className="pt-2 text-sm font-medium text-gray-800">
              ProSkillset is built to support local communities, not exploit user data.
            </p>
          </section>
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
            <span>
              I have read and agree to the ProSkillset Terms of Service and Privacy Agreement.
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleAgree}
              disabled={!alreadyAccepted && !agreed}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
