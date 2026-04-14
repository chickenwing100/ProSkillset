const TERMS_ACCEPTANCE_KEY = "termsAcceptedV1"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

const readAcceptanceRegistry = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TERMS_ACCEPTANCE_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writeAcceptanceRegistry = (registry) => {
  localStorage.setItem(TERMS_ACCEPTANCE_KEY, JSON.stringify(registry))
}

export const hasAcceptedTerms = (email) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const registry = readAcceptanceRegistry()
  return Boolean(registry[normalizedEmail])
}

export const acceptTermsForEmail = (email) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const registry = readAcceptanceRegistry()
  registry[normalizedEmail] = {
    acceptedAt: new Date().toISOString(),
    version: 1
  }
  writeAcceptanceRegistry(registry)
  return true
}

export const getTermsRedirectPath = ({ returnTo } = {}) => {
  const query = new URLSearchParams({
    setup: "1",
    confirmed: "1"
  })

  if (returnTo) {
    query.set("returnTo", returnTo)
  }

  return `/terms-and-conditions?${query.toString()}`
}
