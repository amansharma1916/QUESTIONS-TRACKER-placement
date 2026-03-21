import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Student } from '../models/Student.js'
import { Submission } from '../models/Submission.js'
import { Teacher } from '../models/Teacher.js'
import { recomputeStreakFromSubmissions } from '../services/streakService.js'

const router = express.Router()

const VALID_DEPARTMENTS = ['Btech', 'BCA']
const SECTION_BY_DEPARTMENT = {
  Btech: ['AI/ML A', 'AI/ML B', 'A', 'B', 'C', 'D'],
  BCA: ['A', 'B', 'C', 'D'],
}

function signStudentToken(enrollmentNo) {
  return jwt.sign({ enrollmentNo, role: 'student' }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

function signTeacherToken(email) {
  return jwt.sign({ email, role: 'teacher' }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, enrollmentNo, password, department, section } = req.body
    if (!name || !enrollmentNo || !password) {
      return res.status(400).json({ message: 'name, enrollmentNo and password are required' })
    }

    const normalizedDepartment = VALID_DEPARTMENTS.includes(String(department || '').trim())
      ? String(department).trim()
      : 'Btech'

    const allowedSections = SECTION_BY_DEPARTMENT[normalizedDepartment]
    const normalizedSection = allowedSections.includes(String(section || '').trim())
      ? String(section).trim()
      : allowedSections[0]

    const normalized = String(enrollmentNo).toUpperCase().trim()
    const existing = await Student.findOne({ enrollmentNo: normalized }).lean()
    if (existing) {
      return res.status(409).json({ message: 'Enrollment number already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const student = await Student.create({
      name,
      enrollmentNo: normalized,
      department: normalizedDepartment,
      section: normalizedSection,
      passwordHash,
    })

    await Submission.updateMany(
      { enrollmentNo: normalized, isAnonymous: true },
      { $set: { isAnonymous: false } }
    )
    await recomputeStreakFromSubmissions(normalized)

    const token = signStudentToken(normalized)
    return res.status(201).json({
      token,
      student: {
        name: student.name,
        enrollmentNo: student.enrollmentNo,
        department: student.department,
        section: student.section,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { enrollmentNo, password } = req.body
    if (!enrollmentNo || !password) {
      return res.status(400).json({ message: 'enrollmentNo and password are required' })
    }

    const normalized = String(enrollmentNo).toUpperCase().trim()
    const student = await Student.findOne({ enrollmentNo: normalized })
    if (!student) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const passwordOk = await bcrypt.compare(password, student.passwordHash)
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    student.lastActiveAt = new Date()
    await student.save()

    const token = signStudentToken(student.enrollmentNo)
    return res.json({
      token,
      student: { name: student.name, enrollmentNo: student.enrollmentNo },
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/teacher/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' })
    }

    const normalized = String(email).toLowerCase().trim()
    const teacher = await Teacher.findOne({ email: normalized })
    if (!teacher) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const passwordOk = await bcrypt.compare(password, teacher.passwordHash)
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signTeacherToken(teacher.email)
    return res.json({
      token,
      teacher: { email: teacher.email, name: teacher.name },
    })
  } catch (error) {
    return next(error)
  }
})

export default router
