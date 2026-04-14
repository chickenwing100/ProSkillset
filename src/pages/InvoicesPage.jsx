import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useInvoices } from "../context/InvoicesContext"
import { useJobs } from "../context/JobsContext"
import { useToast } from "../context/ToastContext"
import { isSupabaseConfigured, supabase } from "../lib/supabase"
import { formatDateTime } from "../lib/dateTime"
import { createInvoicePaymentCheckout } from "../services/stripeBillingService"

function statusClasses(status) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700"
  if (status === "sent") return "bg-blue-100 text-blue-700"
  if (status === "overdue") return "bg-red-100 text-red-700"
  return "bg-gray-100 text-gray-700"
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function resolveStagePercent(project, paymentStage) {
  const schedule = project?.paymentSchedule || {}
  if (paymentStage === "upfront") return Number(schedule.upfrontPercent || 0)
  if (paymentStage === "progress") return Number(schedule.progressPercent || 0)
  if (paymentStage === "completion") return Number(schedule.completionPercent || 0)
  return 100
}

function calculateSuggestedAmount(project, paymentStage) {
  if (!project) return ""
  const baseAmount = Number(project.acceptedBid || project.budget || 0)
  if (!baseAmount || baseAmount <= 0) return ""

  const percent = resolveStagePercent(project, paymentStage)
  const nextAmount = paymentStage === "full" ? baseAmount : (baseAmount * percent) / 100
  return nextAmount > 0 ? nextAmount.toFixed(2) : ""
}

const isStripeEnabled = import.meta.env.VITE_STRIPE_ENABLED === "true"

