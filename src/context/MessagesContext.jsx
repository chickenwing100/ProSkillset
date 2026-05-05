import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { createUuid } from "../lib/uuid"

const MessagesContext = createContext()
const SYSTEM_EMAIL = "welcome@proskillset.app"
const TEAM_SIGNATURE = "— The ProSkillset Team"
const normalizeEmail = (value) => String(value || "").trim().toLowerCase()
const MESSAGE_METADATA_SELECT_COLUMNS = "id,from_email,from_name,to_email,job_id,job_title,po_number,created_at,read_by"
const MESSAGE_WINDOW_SELECT_COLUMNS = `${MESSAGE_METADATA_SELECT_COLUMNS},text`
const MESSAGE_PAGE_SIZE = 25
const STORAGE_KEY = "messages"

const sortMessagesAscending = (collection) => [...collection].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))

const mergeUniqueMessages = (existingMessages, incomingMessages) => {
  const deduped = new Map()

  ;[...(Array.isArray(existingMessages) ? existingMessages : []), ...(Array.isArray(incomingMessages) ? incomingMessages : [])].forEach((message) => {
    if (!message?.id) return
    deduped.set(message.id, message)
  })

  return sortMessagesAscending(Array.from(deduped.values()))
}

const toCachedMessages = (conversationWindows) => {
  const deduped = new Map()

  Object.values(conversationWindows || {}).forEach((windowState) => {
    ;(windowState?.messages || []).forEach((message) => {
      if (!message?.id) return
      deduped.set(message.id, message)
    })
  })

  return sortMessagesAscending(Array.from(deduped.values()))
}

const buildMyEmails = (currentUser) => {
  const primaryEmail = normalizeEmail(currentUser?.email)
  if (!primaryEmail) return []
  return currentUser?.role === "admin"
    ? Array.from(new Set([primaryEmail, normalizeEmail(SYSTEM_EMAIL)]))
    : [primaryEmail]
}

const toContactConversationKey = (otherEmail) => `contact:${normalizeEmail(otherEmail)}`
const toProjectConversationKey = ({ jobId, participants = [] }) => {
  const normalizedParticipants = Array.from(new Set(participants.map(normalizeEmail).filter(Boolean))).sort()
  return `project:${String(jobId || "").trim()}:${normalizedParticipants.join(":")}`
}

const createEmptyWindowState = () => ({
  messages: [],
  isLoading: false,
  hasMore: false,
  hasLoadedInitial: false,
  oldestCreatedAt: null
})

