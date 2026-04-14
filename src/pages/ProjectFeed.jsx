import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useJobs } from '../context/JobsContext'
import { formatDateTime } from '../lib/dateTime'
import { TRADE_CATEGORY_GROUPS, toTradeValue, matchesTradeFilter } from '../lib/trades'

export default function ProjectFeed() {
  const { user, getUserProfile } = useAuth()
  const { jobs, refreshJobs } = useJobs()
  const [tradeFilter, setTradeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [locationSearch, setLocationSearch] = useState('')

  useEffect(() => {
    refreshJobs()
  }, [])

  const projects = useMemo(() => {
    if (!user) return []

    return jobs.filter((job) => {
      if ((job.status || 'open') !== 'open') return false
      if ((job.applications || []).length >= 5) return false
      return true
    })
  }, [jobs, user])

  const roleTheme = user?.role === 'contractor'
    ? {
        ring: 'focus:ring-orange-500',
        button: 'bg-orange-600 hover:bg-orange-700',
        link: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-700'
      }
    : {
        ring: 'focus:ring-blue-500',
        button: 'bg-blue-600 hover:bg-blue-700',
        link: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-700'
      }

  const filteredAndSortedProjects = useMemo(
    () => projects
      .filter((project) => {
        const matchesTrade = matchesTradeFilter(project, tradeFilter)

        const matchesLocation =
          !locationSearch ||
          (project.location || '').toLowerCase().includes(locationSearch.toLowerCase())

        return matchesTrade && matchesLocation
      })
      .sort((a, b) => {
        if (sortBy === 'budget_high') {
          return (Number(b.budget) || 0) - (Number(a.budget) || 0)
        }
        if (sortBy === 'budget_low') {
          return (Number(a.budget) || 0) - (Number(b.budget) || 0)
        }
        if (sortBy === 'oldest') {
          return new Date(a.postedDate || 0) - new Date(b.postedDate || 0)
        }
        return new Date(b.postedDate || 0) - new Date(a.postedDate || 0)
      }),
    [projects, tradeFilter, locationSearch, sortBy]
  )

  const getDisplayName = (email, fallbackLabel = "User") => {
    const profile = getUserProfile(email) || {}
    const candidate = String(profile.name || profile.full_name || profile.contractorName || profile.businessName || "").trim()
    return candidate || fallbackLabel
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Project Feed</h1>
          <p className="mt-2 text-sm text-gray-700">
            Discover available projects and find your next opportunity.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Showing {filteredAndSortedProjects.length} open projects.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-4">
          <button
            onClick={refreshJobs}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${roleTheme.button}`}
          >
            Refresh Feed
          </button>
        </div>
      </div>

      <div className="mt-6 mb-8 flex flex-wrap gap-4">
        <select
          value={tradeFilter}
          onChange={(event) => setTradeFilter(event.target.value)}
          className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
        >
          <option value="all">All Trades</option>
          {TRADE_CATEGORY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((trade) => (
                <option key={trade} value={toTradeValue(trade)}>{trade}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
        >
          <option value="newest">Sort by Newest</option>
          <option value="oldest">Sort by Oldest</option>
          <option value="budget_high">Sort by Budget (High to Low)</option>
          <option value="budget_low">Sort by Budget (Low to High)</option>
        </select>

        <input
          type="text"
          value={locationSearch}
          onChange={(event) => setLocationSearch(event.target.value)}
          placeholder="Search location..."
          className={`px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${roleTheme.ring}`}
        />

        <button
          onClick={() => {
            setTradeFilter('all')
            setSortBy('newest')
            setLocationSearch('')
          }}
          className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${roleTheme.button}`}
        >
          Reset Filters
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedProjects.map((project) => (
          <div key={project.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{getDisplayName(project.postedBy, "Project Owner")}</p>
                  <p className="text-xs text-gray-500">Posted {formatDateTime(project.postedDate)}</p>
                </div>
                {project.postedBy === user?.email ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    Your Post
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Open
                  </span>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">{project.title}</h3>
                {project.poNumber && (
                  <p className="mt-1 text-xs font-medium text-gray-500">PO#: {project.poNumber}</p>
                )}
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">{project.description}</p>
              </div>

              <div className="mt-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${roleTheme.badge}`}>
                  {5 - (project.applications?.length || 0)} slots left
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{project.category}</span>
                  {project.location && (
                    <span className="text-sm text-gray-500">📍 {project.location}</span>
                  )}
                </div>
                <span className="text-lg font-semibold text-green-600">${project.budget}</span>
              </div>

              <div className="mt-4">
                <Link
                  to={`/projects/${project.id}`}
                  className={`w-full text-white px-4 py-2 rounded-md text-sm font-medium transition-colors text-center block ${roleTheme.button}`}
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAndSortedProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500">
            No matching projects were found for the selected filters.
          </p>
        </div>
      )}
    </div>
  )
}
