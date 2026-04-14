import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_MAP,
  getDefaultSubscription
} from "../lib/subscriptionPlans"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { createSubscriptionCheckout } from "../services/stripeBillingService"

const SubscriptionContext = createContext(null)

const normalizeEmail = (value) => (value || "").trim().toLowerCase()

const STORAGE_KEY = "contractor_subscriptions_v1"

function readSubscriptionMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
  } catch {
    return {}
  }
}

function writeSubscriptionMap(nextMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMap))
}

function computePeriodEnd(startDateIso) {
  const startDate = new Date(startDateIso)
  const nextBilling = new Date(startDate)
  nextBilling.setMonth(nextBilling.getMonth() + 1)
  return nextBilling.toISOString()
}

function normalizeSubscriptionRecord(record = {}) {
  return {
    ...getDefaultSubscription(),
    planId: record.planId || record.plan_id || null,
    status: String(record.status || "inactive").toLowerCase(),
    startedAt: record.startedAt || record.created_at || null,
    currentPeriodEnd: record.currentPeriodEnd || record.current_period_end || null,
    updatedAt: record.updatedAt || record.updated_at || null,
    stripeCustomerId: record.stripeCustomerId || record.stripe_customer_id || null,
    stripeSubscriptionId: record.stripeSubscriptionId || record.stripe_subscription_id || null,
    cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd || record.cancel_at_period_end)
  }
}

export function SubscriptionProvider({ children }) {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState(() => readSubscriptionMap())

  const currentEmail = normalizeEmail(user?.email)

  const currentSubscription = useMemo(() => {
    if (!currentEmail) return getDefaultSubscription()
    return {
      ...getDefaultSubscription(),
      ...(subscriptions[currentEmail] || {})
    }
  }, [currentEmail, subscriptions])

  const currentPlan = currentSubscription.planId ? PLAN_MAP[currentSubscription.planId] : null
  const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(currentSubscription.status)

  const persistForEmail = (email, value) => {
    const normalized = normalizeEmail(email)
    if (!normalized) return

    setSubscriptions((previous) => {
      const next = {
        ...previous,
        [normalized]: value
      }
      writeSubscriptionMap(next)
      return next
    })
  }

  const refreshSubscription = async (email = currentEmail) => {
    const normalized = normalizeEmail(email)
    if (!normalized) return getDefaultSubscription()

    if (!isSupabaseConfigured) {
      return normalizeSubscriptionRecord(subscriptions[normalized] || getDefaultSubscription())
    }

    const { data, error } = await supabase
      .from("contractor_subscriptions")
      .select("*")
      .eq("contractor_email", normalized)
      .maybeSingle()

    if (error) {
      throw new Error(error.message || "Unable to load subscription status")
    }

    const nextValue = normalizeSubscriptionRecord(data || getDefaultSubscription())
    persistForEmail(normalized, nextValue)
    return nextValue
  }

  useEffect(() => {
    if (!currentEmail) return

    if (!isSupabaseConfigured) {
      persistForEmail(currentEmail, normalizeSubscriptionRecord(subscriptions[currentEmail] || getDefaultSubscription()))
      return
    }

    refreshSubscription(currentEmail).catch(() => {
      persistForEmail(currentEmail, normalizeSubscriptionRecord(getDefaultSubscription()))
    })
  }, [currentEmail])

  const activatePlan = (planId) => {
    if (isSupabaseConfigured) {
      throw new Error("Local subscription activation is disabled when Stripe billing is enabled")
    }

    if (!currentEmail || !PLAN_MAP[planId]) {
      throw new Error("Invalid subscription plan")
    }

    const now = new Date().toISOString()
    persistForEmail(currentEmail, {
      planId,
      status: "active",
      startedAt: now,
      currentPeriodEnd: computePeriodEnd(now),
      updatedAt: now
    })

    return { success: true }
  }

  const cancelSubscription = () => {
    if (isSupabaseConfigured) {
      throw new Error("Subscription cancellation is managed by Stripe billing events")
    }

    if (!currentEmail) return

    const now = new Date().toISOString()
    persistForEmail(currentEmail, {
      ...getDefaultSubscription(),
      status: "inactive",
      updatedAt: now
    })
  }

  const startStripeCheckout = async (planId) => {
    if (!PLAN_MAP[planId]) {
      throw new Error("Invalid subscription plan")
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        reason: "missing_billing_backend"
      }
    }

    const checkout = await createSubscriptionCheckout(planId)
    if (!checkout?.url) {
      throw new Error("Stripe checkout did not return a URL")
    }

    window.location.assign(checkout.url)
    return {
      success: true,
      reason: "redirected_to_checkout"
    }
  }

  const hasActiveSubscription = (email) => {
    const normalized = normalizeEmail(email || currentEmail)
    if (!normalized) return false
    const candidate = subscriptions[normalized]
    return ACTIVE_SUBSCRIPTION_STATUSES.has(candidate?.status)
  }

  const value = {
    currentPlan,
    currentSubscription,
    isActive,
    hasActiveSubscription,
    activatePlan,
    cancelSubscription,
    startStripeCheckout,
    refreshSubscription
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider")
  }
  return context
}
