import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

type StudentRow = {
  name: string
  enrollmentNo: string
  totalSolved: number
  streak: number
  status: 'Active' | 'Inactive'
}

type AnalyticsResponse = {
  summary: {
    studentsRegistered: number
    totalSubmissions: number
    activeThisWeek: number
    inactive7Days: number
  }
  leaderboardRules: string[]
  top5: StudentRow[]
  topicStats: Array<{ topic: string; studentCount: number; percentage: number }>
  languageStats: Array<{ language: string; count: number; percentage: number }>
  difficultyStats: Array<{ difficulty: string; count: number; percentage: number }>
}

type PublicLinkResponse = {
  publicUrl: string
  expiresAt: string | null
}

type StudentsListResponse = {
  students: StudentRow[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function TeacherDashboardPage() {
  const PAGE_SIZE = 5
  const { token } = useAuth()
  const { withLoader, showAlert } = useFeedback()
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentRow[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [publicUrl, setPublicUrl] = useState('')
  const [publicUrlExpiresAt, setPublicUrlExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    withLoader(() => apiRequest<AnalyticsResponse>('/teacher/analytics', { token }))
      .then((analyticsData) => {
        setAnalytics(analyticsData)
      })
      .catch((loadError) => {
        setAnalytics(null)
        showAlert(loadError instanceof Error ? loadError.message : 'Failed to load teacher analytics', 'error')
      })
  }, [showAlert, token, withLoader])

  const studentsEndpoint = useMemo(() => {
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(PAGE_SIZE),
      search: query.trim(),
    })
    return `/teacher/students?${params.toString()}`
  }, [currentPage, query])

  useEffect(() => {
    if (!token) {
      return
    }

    withLoader(() => apiRequest<StudentsListResponse>(studentsEndpoint, { token }))
      .then((payload) => {
        setStudents(payload.students)
        setTotalPages(payload.pagination.totalPages)
        setTotalItems(payload.pagination.totalItems)
      })
      .catch((loadError) => {
        setStudents([])
        setTotalPages(1)
        setTotalItems(0)
        showAlert(loadError instanceof Error ? loadError.message : 'Failed to load students', 'error')
      })
  }, [showAlert, studentsEndpoint, token, withLoader])

  useEffect(() => {
    setCurrentPage(1)
  }, [query])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  async function exportCsv() {
    if (!token) {
      return
    }

    try {
      const csv = await withLoader(() => apiRequest<string>('/teacher/export/csv', { token }))
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'dsa-tracker-students.csv'
      link.click()
      URL.revokeObjectURL(link.href)
      showAlert('CSV exported successfully', 'success')
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Failed to export CSV', 'error')
    }
  }

  async function createPublicLink() {
    if (!token) {
      return
    }

    try {
      const response = await withLoader(() =>
        apiRequest<PublicLinkResponse>('/teacher/public-link', {
          method: 'POST',
          token,
        })
      )

      setPublicUrl(response.publicUrl)
      setPublicUrlExpiresAt(response.expiresAt)

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(response.publicUrl)
        showAlert('24-hour public link created and copied', 'success')
      } else {
        showAlert('24-hour public link created', 'success')
      }
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Failed to create public link', 'error')
    }
  }

  async function copyPublicLink() {
    if (!publicUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(publicUrl)
      showAlert('Public link copied', 'success')
    } catch {
      showAlert('Could not copy link automatically', 'warning')
    }
  }

  return (
    <main className="dashboard">
      <h1>Teacher Dashboard</h1>
      <section className="kpi-grid">
        <article className="panel kpi"><strong>{analytics?.summary.studentsRegistered || 0}</strong><span>students registered</span></article>
        <article className="panel kpi"><strong>{analytics?.summary.totalSubmissions || 0}</strong><span>total submissions</span></article>
        <article className="panel kpi"><strong>{analytics?.summary.activeThisWeek || 0}</strong><span>active this week</span></article>
        <article className="panel kpi"><strong>{analytics?.summary.inactive7Days || 0}</strong><span>inactive 7+ days</span></article>
      </section>

      <section className="split-two">
        <article className="panel">
          <h2>Top 5 students</h2>
          <ol className="leader-list">
            {(analytics?.top5 || []).map((row) => (
              <li key={row.enrollmentNo}>
                <span>{row.name}</span>
                <strong>{row.totalSolved} solved • {row.streak} streak</strong>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <h2>Class topic coverage</h2>
          <div className="bars">
            {(analytics?.topicStats || []).map((row) => (
              <div key={row.topic} className="bar-row">
                <p>{row.topic}</p>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${row.percentage}%` }} /></div>
                <span>{row.studentCount}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <h2>All students</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or enrollment"
          />
          <div className="toolbar-actions">
            <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
            <button className="btn ghost" type="button" onClick={createPublicLink}>Create 24h Public Link</button>
          </div>
        </div>

        {publicUrl ? (
          <div className="public-link-card">
            <p className="sub">
              Public progress URL
              {publicUrlExpiresAt ? ` (valid until ${new Date(publicUrlExpiresAt).toLocaleString()})` : ''}
            </p>
            <div className="public-link-row">
              <input value={publicUrl} readOnly />
              <button type="button" className="btn ghost" onClick={copyPublicLink}>Copy</button>
            </div>
          </div>
        ) : null}

        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Enrollment</th>
              <th>Total</th>
              <th>Streak</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map((row) => (
              <tr key={row.enrollmentNo}>
                <td>{row.name}</td>
                <td>{row.enrollmentNo}</td>
                <td>{row.totalSolved}</td>
                <td>{row.streak} days</td>
                <td><span className={`status-pill ${row.status.toLowerCase()}`}>{row.status}</span></td>
                <td>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => navigate(`/teacher/student/${row.enrollmentNo}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <p className="sub">No students found.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="pagination-wrap">
          <p className="sub">Page {currentPage} of {totalPages} • {totalItems} students</p>
          <div className="pagination-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
