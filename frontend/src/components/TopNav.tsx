import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'

export function TopNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const dashboardPath = user?.role === 'teacher' ? '/teacher' : '/student'

  return (
    <header className="top-nav">
      <Link to="/" className="brand">DSA Tracker</Link>
      <nav>
        {user ? (
          <>
            <NavLink to={dashboardPath} className="nav-link">Dashboard</NavLink>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="btn ghost">Sign in</NavLink>
            <NavLink to="/register" className="btn">Register</NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
