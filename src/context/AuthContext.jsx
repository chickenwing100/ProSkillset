import { createContext, useState, useContext, useEffect } from "react"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { queueAutomatedWelcomeMessages } from "../lib/automatedMessages"
import { getTermsRedirectPath } from "../lib/termsAcceptance"

const AuthContext = createContext()
const CONTRACTOR_SIGNUP_DRAFTS_KEY = "pendingContractorSignupDraftsV1"

const normalizeEmail = (email) => (email || "").trim().toLowerCase()

const isImageDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/")

const normalizeArrayOfStrings = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry || "").trim()).filter(Boolean)
}

const getPortfolioState = (portfolio) => {
  if (Array.isArray(portfolio)) {
    return {
      items: portfolio,
      profileData: {}
    }
  }

  if (portfolio && typeof portfolio === "object") {
    return {
      items: Array.isArray(portfolio.items) ? portfolio.items : [],
      profileData: portfolio.profile_data && typeof portfolio.profile_data === "object"
        ? portfolio.profile_data
        : {}
    }
  }

  return {
    items: [],
    profileData: {}
  }
}

const mapProfileRowToStoredProfile = (profile = {}, authUser = null) => {
  const normalizedEmail = normalizeEmail(profile.email || authUser?.email)
  const { items, profileData } = getPortfolioState(profile.portfolio)
  const fullName = profile.full_name || profileData.name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || ""
  const company = profile.company || profile.business_name || profileData.company || profileData.businessName || ""
  const location = profile.location || profile.service_area || profileData.location || profileData.serviceArea || ""
  const avatarUrl = profile.profile_photo_url || profile.avatar_url || profileData.profilePhoto || profileData.profilePhotoUrl || ""
  const tradeCategories = normalizeArrayOfStrings(profileData.tradeCategories)

  return {
    email: normalizedEmail,
    role: profile.role || authUser?.user_metadata?.role || "client",
    name: fullName,
    full_name: fullName,
    company,
    businessName: profile.business_name || company,
    location,
    serviceArea: profile.service_area || location,
    contactEmail: profile.contact_email || profileData.contactEmail || normalizedEmail,
    phoneNumber: profile.phone_number || profileData.phoneNumber || "",
    teamMembers: Array.isArray(profile.team_members) ? profile.team_members : normalizeArrayOfStrings(profileData.teamMembers),
    profilePhoto: avatarUrl,
    profilePhotoUrl: avatarUrl,
    avatar_url: profile.avatar_url || avatarUrl,
    bio: profileData.bio || "",
    skills: normalizeArrayOfStrings(profileData.skills),
    experience: profileData.experience || "",
    portfolio: items,
    website: profileData.website || "",
    hourlyRate: profileData.hourlyRate || "",
    contractorName: profileData.contractorName || fullName,
    tradeCategories,
    tradeCategory: tradeCategories[0] || "",
    serviceAreas: normalizeArrayOfStrings(profileData.serviceAreas),
    description: profileData.description || profileData.bio || "",
    galleryPhotos: Array.isArray(profileData.galleryPhotos) ? profileData.galleryPhotos : [],
    licenses: profileData.licenses || "",
    insuranceProvider: profileData.insuranceProvider || "",
    insuranceDocuments: Array.isArray(profileData.insuranceDocuments) ? profileData.insuranceDocuments : [],
    insuranceReviewStatus: profileData.insuranceReviewStatus || "not_submitted",
    insuranceVerified: Boolean(profileData.insuranceVerified || profileData.insuranceVerifiedByAdmin),
    insuranceVerifiedByAdmin: Boolean(profileData.insuranceVerifiedByAdmin || profileData.insuranceVerified),
    insuranceReviewedAt: profileData.insuranceReviewedAt || "",
    insuranceReviewedBy: profileData.insuranceReviewedBy || "",
    termsAcceptedAt: profile.terms_accepted_at || profileData.termsAcceptedAt || "",
    termsVersion: Number(profile.terms_version || profileData.termsVersion || 0),
    contractorAgreementAcceptedAt: profile.contractor_agreement_accepted_at || profileData.contractorAgreementAcceptedAt || "",
    contractorAgreementVersion: Number(profile.contractor_agreement_version || profileData.contractorAgreementVersion || 0)
  }
}

