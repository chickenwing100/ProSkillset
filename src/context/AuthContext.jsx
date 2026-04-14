import { createContext, useState, useContext, useEffect } from "react"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { queueAutomatedWelcomeMessages } from "../lib/automatedMessages"
import { getTermsRedirectPath } from "../lib/termsAcceptance"

const AuthContext = createContext()

const normalizeEmail = (email) => (email || "").trim().toLowerCase()

const isImageDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/")

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const getEmailRedirectTo = () => `${window.location.origin}${getTermsRedirectPath()}`

  const buildSupabaseUserData = async (authUser) => {
    if (!authUser?.email) return null

    const normalizedEmail = normalizeEmail(authUser.email)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", authUser.id)
      .maybeSingle()

    return {
      email: normalizedEmail,
      role: profile?.role || authUser.user_metadata?.role || "client",
      name: profile?.full_name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || ""
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
      return { success: true }
    }
    return { success: false, error: "Invalid credentials" }
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

      queueAutomatedWelcomeMessages({
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

    queueAutomatedWelcomeMessages({
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
  }

  const getUserProfile = (email) => {
    const users = readUsers()
    return users[normalizeEmail(email)] || null
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