import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { formatDateTime } from "../lib/dateTime"
import { TRADE_CATEGORY_GROUPS, normalizeTradeCategories } from "../lib/trades"

const MAX_GALLERY_PHOTOS = 18
const MAX_GALLERY_FILE_SIZE = 8 * 1024 * 1024
const MAX_INSURANCE_DOCS = 8
const MAX_INSURANCE_FILE_SIZE = 12 * 1024 * 1024
const INSURANCE_ACCEPT_TYPES = ".png,.jpg,.jpeg,.webp,.heic,.heif,.gif,.bmp,.tif,.tiff,.pdf,.txt,.doc,.docx"
const INSURANCE_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
])
const INSURANCE_ALLOWED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "webp", "heic", "heif", "gif", "bmp", "tif", "tiff", "pdf", "txt", "doc", "docx"
])

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fileToCompressedDataUrl(file, maxDimension = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      fileToDataUrl(file).then(resolve).catch(reject)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("Canvas context unavailable"))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      image.onerror = reject
      image.src = String(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function isAllowedInsuranceFile(file) {
  if (!file) return false
  if (file.type?.startsWith("image/")) return true
  if (INSURANCE_ALLOWED_MIME_TYPES.has(file.type)) return true

  const extension = file.name?.split(".").pop()?.toLowerCase() || ""
  return INSURANCE_ALLOWED_EXTENSIONS.has(extension)
}

export default function ContractorProfilePage({ user: profileUser, isOwnProfile = false }) {
  const { user, updateProfile, updateUserProfileByEmail, isAdminUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(-1)
  const [touchStartX, setTouchStartX] = useState(null)
  const [uploadingInsurance, setUploadingInsurance] = useState(false)
  const [newServiceArea, setNewServiceArea] = useState("")
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const mobileGalleryRef = useRef(null)
  const [formData, setFormData] = useState({
    contractorName: "",
    businessName: "",
    tradeCategories: ["Plumbing"],
    serviceAreas: [],
    description: "",
    profilePhoto: "",
    galleryPhotos: [],
    licenses: "",
    insuranceProvider: "",
    insuranceDocuments: [],
    insuranceReviewStatus: "not_submitted"
  })

  useEffect(() => {
    if (!profileUser) return

    setFormData({
      contractorName: profileUser.contractorName || profileUser.name || "",
      businessName: profileUser.businessName || profileUser.company || "",
      tradeCategories: normalizeTradeCategories(
        profileUser.tradeCategories ||
        profileUser.tradeCategory ||
        profileUser.trade ||
        profileUser.specialty ||
        profileUser.skills ||
        ["Plumbing"]
      ),
      serviceAreas: profileUser.serviceAreas || [],
      description: profileUser.description || profileUser.bio || "",
      profilePhoto: profileUser.profilePhoto || "",
      galleryPhotos: profileUser.galleryPhotos || [],
      licenses: profileUser.licenses || "",
      insuranceProvider: profileUser.insuranceProvider || "",
      insuranceDocuments: profileUser.insuranceDocuments || [],
      insuranceReviewStatus: profileUser.insuranceReviewStatus || "not_submitted"
    })
  }, [profileUser])

  const verificationStatus = useMemo(() => {
    const hasLicense = formData.licenses.trim().length > 0
    const isVerified = hasLicense && formData.insuranceReviewStatus === "approved"
    return { hasLicense, isVerified }
  }, [formData.licenses, formData.insuranceReviewStatus])

  const canReviewInsurance = isAdminUser() && !isOwnProfile && profileUser?.role === "contractor"

  const persistProfileData = (nextFormData) => {
    if (!isOwnProfile) return
    updateProfile({
      ...nextFormData,
      tradeCategory: normalizeTradeCategories(nextFormData.tradeCategories)[0] || "",
      name: nextFormData.contractorName,
      bio: nextFormData.description,
      company: nextFormData.businessName,
      insuranceVerified: nextFormData.insuranceReviewStatus === "approved"
    })
  }

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const handleTradeRoleToggle = (tradeRole) => {
    setFormData((prev) => {
      const current = normalizeTradeCategories(prev.tradeCategories)
      const exists = current.includes(tradeRole)
      const nextTradeCategories = exists
        ? current.filter((value) => value !== tradeRole)
        : [...current, tradeRole]

      return {
        ...prev,
        tradeCategories: nextTradeCategories.length > 0 ? nextTradeCategories : current
      }
    })
  }

  const handleSave = async () => {
    if (!isOwnProfile) return

    setSaving(true)
    try {
      updateProfile({
        ...formData,
        tradeCategory: normalizeTradeCategories(formData.tradeCategories)[0] || "",
        name: formData.contractorName,
        bio: formData.description,
        company: formData.businessName,
        insuranceVerified: Boolean(profileUser?.insuranceVerifiedByAdmin)
      })
      alert("Contractor profile saved")
    } catch (error) {
      alert("Failed to save contractor profile")
    } finally {
      setSaving(false)
    }
  }

  const handleAddServiceArea = () => {
    const normalized = newServiceArea.trim()
    if (!normalized) return

    if (formData.serviceAreas.includes(normalized)) {
      setNewServiceArea("")
      return
    }

    setFormData((prev) => ({
      ...prev,
      serviceAreas: [...prev.serviceAreas, normalized]
    }))
    setNewServiceArea("")
  }

  const handleRemoveServiceArea = (serviceArea) => {
    setFormData((prev) => ({
      ...prev,
      serviceAreas: prev.serviceAreas.filter((area) => area !== serviceArea)
    }))
  }

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      setFormData((prev) => {
        const next = {
          ...prev,
          profilePhoto: dataUrl
        }
        persistProfileData(next)
        return next
      })
    } catch (error) {
      alert("Failed to process selected profile photo")
    }
  }

  const uploadGalleryPhoto = async (file) => {
    const fileExt = file.name.split(".").pop()
    const safeEmail = (user?.email || profileUser?.email || "contractor").replace(/[^a-zA-Z0-9]/g, "_")
    const filePath = `${safeEmail}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

    try {
      const { error } = await supabase.storage.from("contractor-gallery").upload(filePath, file, {
        upsert: false,
        contentType: file.type
      })

      if (error) throw error

      const { data } = supabase.storage.from("contractor-gallery").getPublicUrl(filePath)
      if (!data?.publicUrl) {
        throw new Error("No public URL returned")
      }

      return {
        id: Date.now() + Math.random(),
        path: filePath,
        url: data.publicUrl,
        name: file.name,
        caption: ""
      }
    } catch (error) {
      const fallbackUrl = await fileToCompressedDataUrl(file)
      return {
        id: Date.now() + Math.random(),
        path: null,
        url: fallbackUrl,
        name: file.name,
        caption: ""
      }
    }
  }

  const addGalleryFiles = async (files) => {
    if (files.length === 0) return

    const validFiles = files.filter((file) => file.type.startsWith("image/"))
    if (validFiles.length !== files.length) {
      alert("Only image files are allowed in the gallery")
    }

    if (formData.galleryPhotos.length + validFiles.length > MAX_GALLERY_PHOTOS) {
      alert(`You can keep up to ${MAX_GALLERY_PHOTOS} gallery photos`)
      return
    }

    const oversized = validFiles.find((file) => file.size > MAX_GALLERY_FILE_SIZE)
    if (oversized) {
      alert(`Photo ${oversized.name} is too large. Max size is ${Math.round(MAX_GALLERY_FILE_SIZE / (1024 * 1024))}MB.`)
      return
    }

    setUploading(true)
    try {
      const uploaded = []
      for (const file of validFiles) {
        const uploadedPhoto = await uploadGalleryPhoto(file)
        uploaded.push(uploadedPhoto)
      }

      setFormData((prev) => {
        const next = {
          ...prev,
          galleryPhotos: [...prev.galleryPhotos, ...uploaded]
        }
        persistProfileData(next)
        return next
      })
    } catch (error) {
      alert("Failed to upload one or more gallery photos")
    } finally {
      setUploading(false)
    }
  }

  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    await addGalleryFiles(files)
    event.target.value = ""
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (!isOwnProfile) return

    const files = Array.from(event.dataTransfer.files || [])
    await addGalleryFiles(files)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (!isOwnProfile) return
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const updateGalleryCaption = (photoId, caption) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        galleryPhotos: prev.galleryPhotos.map((photo) =>
          photo.id === photoId ? { ...photo, caption } : photo
        )
      }
      persistProfileData(next)
      return next
    })
  }

  const moveGalleryPhoto = (photoId, direction) => {
    setFormData((prev) => {
      const currentIndex = prev.galleryPhotos.findIndex((photo) => photo.id === photoId)
      if (currentIndex < 0) return prev

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= prev.galleryPhotos.length) return prev

      const updated = [...prev.galleryPhotos]
      const [moved] = updated.splice(currentIndex, 1)
      updated.splice(nextIndex, 0, moved)

      const next = {
        ...prev,
        galleryPhotos: updated
      }
      persistProfileData(next)
      return next
    })
  }

  const removeGalleryPhoto = async (photoId) => {
    const photo = formData.galleryPhotos.find((item) => item.id === photoId)
    if (!photo) return

    if (photo.path) {
      try {
        const { error } = await supabase.storage.from("contractor-gallery").remove([photo.path])
        if (error) {
          throw error
        }
      } catch (error) {
        alert("Failed to remove photo from storage")
        return
      }
    }

    setFormData((prev) => {
      const next = {
        ...prev,
        galleryPhotos: prev.galleryPhotos.filter((item) => item.id !== photoId)
      }
      persistProfileData(next)
      return next
    })
  }

  const uploadInsuranceDocument = async (file) => {
    const fileExt = file.name.split(".").pop()
    const safeEmail = (user?.email || profileUser?.email || "contractor").replace(/[^a-zA-Z0-9]/g, "_")
    const filePath = `${safeEmail}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`

    try {
      const { error } = await supabase.storage.from("contractor-insurance-documents").upload(filePath, file, {
        upsert: false,
        contentType: file.type
      })

      if (error) throw error

      const { data } = supabase.storage.from("contractor-insurance-documents").getPublicUrl(filePath)
      if (!data?.publicUrl) {
        throw new Error("No public URL returned")
      }

      return {
        id: Date.now() + Math.random(),
        path: filePath,
        name: file.name,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        url: data.publicUrl
      }
    } catch (error) {
      return {
        id: Date.now() + Math.random(),
        path: null,
        name: file.name,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        url: file.type.startsWith("image/")
          ? await fileToCompressedDataUrl(file, 1200, 0.7)
          : await fileToDataUrl(file)
      }
    }
  }

  const handleInsuranceUpload = async (event) => {
    if (!isOwnProfile) return
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const disallowed = files.filter((file) => !isAllowedInsuranceFile(file))
    if (disallowed.length > 0) {
      alert("One or more files are not supported. Use common image types, PDF, TXT, DOC, or DOCX.")
      return
    }

    if (formData.insuranceDocuments.length + files.length > MAX_INSURANCE_DOCS) {
      alert(`You can upload up to ${MAX_INSURANCE_DOCS} insurance documents`)
      return
    }

    const oversized = files.find((file) => file.size > MAX_INSURANCE_FILE_SIZE)
    if (oversized) {
      alert(`Document ${oversized.name} is too large. Max size is ${Math.round(MAX_INSURANCE_FILE_SIZE / (1024 * 1024))}MB.`)
      return
    }

    setUploadingInsurance(true)
    try {
      const uploadedDocs = []
      for (const file of files) {
        const uploaded = await uploadInsuranceDocument(file)
        uploadedDocs.push(uploaded)
      }

      setFormData((prev) => {
        const next = {
          ...prev,
          insuranceDocuments: [...prev.insuranceDocuments, ...uploadedDocs],
          insuranceReviewStatus: "pending_review"
        }
        persistProfileData(next)
        return next
      })
    } catch (error) {
      alert("Failed to upload insurance documents")
    } finally {
      setUploadingInsurance(false)
      event.target.value = ""
    }
  }

  const removeInsuranceDocument = async (docId) => {
    if (!isOwnProfile) return
    const documentToRemove = formData.insuranceDocuments.find((doc) => doc.id === docId)
    if (!documentToRemove) return

    if (documentToRemove.path) {
      try {
        const { error } = await supabase.storage.from("contractor-insurance-documents").remove([documentToRemove.path])
        if (error) throw error
      } catch {
        alert("Failed to remove insurance document")
        return
      }
    }

    setFormData((prev) => {
      const remaining = prev.insuranceDocuments.filter((doc) => doc.id !== docId)
      const next = {
        ...prev,
        insuranceDocuments: remaining,
        insuranceReviewStatus: remaining.length > 0 ? "pending_review" : "not_submitted"
      }
      persistProfileData(next)
      return next
    })
  }

  const scrollMobileGallery = (direction) => {
    const container = mobileGalleryRef.current
    if (!container) return
    const step = Math.max(260, Math.round(container.clientWidth * 0.8))
    container.scrollBy({ left: direction === "next" ? step : -step, behavior: "smooth" })
  }

  const openGalleryPreview = (index) => {
    if (index < 0 || index >= formData.galleryPhotos.length) return
    setPreviewIndex(index)
  }

  const closeGalleryPreview = () => {
    setPreviewIndex(-1)
    setTouchStartX(null)
  }

  const showPreviousPreview = () => {
    if (formData.galleryPhotos.length <= 1) return
    setPreviewIndex((prev) => (prev <= 0 ? formData.galleryPhotos.length - 1 : prev - 1))
  }

  const showNextPreview = () => {
    if (formData.galleryPhotos.length <= 1) return
    setPreviewIndex((prev) => (prev >= formData.galleryPhotos.length - 1 ? 0 : prev + 1))
  }

  const handlePreviewTouchStart = (event) => {
    setTouchStartX(event.touches?.[0]?.clientX ?? null)
  }

  const handlePreviewTouchEnd = (event) => {
    if (touchStartX == null) return
    const touchEndX = event.changedTouches?.[0]?.clientX
    if (typeof touchEndX !== "number") return

    const delta = touchEndX - touchStartX
    if (Math.abs(delta) < 40) return

    if (delta > 0) {
      showPreviousPreview()
    } else {
      showNextPreview()
    }
  }

  const handleMobileGalleryScroll = () => {
    const container = mobileGalleryRef.current
    if (!container) return
    const cardWidth = 268
    const nextIndex = Math.round(container.scrollLeft / cardWidth)
    setActiveGalleryIndex(Math.max(0, Math.min(nextIndex, Math.max(0, formData.galleryPhotos.length - 1))))
  }

  const handleInsuranceReviewDecision = (status) => {
    if (!canReviewInsurance) return

    try {
      const email = profileUser?.email
      if (!email) return

      updateUserProfileByEmail(email, {
        insuranceReviewStatus: status,
        insuranceVerifiedByAdmin: status === "approved",
        insuranceReviewedAt: new Date().toISOString(),
        insuranceReviewedBy: user?.email || "admin"
      })

      setFormData((prev) => ({
        ...prev,
        insuranceReviewStatus: status
      }))

      alert(status === "approved" ? "Insurance documents approved" : "Insurance documents rejected")
    } catch (error) {
      alert(error.message || "Unable to update insurance review status")
    }
  }

  if (!profileUser) {
    return <div className="text-center py-8">Loading contractor profile...</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <div className="flex items-start gap-4">
            <img
              src={formData.profilePhoto || "/api/placeholder/120/120"}
              alt={formData.contractorName || "Contractor profile"}
              className="w-24 h-24 rounded-full object-cover border border-gray-200"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
                {formData.contractorName || "Contractor Name"}
              </h1>
              <p className="text-gray-600 mt-1">{formData.businessName || "Business Name"}</p>
              <p className="text-sm text-gray-500 mt-1">{normalizeTradeCategories(formData.tradeCategories).join(", ") || "Trade roles not set"}</p>
              <div className="mt-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${verificationStatus.isVerified ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                  {verificationStatus.isVerified ? "Verified Contractor" : "Verification Pending"}
                </span>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full md:w-auto bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contractor Name</label>
              <input
                name="contractorName"
                value={formData.contractorName}
                onChange={handleFieldChange}
                readOnly={!isOwnProfile}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
              <input
                name="businessName"
                value={formData.businessName}
                onChange={handleFieldChange}
                readOnly={!isOwnProfile}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trade Roles</label>
              {isOwnProfile ? (
                <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                  {TRADE_CATEGORY_GROUPS.map((group) => {
                    const selectedTradeRoles = normalizeTradeCategories(formData.tradeCategories)
                    return (
                      <div key={group.label}>
                        <p className="mb-2 text-xs font-semibold text-gray-500">{group.label}</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {group.options.map((tradeRole) => {
                            const checked = selectedTradeRoles.includes(tradeRole)
                            return (
                              <label key={tradeRole} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${checked ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleTradeRoleToggle(tradeRole)}
                                  disabled={!isOwnProfile}
                                />
                                <span>{tradeRole}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-3">
                  {normalizeTradeCategories(formData.tradeCategories).length === 0 ? (
                    <span className="text-sm text-gray-500">No trade roles listed</span>
                  ) : (
                    normalizeTradeCategories(formData.tradeCategories).map((tradeRole) => (
                      <span key={tradeRole} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-800">
                        {tradeRole}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Areas</label>
              {isOwnProfile && (
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    value={newServiceArea}
                    onChange={(event) => setNewServiceArea(event.target.value)}
                    placeholder="Add city or region"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddServiceArea}
                    className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Add
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {formData.serviceAreas.length === 0 && (
                  <span className="text-sm text-gray-500">No service areas added</span>
                )}
                {formData.serviceAreas.map((area) => (
                  <span key={area} className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                    {area}
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => handleRemoveServiceArea(area)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        x
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                name="description"
                rows={5}
                value={formData.description}
                onChange={handleFieldChange}
                readOnly={!isOwnProfile}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Describe your experience, specialties, and service quality standards."
              />
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photo</label>
              {isOwnProfile && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Past Work Gallery</label>
                {uploading && <span className="text-xs text-gray-500">Uploading...</span>}
              </div>
              {isOwnProfile && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`mb-3 border-2 border-dashed rounded-lg p-4 text-center transition-colors ${isDragging ? "border-orange-500 bg-orange-50" : "border-gray-300 bg-gray-50"}`}
                >
                  <p className="text-sm text-gray-700 mb-2">Drag and drop photos here or select files</p>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleGalleryUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  />
                </div>
              )}
              <div className="md:hidden">
                {formData.galleryPhotos.length > 1 && (
                  <div className="flex justify-end gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => scrollMobileGallery("prev")}
                      className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollMobileGallery("next")}
                      className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
                <div
                  ref={mobileGalleryRef}
                  onScroll={handleMobileGalleryScroll}
                  className="-mx-1 px-1 overflow-x-auto touch-pan-x"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div className="flex gap-3 snap-x snap-mandatory pb-1">
                    {formData.galleryPhotos.length === 0 && (
                      <p className="text-sm text-gray-500">No gallery photos uploaded yet</p>
                    )}
                    {formData.galleryPhotos.map((photo, index) => (
                      <div key={photo.id} className="w-64 flex-shrink-0 snap-start border border-gray-200 rounded-lg p-2 bg-white">
                        <img
                          src={photo.url}
                          alt={photo.name || "Gallery photo"}
                          className="w-full h-36 object-cover rounded-lg border border-gray-200 cursor-pointer"
                          onClick={() => openGalleryPreview(index)}
                        />
                        <p className="text-xs text-gray-600 mt-1 truncate">{photo.name}</p>
                        <input
                          type="text"
                          value={photo.caption || ""}
                          onChange={(event) => updateGalleryCaption(photo.id, event.target.value)}
                          readOnly={!isOwnProfile}
                          placeholder="Caption"
                          className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded"
                        />
                        {isOwnProfile && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => moveGalleryPhoto(photo.id, "up")}
                              disabled={index === 0}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGalleryPhoto(photo.id, "down")}
                              disabled={index === formData.galleryPhotos.length - 1}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() => removeGalleryPhoto(photo.id)}
                              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {formData.galleryPhotos.length > 1 && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Photo {activeGalleryIndex + 1} of {formData.galleryPhotos.length}</p>
                    <div className="flex gap-1">
                      {formData.galleryPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => {
                            const container = mobileGalleryRef.current
                            if (!container) return
                            container.scrollTo({ left: index * 268, behavior: "smooth" })
                          }}
                          className={`h-2 w-2 rounded-full ${index === activeGalleryIndex ? "bg-orange-600" : "bg-gray-300"}`}
                          aria-label={`Go to photo ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden md:grid grid-cols-2 md:grid-cols-3 gap-3">
                {formData.galleryPhotos.length === 0 && (
                  <p className="text-sm text-gray-500 col-span-full">No gallery photos uploaded yet</p>
                )}
                {formData.galleryPhotos.map((photo, index) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.url}
                      alt={photo.name || "Gallery photo"}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
                      onClick={() => openGalleryPreview(index)}
                    />
                    <p className="text-xs text-gray-600 mt-1 truncate">{photo.name}</p>
                    <input
                      type="text"
                      value={photo.caption || ""}
                      onChange={(event) => updateGalleryCaption(photo.id, event.target.value)}
                      readOnly={!isOwnProfile}
                      placeholder="Caption"
                      className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                    {isOwnProfile && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => moveGalleryPhoto(photo.id, "up")}
                          disabled={index === 0}
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveGalleryPhoto(photo.id, "down")}
                          disabled={index === formData.galleryPhotos.length - 1}
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGalleryPhoto(photo.id)}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isOwnProfile && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Licenses</label>
                  <textarea
                    name="licenses"
                    rows={3}
                    value={formData.licenses}
                    onChange={handleFieldChange}
                    readOnly={!isOwnProfile}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="List license types and numbers"
                  />
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Insurance Verification</h3>
                  <div className="space-y-3">
                    <input
                      name="insuranceProvider"
                      value={formData.insuranceProvider}
                      onChange={handleFieldChange}
                      readOnly={!isOwnProfile}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Insurance provider"
                    />
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="text-xs text-gray-600 mb-2">Upload legal insurance documentation for review (PDF, JPG, PNG).</p>
                      {isOwnProfile && (
                        <input
                          type="file"
                          multiple
                          accept={INSURANCE_ACCEPT_TYPES}
                          onChange={handleInsuranceUpload}
                          className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      )}
                      {uploadingInsurance && <p className="text-xs text-gray-500 mt-2">Uploading insurance documents...</p>}

                      <div className="mt-3 space-y-2">
                        {formData.insuranceDocuments.length === 0 && (
                          <p className="text-xs text-gray-500">No documents submitted yet.</p>
                        )}
                        {formData.insuranceDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 text-xs border border-gray-200 rounded px-2 py-1">
                            <div className="min-w-0">
                              <p className="truncate text-gray-700">{doc.name}</p>
                              <p className="text-gray-500">{formatDateTime(doc.uploadedAt)}</p>
                            </div>
                            {isOwnProfile && (
                              <button
                                type="button"
                                onClick={() => removeInsuranceDocument(doc.id)}
                                className="px-2 py-1 rounded bg-red-100 text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-gray-600">
                      Review status: {formData.insuranceReviewStatus === "approved" ? "Approved" : formData.insuranceReviewStatus === "pending_review" ? "Pending Review" : formData.insuranceReviewStatus === "rejected" ? "Rejected" : "Not Submitted"}
                    </p>
                    {canReviewInsurance && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleInsuranceReviewDecision("approved")}
                          className="px-3 py-1 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700"
                        >
                          Approve Documents
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsuranceReviewDecision("rejected")}
                          className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                        >
                          Reject Documents
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-gray-600">
                      Verification is completed by platform review after legal documentation is submitted.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {previewIndex >= 0 && formData.galleryPhotos[previewIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closeGalleryPreview}
        >
          <div
            className="max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handlePreviewTouchStart}
            onTouchEnd={handlePreviewTouchEnd}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-white/90">
                Photo {previewIndex + 1} of {formData.galleryPhotos.length}
              </p>
              <button
                type="button"
                className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                onClick={closeGalleryPreview}
              >
                Close
              </button>
            </div>
            <img
              src={formData.galleryPhotos[previewIndex].url}
              alt={formData.galleryPhotos[previewIndex].name || "Gallery photo"}
              className="w-full max-h-[80vh] object-contain rounded-lg bg-black"
            />
            {formData.galleryPhotos.length > 1 && (
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                  onClick={showPreviousPreview}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="text-white bg-black/40 px-3 py-1 rounded hover:bg-black/60"
                  onClick={showNextPreview}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}