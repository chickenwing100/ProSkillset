import { isSupabaseConfigured, supabase } from "../lib/supabase"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY

function buildReturnUrl(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

async function invokeBillingFunction(name, body) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured")
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or API key is missing")
  }

  const {
    data: { session: initialSession }
  } = await supabase.auth.getSession()

  let session = initialSession

  if (!session?.access_token) {
    throw new Error("You are not signed in with Supabase. Please log out and sign in again before using billing.")
  }

  const ensureValidAccessToken = async () => {
    const currentToken = session?.access_token || ""
    if (!currentToken) return null

    const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser(currentToken)
    if (!currentUserError && currentUserData?.user) {
      return currentToken
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshData?.session?.access_token) {
      await supabase.auth.signOut()
      return null
    }

    session = refreshData.session

    const { data: refreshedUserData, error: refreshedUserError } = await supabase.auth.getUser(session.access_token)
    if (refreshedUserError || !refreshedUserData?.user) {
      await supabase.auth.signOut()
      return null
    }

    return session.access_token
  }

  const validatedAccessToken = await ensureValidAccessToken()
  if (!validatedAccessToken) {
    throw new Error("Your session expired or became invalid. Please sign in again.")
  }

  const invokeWithToken = async (accessToken) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })

    const jsonBody = await response.clone().json().catch(() => null)
    const textBody = await response.clone().text().catch(() => "")

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: jsonBody?.error || textBody || `Failed to invoke ${name}`,
          context: jsonBody || textBody || null
        }
      }
    }

    return {
      data: jsonBody,
      error: null
    }
  }

  let { data, error } = await invokeWithToken(validatedAccessToken)

  const shouldRetryWithRefresh =
    error &&
    String(error.message || "").toLowerCase().includes("invalid jwt")

  if (shouldRetryWithRefresh) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
    const refreshedToken = refreshData?.session?.access_token

    if (!refreshError && refreshedToken) {
      const retryResult = await invokeWithToken(refreshedToken)
      data = retryResult.data
      error = retryResult.error
    }
  }

  if (error) {
    let nextMessage = error.message || `Failed to invoke ${name}`
    if (error.context) {
      if (typeof error.context === "string") {
        try {
          const parsed = JSON.parse(error.context)
          if (parsed?.error) {
            nextMessage = parsed.error
          } else {
            nextMessage = error.context
          }
        } catch {
          nextMessage = error.context
        }
      } else if (typeof error.context === "object") {
        if (error.context?.error) {
          nextMessage = String(error.context.error)
        } else {
          const rawObjectMessage = JSON.stringify(error.context)
          if (rawObjectMessage && rawObjectMessage !== "{}") {
            nextMessage = rawObjectMessage
          }
        }
      } else {
        const rawContext = String(error.context || "")
        if (rawContext && rawContext !== "[object Response]") {
          nextMessage = rawContext
        }
      }
    }
    throw new Error(nextMessage)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data
}

export async function createConnectAccountOnboardingLink() {
  const returnUrl = buildReturnUrl("/account-settings", { billing: "connect-return" })
  const refreshUrl = buildReturnUrl("/account-settings", { billing: "connect-refresh" })
  return invokeBillingFunction("create-connect-account-link", {
    returnUrl,
    refreshUrl
  })
}

export async function createInvoicePaymentCheckout(invoiceId) {
  const successUrl = buildReturnUrl("/invoices", { billing: "invoice-paid", invoiceId })
  const cancelUrl = buildReturnUrl("/invoices", { billing: "invoice-payment-cancelled", invoiceId })
  return invokeBillingFunction("create-invoice-payment-session", {
    invoiceId,
    successUrl,
    cancelUrl
  })
}