const buildProfileUpdatePayload = ({ existingProfile = {}, updatedData = {}, authUser = null, email, role }) => {
  const { items, profileData } = getPortfolioState(existingProfile.portfolio)
  const mergedProfile = {
    ...existingProfile,
    ...updatedData,
    email: normalizeEmail(email || existingProfile.email || authUser?.email),
    role: role || existingProfile.role || authUser?.user_metadata?.role || "client"
  }

  const portfolioItems = Array.isArray(mergedProfile.portfolio) ? mergedProfile.portfolio : items
  const nextProfileData = {
    ...profileData,
    bio: mergedProfile.bio || "",
    skills: normalizeArrayOfStrings(mergedProfile.skills),
    experience: mergedProfile.experience || "",
    website: mergedProfile.website || "",
    hourlyRate: mergedProfile.hourlyRate || "",
    contractorName: mergedProfile.contractorName || mergedProfile.name || "",
    tradeCategories: normalizeArrayOfStrings(mergedProfile.tradeCategories),
    serviceAreas: normalizeArrayOfStrings(mergedProfile.serviceAreas),
    description: mergedProfile.description || mergedProfile.bio || "",
    galleryPhotos: Array.isArray(mergedProfile.galleryPhotos) ? mergedProfile.galleryPhotos : [],
    licenses: mergedProfile.licenses || "",
    insuranceProvider: mergedProfile.insuranceProvider || "",
    insuranceDocuments: Array.isArray(mergedProfile.insuranceDocuments) ? mergedProfile.insuranceDocuments : [],
    insuranceReviewStatus: mergedProfile.insuranceReviewStatus || "not_submitted",
    insuranceVerified: Boolean(mergedProfile.insuranceVerified),
    insuranceVerifiedByAdmin: Boolean(mergedProfile.insuranceVerifiedByAdmin ?? mergedProfile.insuranceVerified),
    insuranceReviewedAt: mergedProfile.insuranceReviewedAt || "",
    insuranceReviewedBy: mergedProfile.insuranceReviewedBy || "",
    termsAcceptedAt: mergedProfile.termsAcceptedAt || "",
    termsVersion: Number(mergedProfile.termsVersion || 0),
    contractorAgreementAcceptedAt: mergedProfile.contractorAgreementAcceptedAt || "",
    contractorAgreementVersion: Number(mergedProfile.contractorAgreementVersion || 0),
    contactEmail: mergedProfile.contactEmail || mergedProfile.email || "",
    phoneNumber: mergedProfile.phoneNumber || "",
    teamMembers: Array.isArray(mergedProfile.teamMembers) ? mergedProfile.teamMembers : normalizeArrayOfStrings(mergedProfile.teamMembers),
    profilePhoto: mergedProfile.profilePhoto || mergedProfile.profilePhotoUrl || mergedProfile.avatar_url || "",
    profilePhotoUrl: mergedProfile.profilePhotoUrl || mergedProfile.profilePhoto || mergedProfile.avatar_url || "",
    company: mergedProfile.company || mergedProfile.businessName || "",
    businessName: mergedProfile.businessName || mergedProfile.company || "",
    location: mergedProfile.location || mergedProfile.serviceArea || "",
    serviceArea: mergedProfile.serviceArea || mergedProfile.location || ""
  }

  return {
    id: authUser?.id,
    email: mergedProfile.email,
    role: mergedProfile.role,
    full_name: mergedProfile.name || mergedProfile.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "",
    company: mergedProfile.company || mergedProfile.businessName || "",
    location: mergedProfile.location || mergedProfile.serviceArea || "",
    avatar_url: mergedProfile.profilePhoto || mergedProfile.profilePhotoUrl || mergedProfile.avatar_url || "",
    business_name: mergedProfile.businessName || mergedProfile.company || "",
    contact_email: mergedProfile.contactEmail || mergedProfile.email || "",
    phone_number: mergedProfile.phoneNumber || "",
    service_area: mergedProfile.serviceArea || mergedProfile.location || "",
    team_members: Array.isArray(mergedProfile.teamMembers) ? mergedProfile.teamMembers : normalizeArrayOfStrings(mergedProfile.teamMembers),
    profile_photo_url: mergedProfile.profilePhotoUrl || mergedProfile.profilePhoto || mergedProfile.avatar_url || "",
    terms_accepted_at: mergedProfile.termsAcceptedAt || null,
    terms_version: Number(mergedProfile.termsVersion || 0) || null,
    contractor_agreement_accepted_at: mergedProfile.contractorAgreementAcceptedAt || null,
    contractor_agreement_version: Number(mergedProfile.contractorAgreementVersion || 0) || null,
    portfolio: {
      items: portfolioItems,
      profile_data: nextProfileData
    },
    updated_at: new Date().toISOString()
  }
}

