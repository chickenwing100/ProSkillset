const SYSTEM_SENDER = {
  email: "welcome@proskillset.app",
  name: "ProSkillset Team"
}

export const WELCOME_MESSAGE_TEMPLATES = {
  contractor: [
    `👋 Welcome to ProSkillset!

First off — thank you for joining us as one of the early contractors on the platform. We're building ProSkillset to support small, owner-operated crews and independent tradespeople like you.

Our mission is simple:
**Rebuild the local economy by giving skilled trades professionals fair access to real work — without lead fees or bidding wars.**

Right now you're part of the early group helping shape the platform here in the Treasure Valley. As you explore the project feed and contractor tools, we'd genuinely love to hear your thoughts.

If you notice anything confusing, broken, or that could be improved, please send us a quick message. Your feedback will directly help us make ProSkillset better for contractors like you.

Thanks again for being part of the launch.

— The ProSkillset Team`,
    "What's the one feature that would make ProSkillset most useful for your business?"
  ],
  client: [
    `👋 Welcome to ProSkillset!

Thank you for joining our growing community here in the Treasure Valley.

ProSkillset was created to make it easier to connect with **local, skilled contractors** without the frustration of bidding wars or lead marketplaces.

Our mission is to **rebuild the local economy by supporting small, owner-operated contractors and making it easier for homeowners to find trusted help.**

As you browse contractors or post projects, we'd love to hear about your experience. If you run into anything that feels confusing or could be improved, please send us a message. Your feedback helps us build a better platform for the entire community.

Thanks again for being here.

— The ProSkillset Team`,
    "What made you decide to try ProSkillset today?"
  ]
}

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()
const normalizeRole = (value) => String(value || "").trim().toLowerCase()

const getStorageMessages = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("messages") || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const setStorageMessages = (messages) => {
  localStorage.setItem("messages", JSON.stringify(messages))
}

const getSentRegistry = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("automatedWelcomeSentV1") || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const setSentRegistry = (registry) => {
  localStorage.setItem("automatedWelcomeSentV1", JSON.stringify(registry))
}

export const queueAutomatedWelcomeMessages = ({ email, role, force = false }) => {
  const normalizedEmail = normalizeEmail(email)
  const normalizedRole = normalizeRole(role)

  if (!normalizedEmail || !normalizedRole) return { sentCount: 0 }

  const templates = WELCOME_MESSAGE_TEMPLATES[normalizedRole]
  if (!Array.isArray(templates) || templates.length === 0) return { sentCount: 0 }

  const registryKey = `${normalizedRole}:${normalizedEmail}`
  const sentRegistry = getSentRegistry()
  if (!force && sentRegistry[registryKey]) return { sentCount: 0 }

  const now = Date.now()
  const outbound = templates
    .map((text, index) => String(text || "").trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: now + index,
      from: SYSTEM_SENDER.email,
      fromName: SYSTEM_SENDER.name,
      to: normalizedEmail,
      text,
      jobId: null,
      jobTitle: "",
      poNumber: "",
      createdAt: new Date(now + index).toISOString(),
      readBy: [SYSTEM_SENDER.email]
    }))

  if (!outbound.length) return { sentCount: 0 }

  const existingMessages = getStorageMessages()
  setStorageMessages([...existingMessages, ...outbound])

  sentRegistry[registryKey] = true
  setSentRegistry(sentRegistry)

  return { sentCount: outbound.length }
}
