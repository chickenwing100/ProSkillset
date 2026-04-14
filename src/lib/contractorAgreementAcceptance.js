const CONTRACTOR_AGREEMENT_ACCEPTANCE_KEY = "contractorAgreementAcceptedV1"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

const readAcceptanceRegistry = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTRACTOR_AGREEMENT_ACCEPTANCE_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writeAcceptanceRegistry = (registry) => {
  localStorage.setItem(CONTRACTOR_AGREEMENT_ACCEPTANCE_KEY, JSON.stringify(registry))
}

export const hasAcceptedContractorAgreement = (email) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const registry = readAcceptanceRegistry()
  return Boolean(registry[normalizedEmail])
}

export const acceptContractorAgreementForEmail = (email) => {
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
