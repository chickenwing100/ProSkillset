import { Link } from 'react-router-dom'

export default function RecentMessages() {
  // Mock data for recent messages - in a real app, this would come from your backend
  const messages = [
    {
      id: 1,
      from: 'John Client',
      project: 'Website Redesign',
      message: 'Thanks for your application! Can you share your portfolio?',
      time: '2 hours ago',
      unread: true
    },
    {
      id: 2,
      from: 'Sarah Business',
      project: 'Mobile App Development',
      message: 'We\'d like to schedule a call to discuss the project details.',
      time: '1 day ago',
      unread: false
    },
    {
      id: 3,
      from: 'Mike Corp',
      project: 'Data Analysis Project',
      message: 'Your proposal looks great! When can you start?',
      time: '3 days ago',
      unread: false
    }
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Messages</h3>
        <Link
          to="/messages"
          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
        >
          View All →
        </Link>
      </div>

      {messages.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">💬</div>
          <p className="text-gray-500 text-sm">No messages yet</p>
          <p className="text-gray-400 text-xs mt-1">Messages from clients will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                message.unread ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900 text-sm">{message.from}</span>
                    {message.unread && (
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-1 font-medium">{message.project}</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{message.message}</p>
                </div>
                <div className="text-xs text-gray-500 ml-3">
                  {message.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}