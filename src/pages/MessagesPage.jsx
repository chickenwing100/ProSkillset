import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useJobs } from "../context/JobsContext"
import { useMessages } from "../context/MessagesContext"
import { formatDateTime } from "../lib/dateTime"

const SYSTEM_EMAIL = "welcome@proskillset.app"

function renderMessageText(text) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function MessagesPage() {
  const { user, getUserProfile } = useAuth()
  const { jobs } = useJobs()
  const { messages, sendMessage, getConversation, getUnreadCount, markConversationRead } = useMessages()
  const [selectedEmail, setSelectedEmail] = useState("")
  const [draft, setDraft] = useState("")

  const contacts = useMemo(() => {
    if (!user) return []

    const contactMap = new Map()

    const normalizeEmail = (value) => String(value || "").trim().toLowerCase()
    const isEmailLike = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
    const formatProjectReference = (poNumber, jobTitle) => {
      const cleanedPo = String(poNumber || "").trim()
      const cleanedTitle = String(jobTitle || "").trim()
      if (cleanedPo && cleanedTitle) return `PO# ${cleanedPo} / ${cleanedTitle}`
      if (cleanedPo) return `PO# ${cleanedPo}`
      if (cleanedTitle) return cleanedTitle
      return ""
    }

    const jobsById = new Map(
      jobs.map((job) => [Number(job.id), job])
    )

    const resolveNameByEmail = (email, fallbackName = "") => {
      const normalizedEmail = normalizeEmail(email)
      if (!normalizedEmail) return "User"

      const profile = getUserProfile(normalizedEmail) || {}
      const profileName = profile.name || profile.full_name || profile.contractorName || profile.businessName || ""
      const candidate = String(profileName || fallbackName || "").trim()

      if (candidate && !isEmailLike(candidate)) {
        return candidate
      }

      if (profile.role === "client") return "Client"
      if (profile.role === "contractor") return "Contractor"
      return "User"
    }

    const upsertContact = ({ email, name, project }) => {
      const normalizedEmail = normalizeEmail(email)
      if (!normalizedEmail) return

      const existing = contactMap.get(normalizedEmail)
      const existingName = existing?.name || ""
      const nextName = resolveNameByEmail(normalizedEmail, name)

      const shouldUseNextName = !existingName || isEmailLike(existingName) || existingName === "User"

      const nextProject = String(project || "").trim()
      const existingProject = String(existing?.project || "").trim()

      contactMap.set(normalizedEmail, {
        email: normalizedEmail,
        name: shouldUseNextName ? nextName : existingName,
        project: nextProject && existingProject === "Direct conversation"
          ? nextProject
          : (existingProject || nextProject || "Direct conversation")
      })
    }

    jobs.forEach((job) => {
      if (job.postedBy === user.email) {
        job.applications.forEach((application) => {
          upsertContact({
            email: application.applicant,
            name: application.applicantName,
            project: job.title
          })
        })
      }

      if (user.role === "contractor") {
        const hasRelationship = job.applications.some((application) => application.applicant === user.email)
        if (hasRelationship) {
          upsertContact({
            email: job.postedBy,
            name: job.postedByName || job.clientName,
            project: job.title
          })
        }
      }
    })

    const isAdmin = user?.role === "admin"
    const myEmails = isAdmin ? [user.email, SYSTEM_EMAIL] : [user.email]

    messages.forEach((message) => {
      const isMyMessage = myEmails.includes(message.from) || myEmails.includes(message.to)
      if (!isMyMessage) return

      const otherEmail = myEmails.includes(message.from) ? message.to : message.from
      if (!otherEmail || myEmails.includes(otherEmail)) return

      const guessedName = myEmails.includes(message.from) ? message.toName : message.fromName
      const linkedJob = jobsById.get(Number(message.jobId))
      const reference = formatProjectReference(
        message.poNumber || linkedJob?.poNumber,
        message.jobTitle || linkedJob?.title
      )
      upsertContact({
        email: otherEmail,
        name: guessedName || (otherEmail === SYSTEM_EMAIL ? "ProSkillset Team" : undefined),
        project: reference || "Direct conversation"
      })
    })

    return Array.from(contactMap.values())
  }, [jobs, messages, user, getUserProfile])

  useEffect(() => {
    if (!selectedEmail && contacts.length > 0) {
      setSelectedEmail(contacts[0].email)
    }
  }, [contacts, selectedEmail])

  useEffect(() => {
    if (selectedEmail) {
      markConversationRead(selectedEmail)
    }
  }, [selectedEmail])

  const conversation = getConversation(selectedEmail)
  const roleTheme = user?.role === "contractor"
    ? {
        accent: "text-orange-700",
        selected: "bg-orange-50 border-orange-200",
        button: "bg-orange-600 hover:bg-orange-700"
      }
    : {
        accent: "text-blue-700",
        selected: "bg-blue-50 border-blue-200",
        button: "bg-blue-600 hover:bg-blue-700"
      }

  const handleSend = () => {
    if (!selectedEmail || !draft.trim()) return
    sendMessage({ to: selectedEmail, text: draft })
    setDraft("")
  }

  const formatProjectReference = (poNumber, jobTitle) => {
    const cleanedPo = String(poNumber || "").trim()
    const cleanedTitle = String(jobTitle || "").trim()
    if (cleanedPo && cleanedTitle) return `PO# ${cleanedPo} / ${cleanedTitle}`
    if (cleanedPo) return `PO# ${cleanedPo}`
    if (cleanedTitle) return cleanedTitle
    return ""
  }

  const selectedContact = contacts.find((contact) => contact.email === selectedEmail)

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[70vh] lg:min-h-[600px]">
          <div className="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
            <h1 className={`text-xl font-semibold mb-4 ${roleTheme.accent}`}>Messages</h1>
            <div className="max-h-64 space-y-2 overflow-y-auto lg:max-h-none">
              {contacts.length === 0 && <p className="text-sm text-gray-500">No conversations yet.</p>}
              {contacts.map((contact) => {
                const unread = getUnreadCount(contact.email)
                const isActive = selectedEmail === contact.email
                return (
                  <button
                    key={contact.email}
                    onClick={() => setSelectedEmail(contact.email)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${isActive ? roleTheme.selected : "border-gray-100 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">{contact.name}</span>
                      {unread > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${user?.role === "contractor" ? "bg-orange-600" : "bg-blue-600"}`}>
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">{contact.project}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4 flex flex-col">
            {selectedEmail ? (
              <>
                {selectedContact?.project && selectedContact.project !== "Direct conversation" && (
                  <p className="text-xs text-gray-500 mb-3">Reference: {selectedContact.project}</p>
                )}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {conversation.length === 0 ? (
                    <p className="text-sm text-gray-500">No messages yet. Start the conversation.</p>
                  ) : (
                    conversation.map((message) => {
                      const mine = message.from === user.email || (user?.role === "admin" && message.from === SYSTEM_EMAIL)
                      const linkedJob = jobs.find((job) => Number(job.id) === Number(message.jobId))
                      const messageReference = formatProjectReference(
                        message.poNumber || linkedJob?.poNumber,
                        message.jobTitle || linkedJob?.title
                      )
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[90%] rounded-lg px-4 py-2 text-sm sm:max-w-[75%] ${mine ? `${user?.role === "contractor" ? "bg-orange-600" : "bg-blue-600"} text-white` : "bg-gray-100 text-gray-800"}`}>
                            {messageReference && (
                              <p className={`text-xs mb-1 ${mine ? "text-white/80" : "text-gray-500"}`}>
                                {messageReference}
                              </p>
                            )}
                            <p className="whitespace-pre-line">{renderMessageText(message.text)}</p>
                            <p className={`text-xs mt-1 ${mine ? "text-white/80" : "text-gray-500"}`}>
                              {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none"
                  />
                  <button onClick={handleSend} className={`px-4 py-2 text-white rounded-lg ${roleTheme.button}`}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">Select a conversation to start messaging.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
