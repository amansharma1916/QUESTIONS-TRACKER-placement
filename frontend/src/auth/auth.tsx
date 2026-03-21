import { createContext, useContext, useMemo, useState } from 'react'

type Role = 'student' | 'teacher'

type AuthUser = {
  role: Role
  enrollmentNo?: string
  email?: string
}

type AuthContextType = {
  token: string | null
  user: AuthUser | null
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)
const TOKEN_KEY = 'dsa-tracker-token'

function decodePayload(token: string): AuthUser | null {
  try {
    const payloadPart = token.split('.')[1]
    const payload = JSON.parse(atob(payloadPart)) as {
      role?: Role
      enrollmentNo?: string
      email?: string
    }

    if (!payload.role) {
      return null
    }

    return {
      role: payload.role,
      enrollmentNo: payload.enrollmentNo,
      email: payload.email,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialToken = localStorage.getItem(TOKEN_KEY)
  const [token, setToken] = useState<string | null>(initialToken)
  const [user, setUser] = useState<AuthUser | null>(initialToken ? decodePayload(initialToken) : null)

  const value = useMemo<AuthContextType>(() => ({
    token,
    user,
    login: (newToken) => {
      localStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
      setUser(decodePayload(newToken))
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    },
  }), [token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
