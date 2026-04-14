import { useNavigate } from "react-router-dom"
import { useSubscription } from "../../context/SubscriptionContext"
import { formatDateTime } from "../../lib/dateTime"
import { formatPlanPrice } from "../../lib/subscriptionPlans"

const isStripeEnabled = import.meta.env.VITE_STRIPE_ENABLED === "true"

export default function SubscriptionStatus() {
  const navigate = useNavigate()
  const { currentPlan, currentSubscription, isActive } = useSubscription()

  const subscription = {
    plan: currentPlan?.name || "No Active Plan",
    status: isActive ? "Active" : "Inactive",
    nextBilling: currentSubscription.currentPeriodEnd,
    features: currentPlan
      ? [`${currentPlan.userLimit} user${currentPlan.userLimit > 1 ? "s" : ""}`, formatPlanPrice(currentPlan.priceMonthly)]
      : ["Browse project feed for free", "Claim projects after subscribing"]
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trial':
        return 'bg-blue-100 text-blue-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
        <button onClick={() => navigate("/account-settings")} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Manage →
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{subscription.plan}</p>
            <p className="text-sm text-gray-600">Current plan</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
            {subscription.status}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {subscription.nextBilling && (
            <p className="text-sm text-gray-600 mb-3">
              Next billing: {formatDateTime(subscription.nextBilling)}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Plan includes:</p>
            <ul className="space-y-1">
              {subscription.features.map((feature, index) => (
                <li key={index} className="flex items-center text-sm text-gray-600">
                  <span className="text-green-500 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {isStripeEnabled ? (
            <button
              onClick={() => navigate("/account-settings")}
              className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            >
              {isActive ? "Manage Plan" : "Choose Plan"}
            </button>
          ) : (
            <p className="text-center text-xs text-gray-400">Subscription billing coming soon</p>
          )}
        </div>
      </div>
    </div>
  )
}