import express from 'express'
import { Parser } from 'json2csv'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { requireAuth, requireTeacher } from '../middleware/auth.js'
import { Student } from '../models/Student.js'
import { Submission } from '../models/Submission.js'
import { Streak } from '../models/Streak.js'
import { dayDifference, toDayString } from '../utils/date.js'
import { compareLeaderboardRows, LEADERBOARD_RULES } from '../utils/leaderboard.js'

const router = express.Router()

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildAnalyticsPayload(rows, submissions) {
  const top5 = [...rows].sort(compareLeaderboardRows).slice(0, 5)
  const inactiveCount = rows.filter((row) => row.status === 'Inactive').length

  const topicCoverage = new Map()
  const languageCounts = new Map()
  const difficultyCounts = new Map()

  for (const s of submissions) {
    for (const topic of s.topic || []) {
      if (!topicCoverage.has(topic)) {
        topicCoverage.set(topic, new Set())
      }
      topicCoverage.get(topic).add(s.enrollmentNo)
    }

    const language = (s.language || 'unknown').toLowerCase()
    languageCounts.set(language, (languageCounts.get(language) || 0) + 1)

    const difficulty = (s.difficulty || 'unknown').toLowerCase()
    difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1)
  }

  const totalStudents = rows.length || 1
  const totalSubmissions = submissions.length || 1

  const topicStats = [...topicCoverage.entries()].map(([topic, set]) => ({
    topic,
    studentCount: set.size,
    percentage: Math.round((set.size / totalStudents) * 100),
  }))

  const languageStats = [...languageCounts.entries()]
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / totalSubmissions) * 100),
    }))
    .sort((a, b) => b.count - a.count)

  const difficultyStats = [...difficultyCounts.entries()]
    .map(([difficulty, count]) => ({
      difficulty,
      count,
      percentage: Math.round((count / totalSubmissions) * 100),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    summary: {
      studentsRegistered: rows.length,
      totalSubmissions: submissions.length,
      activeThisWeek: rows.filter((row) => row.status === 'Active').length,
      inactive7Days: inactiveCount,
    },
    leaderboardRules: LEADERBOARD_RULES,
    top5,
    topicStats,
    languageStats,
    difficultyStats,
  }
}

async function getStudentRows() {
  const [students, streaks, latestQuestions] = await Promise.all([
    Student.find({}).select('-passwordHash').lean(),
    Streak.find({}).lean(),
    Submission.aggregate([
      { $sort: { submittedAt: -1 } },
      {
        $group: {
          _id: '$enrollmentNo',
          questionTitles: { $push: '$questionTitle' },
        },
      },
      {
        $project: {
          _id: 1,
          last5QuestionTitles: { $slice: ['$questionTitles', 5] },
        },
      },
    ]),
  ])

  const streakMap = new Map(streaks.map((s) => [s.enrollmentNo, s]))
  const latestQuestionMap = new Map(latestQuestions.map((row) => [row._id, row.last5QuestionTitles]))

  return students.map((student) => {
    const streak = streakMap.get(student.enrollmentNo)
    const currentStreak = streak?.currentStreak || 0
    const totalSolved = streak?.totalSolved || 0
    const last = streak?.lastSubmissionDate
    const inactive = !last || dayDifference(last, toDayString()) >= 7

    return {
      name: student.name,
      enrollmentNo: student.enrollmentNo,
      totalSolved,
      streak: currentStreak,
      status: inactive ? 'Inactive' : 'Active',
      last5QuestionTitles: (latestQuestionMap.get(student.enrollmentNo) || []).join(' | '),
      lastSubmissionDate: last,
      lastActiveAt: student.lastActiveAt,
    }
  })
}

router.get('/students', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const pageRaw = Number(req.query.page)
    const limitRaw = Number(req.query.limit)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(50, Math.floor(limitRaw))
      : 5
    const search = String(req.query.search || '').trim()

    const filter = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: 'i' } },
            { enrollmentNo: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {}

    const skip = (page - 1) * limit

    const [students, totalItems] = await Promise.all([
      Student.find(filter)
        .select('-passwordHash')
        .sort({ enrollmentNo: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter),
    ])

    const enrollments = students.map((student) => student.enrollmentNo)
    const streaks = enrollments.length
      ? await Streak.find({ enrollmentNo: { $in: enrollments } }).lean()
      : []
    const streakMap = new Map(streaks.map((item) => [item.enrollmentNo, item]))

    const rows = students.map((student) => {
      const streak = streakMap.get(student.enrollmentNo)
      const currentStreak = streak?.currentStreak || 0
      const totalSolved = streak?.totalSolved || 0
      const last = streak?.lastSubmissionDate
      const inactive = !last || dayDifference(last, toDayString()) >= 7

      return {
        name: student.name,
        enrollmentNo: student.enrollmentNo,
        totalSolved,
        streak: currentStreak,
        status: inactive ? 'Inactive' : 'Active',
        lastSubmissionDate: last,
        lastActiveAt: student.lastActiveAt,
      }
    })

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return res.json({
      students: rows,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/analytics', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const rows = await getStudentRows()
    const submissions = await Submission.find({}).lean()
    return res.json(buildAnalyticsPayload(rows, submissions))
  } catch (error) {
    return next(error)
  }
})

router.post('/public-link', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const sharedBy = req.user?.email || req.user?.enrollmentNo || 'teacher'
    const token = jwt.sign(
      { type: 'public-analytics', sharedBy },
      env.jwtSecret,
      { expiresIn: '24h' }
    )

    const decoded = jwt.decode(token)
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null
    const frontendBase = String(env.frontendOrigin || '').replace(/\/$/, '')
    const publicUrl = `${frontendBase}/public/progress/${token}`

    return res.json({ publicUrl, expiresAt })
  } catch (error) {
    return next(error)
  }
})

router.get('/public/analytics/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '')
    if (!token) {
      return res.status(400).json({ message: 'Missing public token' })
    }

    let payload
    try {
      payload = jwt.verify(token, env.jwtSecret)
    } catch {
      return res.status(401).json({ message: 'Public link is invalid or expired' })
    }

    if (payload?.type !== 'public-analytics') {
      return res.status(403).json({ message: 'Invalid public analytics token' })
    }

    const rows = await getStudentRows()
    const submissions = await Submission.find({}).lean()
    const analytics = buildAnalyticsPayload(rows, submissions)
    const expiresAt = payload?.exp ? new Date(payload.exp * 1000).toISOString() : null

    return res.json({
      sharedBy: payload.sharedBy || null,
      expiresAt,
      analytics,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/export/csv', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const rows = await getStudentRows()
    const parser = new Parser({
      fields: ['name', 'enrollmentNo', 'totalSolved', 'streak', 'status', 'last5QuestionTitles', 'lastSubmissionDate'],
    })
    const csv = parser.parse(rows)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="dsa-tracker-students.csv"')
    return res.status(200).send(csv)
  } catch (error) {
    return next(error)
  }
})

export default router
