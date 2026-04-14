import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useJobs } from "../context/JobsContext"
import { useMessages } from "../context/MessagesContext"
import { useToast } from "../context/ToastContext"
import { queueAutomatedWelcomeMessages } from "../lib/automatedMessages"

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

export default function AdminProSkillset() {
  const { user, isAdminUser, getAllProfiles } = useAuth()
  const { jobs } = useJobs()
  const { messages, sendBulkMessages } = useMessages()
  const { showToast } = useToast()

  const [search, setSearch] = useState("")
  const [selectedRecipient, setSelectedRecipient] = useState("")
  const [directMessage, setDirectMessage] = useState("")
  const [broadcastMessage, setBroadcastMessage] = useState("")
  const [broadcastRoleFilter, setBroadcastRoleFilter] = useState("all")

  const profiles = useMemo(() => getAllProfiles(), [getAllProfiles])

  const profileStats = useMemo(() => {
    const base = { total: 0, clients: 0, contractors: 0, admins: 0 }
    profiles.forEach((profile) => {
      base.total += 1
      if (profile.role === "client") base.clients += 1
      if (profile.role === "contractor") base.contractors += 1
      if (profile.role === "admin") base.admins += 1
    })
    return base
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return profiles

    return profiles.filter((profile) => {
      const name = String(profile.name || profile.full_name || "").toLowerCase()
      const email = String(profile.email || "").toLowerCase()
      const role = String(profile.role || "").toLowerCase()
      return name.includes(query) || email.includes(query) || role.includes(query)
    })
  }, [profiles, search])

  const recipientOptions = useMemo(
    () => profiles
      .filter((profile) => normalizeEmail(profile.email) !== normalizeEmail(user?.email))
      .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""))),
    [profiles, user?.email]
  )

  const jobStats = useMemo(() => {
    const open = jobs.filter((job) => job.status === "open").length
    const inProgress = jobs.filter((job) => job.status === "in_progress" || job.status === "pending_client_confirmation").length
    const completed = jobs.filter((job) => job.status === "completed").length
    return { total: jobs.length, open, inProgress, completed }
  }, [jobs])

  const platformMessageStats = useMemo(() => {
    const total = messages.length
    const adminSent = messages.filter((message) => normalizeEmail(message.from) === normalizeEmail(user?.email)).length
    return { total, adminSent }
  }, [messages, user?.email])

  if (!isAdminUser()) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Admin Access Required</h1>
          <p className="text-gray-600 mt-2">Only admin users can access the ProSkillset control center.</p>
        </div>
      </div>
    )
  }

  const handleSendDirectMessage = () => {
    if (!selectedRecipient) {
      showToast("Select a recipient first.", "error")
      return
    }

    if (!directMessage.trim()) {
      showToast("Enter a message first.", "error")
      return
    }

    const result = sendBulkMessages({
      recipients: [selectedRecipient],
      text: directMessage
    })

    if (!result.sentCount) {
      showToast("No message was sent.", "error")
      return
    }

    setDirectMessage("")
    showToast("Message sent.", "success")
  }

  const handleSendBroadcast = () => {
    if (!broadcastMessage.trim()) {
      showToast("Enter a broadcast message first.", "error")
      return
    }

    let recipientProfiles = profiles
    if (broadcastRoleFilter !== "all") {
      recipientProfiles = profiles.filter((profile) => profile.role === broadcastRoleFilter)
    }

    const recipients = recipientProfiles
      .map((profile) => normalizeEmail(profile.email))
      .filter((email) => email && email !== normalizeEmail(user?.email))

    const result = sendBulkMessages({
      recipients,
      text: broadcastMessage
    })

    if (!result.sentCount) {
      showToast("No recipients available for broadcast.", "error")
      return
    }

    setBroadcastMessage("")
    showToast(`Broadcast sent to ${result.sentCount} users.`, "success")
  }

  const handleSendWelcomeToUser = (profile) => {
    const result = queueAutomatedWelcomeMessages({
      email: profile.email,
      role: profile.role,
      force: true
    })
    if (!result.sentCount) {
      showToast(`No welcome messages configured for role: ${profile.role}.`, "error")
      return
    }
    showToast(`Welcome messages sent to ${profile.name || profile.email}.`, "success")
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">ProSkillset</h1>
        <p className="text-gray-600 mt-1">Admin control center with full platform visibility and messaging controls.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Users</p>
          <p className="text-2xl font-semibold text-gray-900">{profileStats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Open Projects</p>
          <p className="text-2xl font-semibold text-gray-900">{jobStats.open}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-semibold text-gray-900">{jobStats.inProgress}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-semibold text-gray-900">{jobStats.completed}</p>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Platform Access</h2>
        <p className="text-sm text-gray-600">Jump directly into client and contractor experiences.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/projects" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-center">Open Project Feed</Link>
          <Link to="/contractors" className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 text-center">Open Contractors</Link>
          <Link to="/my-projects" className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-800 text-center">Open My Projects</Link>
          <Link to="/messages" className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-center">Open Messages</Link>
          <Link to="/admin/insurance-review" className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-center">Insurance Review</Link>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Message Any User</h2>
          <p className="text-sm text-gray-600">Reach any current platform member directly.</p>

          <select
            value={selectedRecipient}
            onChange={(event) => setSelectedRecipient(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">Select user...</option>
            {recipientOptions.map((profile) => (
              <option key={profile.email} value={profile.email}>
                {(profile.name || profile.full_name || profile.email)} ({profile.role})
              </option>
            ))}
          </select>

          <textarea
            value={directMessage}
            onChange={(event) => setDirectMessage(event.target.value)}
            rows={4}
            placeholder="Type direct message..."
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />

          <button
            type="button"
            onClick={handleSendDirectMessage}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Send Direct Message
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Broadcast Message</h2>
          <p className="text-sm text-gray-600">Send one message to everyone who has joined the platform.</p>

          <select
            value={broadcastRoleFilter}
            onChange={(event) => setBroadcastRoleFilter(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="all">Send to All Users</option>
            <option value="client">Send to Clients Only</option>
            <option value="contractor">Send to Contractors Only</option>
          </select>

          <textarea
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
            rows={6}
            placeholder="Type announcement to all users..."
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />

          <button
            type="button"
            onClick={handleSendBroadcast}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700"
          >
            {broadcastRoleFilter === "all" ? "Send Broadcast To All Users" : `Send Broadcast To ${broadcastRoleFilter === "client" ? "Clients" : "Contractors"} Only`}
          </button>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            <p>Total messages in platform: {platformMessageStats.total}</p>
            <p>Messages sent by this admin: {platformMessageStats.adminSent}</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">User Directory</h2>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users by name/email/role..."
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <p>Clients: {profileStats.clients}</p>
          <p>Contractors: {profileStats.contractors}</p>
          <p>Admins: {profileStats.admins}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 text-gray-600">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.email} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{profile.name || profile.full_name || "-"}</td>
                  <td className="py-2 pr-4">{profile.email}</td>
                  <td className="py-2 pr-4 capitalize">{profile.role || "-"}</td>
                  <td className="py-2 pr-4">
                    <button
                      type="button"
                      onClick={() => handleSendWelcomeToUser(profile)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                    >
                      Send Welcome
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProfiles.length === 0 && (
            <p className="text-sm text-gray-500 py-3">No users match your search.</p>
          )}
        </div>
      </section>
    </div>
  )
}
