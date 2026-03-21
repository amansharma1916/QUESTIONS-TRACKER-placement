import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

const LANGUAGES = ['python', 'c', 'cpp', 'java', 'javascript'] as const
const TOPICS = ['NA', 'Arrays', 'Strings', 'Linked List', 'Trees', 'DP', 'Graphs', 'Sorting', 'Stacks', 'Design'] as const
const DIFFICULTY = ['easy', 'medium', 'hard'] as const

type ResolveEnrollmentResponse = {
  enrollmentNo: string
  matchedBy: 'exact' | 'suffix'
}

export function HomePage() {
  const { user } = useAuth()
  const { withLoader, showAlert } = useFeedback()
  const [enrollmentNo, setEnrollmentNo] = useState(user?.enrollmentNo || '')
  const [questionTitle, setQuestionTitle] = useState('')
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('python')
  const [topics, setTopics] = useState<string[]>(['NA'])
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY)[number]>('easy')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(() => {
    return Boolean(enrollmentNo.trim() && questionTitle.trim() && code.trim() && topics.length > 0)
  }, [enrollmentNo, questionTitle, code, topics])

  function toggleTopic(topic: string) {
    setTopics((current) => {
      if (topic === 'NA') {
        return ['NA']
      }

      const withoutNa = current.filter((value) => value !== 'NA')
      const next = withoutNa.includes(topic)
        ? withoutNa.filter((value) => value !== topic)
        : [...withoutNa, topic]

      return next.length > 0 ? next : ['NA']
    })
  }

  async function resolveEnrollment(input: string, showResolvedToast: boolean) {
    const trimmed = input.trim()
    if (!trimmed) {
      return input
    }

    if (!/^\d{1,4}$/.test(trimmed) && !/^[A-Za-z0-9]+$/.test(trimmed)) {
      return input
    }

    try {
      const result = await apiRequest<ResolveEnrollmentResponse>('/students/resolve-enrollment', {
        method: 'POST',
        body: { input: trimmed },
      })

      if (result.enrollmentNo !== enrollmentNo) {
        setEnrollmentNo(result.enrollmentNo)
      }

      if (showResolvedToast && result.matchedBy === 'suffix') {
        showAlert(`Mapped ${trimmed} to ${result.enrollmentNo}`, 'info')
      }

      return result.enrollmentNo
    } catch {
      return input
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)

    try {
      const resolvedEnrollment = await resolveEnrollment(enrollmentNo, false)
      await withLoader(() => apiRequest('/submissions', {
        method: 'POST',
        body: {
          enrollmentNo: resolvedEnrollment,
          questionTitle,
          language,
          topic: topics,
          difficulty,
          code,
        },
      }))
      setCode('')
      setQuestionTitle('')
      showAlert('Submission saved successfully', 'success')
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Submission failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="layout-grid layout-grid-single">
      <section className="panel">
        <h1>Submit your DSA solution</h1>
        <p className="sub">No login needed. Paste code and tag language, topics, and difficulty.</p>

        <form onSubmit={handleSubmit} className="submit-form">
          <div className="input-row">
            <label>
              Enrollment number
              <input
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                onBlur={() => {
                  void resolveEnrollment(enrollmentNo, true)
                }}
                placeholder="e.g. 22CS047"
                required
              />
            </label>
            <label>
              Question title / number
              <input
                value={questionTitle}
                onChange={(e) => setQuestionTitle(e.target.value)}
                placeholder="e.g. Two Sum (LC 1)"
                required
              />
            </label>
          </div>

          <div>
            <p className="label">Language</p>
            <div className="chip-row">
              {LANGUAGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${language === item ? 'selected' : ''}`}
                  onClick={() => setLanguage(item)}
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
                  className={`chip ${topics.includes(item) ? 'selected' : ''}`}
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
                  className={`chip difficulty ${difficulty === item ? `is-${item}` : ''}`}
                  onClick={() => setDifficulty(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label>
            Paste your code
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={11}
              placeholder="# Paste your solution here..."
              required
            />
          </label>

          <button type="submit" className="btn" disabled={!canSubmit || submitting}>
            {submitting ? 'Submitting...' : 'Submit solution'}
          </button>
        </form>
      </section>
    </main>
  )
}
