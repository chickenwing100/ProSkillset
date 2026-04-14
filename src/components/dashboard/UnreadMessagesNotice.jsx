import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useMessages } from "../../context/MessagesContext"

export default function UnreadMessagesNotice() {
  const { user } = useAuth()
  const { getTotalUnreadCount } = useMessages()

  const unreadCount = getTotalUnreadCount()
  const themeClass = user?.role === "contractor"
    ? "bg-orange-50 border-orange-200 text-orange-700"
    : "bg-blue-50 border-blue-200 text-blue-700"

  if (unreadCount === 0) {
    return null
  }

  return (
    <Link
      to="/messages"
      className={`block border rounded-lg p-4 ${themeClass}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">New Message</p>
          <p className="text-sm">You have {unreadCount} unread message{unreadCount === 1 ? "" : "s"}.</p>
        </div>
        <span className="text-sm font-medium">Open Inbox →</span>
      </div>
    </Link>
  )
}
