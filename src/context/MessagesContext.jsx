import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { createUuid } from "../lib/uuid"

const MessagesContext = createContext()
const SYSTEM_EMAIL = "welcome@proskillset.app"
const TEAM_SIGNATURE = "— The ProSkillset Team"
const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

export function MessagesProvider({ children }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)

  const normalizeMessage = (message) => ({
    ...message,
    from: normalizeEmail(message.from),
    to: normalizeEmail(message.to),
    readBy: Array.isArray(message.readBy) ? message.readBy : [message.from],
    jobTitle: message.jobTitle || "",
    poNumber: message.poNumber || ""
  })

  const mapDatabaseRowToMessage = (row) => {
    if (!row || typeof row !== "object") return null

    return normalizeMessage({
      id: row.id,
      from: row.from_email || row.from || "",
      fromName: row.from_name || row.fromName || "",
      to: row.to_email || row.to || "",
      text: row.text || "",
      jobId: row.job_id ?? row.jobId ?? null,
      jobTitle: row.job_title || row.jobTitle || "",
      poNumber: row.po_number || row.poNumber || "",
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      readBy: Array.isArray(row.read_by) ? row.read_by : (Array.isArray(row.readBy) ? row.readBy : [])
    })
  }

  const serializeMessageForDatabase = (message) => ({
    id: message.id,
    from_email: normalizeEmail(message.from),
    from_name: message.fromName || "",
    to_email: normalizeEmail(message.to),
    text: message.text || "",
    job_id: message.jobId ?? null,
    job_title: String(message.jobTitle || "").trim(),
    po_number: String(message.poNumber || "").trim(),
    created_at: message.createdAt || new Date().toISOString(),
    read_by: Array.isArray(message.readBy) ? message.readBy : []
  })

  const loadMessagesFromStorage = () => {
    const stored = localStorage.getItem("messages")
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map(normalizeMessage) : []
  }

  const loadMessagesFromSupabase = async (currentUser) => {
    if (!isSupabaseConfigured || !currentUser?.email) return null

    try {
      const userEmail = normalizeEmail(currentUser.email)
      const isCurrentUserAdmin = currentUser?.role === "admin"
      const relevantEmails = isCurrentUserAdmin
        ? [userEmail, normalizeEmail(SYSTEM_EMAIL)]
        : [userEmail]

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(relevantEmails.map((email) => `from_email.eq.${email},to_email.eq.${email}`).join(","))

      if (error) return null

      return (Array.isArray(data) ? data : [])
        .map(mapDatabaseRowToMessage)
        .filter(Boolean)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    } catch {
      return null
    }
  }

  const persistMessagesToSupabase = async (outboundMessages) => {
    if (!isSupabaseConfigured || !Array.isArray(outboundMessages) || outboundMessages.length === 0) return

    try {
      const { error } = await supabase
        .from("messages")
        .upsert(outboundMessages.map(serializeMessageForDatabase), { onConflict: "id" })

      if (error) {
        console.error("Failed to persist messages to Supabase:", error)
      }
    } catch {
      // No-op: local state remains the fallback source.
      console.error("Unexpected error while persisting messages to Supabase")
    }
  }

  const updateReadByInSupabase = async (messageId, readBy) => {
    if (!isSupabaseConfigured) return

    try {
      await supabase
        .from("messages")
        .update({ read_by: Array.isArray(readBy) ? readBy : [] })
        .eq("id", messageId)
    } catch {
      // No-op: local state remains the fallback source.
    }
  }

  useEffect(() => {
    setMessages(loadMessagesFromStorage())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem("messages", JSON.stringify(messages))
  }, [messages, isHydrated])

  useEffect(() => {
    if (!isHydrated || !user) return

    const hydrate = async () => {
      const supabaseMessages = await loadMessagesFromSupabase(user)
      const nextMessages = supabaseMessages ?? loadMessagesFromStorage()
      setMessages(nextMessages)
      localStorage.setItem("messages", JSON.stringify(nextMessages))
    }

    void hydrate()
  }, [user, isHydrated])

  // Admins send as the ProSkillset Team identity so replies stay in the same thread
  const isAdmin = user?.role === "admin"
  const effectiveSenderEmail = normalizeEmail(isAdmin ? SYSTEM_EMAIL : user?.email)
  const effectiveSenderName = isAdmin ? "ProSkillset Team" : user?.name

  const formatOutboundText = (text) => {
    const trimmed = String(text || "").trim()
    if (!trimmed) return ""

    if (!isAdmin || effectiveSenderEmail !== SYSTEM_EMAIL) {
      return trimmed
    }

    const normalized = trimmed.replace(/\s+/g, " ").toLowerCase()
    const signatureNormalized = TEAM_SIGNATURE.replace(/\s+/g, " ").toLowerCase()
    if (normalized.endsWith(signatureNormalized)) {
      return trimmed
    }

    return `${trimmed}\n\n${TEAM_SIGNATURE}`
  }

  const sendMessage = ({ to, text, jobId = null, jobTitle = "", poNumber = "" }) => {
    if (!user || !to || !text?.trim()) return

    const outboundText = formatOutboundText(text)

    const message = normalizeMessage({
      id: createUuid(),
      from: effectiveSenderEmail,
      fromName: effectiveSenderName,
      to,
      text: outboundText,
      jobId,
      jobTitle: String(jobTitle || "").trim(),
      poNumber: String(poNumber || "").trim(),
      createdAt: new Date().toISOString(),
      readBy: [effectiveSenderEmail]
    })

    setMessages((prev) => [...prev, message])
    void persistMessagesToSupabase([message])
  }

  const sendBulkMessages = ({ recipients = [], text, jobId = null, jobTitle = "", poNumber = "" }) => {
    if (!user || !text?.trim()) return { sentCount: 0 }

    const outboundText = formatOutboundText(text)

    const uniqueRecipients = Array.from(new Set(
      recipients
        .map((recipient) => String(recipient || "").trim().toLowerCase())
        .filter(Boolean)
        .filter((recipient) => recipient !== String(user.email || "").trim().toLowerCase())
    ))

    if (uniqueRecipients.length === 0) return { sentCount: 0 }

    const outbound = uniqueRecipients.map((to, index) => normalizeMessage({
      id: createUuid(),
      from: effectiveSenderEmail,
      fromName: effectiveSenderName,
      to,
      text: outboundText,
      jobId,
      jobTitle: String(jobTitle || "").trim(),
      poNumber: String(poNumber || "").trim(),
      createdAt: new Date(Date.now() + index).toISOString(),
      readBy: [effectiveSenderEmail]
    }))

    setMessages((prev) => [...prev, ...outbound])
    void persistMessagesToSupabase(outbound)
    return { sentCount: outbound.length }
  }

  const getConversation = (otherEmail) => {
    if (!user || !otherEmail) return []

    // Admins see both their direct messages and SYSTEM_EMAIL messages with otherEmail
    const myEmails = isAdmin ? [user.email, SYSTEM_EMAIL] : [user.email]

    return messages
      .filter(
        (message) =>
          (myEmails.includes(message.from) && message.to === otherEmail) ||
          (message.from === otherEmail && myEmails.includes(message.to))
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }

  const getUnreadCount = (otherEmail) => {
    if (!user || !otherEmail) return 0

    const myEmails = isAdmin ? [user.email, SYSTEM_EMAIL] : [user.email]

    return messages.filter(
      (message) =>
        message.from === otherEmail &&
        myEmails.includes(message.to) &&
        !message.readBy.includes(user.email)
    ).length
  }

  const getTotalUnreadCount = () => {
    if (!user) return 0

    const myEmails = isAdmin ? [user.email, SYSTEM_EMAIL] : [user.email]

    return messages.filter(
      (message) => myEmails.includes(message.to) && !message.readBy.includes(user.email)
    ).length
  }

  const markConversationRead = (otherEmail) => {
    if (!user || !otherEmail) return

    const myEmails = isAdmin ? [user.email, SYSTEM_EMAIL] : [user.email]

    const changedMessages = []

    setMessages((prev) => {
      let hasChanges = false

      const next = prev.map((message) => {
        const isConversationMessage =
          message.from === otherEmail &&
          myEmails.includes(message.to) &&
          !message.readBy.includes(user.email)

        if (!isConversationMessage) return message

        hasChanges = true
        const updatedMessage = {
          ...message,
          readBy: [...message.readBy, user.email]
        }
        changedMessages.push(updatedMessage)
        return updatedMessage
      })

      return hasChanges ? next : prev
    })

    if (changedMessages.length > 0) {
      changedMessages.forEach((message) => {
        void updateReadByInSupabase(message.id, message.readBy)
      })
    }
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        sendMessage,
        sendBulkMessages,
        getConversation,
        getUnreadCount,
        getTotalUnreadCount,
        markConversationRead
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error("useMessages must be used within a MessagesProvider")
  }
  return context
}
