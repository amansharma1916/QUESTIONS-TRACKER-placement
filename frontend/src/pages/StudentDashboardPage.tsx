import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

const LANGUAGES = ['python', 'c', 'cpp', 'java', 'javascript'] as const
const DIFFICULTY = ['easy', 'medium', 'hard'] as const
const TOPICS = ['Arrays', 'Strings', 'Linked List', 'Trees', 'DP', 'Graphs', 'Sorting', 'Stacks', 'Design'] as const

type Streak = {
  totalSolved: number
  currentStreak: number
  longestStreak: number
}

type Submission = {
  _id: string
  questionTitle: string
  language: string
  topic: string[]
  difficulty: string
  code: string
  submittedAt: string
}

type EditDraft = {
  questionTitle: string
  language: string
  topic: string[]
  difficulty: string
  code: string
}

type ProfileResponse = {
  profile: { name: string; enrollmentNo: string }
  streak: Streak
  rank: {
    position: number | null
    totalStudents: number
    rules: string[]
  }
  heatmap: Array<{
    date: string
    count: number
    level: number
  }>
}

type SubmissionsListResponse = {
  submissions: Submission[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function StudentDashboardPage() {
  const PAGE_SIZE = 5
  const { token, user } = useAuth()
  const { withLoader, showAlert } = useFeedback()
  const [data, setData] = useState<ProfileResponse | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [submissionsPage, setSubmissionsPage] = useState(1)
  const [submissionsTotalPages, setSubmissionsTotalPages] = useState(1)
  const [submissionsTotalItems, setSubmissionsTotalItems] = useState(0)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)

  useEffect(() => {
    if (!token) {
      return
    }

    withLoader(() => apiRequest<ProfileResponse>('/students/me', { token }))
      .then(setData)
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load dashboard'
        setError(message)
        showAlert(message, 'error')
      })
  }, [showAlert, token, withLoader])

  const submissionsEndpoint = useMemo(() => {
    const enrollmentNo = user?.enrollmentNo || data?.profile.enrollmentNo
    if (!enrollmentNo) {
      return null
    }

    const params = new URLSearchParams({
      page: String(submissionsPage),
      limit: String(PAGE_SIZE),
    })

    return `/submissions/${enrollmentNo}?${params.toString()}`
  }, [data?.profile.enrollmentNo, submissionsPage, user?.enrollmentNo])

  useEffect(() => {
    if (!token || !submissionsEndpoint) {
      return
    }

    withLoader(() => apiRequest<SubmissionsListResponse>(submissionsEndpoint, { token }))
      .then((payload) => {
        setSubmissions(payload.submissions)
        setSubmissionsTotalPages(payload.pagination.totalPages)
        setSubmissionsTotalItems(payload.pagination.totalItems)
      })
      .catch((loadError) => {
        setSubmissions([])
        setSubmissionsTotalPages(1)
        setSubmissionsTotalItems(0)
        showAlert(loadError instanceof Error ? loadError.message : 'Failed to load submissions', 'error')
      })
  }, [showAlert, submissionsEndpoint, token, withLoader])

  useEffect(() => {
    if (submissionsPage > submissionsTotalPages) {
      setSubmissionsPage(submissionsTotalPages)
    }
  }, [submissionsPage, submissionsTotalPages])

  const topicCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of submissions) {
      for (const topic of row.topic) {
        map.set(topic, (map.get(topic) || 0) + 1)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [submissions])

  function startEdit(submission: Submission) {
    setEditingId(submission._id)
    setEditDraft({
      questionTitle: submission.questionTitle,
      language: submission.language,
      topic: [...submission.topic],
      difficulty: submission.difficulty,
      code: submission.code,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  function toggleTopic(topic: string) {
    setEditDraft((current) => {
      if (!current) {
        return current
      }

      const exists = current.topic.includes(topic)
      return {
        ...current,
        topic: exists ? current.topic.filter((item) => item !== topic) : [...current.topic, topic],
      }
    })
  }

  async function saveEdit() {
    if (!token || !editingId || !editDraft) {
      return
    }

    if (!editDraft.questionTitle.trim() || !editDraft.code.trim() || editDraft.topic.length === 0) {
      showAlert('Question title, code, and at least one topic are required', 'warning')
      return
    }

    try {
      const result = await withLoader(() =>
        fetchEditSubmission(token, editingId, editDraft)
      )

      const updatedSubmission = result?.submission
      if (!updatedSubmission) {
        return
      }

      setSubmissions((current) => current.map((item) =>
        item._id === updatedSubmission._id ? updatedSubmission : item
      ))

      showAlert('Submission updated', 'success')
      cancelEdit()
    } catch (updateError) {
      showAlert(updateError instanceof Error ? updateError.message : 'Failed to update submission', 'error')
    }
  }

  if (error) {
    return <p className="error-block">{error}</p>
  }

  const name = data?.profile.name || 'Student'
  const streak = data?.streak || { totalSolved: 0, currentStreak: 0, longestStreak: 0 }
  const rankLabel = data?.rank?.position ? `#${data.rank.position}` : '-'

  return (
    <main className="dashboard">
      <h1>{name}'s Dashboard</h1>
      <section className="kpi-grid">
        <article className="panel kpi"><strong>{streak.totalSolved}</strong><span>total solved</span></article>
        <article className="panel kpi"><strong>{streak.currentStreak}</strong><span>current streak</span></article>
        <article className="panel kpi"><strong>{streak.longestStreak}</strong><span>best streak</span></article>
        <article className="panel kpi"><strong>{user?.role === 'student' ? rankLabel : '-'}</strong><span>class rank</span></article>
      </section>

      <section className="panel">
        <h2>Activity - last 6 months</h2>
        <div className="heatmap-grid" aria-label="Daily submissions heatmap">
          {(data?.heatmap || []).map((day) => (
            <div
              key={day.date}
              className={`heatmap-cell level-${day.level}`}
              title={`${day.date}: ${day.count} submission${day.count === 1 ? '' : 's'}`}
            />
          ))}
        </div>
        <p className="sub">Each square is a day. Darker means more submissions.</p>
      </section>

      <section className="panel">
        <h2>Topics solved</h2>
        <div className="bars">
          {topicCounts.length === 0 ? <p className="sub">No submissions yet</p> : null}
          {topicCounts.map(([topic, count]) => (
            <div key={topic} className="bar-row">
              <p>{topic}</p>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(100, count * 12)}%` }} /></div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Recent submissions</h2>
        <ul className="submission-list">
          {submissions.map((row) => (
            <li key={row._id}>
              <strong>{row.questionTitle}</strong>
              <span>{row.language}</span>
              <span>{row.difficulty}</span>
              <span>{new Date(row.submittedAt).toLocaleDateString()}</span>
              <button type="button" className="btn ghost submission-action" onClick={() => startEdit(row)}>
                Edit
              </button>

              {editingId === row._id && editDraft ? (
                <div className="edit-card">
                  <label>
                    Question title
                    <input
                      value={editDraft.questionTitle}
                      onChange={(event) =>
                        setEditDraft((current) => current ? { ...current, questionTitle: event.target.value } : current)
                      }
                    />
                  </label>

                  <div>
                    <p className="label">Language</p>
                    <div className="chip-row">
                      {LANGUAGES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${editDraft.language === item ? 'selected' : ''}`}
                          onClick={() =>
                            setEditDraft((current) => current ? { ...current, language: item } : current)
                          }
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">Topic</p>
                    <div className="chip-row">
                      {TOPICS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${editDraft.topic.includes(item) ? 'selected' : ''}`}
                          onClick={() => toggleTopic(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="label">Difficulty</p>
                    <div className="chip-row">
                      {DIFFICULTY.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip difficulty ${editDraft.difficulty === item ? `is-${item}` : ''}`}
                          onClick={() =>
                            setEditDraft((current) => current ? { ...current, difficulty: item } : current)
                          }
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label>
                    Code
                    <textarea
                      rows={8}
                      value={editDraft.code}
                      onChange={(event) =>
                        setEditDraft((current) => current ? { ...current, code: event.target.value } : current)
                      }
                    />
                  </label>

                  <div className="edit-actions">
                    <button type="button" className="btn" onClick={saveEdit}>Save changes</button>
                    <button type="button" className="btn ghost" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
          {submissions.length === 0 ? <li><p className="sub">No submissions yet.</p></li> : null}
        </ul>

        <div className="pagination-wrap">
          <p className="sub">Page {submissionsPage} of {submissionsTotalPages} • {submissionsTotalItems} submissions</p>
          <div className="pagination-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSubmissionsPage((page) => Math.max(1, page - 1))}
              disabled={submissionsPage === 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSubmissionsPage((page) => Math.min(submissionsTotalPages, page + 1))}
              disabled={submissionsPage === submissionsTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

async function fetchEditSubmission(token: string, submissionId: string, draft: EditDraft) {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/submissions/item/${submissionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(draft),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Failed to update submission' }))
    throw new Error(payload.message || 'Failed to update submission')
  }

  return response.json() as Promise<{ submission: Submission }>
}
