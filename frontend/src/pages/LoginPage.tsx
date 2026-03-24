import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

type StudentLoginResponse = {
  token: string
}

type TeacherLoginResponse = {
  token: string
}


export function LoginPage() {
  const [mode, setMode] = useState<'student' | 'teacher'>('student')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { showAlert, withLoader } = useFeedback()
  const navigate = useNavigate()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = await withLoader(() => (
        mode === 'student'
          ? apiRequest<StudentLoginResponse>('/auth/login', {
              method: 'POST',
              body: { enrollmentNo, password },
            })
          : apiRequest<TeacherLoginResponse>('/auth/teacher/login', {
              method: 'POST',
              body: { email, password },
            })
      ))

      login(payload.token)
      showAlert('Signed in successfully', 'success')
      navigate(mode === 'teacher' ? '/teacher' : '/student')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Login failed'
      setError(message)
      showAlert(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrap">
      <section className="panel auth-panel">
        <h1>Sign in</h1>
        <div className="chip-row">
          <button type="button" className={`chip ${mode === 'student' ? 'selected' : ''}`} onClick={() => setMode('student')}>
            Student
          </button>
          <button type="button" className={`chip ${mode === 'teacher' ? 'selected' : ''}`} onClick={() => setMode('teacher')}>
            Teacher
          </button>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'student' ? (
            <label>
              Enrollment number
              <input value={enrollmentNo} onChange={(e) => setEnrollmentNo(e.target.value)} required />
            </label>
          ) : (
            <label>
              Teacher email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
          )}

          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          {error ? <p className="error">{error}</p> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
