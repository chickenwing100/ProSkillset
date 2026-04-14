export const SUBSCRIPTION_PLANS = [
  {
    id: "solo",
    name: "Solo",
    priceMonthly: 49.99,
    userLimit: 1,
    description: "Best for independent contractors"
  },
  {
    id: "crew",
    name: "Crew",
    priceMonthly: 79.99,
    userLimit: 2,
    description: "Ideal for small teams"
  },
  {
    id: "builder",
    name: "Builder",
    priceMonthly: 119.99,
    userLimit: 4,
    description: "Designed for growing contractor businesses"
  }
]

export const PLAN_MAP = SUBSCRIPTION_PLANS.reduce((accumulator, plan) => {
  accumulator[plan.id] = plan
  return accumulator
}, {})

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])

export const STRIPE_PAYMENT_LINKS = {
  solo: import.meta.env.VITE_STRIPE_SOLO_PAYMENT_LINK || "",
  crew: import.meta.env.VITE_STRIPE_CREW_PAYMENT_LINK || "",
  builder: import.meta.env.VITE_STRIPE_BUILDER_PAYMENT_LINK || ""
}

export const formatPlanPrice = (value) => `$${Number(value).toFixed(2)}/month`

export const getDefaultSubscription = () => ({
  planId: null,
  status: "inactive",
  startedAt: null,
  currentPeriodEnd: null,
  updatedAt: null
})
