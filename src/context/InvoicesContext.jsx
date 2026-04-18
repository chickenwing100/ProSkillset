import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"

const InvoicesContext = createContext()

const STORAGE_KEY = "invoices_v1"

const normalizeEmail = (value) => (value || "").trim().toLowerCase()
const normalizeRelatedJobId = (value) => {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

const normalizeInvoice = (invoice) => ({
  id: invoice.id,
  contractorEmail: normalizeEmail(invoice.contractorEmail || invoice.contractor_email),
  contractorName: invoice.contractorName || invoice.contractor_name || "",
  clientEmail: normalizeEmail(invoice.clientEmail || invoice.client_email),
  clientName: invoice.clientName || invoice.client_name || "",
  description: invoice.description || "",
  amount: Number(invoice.amount || 0),
  dueDate: invoice.dueDate || invoice.due_date || "",
  relatedJobId: normalizeRelatedJobId(invoice.relatedJobId ?? invoice.related_job_id),
  relatedJobTitle: invoice.relatedJobTitle || invoice.related_job_title || "",
  relatedJobPoNumber: invoice.relatedJobPoNumber || invoice.related_job_po_number || "",
  paymentStage: String(invoice.paymentStage || invoice.payment_stage || "full").toLowerCase(),
  attachments: Array.isArray(invoice.attachments) ? invoice.attachments : [],
  status: String(invoice.status || "draft").toLowerCase(),
  paymentMethod: String(invoice.paymentMethod || invoice.payment_method || ""),
  paymentReference: invoice.paymentReference || invoice.payment_reference || "",
  paidAmount: Number(invoice.paidAmount || invoice.paid_amount || invoice.amount || 0),
  paidByName: invoice.paidByName || invoice.paid_by_name || "",
  createdAt: invoice.createdAt || invoice.created_at || new Date().toISOString(),
  updatedAt: invoice.updatedAt || invoice.updated_at || new Date().toISOString(),
  sentAt: invoice.sentAt || invoice.sent_at || null,
  paidAt: invoice.paidAt || invoice.paid_at || null
})

const toSupabaseInvoice = (invoice, includeOptional = true) => ({
  id: invoice.id,
  contractor_email: invoice.contractorEmail,
  contractor_name: invoice.contractorName,
  client_email: invoice.clientEmail,
  client_name: invoice.clientName,
  description: invoice.description,
  amount: Number(invoice.amount || 0),
  due_date: invoice.dueDate || null,
  ...(includeOptional
    ? {
        related_job_id: normalizeRelatedJobId(invoice.relatedJobId),
        related_job_title: invoice.relatedJobTitle || null,
        related_job_po_number: invoice.relatedJobPoNumber || null,
        payment_stage: invoice.paymentStage || "full"
      }
    : {}),
  attachments: invoice.attachments || [],
  status: invoice.status,
  ...(includeOptional
    ? {
        payment_method: invoice.paymentMethod || null,
        payment_reference: invoice.paymentReference || null,
        paid_amount: Number(invoice.paidAmount || invoice.amount || 0),
        paid_by_name: invoice.paidByName || null
      }
    : {}),
  created_at: invoice.createdAt,
  updated_at: invoice.updatedAt,
  sent_at: invoice.sentAt,
  paid_at: invoice.paidAt
})

const isOverdue = (invoice) => {
  const status = String(invoice.status || "").toLowerCase()
  if (status === "paid" || status === "draft") return false
  if (!invoice.dueDate) return false

  const due = new Date(`${invoice.dueDate}T23:59:59`)
  return Number.isFinite(due.getTime()) && due < new Date()
}

const getDisplayStatus = (invoice) => {
  if (isOverdue(invoice)) return "overdue"
  return String(invoice.status || "draft").toLowerCase()
}

const hasOptionalColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase()
  return message.includes("related_job") || message.includes("payment_stage") || message.includes("payment_") || message.includes("paid_")
}

function loadFromLocalStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(stored) ? stored.map(normalizeInvoice) : []
  } catch {
    return []
  }
}

