import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

const DEPARTMENTS = ['Btech', 'BCA'] as const
const SECTION_BY_DEPARTMENT = {
  Btech: ['AI/ML A', 'AI/ML B', 'A', 'B', 'C', 'D'],
  BCA: ['A', 'B', 'C', 'D'],
} as const

type Department = (typeof DEPARTMENTS)[number]

type RegisterResponse = {
  token: string
}

export function RegisterPage() {
  const [name, setName] = useState('')
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState<Department>('Btech')
  const [section, setSection] = useState<string>('AI/ML A')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()
  const { showAlert, withLoader } = useFeedback()

  const availableSections = SECTION_BY_DEPARTMENT[department]

  function onDepartmentChange(value: Department) {
    setDepartment(value)
    const nextSections = SECTION_BY_DEPARTMENT[value] as readonly string[]
    if (!nextSections.includes(section)) {
      setSection(nextSections[0])
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await withLoader(() => apiRequest<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { name, enrollmentNo, password, department, section },
      }))
      login(data.token)
      showAlert('Account created successfully', 'success')
      navigate('/student')
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : 'Register failed'
      setError(message)
      showAlert(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-wrap">
      <section className="panel auth-panel">
        <h1>Create account</h1>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Enrollment number
            <input value={enrollmentNo} onChange={(e) => setEnrollmentNo(e.target.value)} required />
          </label>
          <label>
            Department
            <select value={department} onChange={(e) => onDepartmentChange(e.target.value as Department)}>
              {DEPARTMENTS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <fieldset className="section-group">
            <legend>Section</legend>
            <div className="section-options" role="radiogroup" aria-label="Section">
              {availableSections.map((item) => (
                <label key={item} className={`section-option ${section === item ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="section"
                    value={item}
                    checked={section === item}
                    onChange={() => setSection(item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </section>
    </main>
  )
}
