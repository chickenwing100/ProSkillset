import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import {
  fetchContractorAccountSettings,
  saveContractorAccountSettings,
  updateContractorPassword
} from "../services/accountSettingsService"

const toTeamMembersText = (members) => (Array.isArray(members) ? members.join("\n") : "")
const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function AccountSettings() {
  const { user, updateProfile, getUserProfile, updatePassword } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [settings, setSettings] = useState({
    businessName: "",
    contactEmail: "",
    phoneNumber: "",
    serviceArea: "",
    teamMembersText: "",
    profilePhotoUrl: ""
  })

  const [profileRow, setProfileRow] = useState(null)
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingSection, setSavingSection] = useState("")
  const [statusBySection, setStatusBySection] = useState({})
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  })

  useEffect(() => {
    if (!user) {
      navigate("/login")
      return
    }

    if (user.role !== "contractor") {
      navigate("/dashboard")
      return
    }

    const localProfile = getUserProfile(user.email) || {}
    setSettings({
      businessName: localProfile.businessName || localProfile.company || "",
      contactEmail: localProfile.contactEmail || user.email || "",
      phoneNumber: localProfile.phoneNumber || "",
      serviceArea: localProfile.serviceArea || localProfile.location || "",
      teamMembersText: toTeamMembersText(localProfile.teamMembers),
      profilePhotoUrl: localProfile.profilePhoto || localProfile.profilePhotoUrl || ""
    })

    const loadSupabaseSettings = async () => {
      const { data, error } = await fetchContractorAccountSettings(user.email)
      if (error) {
        setStatusBySection((prev) => ({
          ...prev,
          global: {
            type: "error",
            message: error.message || "Unable to load settings from Supabase"
          }
        }))
        showToast(error.message || "Unable to load settings from Supabase", "error")
      }

      if (data) {
        setProfileRow(data.profileRow || null)
        setSettings({
          businessName: data.businessName || localProfile.businessName || localProfile.company || "",
          contactEmail: data.contactEmail || localProfile.contactEmail || user.email || "",
          phoneNumber: data.phoneNumber || localProfile.phoneNumber || "",
          serviceArea: data.serviceArea || localProfile.serviceArea || localProfile.location || "",
          teamMembersText: toTeamMembersText(data.teamMembers || localProfile.teamMembers),
          profilePhotoUrl: data.profilePhotoUrl || localProfile.profilePhoto || localProfile.profilePhotoUrl || ""
        })
      }

      setLoading(false)
    }

    loadSupabaseSettings()
  }, [getUserProfile, navigate, showToast, user])

  const updateSectionStatus = (section, type, message) => {
    setStatusBySection((prev) => ({
      ...prev,
      [section]: { type, message }
    }))
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setSettings((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const syncLocalProfile = (nextSettings) => {
    const nextProfile = {
      businessName: nextSettings.businessName,
      company: nextSettings.businessName,
      contactEmail: normalizeEmail(nextSettings.contactEmail || user?.email),
      phoneNumber: nextSettings.phoneNumber,
      serviceArea: nextSettings.serviceArea,
      location: nextSettings.serviceArea,
      teamMembers: nextSettings.teamMembers,
      profilePhoto: nextSettings.profilePhotoUrl,
      profilePhotoUrl: nextSettings.profilePhotoUrl
    }

    updateProfile(nextProfile)
  }

  const persistSettings = async (section) => {
    if (!user?.email) return

    setSavingSection(section)
    updateSectionStatus(section, "info", "Saving...")

    const nextSettings = {
      businessName: settings.businessName,
      contactEmail: settings.contactEmail,
      phoneNumber: settings.phoneNumber,
      serviceArea: settings.serviceArea,
      teamMembers: settings.teamMembersText,
      profilePhotoUrl: settings.profilePhotoUrl
    }

    const { data, error } = await saveContractorAccountSettings({
      authFallbackName: user.name,
      email: user.email,
      settings: nextSettings,
      existingProfile: profileRow
    })

    if (error) {
      updateSectionStatus(section, "error", error.message || "Save failed")
      showToast(error.message || "Save failed", "error")
      setSavingSection("")
      return
    }

    const syncedSettings = {
      ...nextSettings,
      teamMembers: data?.teamMembers || settings.teamMembersText.split(/\n|,/).map((entry) => entry.trim()).filter(Boolean)
    }

    if (data?.profileRow) {
      setProfileRow(data.profileRow)
    }

    setSettings((prev) => ({
      ...prev,
      businessName: syncedSettings.businessName,
      contactEmail: normalizeEmail(syncedSettings.contactEmail || user.email),
      phoneNumber: syncedSettings.phoneNumber,
      serviceArea: syncedSettings.serviceArea,
      teamMembersText: toTeamMembersText(syncedSettings.teamMembers),
      profilePhotoUrl: syncedSettings.profilePhotoUrl || prev.profilePhotoUrl
    }))

    const successMessage = data?.localOnly
      ? "Saved locally. Add Supabase keys to sync to database."
      : "Saved to Supabase"

    syncLocalProfile(syncedSettings)
    updateSectionStatus(section, "success", successMessage)
    showToast(successMessage, "success")
    setSavingSection("")
  }

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handlePhotoSave = async () => {
    if (!selectedPhotoFile || !user?.email) {
      updateSectionStatus("photo", "error", "Choose a photo before saving")
      showToast("Choose a photo before saving", "error")
      return
    }

    setSavingSection("photo")
    updateSectionStatus("photo", "info", "Uploading...")

    let photoUrl = settings.profilePhotoUrl
    const filePath = `${normalizeEmail(user.email)}/profile-${Date.now()}-${selectedPhotoFile.name}`

    if (!isSupabaseConfigured) {
      const inlineDataUrl = await fileToDataUrl(selectedPhotoFile)
      photoUrl = inlineDataUrl
    } else {
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, selectedPhotoFile, { upsert: true })

      if (uploadError) {
        const inlineDataUrl = await fileToDataUrl(selectedPhotoFile)
        photoUrl = inlineDataUrl
      } else {
        const { data: publicData } = supabase.storage.from("profile-photos").getPublicUrl(filePath)
        photoUrl = publicData?.publicUrl || (await fileToDataUrl(selectedPhotoFile))
      }
    }

    setSettings((prev) => ({
      ...prev,
      profilePhotoUrl: photoUrl
    }))

    const { data, error } = await saveContractorAccountSettings({
      authFallbackName: user.name,
      email: user.email,
      settings: {
        businessName: settings.businessName,
        contactEmail: settings.contactEmail,
        phoneNumber: settings.phoneNumber,
        serviceArea: settings.serviceArea,
        teamMembers: settings.teamMembersText,
        profilePhotoUrl: photoUrl
      },
      existingProfile: profileRow
    })

    if (error) {
      updateSectionStatus("photo", "error", error.message || "Photo save failed")
      showToast(error.message || "Photo save failed", "error")
      setSavingSection("")
      return
    }

    if (data?.profileRow) {
      setProfileRow(data.profileRow)
    }

    setSettings((prev) => ({
      ...prev,
      profilePhotoUrl: photoUrl,
      contactEmail: normalizeEmail(prev.contactEmail || user.email)
    }))

    syncLocalProfile({
      businessName: settings.businessName,
      contactEmail: settings.contactEmail,
      phoneNumber: settings.phoneNumber,
      serviceArea: settings.serviceArea,
      teamMembers: settings.teamMembersText.split(/\n|,/).map((entry) => entry.trim()).filter(Boolean),
      profilePhotoUrl: photoUrl
    })

    const photoMessage = data?.localOnly
      ? "Photo saved locally. Add Supabase keys to sync to database."
      : "Photo uploaded and saved"

    updateSectionStatus("photo", "success", photoMessage)
    showToast(photoMessage, "success")
    setSelectedPhotoFile(null)
    setSavingSection("")
  }

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      updateSectionStatus("password", "error", "New password must be at least 6 characters")
      showToast("New password must be at least 6 characters", "error")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      updateSectionStatus("password", "error", "Passwords do not match")
      showToast("Passwords do not match", "error")
      return
    }

    setSavingSection("password")
    updateSectionStatus("password", "info", "Updating password...")

    if (!isSupabaseConfigured) {
      const result = updatePassword(passwordData.currentPassword, passwordData.newPassword)
      if (!result.success) {
        updateSectionStatus("password", "error", result.error || "Password update failed")
        showToast(result.error || "Password update failed", "error")
        setSavingSection("")
        return
      }
    } else {
      const { error } = await updateContractorPassword(passwordData.newPassword)

      if (error) {
        const nextMessage = "Password update failed. Please try again."
        updateSectionStatus("password", "error", nextMessage)
        showToast(nextMessage, "error")
        setSavingSection("")
        return
      }
    }

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    })
    updateSectionStatus("password", "success", "Password updated")
    showToast("Password updated", "success")
    setSavingSection("")
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading account settings...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-gray-600 mt-1">Manage your contractor business profile and security settings.</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {statusBySection.global && (
          <div className={`rounded-md px-4 py-3 border ${statusBySection.global.type === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
            {statusBySection.global.message}
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Business Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                name="businessName"
                value={settings.businessName}
                onChange={handleFieldChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Prime Build LLC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Area</label>
              <input
                name="serviceArea"
                value={settings.serviceArea}
                onChange={handleFieldChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Austin, TX metro"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${statusBySection.business?.type === "error" ? "text-red-600" : "text-gray-500"}`}>
              {statusBySection.business?.message || "Save updates for your business identity and service coverage."}
            </p>
            <button
              onClick={() => persistSettings("business")}
              disabled={savingSection === "business"}
              className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {savingSection === "business" ? "Saving..." : "Save Business Info"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Contact Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                name="contactEmail"
                type="email"
                value={settings.contactEmail}
                onChange={handleFieldChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="contact@yourbusiness.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                name="phoneNumber"
                value={settings.phoneNumber}
                onChange={handleFieldChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${statusBySection.contact?.type === "error" ? "text-red-600" : "text-gray-500"}`}>
              {statusBySection.contact?.message || "Keep your client-facing contact info up to date."}
            </p>
            <button
              onClick={() => persistSettings("contact")}
              disabled={savingSection === "contact"}
              className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {savingSection === "contact" ? "Saving..." : "Save Contact Details"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Member Names</label>
            <textarea
              name="teamMembersText"
              value={settings.teamMembersText}
              onChange={handleFieldChange}
              rows={5}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="One name per line or comma-separated"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${statusBySection.team?.type === "error" ? "text-red-600" : "text-gray-500"}`}>
              {statusBySection.team?.message || "Manage who appears as part of your contractor team."}
            </p>
            <button
              onClick={() => persistSettings("team")}
              disabled={savingSection === "team"}
              className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {savingSection === "team" ? "Saving..." : "Save Team Members"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Profile Photo</h2>
          <div className="flex items-center gap-6">
            <img
              src={photoPreviewUrl || settings.profilePhotoUrl || "/api/placeholder/96/96"}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover border border-gray-200"
            />
            <div className="space-y-2">
              <input type="file" accept="image/*" onChange={handlePhotoSelect} />
              <p className="text-sm text-gray-500">Upload a JPG, PNG, WEBP, or HEIC photo.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${statusBySection.photo?.type === "error" ? "text-red-600" : "text-gray-500"}`}>
              {statusBySection.photo?.message || "Upload and save your contractor profile image."}
            </p>
            <button
              onClick={handlePhotoSave}
              disabled={savingSection === "photo"}
              className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {savingSection === "photo" ? "Saving..." : "Save Profile Photo"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Password Update</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords.currentPassword ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={(event) => setPasswordData((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Current password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("currentPassword")}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
                >
                  {showPasswords.currentPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.newPassword ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(event) => setPasswordData((prev) => ({ ...prev, newPassword: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("newPassword")}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
                >
                  {showPasswords.newPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirmPassword ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(event) => setPasswordData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("confirmPassword")}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-gray-600 hover:text-gray-900"
                >
                  {showPasswords.confirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${statusBySection.password?.type === "error" ? "text-red-600" : "text-gray-500"}`}>
              {statusBySection.password?.message || "Password updates use your active Supabase session."}
            </p>
            <button
              onClick={handlePasswordChange}
              disabled={savingSection === "password"}
              className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              {savingSection === "password" ? "Saving..." : "Update Password"}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
