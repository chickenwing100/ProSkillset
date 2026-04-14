import { isSupabaseConfigured, supabase } from "../lib/supabase"

const normalizeEmail = (value) => (value || "").trim().toLowerCase()

function normalizeTeamMembers(value) {
  if (Array.isArray(value)) {
    return value.map((member) => String(member || "").trim()).filter(Boolean)
  }

  return String(value || "")
    .split(/[\n,]/)
    .map((member) => member.trim())
    .filter(Boolean)
}

function parseAccountSettingsFromProfile(profile = {}) {
  const legacySettings = profile?.portfolio?.account_settings || {}

  return {
    businessName: profile.business_name || profile.company || legacySettings.businessName || "",
    contactEmail: profile.contact_email || legacySettings.contactEmail || profile.email || "",
    phoneNumber: profile.phone_number || legacySettings.phoneNumber || "",
    serviceArea: profile.service_area || profile.location || legacySettings.serviceArea || "",
    teamMembers: normalizeTeamMembers(profile.team_members || legacySettings.teamMembers),
    profilePhotoUrl: profile.profile_photo_url || profile.avatar_url || legacySettings.profilePhotoUrl || ""
  }
}

function buildFallbackPortfolio(existingPortfolio, nextSettings) {
  const current = Array.isArray(existingPortfolio)
    ? { items: existingPortfolio }
    : (existingPortfolio && typeof existingPortfolio === "object" ? existingPortfolio : {})

  return {
    ...current,
    account_settings: {
      ...(current.account_settings || {}),
      ...nextSettings
    }
  }
}

export async function fetchContractorAccountSettings(email) {
  if (!isSupabaseConfigured) {
    return { data: null, error: null }
  }

  const normalizedEmail = normalizeEmail(email)
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: {
      ...parseAccountSettingsFromProfile(data),
      profileRow: data
    },
    error: null
  }
}

export async function saveContractorAccountSettings({
  authFallbackName,
  email,
  settings,
  existingProfile
}) {
  if (!isSupabaseConfigured) {
    const normalizedEmail = normalizeEmail(email)
    const normalizedSettings = {
      businessName: settings.businessName || "",
      contactEmail: normalizeEmail(settings.contactEmail || normalizedEmail),
      phoneNumber: settings.phoneNumber || "",
      serviceArea: settings.serviceArea || "",
      teamMembers: normalizeTeamMembers(settings.teamMembers),
      profilePhotoUrl: settings.profilePhotoUrl || ""
    }

    return {
      data: {
        ...normalizedSettings,
        profileRow: existingProfile || null,
        localOnly: true
      },
      error: null
    }
  }

  const normalizedEmail = normalizeEmail(email)
  const normalizedSettings = {
    businessName: settings.businessName || "",
    contactEmail: normalizeEmail(settings.contactEmail || normalizedEmail),
    phoneNumber: settings.phoneNumber || "",
    serviceArea: settings.serviceArea || "",
    teamMembers: normalizeTeamMembers(settings.teamMembers),
    profilePhotoUrl: settings.profilePhotoUrl || ""
  }

  const payload = {
    business_name: normalizedSettings.businessName,
    contact_email: normalizedSettings.contactEmail,
    phone_number: normalizedSettings.phoneNumber,
    service_area: normalizedSettings.serviceArea,
    team_members: normalizedSettings.teamMembers,
    profile_photo_url: normalizedSettings.profilePhotoUrl,
    company: normalizedSettings.businessName,
    location: normalizedSettings.serviceArea,
    avatar_url: normalizedSettings.profilePhotoUrl,
    updated_at: new Date().toISOString()
  }

  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user

  const baseInsertPayload = {
    ...payload,
    email: normalizedEmail,
    full_name: authFallbackName || "Contractor",
    role: "contractor"
  }

  if (authUser?.id) {
    baseInsertPayload.id = authUser.id
  }

  const rowExists = Boolean(existingProfile?.id || existingProfile?.email)

  const runUpdate = async (nextPayload) => {
    if (rowExists) {
      return supabase
        .from("profiles")
        .update(nextPayload)
        .eq("email", normalizedEmail)
        .select("*")
        .maybeSingle()
    }

    return supabase
      .from("profiles")
      .insert(baseInsertPayload)
      .select("*")
      .maybeSingle()
  }

  const { data, error } = await runUpdate(payload)

  if (!error) {
    return {
      data: {
        ...normalizedSettings,
        profileRow: data || existingProfile || null
      },
      error: null
    }
  }

  const fallbackPortfolio = buildFallbackPortfolio(existingProfile?.portfolio, normalizedSettings)
  const fallbackPayload = {
    company: normalizedSettings.businessName,
    location: normalizedSettings.serviceArea,
    avatar_url: normalizedSettings.profilePhotoUrl,
    portfolio: fallbackPortfolio,
    updated_at: new Date().toISOString()
  }

  const fallbackInsertPayload = {
    ...baseInsertPayload,
    portfolio: fallbackPortfolio
  }

  const fallbackResult = rowExists
    ? await supabase
      .from("profiles")
      .update(fallbackPayload)
      .eq("email", normalizedEmail)
      .select("*")
      .maybeSingle()
    : await supabase
      .from("profiles")
      .insert(fallbackInsertPayload)
      .select("*")
      .maybeSingle()

  if (fallbackResult.error) {
    return { data: null, error: fallbackResult.error }
  }

  return {
    data: {
      ...normalizedSettings,
      profileRow: fallbackResult.data || existingProfile || null
    },
    error: null
  }
}

export async function updateContractorPassword(password) {
  if (!isSupabaseConfigured) {
    return {
      error: new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
    }
  }

  return supabase.auth.updateUser({ password })
}