export function MessagesProvider({ children }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [conversationWindows, setConversationWindows] = useState({})
  const [isHydrated, setIsHydrated] = useState(false)

  const normalizeMessage = (message) => ({
    ...message,
    from: normalizeEmail(message.from),
    to: normalizeEmail(message.to),
    readBy: Array.isArray(message.readBy) ? message.readBy : [message.from],
    jobTitle: message.jobTitle || "",
    poNumber: message.poNumber || ""
  })

  const toMessageMetadata = (message) => ({
    ...normalizeMessage(message),
    text: undefined
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
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.map(normalizeMessage) : []
  }

  const buildConversationWindowsFromStorage = (storedMessages, currentUser) => {
    const myEmails = buildMyEmails(currentUser)
    if (myEmails.length === 0) return {}

    return storedMessages.reduce((accumulator, message) => {
      const otherEmail = myEmails.includes(message.from) ? message.to : message.from
      const normalizedOtherEmail = normalizeEmail(otherEmail)

      if (!normalizedOtherEmail || myEmails.includes(normalizedOtherEmail)) {
        return accumulator
      }

      const key = toContactConversationKey(normalizedOtherEmail)
      const existingWindow = accumulator[key] || createEmptyWindowState()
      const mergedMessages = mergeUniqueMessages(existingWindow.messages, [message])

      accumulator[key] = {
        ...existingWindow,
        messages: mergedMessages,
        hasLoadedInitial: mergedMessages.length > 0,
        hasMore: false,
        oldestCreatedAt: mergedMessages[0]?.createdAt || null
      }

      return accumulator
    }, {})
  }

  const loadMessageMetadataFromSupabase = async (currentUser) => {
    if (!isSupabaseConfigured || !currentUser?.email) return null

    try {
      const relevantEmails = buildMyEmails(currentUser)

      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_METADATA_SELECT_COLUMNS)
        .or(relevantEmails.map((email) => `from_email.eq.${email},to_email.eq.${email}`).join(","))
        .order("created_at", { ascending: true })

      if (error) return null

      return (Array.isArray(data) ? data : [])
        .map(mapDatabaseRowToMessage)
        .filter(Boolean)
        .map(toMessageMetadata)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    } catch {
      return null
    }
  }

  const buildConversationFilter = ({ currentUser, otherEmail, participants = [] }) => {
    const normalizedOtherEmail = normalizeEmail(otherEmail)
    if (normalizedOtherEmail) {
      return buildMyEmails(currentUser)
        .flatMap((myEmail) => [
          `and(from_email.eq.${myEmail},to_email.eq.${normalizedOtherEmail})`,
          `and(from_email.eq.${normalizedOtherEmail},to_email.eq.${myEmail})`
        ])
        .join(",")
    }

    const normalizedParticipants = Array.from(new Set(participants.map(normalizeEmail).filter(Boolean)))
    if (normalizedParticipants.length < 2) return ""

    const [firstParticipant, secondParticipant] = normalizedParticipants.sort()
    return [
      `and(from_email.eq.${firstParticipant},to_email.eq.${secondParticipant})`,
      `and(from_email.eq.${secondParticipant},to_email.eq.${firstParticipant})`
    ].join(",")
  }

  const loadConversationWindowFromSupabase = async ({
    currentUser,
    otherEmail = "",
    participants = [],
    jobId = null,
    cursorBefore = null
  }) => {
    if (!isSupabaseConfigured || !currentUser?.email) return null

    const conversationFilter = buildConversationFilter({ currentUser, otherEmail, participants })
    if (!conversationFilter) return []

    try {
      let query = supabase
        .from("messages")
        .select(MESSAGE_WINDOW_SELECT_COLUMNS)
        .or(conversationFilter)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_PAGE_SIZE)

      if (jobId != null && String(jobId).trim()) {
        query = query.eq("job_id", jobId)
      }

      if (cursorBefore) {
        query = query.lt("created_at", cursorBefore)
      }

      const { data, error } = await query
      if (error) return null

      return sortMessagesAscending(
        (Array.isArray(data) ? data : [])
          .map(mapDatabaseRowToMessage)
          .filter(Boolean)
      )
    } catch {
      return null
    }
  }

  const setWindowLoadingState = (conversationKey, nextIsLoading) => {
    setConversationWindows((prev) => {
      const existingWindow = prev[conversationKey] || createEmptyWindowState()
      return {
        ...prev,
        [conversationKey]: {
          ...existingWindow,
          isLoading: nextIsLoading
        }
      }
    })
  }

  const hydrateWindowState = ({ conversationKey, incomingMessages, append }) => {
    setConversationWindows((prev) => {
      const existingWindow = prev[conversationKey] || createEmptyWindowState()
      const mergedMessages = append
        ? mergeUniqueMessages(existingWindow.messages, incomingMessages)
        : mergeUniqueMessages(incomingMessages, existingWindow.messages)

      return {
        ...prev,
        [conversationKey]: {
          ...existingWindow,
          messages: mergedMessages,
          isLoading: false,
          hasLoadedInitial: true,
          hasMore: Array.isArray(incomingMessages) && incomingMessages.length === MESSAGE_PAGE_SIZE,
          oldestCreatedAt: mergedMessages[0]?.createdAt || null
        }
      }
    })
  }

  const loadConversation = async (otherEmail, options = {}) => {
    if (!user || !otherEmail) return []

    const conversationKey = toContactConversationKey(otherEmail)
    const existingWindow = conversationWindows[conversationKey] || createEmptyWindowState()
    const append = Boolean(options.append)
    const cursorBefore = append ? existingWindow.oldestCreatedAt : null

    if (existingWindow.isLoading) return existingWindow.messages
    if (!append && existingWindow.hasLoadedInitial && !options.force) {
      return existingWindow.messages
    }
    if (append && (!existingWindow.hasLoadedInitial || !existingWindow.hasMore || !cursorBefore)) {
      return existingWindow.messages
    }

    setWindowLoadingState(conversationKey, true)

    const supabaseMessages = await loadConversationWindowFromSupabase({
      currentUser: user,
      otherEmail,
      cursorBefore
    })

    if (supabaseMessages == null) {
      setWindowLoadingState(conversationKey, false)
      return existingWindow.messages
    }

    hydrateWindowState({ conversationKey, incomingMessages: supabaseMessages, append })
    return mergeUniqueMessages(existingWindow.messages, supabaseMessages)
  }

  const loadProjectConversation = async ({ jobId, participants = [] } = {}, options = {}) => {
    if (!user || !jobId || !Array.isArray(participants) || participants.length < 2) return []

    const conversationKey = toProjectConversationKey({ jobId, participants })
    const existingWindow = conversationWindows[conversationKey] || createEmptyWindowState()
    const append = Boolean(options.append)
    const cursorBefore = append ? existingWindow.oldestCreatedAt : null

    if (existingWindow.isLoading) return existingWindow.messages
    if (!append && existingWindow.hasLoadedInitial && !options.force) {
      return existingWindow.messages
    }
    if (append && (!existingWindow.hasLoadedInitial || !existingWindow.hasMore || !cursorBefore)) {
      return existingWindow.messages
    }

    setWindowLoadingState(conversationKey, true)

    const supabaseMessages = await loadConversationWindowFromSupabase({
      currentUser: user,
      participants,
      jobId,
      cursorBefore
    })

    if (supabaseMessages == null) {
      setWindowLoadingState(conversationKey, false)
      return existingWindow.messages
    }

    hydrateWindowState({ conversationKey, incomingMessages: supabaseMessages, append })
    return mergeUniqueMessages(existingWindow.messages, supabaseMessages)
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
    const storedMessages = loadMessagesFromStorage()
    setMessages(storedMessages.map(toMessageMetadata))
    setConversationWindows(buildConversationWindowsFromStorage(storedMessages, user))
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toCachedMessages(conversationWindows)))
  }, [conversationWindows, isHydrated])

  useEffect(() => {
    if (!isHydrated || !user) return

    const storedMessages = loadMessagesFromStorage()
    if (storedMessages.length > 0) {
      setConversationWindows((prev) => Object.keys(prev).length > 0 ? prev : buildConversationWindowsFromStorage(storedMessages, user))
    }

    const hydrate = async () => {
      const supabaseMessages = await loadMessageMetadataFromSupabase(user)
      const nextMessages = supabaseMessages ?? loadMessagesFromStorage().map(toMessageMetadata)
      setMessages(nextMessages)
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

  const appendMessagesToState = (outboundMessages) => {
    if (!Array.isArray(outboundMessages) || outboundMessages.length === 0) return

    const myEmails = buildMyEmails(user)

    setMessages((prev) => mergeUniqueMessages(prev, outboundMessages.map(toMessageMetadata)))
    setConversationWindows((prev) => {
      const next = { ...prev }

      outboundMessages.forEach((message) => {
        const normalizedFrom = normalizeEmail(message.from)
        const normalizedTo = normalizeEmail(message.to)
        const otherEmail = myEmails.includes(normalizedFrom) ? normalizedTo : normalizedFrom

        if (otherEmail && !myEmails.includes(otherEmail)) {
          const contactKey = toContactConversationKey(otherEmail)
          const existingContactWindow = next[contactKey] || createEmptyWindowState()
          next[contactKey] = {
            ...existingContactWindow,
            messages: mergeUniqueMessages(existingContactWindow.messages, [message]),
            hasLoadedInitial: existingContactWindow.hasLoadedInitial || myEmails.includes(normalizedFrom),
            oldestCreatedAt: mergeUniqueMessages(existingContactWindow.messages, [message])[0]?.createdAt || existingContactWindow.oldestCreatedAt
          }
        }

        if (message.jobId && normalizedFrom && normalizedTo) {
          const projectKey = toProjectConversationKey({
            jobId: message.jobId,
            participants: [normalizedFrom, normalizedTo]
          })
          const existingProjectWindow = next[projectKey] || createEmptyWindowState()
          next[projectKey] = {
            ...existingProjectWindow,
            messages: mergeUniqueMessages(existingProjectWindow.messages, [message]),
            hasLoadedInitial: existingProjectWindow.hasLoadedInitial || normalizedFrom === effectiveSenderEmail,
            oldestCreatedAt: mergeUniqueMessages(existingProjectWindow.messages, [message])[0]?.createdAt || existingProjectWindow.oldestCreatedAt
          }
        }
      })

      return next
    })
  }

  const sendMessage = async ({ to, text, jobId = null, jobTitle = "", poNumber = "" }) => {
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

    appendMessagesToState([message])
    void persistMessagesToSupabase([message])
    return message
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

    appendMessagesToState(outbound)
    void persistMessagesToSupabase(outbound)
    return { sentCount: outbound.length }
  }

  const getConversation = (otherEmail) => {
    if (!user || !otherEmail) return []
    return conversationWindows[toContactConversationKey(otherEmail)]?.messages || []
  }

  const getProjectConversation = ({ jobId, participants = [] } = {}) => {
    if (!jobId || !Array.isArray(participants) || participants.length < 2) return []
    return conversationWindows[toProjectConversationKey({ jobId, participants })]?.messages || []
  }

  const getUnreadCount = (otherEmail) => {
    if (!user || !otherEmail) return 0

    const myEmails = buildMyEmails(user)

    return messages.filter(
      (message) =>
        message.from === otherEmail &&
        myEmails.includes(message.to) &&
        !message.readBy.includes(user.email)
    ).length
  }

  const getTotalUnreadCount = () => {
    if (!user) return 0

    const myEmails = buildMyEmails(user)

    return messages.filter(
      (message) => myEmails.includes(message.to) && !message.readBy.includes(user.email)
    ).length
  }

  const markConversationRead = (otherEmail) => {
    if (!user || !otherEmail) return

    const myEmails = buildMyEmails(user)

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

    setConversationWindows((prev) => {
      let hasChanges = false

      const next = Object.entries(prev).reduce((accumulator, [key, windowState]) => {
        const nextMessages = (windowState?.messages || []).map((message) => {
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

        accumulator[key] = hasChanges
          ? { ...windowState, messages: nextMessages }
          : windowState

        return accumulator
      }, {})

      return hasChanges ? next : prev
    })

    if (changedMessages.length > 0) {
      changedMessages.forEach((message) => {
        void updateReadByInSupabase(message.id, message.readBy)
      })
    }
  }

  const isConversationLoading = (otherEmail) => Boolean(conversationWindows[toContactConversationKey(otherEmail)]?.isLoading)
  const hasMoreConversation = (otherEmail) => Boolean(conversationWindows[toContactConversationKey(otherEmail)]?.hasMore)
  const isProjectConversationLoading = ({ jobId, participants = [] } = {}) => Boolean(
    conversationWindows[toProjectConversationKey({ jobId, participants })]?.isLoading
  )
  const hasMoreProjectConversation = ({ jobId, participants = [] } = {}) => Boolean(
    conversationWindows[toProjectConversationKey({ jobId, participants })]?.hasMore
  )

  return (
    <MessagesContext.Provider
      value={{
        messages,
        sendMessage,
        sendBulkMessages,
        getConversation,
        getProjectConversation,
        loadConversation,
        loadProjectConversation,
        isConversationLoading,
        hasMoreConversation,
        isProjectConversationLoading,
        hasMoreProjectConversation,
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