export default function InvoicesPage() {
  const location = useLocation()
  const { user } = useAuth()
  const { jobs } = useJobs()
  const { showToast } = useToast()
  const {
    contractorInvoices,
    clientInvoices,
    isHydrated,
    refreshInvoices,
    createInvoice,
    sendInvoice,
    markInvoicePaid,
    getDisplayStatus
  } = useInvoices()

  const [formState, setFormState] = useState({
    clientEmail: "",
    relatedJobId: "",
    poReference: "",
    paymentStage: "full",
    description: "",
    amount: "",
    dueDate: ""
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [amountEditedManually, setAmountEditedManually] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const clientsFromProjects = useMemo(() => {
    if (user?.role !== "contractor") return []

    const map = new Map()
    jobs
      .filter((job) => job.selectedContractor === user.email || job.status === "completed")
      .forEach((job) => {
        if (!job.postedBy) return
        map.set(job.postedBy, {
          email: job.postedBy,
          name: job.postedBy
        })
      })

    return Array.from(map.values())
  }, [jobs, user])

  const contractorProjects = useMemo(() => {
    if (user?.role !== "contractor") return []
    return jobs
      .filter((job) => job.selectedContractor === user.email || job.status === "completed")
      .sort((a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0))
  }, [jobs, user])

  useEffect(() => {
    if (user?.role !== "contractor") return

    const query = new URLSearchParams(location.search)
    const relatedJobId = query.get("relatedJobId") || ""
    const relatedJobTitle = query.get("relatedJobTitle") || ""
    const relatedJobPoNumber = query.get("relatedJobPoNumber") || ""
    const clientEmail = query.get("clientEmail") || ""
    const paymentStage = query.get("paymentStage") || "full"

    if (!relatedJobId && !clientEmail && !relatedJobTitle) return

    setFormState((prev) => {
      if (prev.relatedJobId || prev.clientEmail || prev.description || prev.amount || prev.dueDate) {
        return prev
      }

      return {
        ...prev,
        relatedJobId,
        clientEmail,
        poReference: relatedJobPoNumber,
        paymentStage,
        amount: prev.amount,
        description: relatedJobTitle
          ? `${relatedJobTitle}${relatedJobPoNumber ? ` (PO# ${relatedJobPoNumber})` : ""}`
          : prev.description
      }
    })
  }, [location.search, user?.role])

  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const billingState = query.get("billing")
    if (!billingState) return

    if (billingState === "invoice-paid") {
      refreshInvoices?.()
      showToast("Stripe payment completed. Invoice status will refresh from billing events.", "success")
    }

    if (billingState === "invoice-payment-cancelled") {
      showToast("Invoice payment was cancelled.", "info")
    }
  }, [location.search, refreshInvoices, showToast])

  useEffect(() => {
    if (user?.role !== "contractor") return
    if (!formState.relatedJobId || amountEditedManually) return

    const selectedProject = contractorProjects.find((job) => String(job.id) === String(formState.relatedJobId))
    const suggested = calculateSuggestedAmount(selectedProject, formState.paymentStage)
    if (!suggested) return

    setFormState((prev) => ({ ...prev, amount: suggested }))
  }, [formState.relatedJobId, formState.paymentStage, contractorProjects, user?.role, amountEditedManually])

  const onChange = (event) => {
    const { name, value } = event.target
    if (name === "relatedJobId") {
      const selectedJob = contractorProjects.find((job) => String(job.id) === value)
      const suggested = calculateSuggestedAmount(selectedJob, formState.paymentStage)
      setAmountEditedManually(false)
      setFormState((prev) => ({
        ...prev,
        relatedJobId: value,
        clientEmail: selectedJob?.postedBy || prev.clientEmail,
        poReference: selectedJob?.poNumber || prev.poReference,
        amount: suggested || prev.amount,
        description: selectedJob
          ? `${selectedJob.title}${selectedJob.poNumber ? ` (PO# ${selectedJob.poNumber})` : ""}`
          : prev.description
      }))
      return
    }

    if (name === "paymentStage") {
      setAmountEditedManually(false)
      setFormState((prev) => ({ ...prev, paymentStage: value }))
      return
    }

    if (name === "amount") {
      setAmountEditedManually(true)
    }

    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const onSelectFiles = (event) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  const prepareAttachments = async () => {
    if (selectedFiles.length === 0) return []

    const attachments = []
    for (const file of selectedFiles) {
      if (isSupabaseConfigured) {
        const path = `${user.email}/invoice-${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from("invoice-attachments").upload(path, file, { upsert: true })
        if (!error) {
          const { data } = supabase.storage.from("invoice-attachments").getPublicUrl(path)
          attachments.push({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: data?.publicUrl || "",
            path
          })
          continue
        }
      }

      const dataUrl = await fileToDataUrl(file)
      attachments.push({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        url: dataUrl,
        path: ""
      })
    }

    return attachments
  }

  const handleCreateInvoice = async (event) => {
    event.preventDefault()

    if (!formState.clientEmail.trim()) {
      showToast("Client email is required", "error")
      return
    }

    if (!formState.description.trim()) {
      showToast("Description is required", "error")
      return
    }

    const numericAmount = Number(formState.amount)
    if (!numericAmount || numericAmount <= 0) {
      showToast("Amount must be greater than zero", "error")
      return
    }

    if (!formState.dueDate) {
      showToast("Due date is required", "error")
      return
    }

    setSaving(true)
    try {
      const attachments = await prepareAttachments()
      await createInvoice({
        clientEmail: formState.clientEmail,
        clientName: formState.clientEmail,
        description: formState.description,
        amount: numericAmount,
        dueDate: formState.dueDate,
        relatedJobId: formState.relatedJobId || null,
        relatedJobTitle: contractorProjects.find((job) => String(job.id) === formState.relatedJobId)?.title || "",
        relatedJobPoNumber: formState.poReference || contractorProjects.find((job) => String(job.id) === formState.relatedJobId)?.poNumber || "",
        paymentStage: formState.paymentStage,
        attachments
      })

      showToast("Invoice saved as draft", "success")
      setFormState({ clientEmail: "", relatedJobId: "", poReference: "", paymentStage: "full", description: "", amount: "", dueDate: "" })
      setAmountEditedManually(false)
      setSelectedFiles([])
    } catch (error) {
      showToast(error.message || "Failed to create invoice", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleSendInvoice = async (invoiceId) => {
    try {
      await sendInvoice(invoiceId)
      showToast("Invoice sent to client", "success")
    } catch (error) {
      showToast(error.message || "Unable to send invoice", "error")
    }
  }

  const openInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice)
  }

  const openPaymentDialog = (invoice) => {
    if (!invoice) return

    if (!isSupabaseConfigured) {
      markInvoicePaid(invoice.id, {
        paymentMethod: "local_dev",
        paymentReference: `LOCAL-${Date.now()}`,
        paidAmount: invoice.amount,
        paidByName: user?.name || user?.email || ""
      })
        .then(() => showToast("Invoice marked paid in local mode", "success"))
        .catch((error) => showToast(error.message || "Unable to pay invoice", "error"))
      return
    }

    createInvoicePaymentCheckout(invoice.id)
      .then((response) => {
        if (!response?.url) {
          throw new Error("Stripe did not return a payment URL")
        }
        window.location.assign(response.url)
      })
      .catch((error) => showToast(error.message || "Unable to open invoice payment", "error"))
  }

  if (!isHydrated) {
    return <div className="min-h-screen flex items-center justify-center">Loading invoices...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Create, send, and track invoice status across projects.</p>
        </div>

        {user?.role === "contractor" && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Invoice</h2>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attach to Project</label>
                  <select
                    name="relatedJobId"
                    value={formState.relatedJobId}
                    onChange={onChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">No linked project</option>
                    {contractorProjects.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}{job.poNumber ? ` - PO# ${job.poNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO# Reference</label>
                  <input
                    name="poReference"
                    value={formState.poReference}
                    onChange={onChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="e.g., MapleAve-Roof Replacement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                  <input
                    name="clientEmail"
                    value={formState.clientEmail}
                    onChange={onChange}
                    list="client-email-options"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="client@example.com"
                  />
                  <datalist id="client-email-options">
                    {clientsFromProjects.map((client) => (
                      <option key={client.email} value={client.email} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formState.amount}
                    onChange={onChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="1250.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated from accepted bid and selected payment stage when a project is linked.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  value={formState.description}
                  onChange={onChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Scope of work, billing period, and line item notes"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    name="dueDate"
                    type="date"
                    value={formState.dueDate}
                    onChange={onChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Stage</label>
                  <select
                    name="paymentStage"
                    value={formState.paymentStage}
                    onChange={onChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="full">Full Payment</option>
                    <option value="upfront">Upfront Payment</option>
                    <option value="progress">Progress Payment</option>
                    <option value="completion">Completion Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                  <input
                    type="file"
                    multiple
                    onChange={onSelectFiles}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
              </div>
            </form>
          </section>
        )}

        {user?.role === "contractor" && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">My Invoices</h2>
            {contractorInvoices.length === 0 ? (
              <p className="text-gray-500">No invoices created yet.</p>
            ) : (
              <div className="space-y-3">
                {contractorInvoices.map((invoice) => {
                  const status = getDisplayStatus(invoice)
                  return (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">To: {invoice.clientEmail}</p>
                          {invoice.relatedJobTitle && (
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {invoice.relatedJobTitle}
                              {invoice.relatedJobPoNumber ? ` (PO# ${invoice.relatedJobPoNumber})` : ""}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">Stage: {String(invoice.paymentStage || "full").replace("_", " ")}</p>
                          <p className="text-sm text-gray-600 mt-1">{invoice.description}</p>
                          <p className="text-sm text-gray-500 mt-1">Due: {invoice.dueDate || "N/A"}</p>
                          <p className="text-sm text-gray-500">Created: {formatDateTime(invoice.createdAt)}</p>
                          {status === "paid" && (
                            <p className="text-xs text-emerald-700 mt-1">
                              Paid {invoice.paidAt ? formatDateTime(invoice.paidAt) : ""}{invoice.paymentReference ? ` • Ref: ${invoice.paymentReference}` : ""}
                            </p>
                          )}
                          {invoice.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {invoice.attachments.map((file) => (
                                <a
                                  key={file.id}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700"
                                >
                                  {file.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">${Number(invoice.amount || 0).toFixed(2)}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusClasses(status)}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSendInvoice(invoice.id)}
                          disabled={status === "paid" || status === "sent" || status === "overdue"}
                          className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          {status === "draft" ? "Send Invoice" : "Sent"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {user?.role === "client" && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Invoices From Contractors</h2>
            {clientInvoices.length === 0 ? (
              <p className="text-gray-500">No invoices received yet.</p>
            ) : (
              <div className="space-y-3">
                {clientInvoices.map((invoice) => {
                  const status = getDisplayStatus(invoice)
                  return (
                    <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">From: {invoice.contractorName || invoice.contractorEmail}</p>
                          {invoice.relatedJobTitle && (
                            <p className="text-sm text-gray-600 mt-1">
                              Project: {invoice.relatedJobTitle}
                              {invoice.relatedJobPoNumber ? ` (PO# ${invoice.relatedJobPoNumber})` : ""}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 mt-1">Stage: {String(invoice.paymentStage || "full").replace("_", " ")}</p>
                          <p className="text-sm text-gray-600 mt-1">{invoice.description}</p>
                          <p className="text-sm text-gray-500 mt-1">Due: {invoice.dueDate || "N/A"}</p>
                          {status === "paid" && (
                            <p className="text-xs text-emerald-700 mt-1">
                              Paid {invoice.paidAt ? formatDateTime(invoice.paidAt) : ""}{invoice.paymentReference ? ` • Ref: ${invoice.paymentReference}` : ""}
                            </p>
                          )}
                          {invoice.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {invoice.attachments.map((file) => (
                                <a
                                  key={file.id}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700"
                                >
                                  {file.name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">${Number(invoice.amount || 0).toFixed(2)}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold uppercase ${statusClasses(status)}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openInvoiceDetails(invoice)}
                            className="px-3 py-1.5 rounded-md bg-gray-700 text-white hover:bg-gray-800"
                          >
                            View Invoice
                          </button>
                          {isStripeEnabled ? (
                            <button
                              type="button"
                              onClick={() => openPaymentDialog(invoice)}
                              disabled={status === "paid"}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {status === "paid" ? "Paid" : "Pay Invoice"}
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-500 text-sm border border-gray-200">
                              {status === "paid" ? "Paid" : "Online Payments Coming Soon"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Invoice Details</h3>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedInvoice(null)}>Close</button>
              </div>
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">From:</span> {selectedInvoice.contractorName || selectedInvoice.contractorEmail}</p>
                <p><span className="font-medium">To:</span> {selectedInvoice.clientEmail}</p>
                <p><span className="font-medium">Project:</span> {selectedInvoice.relatedJobTitle || "N/A"}</p>
                <p><span className="font-medium">PO#:</span> {selectedInvoice.relatedJobPoNumber || "N/A"}</p>
                <p><span className="font-medium">Payment Stage:</span> {String(selectedInvoice.paymentStage || "full").replace("_", " ")}</p>
                <p><span className="font-medium">Amount:</span> ${Number(selectedInvoice.amount || 0).toFixed(2)}</p>
                <p><span className="font-medium">Due Date:</span> {selectedInvoice.dueDate || "N/A"}</p>
                <p><span className="font-medium">Description:</span> {selectedInvoice.description}</p>
                {selectedInvoice.attachments?.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Attachments:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedInvoice.attachments.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700"
                        >
                          {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
