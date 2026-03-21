import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'

export function ProtectedRoute({
  role,
  children,
}: {
  role?: 'student' | 'teacher'
  children: React.ReactNode
}) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />
  }

  return <>{children}</>
}