export function InvoicesProvider({ children }) {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [isHydrated, setIsHydrated] = useState(false)

  const persistLocal = (nextInvoices) => {
    setInvoices(nextInvoices)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextInvoices))
  }

  const refreshInvoices = async () => {
    if (!user?.email) {
      setInvoices([])
      setIsHydrated(true)
      return
    }

    if (!isSupabaseConfigured) {
      const local = loadFromLocalStorage()
      setInvoices(local)
      setIsHydrated(true)
      return
    }

    const email = normalizeEmail(user.email)

    const [{ data: contractorRows, error: contractorError }, { data: clientRows, error: clientError }] = await Promise.all([
      supabase.from("invoices").select("*").eq("contractor_email", email),
      supabase.from("invoices").select("*").eq("client_email", email)
    ])

    if (contractorError || clientError) {
      setInvoices(loadFromLocalStorage())
      setIsHydrated(true)
      return
    }

    const combined = [...(contractorRows || []), ...(clientRows || [])]
    const dedupedById = new Map()
    combined.forEach((row) => {
      if (!dedupedById.has(row.id)) {
        dedupedById.set(row.id, normalizeInvoice(row))
      }
    })

    const normalized = Array.from(dedupedById.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    persistLocal(normalized)
    setIsHydrated(true)
  }

  useEffect(() => {
    refreshInvoices()
  }, [user?.email])

  const createInvoice = async (payload) => {
    if (!user?.email) throw new Error("You must be logged in")

    const now = new Date().toISOString()
    const nextInvoice = normalizeInvoice({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      contractorEmail: normalizeEmail(user.email),
      contractorName: user.name || "Contractor",
      clientEmail: payload.clientEmail,
      clientName: payload.clientName,
      description: payload.description,
      amount: Number(payload.amount),
      dueDate: payload.dueDate,
      relatedJobId: payload.relatedJobId || null,
      relatedJobTitle: payload.relatedJobTitle || "",
      relatedJobPoNumber: payload.relatedJobPoNumber || "",
      paymentStage: payload.paymentStage || "full",
      attachments: payload.attachments || [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      paidAt: null
    })

    const next = [nextInvoice, ...invoices]
    persistLocal(next)

    if (isSupabaseConfigured) {
      let { error } = await supabase.from("invoices").insert(toSupabaseInvoice(nextInvoice, true))
      if (error && hasOptionalColumnError(error)) {
        const fallback = await supabase.from("invoices").insert(toSupabaseInvoice(nextInvoice, false))
        error = fallback.error
      }
      if (error) {
        throw new Error(error.message || "Unable to save invoice")
      }
    }

    return nextInvoice
  }

  const updateInvoice = async (invoiceId, updates) => {
    const target = invoices.find((item) => item.id === invoiceId)
    if (!target) throw new Error("Invoice not found")

    if (normalizeEmail(target.contractorEmail) !== normalizeEmail(user?.email)) {
      throw new Error("Only the contractor who created this invoice can edit it")
    }

    const nextInvoice = normalizeInvoice({
      ...target,
      ...updates,
      updatedAt: new Date().toISOString()
    })

    const next = invoices.map((item) => (item.id === invoiceId ? nextInvoice : item))
    persistLocal(next)

    if (isSupabaseConfigured) {
      let { error } = await supabase.from("invoices").update(toSupabaseInvoice(nextInvoice, true)).eq("id", invoiceId)
      if (error && hasOptionalColumnError(error)) {
        const fallback = await supabase.from("invoices").update(toSupabaseInvoice(nextInvoice, false)).eq("id", invoiceId)
        error = fallback.error
      }
      if (error) throw new Error(error.message || "Unable to update invoice")
    }

    return nextInvoice
  }

  const sendInvoice = async (invoiceId) => {
    const invoice = invoices.find((item) => item.id === invoiceId)
    if (!invoice) throw new Error("Invoice not found")
    if (invoice.status === "paid") throw new Error("Paid invoices cannot be sent again")

    return updateInvoice(invoiceId, {
      status: "sent",
      sentAt: new Date().toISOString()
    })
  }

  const markInvoicePaid = async (invoiceId, paymentDetails = {}) => {
    const invoice = invoices.find((item) => item.id === invoiceId)
    if (!invoice) throw new Error("Invoice not found")

    if (normalizeEmail(invoice.clientEmail) !== normalizeEmail(user?.email)) {
      throw new Error("Only the billed client can mark this invoice as paid")
    }

    const nextInvoice = normalizeInvoice({
      ...invoice,
      status: "paid",
      paymentMethod: paymentDetails.paymentMethod || "platform_card",
      paymentReference: paymentDetails.paymentReference || `PS-${Date.now()}`,
      paidAmount: Number(paymentDetails.paidAmount || invoice.amount || 0),
      paidByName: paymentDetails.paidByName || user?.name || user?.email || "",
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    const next = invoices.map((item) => (item.id === invoiceId ? nextInvoice : item))
    persistLocal(next)

    if (isSupabaseConfigured) {
      let { error } = await supabase.from("invoices").update(toSupabaseInvoice(nextInvoice, true)).eq("id", invoiceId)
      if (error && hasOptionalColumnError(error)) {
        const fallback = await supabase.from("invoices").update(toSupabaseInvoice(nextInvoice, false)).eq("id", invoiceId)
        error = fallback.error
      }
      if (error) throw new Error(error.message || "Unable to update invoice")
    }

    return nextInvoice
  }

  const contractorInvoices = useMemo(() => {
    const email = normalizeEmail(user?.email)
    return invoices.filter((invoice) => normalizeEmail(invoice.contractorEmail) === email)
  }, [invoices, user?.email])

  const clientInvoices = useMemo(() => {
    const email = normalizeEmail(user?.email)
    return invoices.filter((invoice) => normalizeEmail(invoice.clientEmail) === email)
  }, [invoices, user?.email])

  return (
    <InvoicesContext.Provider
      value={{
        invoices,
        contractorInvoices,
        clientInvoices,
        isHydrated,
        refreshInvoices,
        createInvoice,
        updateInvoice,
        sendInvoice,
        markInvoicePaid,
        getDisplayStatus
      }}
    >
      {children}
    </InvoicesContext.Provider>
  )
}

export function useInvoices() {
  const context = useContext(InvoicesContext)
  if (!context) {
    throw new Error("useInvoices must be used within an InvoicesProvider")
  }
  return context
}