const compressDataUrl = (dataUrl, maxDimension = 1400, quality = 0.75) => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => {
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) {
      reject(new Error("Canvas context unavailable"))
      return
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL("image/jpeg", quality))
  }
  image.onerror = reject
  image.src = dataUrl
})

const readPendingContractorSignupDrafts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTRACTOR_SIGNUP_DRAFTS_KEY) || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writePendingContractorSignupDrafts = (drafts) => {
  localStorage.setItem(CONTRACTOR_SIGNUP_DRAFTS_KEY, JSON.stringify(drafts))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const getEmailRedirectTo = () => `${window.location.origin}${getTermsRedirectPath()}`

  const buildSupabaseUserData = async (authUser) => {
    if (!authUser?.email) return null

    const normalizedEmail = normalizeEmail(authUser.email)
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle()

    if (profile) {
      return mapProfileRowToStoredProfile(profile, authUser)
    }

    return {
      email: normalizedEmail,
      role: authUser.user_metadata?.role || "client",
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || ""
    }
  }

  const readUsers = () => {
    try {
      return JSON.parse(localStorage.getItem("users") || "{}")
    } catch {
      return {}
    }
  }

  const writeUsers = (users) => {
    localStorage.setItem("users", JSON.stringify(users))
  }

  const isAdminUser = (candidateUser = user) => candidateUser?.role === "admin"

  const ensureProfileRecord = (userData) => {
    if (!userData?.email) return
    const emailKey = normalizeEmail(userData.email)
    if (!emailKey) return

    const users = readUsers()
    users[emailKey] = {
      ...(users[emailKey] || {}),
      ...userData,
      email: emailKey
    }
    writeUsers(users)
  }

  const persistSupabaseProfile = async ({ email, updatedData, role }) => {
    if (!isSupabaseConfigured) return null

    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return null

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError

    const authUser = authData?.user || null
    const users = readUsers()
    const existingProfile = users[normalizedEmail] || {}
    const payload = buildProfileUpdatePayload({
      existingProfile,
      updatedData,
      authUser: authUser && normalizeEmail(authUser.email) === normalizedEmail ? authUser : null,
      email: normalizedEmail,
      role
    })

    let result
    if (payload.id) {
      result = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("*")
        .maybeSingle()
    } else {
      result = await supabase
        .from("profiles")
        .update(payload)
        .eq("email", normalizedEmail)
        .select("*")
        .maybeSingle()
    }

    if (result.error) throw result.error

    const syncedProfile = mapProfileRowToStoredProfile(result.data || payload, authUser)
    ensureProfileRecord(syncedProfile)

    if (normalizeEmail(user?.email) === normalizedEmail) {
      setUser((currentUser) => ({
        ...(currentUser || {}),
        ...syncedProfile
      }))
      localStorage.setItem("user", JSON.stringify({
        ...(user || {}),
        ...syncedProfile
      }))
    }

    return syncedProfile
  }

  const applyPendingContractorSignupDraft = async (email, role) => {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail || role !== "contractor" || !isSupabaseConfigured) return null

    const drafts = readPendingContractorSignupDrafts()
    const draft = drafts[normalizedEmail]
    if (!draft || typeof draft !== "object") return null

    try {
      const syncedProfile = await persistSupabaseProfile({
        email: normalizedEmail,
        updatedData: draft,
        role
      })

      delete drafts[normalizedEmail]
      writePendingContractorSignupDrafts(drafts)
      return syncedProfile
    } catch (error) {
      console.error("Failed to apply pending contractor signup draft:", error)
      return null
    }
  }



  const migrateUserPhotosIfNeeded = async () => {
    const migrationKey = "users_photo_migration_v1"
    if (localStorage.getItem(migrationKey)) return

    const users = readUsers()
    let hasChanges = false

    const userEntries = Object.entries(users)
    for (const [emailKey, storedProfile] of userEntries) {
      if (!storedProfile || typeof storedProfile !== "object") continue

      const nextProfile = { ...storedProfile }

      if (isImageDataUrl(nextProfile.profilePhoto) && nextProfile.profilePhoto.length > 350000) {
        try {
          nextProfile.profilePhoto = await compressDataUrl(nextProfile.profilePhoto)
          hasChanges = true
        } catch {
          // Skip faulty image payloads during migration.
        }
      }

      if (Array.isArray(nextProfile.galleryPhotos)) {
        const migratedGallery = []
        let galleryChanged = false

        for (const photo of nextProfile.galleryPhotos) {
          if (photo?.url && isImageDataUrl(photo.url) && photo.url.length > 350000) {
            try {
              const compressed = await compressDataUrl(photo.url)
              migratedGallery.push({ ...photo, url: compressed })
              galleryChanged = true
            } catch {
              migratedGallery.push(photo)
            }
          } else {
            migratedGallery.push(photo)
          }
        }

        if (galleryChanged) {
          nextProfile.galleryPhotos = migratedGallery
          hasChanges = true
        }
      }

      users[emailKey] = nextProfile
    }

    if (hasChanges) {
      writeUsers(users)
      if (user?.email && users[user.email]) {
        const syncedUser = {
          email: user.email,
          role: users[user.email].role,
          name: users[user.email].name
        }
        setUser(syncedUser)
        localStorage.setItem("user", JSON.stringify(syncedUser))
      }
    }

    localStorage.setItem(migrationKey, "done")
  }

  useEffect(() => {
    if (isSupabaseConfigured) {
      let isMounted = true

      const syncFromSession = async (session) => {
        if (!isMounted) return

        const accessToken = session?.access_token || ""
        if (!accessToken) {
          setUser(null)
          localStorage.removeItem("user")
          return
        }

        const {
          data: userData,
          error: userError
        } = await supabase.auth.getUser(accessToken)

        if (userError || !userData?.user) {
          await supabase.auth.signOut()
          setUser(null)
          localStorage.removeItem("user")
          return
        }

        const authUser = userData.user
        if (!authUser) {
          setUser(null)
          localStorage.removeItem("user")
          return
        }

        const nextUser = await buildSupabaseUserData(authUser)
        if (!isMounted) return

        if (nextUser) {
          setUser(nextUser)
          localStorage.setItem("user", JSON.stringify(nextUser))
          ensureProfileRecord(nextUser)
          void applyPendingContractorSignupDraft(nextUser.email, nextUser.role)
        }
      }

      supabase.auth.getSession()
        .then(({ data: { session } }) => syncFromSession(session))
        .finally(() => {
          if (isMounted) setLoading(false)
        })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        syncFromSession(session)
      })

      return () => {
        isMounted = false
        subscription?.unsubscribe()
      }
    }

    // Check for stored user on app load
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        const normalizedUser = {
          ...parsedUser,
          email: normalizeEmail(parsedUser.email)
        }
        setUser(normalizedUser)
        ensureProfileRecord(normalizedUser)
      } catch {
        localStorage.removeItem("user")
      }
    }
    setLoading(false)

    migrateUserPhotosIfNeeded().catch(() => {
      // Migration failures should not block auth boot.
    })
  }, [])

  const login = async (email, password) => {
    const normalizedEmail = normalizeEmail(email)

    try {
      if (isSupabaseConfigured) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        })

        if (authError || !authData?.user) {
          const authMessage = String(authError?.message || "").toLowerCase()
          if (authMessage.includes("email not confirmed")) {
            return { success: false, error: "Please confirm your email first, then sign in." }
          }
          if (authMessage.includes("invalid login credentials")) {
            return { success: false, error: "Email or password is incorrect. If you just signed up, confirm your email first." }
          }
          return { success: false, error: authError?.message || "Invalid credentials" }
        }

        const userData = await buildSupabaseUserData(authData.user)

        if (!userData) {
          return { success: false, error: "Unable to read account profile" }
        }

        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        ensureProfileRecord(userData)
        void applyPendingContractorSignupDraft(userData.email, userData.role)
        void queueAutomatedWelcomeMessages({
          email: userData.email,
          role: userData.role,
          force: false
        })
        return { success: true }
      }

      const users = readUsers()
      const storedAccount = users[normalizedEmail]
      const foundUser = (storedAccount && storedAccount.password === password) ? storedAccount : null

      if (foundUser) {
        const userData = {
          email: normalizeEmail(foundUser.email),
          role: foundUser.role,
          name: foundUser.name
        }
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        ensureProfileRecord(userData)
        void applyPendingContractorSignupDraft(userData.email, userData.role)
        void queueAutomatedWelcomeMessages({
          email: userData.email,
          role: userData.role,
          force: false
        })
        return { success: true }
      }

      return { success: false, error: "Invalid credentials" }
    } catch (err) {
      console.error("Login failed:", err)
      return { success: false, error: err?.message || "Unable to sign in" }
    }
  }

  const signup = async (email, password, role, name) => {
    const normalizedEmail = normalizeEmail(email)

    if (isSupabaseConfigured) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            role,
            full_name: name
          }
        }
      })

      if (authError) {
        const authMessage = String(authError.message || "").toLowerCase()
        if (authMessage.includes("email rate limit exceeded")) {
          return {
            success: false,
            error: "Email rate limit reached. Wait a few minutes, then try again. Also check your inbox for the earlier confirmation email and use Sign in instead of creating another account."
          }
        }
        if (authMessage.includes("user already registered")) {
          return {
            success: false,
            error: "This email is already registered. Please sign in instead."
          }
        }
        return { success: false, error: authError.message || "Signup failed" }
      }

      if (!authData?.user) {
        return { success: false, error: "Signup failed" }
      }

      void queueAutomatedWelcomeMessages({
        email: normalizedEmail,
        role
      })

      if (!authData.session) {
        return {
          success: false,
          error: "Account created. Please confirm your email, then sign in to continue."
        }
      }

      const userData = await buildSupabaseUserData(authData.user)

      if (!userData) {
        return { success: false, error: "Account created, but profile loading failed. Please sign in." }
      }

      setUser(userData)
      localStorage.setItem("user", JSON.stringify(userData))
      ensureProfileRecord(userData)
      return { success: true }
    }

    const users = readUsers()
    if (users[normalizedEmail]) {
      return { success: false, error: "An account with this email already exists" }
    }

    const userData = { email: normalizedEmail, role, name }
    setUser(userData)
    localStorage.setItem("user", JSON.stringify(userData))

    users[normalizedEmail] = { ...userData, password }
    writeUsers(users)

    void queueAutomatedWelcomeMessages({
      email: normalizedEmail,
      role
    })

    return { success: true }
  }

  const updateProfile = (updatedData) => {
    if (!user) return

    // Prevent profile edits from changing identity or role through form payloads.
    const { email, role, password, ...safeUpdates } = updatedData || {}
    const updatedUser = { ...user, ...safeUpdates }
    setUser(updatedUser)
    localStorage.setItem("user", JSON.stringify(updatedUser))

    const users = readUsers()
    const userKey = normalizeEmail(user.email)
    users[userKey] = {
      ...(users[userKey] || {}),
      ...safeUpdates,
      email: userKey,
      role: user.role,
      name: updatedUser.name,
      password: users[userKey]?.password
    }
    writeUsers(users)

    if (!isSupabaseConfigured) {
      return updatedUser
    }

    const persistenceTask = persistSupabaseProfile({
      email: user.email,
      updatedData: safeUpdates,
      role: user.role
    })
    persistenceTask.catch((error) => {
      console.error("Failed to sync profile to Supabase:", error)
    })
    return persistenceTask
  }

  const updateUserProfileByEmail = (email, updatedData) => {
    const emailKey = normalizeEmail(email)
    if (!emailKey || !updatedData) return

    const targetIsCurrentUser = emailKey === normalizeEmail(user?.email)
    if (!targetIsCurrentUser && !isAdminUser()) {
      throw new Error("Only admins can update another user profile")
    }

    const users = readUsers()
    const existingProfile = users[emailKey]
    if (!existingProfile) {
      throw new Error("Profile not found")
    }

    const { email: nextEmail, role: nextRole, password: nextPassword, ...safeUpdates } = updatedData
    users[emailKey] = {
      ...existingProfile,
      ...safeUpdates,
      email: emailKey,
      role: targetIsCurrentUser && !isAdminUser() ? user.role : (existingProfile.role || nextRole),
      password: existingProfile.password || nextPassword
    }

    writeUsers(users)

    if (targetIsCurrentUser) {
      const refreshedCurrentUser = {
        email: emailKey,
        role: users[emailKey].role,
        name: users[emailKey].name
      }
      setUser(refreshedCurrentUser)
      localStorage.setItem("user", JSON.stringify(refreshedCurrentUser))
    }

    if (!isSupabaseConfigured) {
      return users[emailKey]
    }

    const persistenceTask = persistSupabaseProfile({
      email: emailKey,
      updatedData: safeUpdates,
      role: users[emailKey].role
    })
    persistenceTask.catch((error) => {
      console.error("Failed to sync profile update to Supabase:", error)
    })
    return persistenceTask
  }

  const getUserProfile = (email) => {
    const users = readUsers()
    return users[normalizeEmail(email)] || (normalizeEmail(email) === normalizeEmail(user?.email) ? user : null)
  }

  const getAllProfiles = () => {
    if (!isAdminUser()) return []

    const demoEmails = new Set([
      'client@example.com',
      'contractor@example.com',
      'admin@example.com'
    ])

    const users = readUsers()
    return Object.values(users)
      .filter((profile) => profile && typeof profile === "object" && !demoEmails.has(normalizeEmail(profile.email)))
      .map((profile) => ({ ...profile, email: normalizeEmail(profile.email) }))
  }

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
    }
    setUser(null)
    localStorage.removeItem("user")
  }

  const updatePassword = (currentPassword, newPassword) => {
    if (isSupabaseConfigured) {
      const nextPassword = String(newPassword || "")
      if (nextPassword.length < 6) {
        return { success: false, error: "Password must be at least 6 characters" }
      }

      return supabase.auth.updateUser({ password: nextPassword })
        .then(({ error }) => error
          ? { success: false, error: error.message || "Unable to update password" }
          : { success: true }
        )
    }

    if (!user?.email) {
      return { success: false, error: "You must be logged in" }
    }

    const nextPassword = String(newPassword || "")
    if (nextPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" }
    }

    const users = readUsers()
    const userKey = normalizeEmail(user.email)
    const existingProfile = users[userKey]

    if (!existingProfile) {
      return { success: false, error: "Account not found" }
    }

    const storedPassword = existingProfile.password
    if (storedPassword && String(currentPassword || "") !== storedPassword) {
      return { success: false, error: "Current password is incorrect" }
    }

    users[userKey] = {
      ...existingProfile,
      password: nextPassword
    }
    writeUsers(users)

    return { success: true }
  }

  const value = {
    user,
    login,
    signup,
    logout,
    updateProfile,
    updateUserProfileByEmail,
    getUserProfile,
    getAllProfiles,
    isAdminUser,
    updatePassword,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}