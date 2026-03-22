import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'
import { downloadSubmissionCode } from '../utils/codeDownload'

const LANGUAGES = ['python', 'c', 'cpp', 'java', 'javascript'] as const
const DIFFICULTY = ['easy', 'medium', 'hard'] as const
const TOPICS = ['NA', 'Arrays', 'Strings', 'Linked List', 'Trees', 'DP', 'Graphs', 'Sorting', 'Stacks', 'Design'] as const

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

type CreateDraft = {
  questionTitle: string
  language: string
  topic: string[]
  difficulty: string
  code: string
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
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    questionTitle: '',
    language: 'python',
    topic: ['NA'],
    difficulty: 'easy',
    code: '',
  })
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')

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

  const canCreateSubmit = useMemo(() => {
    return Boolean(
      createDraft.questionTitle.trim()
      && createDraft.code.trim()
      && createDraft.topic.length > 0
      && token
    )
  }, [createDraft.code, createDraft.questionTitle, createDraft.topic.length, token])

  function toggleCreateTopic(topic: string) {
    setCreateDraft((current) => {
      if (topic === 'NA') {
        return { ...current, topic: ['NA'] }
      }

      const withoutNa = current.topic.filter((value) => value !== 'NA')
      const next = withoutNa.includes(topic)
        ? withoutNa.filter((value) => value !== topic)
        : [...withoutNa, topic]

      return { ...current, topic: next.length > 0 ? next : ['NA'] }
    })
  }

  function inferLanguageFromFileName(fileName: string) {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.py')) return 'python'
    if (lower.endsWith('.c')) return 'c'
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp'
    if (lower.endsWith('.java')) return 'java'
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'javascript'
    return null
  }

  async function handleCodeFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const fileContent = await file.text()
      const inferred = inferLanguageFromFileName(file.name)
      const baseTitle = file.name.replace(/\.[^/.]+$/, '')

      setCreateDraft((current) => ({
        ...current,
        code: fileContent,
        questionTitle: current.questionTitle.trim() ? current.questionTitle : baseTitle,
        language: inferred || current.language,
      }))
      setUploadedFileName(file.name)
      showAlert('Code file loaded. You can edit before submitting.', 'info')
    } catch {
      showAlert('Unable to read selected file', 'error')
    } finally {
      event.target.value = ''
    }
  }

  async function submitNewSubmission(event: FormEvent) {
    event.preventDefault()

    if (!token) {
      showAlert('Please login to submit code', 'warning')
      return
    }

    const enrollmentNo = user?.enrollmentNo || data?.profile.enrollmentNo
    if (!enrollmentNo) {
      showAlert('Enrollment number not found for your account', 'error')
      return
    }

    if (!createDraft.questionTitle.trim() || !createDraft.code.trim() || createDraft.topic.length === 0) {
      showAlert('Question title, code, and at least one topic are required', 'warning')
      return
    }

    setCreateSubmitting(true)
    try {
      await withLoader(async () => {
        await apiRequest('/submissions', {
          method: 'POST',
          token,
          body: {
            enrollmentNo,
            questionTitle: createDraft.questionTitle,
            language: createDraft.language,
            topic: createDraft.topic,
            difficulty: createDraft.difficulty,
            code: createDraft.code,
          },
        })

        const [profilePayload, submissionsPayload] = await Promise.all([
          apiRequest<ProfileResponse>('/students/me', { token }),
          apiRequest<SubmissionsListResponse>(`/submissions/${enrollmentNo}?page=1&limit=${PAGE_SIZE}`, { token }),
        ])

        setData(profilePayload)
        setSubmissions(submissionsPayload.submissions)
        setSubmissionsTotalPages(submissionsPayload.pagination.totalPages)
        setSubmissionsTotalItems(submissionsPayload.pagination.totalItems)
        setSubmissionsPage(1)
      })

      setCreateDraft((current) => ({
        ...current,
        questionTitle: '',
        code: '',
      }))
      setUploadedFileName('')
      showAlert('Submission saved successfully', 'success')
    } catch (submitError) {
      showAlert(submitError instanceof Error ? submitError.message : 'Failed to submit solution', 'error')
    } finally {
      setCreateSubmitting(false)
    }
  }

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
        <article className="panel kpi"><strong>{user?.role === 'student' ? rankLabel : '-'}</strong><span>rank</span></article>
      </section>

      <section className="panel">
        <h2>Submit new solution</h2>
        <p className="sub">Upload an existing code file or paste code manually, just like on the home page.</p>

        <form onSubmit={submitNewSubmission} className="submit-form">
          <div className="input-row">
            <label>
              Question title / number
              <input
                value={createDraft.questionTitle}
                onChange={(event) => setCreateDraft((current) => ({ ...current, questionTitle: event.target.value }))}
                placeholder="e.g. Two Sum (LC 1)"
                required
              />
            </label>
            <label>
              Upload existing code file (optional)
              <input
                type="file"
                accept=".py,.c,.cpp,.cc,.cxx,.java,.js,.mjs,.cjs,.txt"
                onChange={handleCodeFileSelected}
              />
              {uploadedFileName ? <span className="sub">Loaded: {uploadedFileName}</span> : null}
            </label>
          </div>

          <div>
            <p className="label">Language</p>
            <div className="chip-row">
              {LANGUAGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${createDraft.language === item ? 'selected' : ''}`}
                  onClick={() => setCreateDraft((current) => ({ ...current, language: item }))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Topic (multi-select)</p>
            <div className="chip-row">
              {TOPICS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${createDraft.topic.includes(item) ? 'selected' : ''}`}
                  onClick={() => toggleCreateTopic(item)}
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
                  className={`chip difficulty ${createDraft.difficulty === item ? `is-${item}` : ''}`}
                  onClick={() => setCreateDraft((current) => ({ ...current, difficulty: item }))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label>
            Paste your code
            <textarea
              rows={11}
              value={createDraft.code}
              onChange={(event) => setCreateDraft((current) => ({ ...current, code: event.target.value }))}
              placeholder="# Paste your solution here..."
              required
            />
          </label>

          <button type="submit" className="btn" disabled={!canCreateSubmit || createSubmitting}>
            {createSubmitting ? 'Submitting...' : 'Submit solution'}
          </button>
        </form>
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
              <div className="submission-actions">
                <button type="button" className="btn ghost submission-action" onClick={() => startEdit(row)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn ghost submission-action"
                  onClick={() => downloadSubmissionCode(row.questionTitle, row.language, row.code)}
                >
                  Download
                </button>
              </div>

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
