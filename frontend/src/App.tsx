import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { useAuth } from './auth/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TopNav } from './components/TopNav'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { PublicProgressPage } from './pages/PublicProgressPage'
import { StudentDashboardPage } from './pages/StudentDashboardPage'
import { TeacherDashboardPage } from './pages/TeacherDashboardPage'
import { TeacherStudentProfilePage } from './pages/TeacherStudentProfilePage'

function App() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <TopNav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/public/progress/:token" element={<PublicProgressPage />} />
        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/student/:enrollmentNo"
          element={
            <ProtectedRoute role="teacher">
              <TeacherStudentProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={user?.role === 'teacher' ? '/teacher' : '/'} replace />}
        />
      </Routes>
    </div>
  )
}

export default App
