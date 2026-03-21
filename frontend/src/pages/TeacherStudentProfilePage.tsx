import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/auth'
import { useFeedback } from '../ui/feedback'

type StudentSubmission = {
  _id: string
  questionTitle: string
  language: string
  topic: string[]
  difficulty: string
  submittedAt: string
  code: string
}

type StudentProfileResponse = {
  profile: {
    name: string
    enrollmentNo: string
    department?: string
    section?: string
    createdAt?: string
    lastActiveAt?: string
  }
  streak: {
    currentStreak: number
    longestStreak: number
    totalSolved: number
    lastSubmissionDate?: string
  } | null
  submissions: StudentSubmission[]
}

export function TeacherStudentProfilePage() {
  const { enrollmentNo } = useParams<{ enrollmentNo: string }>()
  const { token } = useAuth()
  const { withLoader, showAlert } = useFeedback()
  const navigate = useNavigate()
  const [studentProfile, setStudentProfile] = useState<StudentProfileResponse | null>(null)

  useEffect(() => {
    if (!token || !enrollmentNo) {
      return
    }

    withLoader(() => apiRequest<StudentProfileResponse>(`/students/${enrollmentNo}`, { token }))
      .then(setStudentProfile)
      .catch((error) => {
        showAlert(error instanceof Error ? error.message : 'Failed to load student profile', 'error')
      })
  }, [enrollmentNo, showAlert, token, withLoader])

  async function deleteStudent() {
    if (!token || !studentProfile) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${studentProfile.profile.name} (${studentProfile.profile.enrollmentNo})? This will remove profile, streak, and all submissions.`
    )
    if (!confirmed) {
      return
    }

    try {
      await withLoader(() =>
        apiRequest<{ message: string }>(`/students/${studentProfile.profile.enrollmentNo}`, {
          method: 'DELETE',
          token,
        })
      )
      showAlert('Student deleted successfully', 'success')
      navigate('/teacher')
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'Failed to delete student', 'error')
    }
  }

  if (!studentProfile) {
    return (
      <main className="dashboard">
        <section className="panel">
          <p className="sub">Loading student profile...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard">
      <section className="panel profile-page-header">
        <Link to="/teacher" className="btn ghost">Back to dashboard</Link>
        <h1>{studentProfile.profile.name}</h1>
        <p className="sub">{studentProfile.profile.enrollmentNo}</p>
        <button type="button" className="btn danger" onClick={deleteStudent}>Delete student</button>
      </section>

      <section className="panel">
        <h2>Student details</h2>
        <div className="profile-details-grid">
          <div className="profile-detail-item">
            <span className="sub">Name</span>
            <strong>{studentProfile.profile.name}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Enrollment</span>
            <strong>{studentProfile.profile.enrollmentNo}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Department</span>
            <strong>{studentProfile.profile.department || '-'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Section</span>
            <strong>{studentProfile.profile.section || '-'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Joined</span>
            <strong>
              {studentProfile.profile.createdAt
                ? new Date(studentProfile.profile.createdAt).toLocaleDateString()
                : '-'}
            </strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Last active</span>
            <strong>
              {studentProfile.profile.lastActiveAt
                ? new Date(studentProfile.profile.lastActiveAt).toLocaleDateString()
                : '-'}
            </strong>
          </div>
          <div className="profile-detail-item">
            <span className="sub">Last submission</span>
            <strong>
              {studentProfile.streak?.lastSubmissionDate
                ? new Date(studentProfile.streak.lastSubmissionDate).toLocaleDateString()
                : '-'}
            </strong>
          </div>
        </div>

        <h2>Performance snapshot</h2>
        <div className="profile-stats">
          <div>
            <strong>{studentProfile.streak?.totalSolved || 0}</strong>
            <span>Total solved</span>
          </div>
          <div>
            <strong>{studentProfile.streak?.currentStreak || 0}</strong>
            <span>Current streak</span>
          </div>
          <div>
            <strong>{studentProfile.streak?.longestStreak || 0}</strong>
            <span>Best streak</span>
          </div>
          <div>
            <strong>{studentProfile.submissions.length}</strong>
            <span>Submissions</span>
          </div>
        </div>
      </section>

      <section className="panel teacher-profile-submissions">
        <h2>Submission history</h2>
        <ul className="submission-list">
          {studentProfile.submissions.map((submission) => (
            <li key={submission._id}>
              <strong>{submission.questionTitle}</strong>
              <span>{submission.language}</span>
              <span>{submission.difficulty}</span>
              <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
              <details>
                <summary>View code</summary>
                <pre>{submission.code}</pre>
              </details>
            </li>
          ))}
          {studentProfile.submissions.length === 0 ? (
            <li>
              <p className="sub">No submissions found for this student.</p>
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  )
}
