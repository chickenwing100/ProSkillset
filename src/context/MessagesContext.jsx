import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"

const MessagesContext = createContext()
const SYSTEM_EMAIL = "welcome@proskillset.app"
const TEAM_SIGNATURE = "— The ProSkillset Team"

export function MessagesProvider({ children }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)

  const normalizeMessage = (message) => ({
    ...message,
    readBy: Array.isArray(message.readBy) ? message.readBy : [message.from],
    jobTitle: message.jobTitle || "",
    poNumber: message.poNumber || ""
  })

  const loadMessagesFromStorage = () => {
    const stored = localStorage.getItem("messages")
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map(normalizeMessage) : []
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
    setMessages(loadMessagesFromStorage())
  }, [user, isHydrated])

  // Admins send as the ProSkillset Team identity so replies stay in the same thread
  const isAdmin = user?.role === "admin"
  const effectiveSenderEmail = isAdmin ? SYSTEM_EMAIL : user?.email
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
      id: Date.now(),
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

    const createdAtBase = Date.now()
    const outbound = uniqueRecipients.map((to, index) => normalizeMessage({
      id: createdAtBase + index,
      from: effectiveSenderEmail,
      fromName: effectiveSenderName,
      to,
      text: outboundText,
      jobId,
      jobTitle: String(jobTitle || "").trim(),
      poNumber: String(poNumber || "").trim(),
      createdAt: new Date(createdAtBase + index).toISOString(),
      readBy: [effectiveSenderEmail]
    }))

    setMessages((prev) => [...prev, ...outbound])
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

    setMessages((prev) => {
      let hasChanges = false

      const next = prev.map((message) => {
        const isConversationMessage =
          message.from === otherEmail &&
          myEmails.includes(message.to) &&
          !message.readBy.includes(user.email)

        if (!isConversationMessage) return message

        hasChanges = true
        return {
          ...message,
          readBy: [...message.readBy, user.email]
        }
      })

      return hasChanges ? next : prev
    })
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
