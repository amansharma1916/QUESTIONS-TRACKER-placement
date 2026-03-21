import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

function readToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return null
  }
  return token
}

export function requireAuth(req, res, next) {
  const token = readToken(req)
  if (!token) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' })
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret)
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function requireStudent(req, res, next) {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ message: 'Student access required' })
  }
  return next()
}

export function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ message: 'Teacher access required' })
  }
  return next()
}
