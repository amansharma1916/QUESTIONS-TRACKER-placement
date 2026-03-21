import express from 'express'
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js'
import { Student } from '../models/Student.js'
import { Submission } from '../models/Submission.js'
import { Streak } from '../models/Streak.js'
import { toDayString } from '../utils/date.js'
import { compareLeaderboardRows, LEADERBOARD_RULES } from '../utils/leaderboard.js'

const router = express.Router()

function buildHeatmapDays(dayCountsMap, totalDays = 180) {
  const result = []
  const base = new Date()

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(base)
    date.setUTCDate(base.getUTCDate() - offset)
    const day = toDayString(date)
    const count = dayCountsMap.get(day) || 0

    let level = 0
    if (count > 0) level = 1
    if (count >= 2) level = 2
    if (count >= 3) level = 3
    if (count >= 5) level = 4

    result.push({ date: day, count, level })
  }

  return result
}

router.post('/resolve-enrollment', async (req, res, next) => {
  try {
    const rawInput = String(req.body?.input || '').trim().toUpperCase()
    if (!rawInput) {
      return res.status(400).json({ message: 'input is required' })
    }

    const exact = await Student.findOne({ enrollmentNo: rawInput }).select('enrollmentNo').lean()
    if (exact) {
      return res.json({ enrollmentNo: exact.enrollmentNo, matchedBy: 'exact' })
    }

    if (!/^\d{1,4}$/.test(rawInput)) {
      return res.status(400).json({
        message: 'Enter full enrollment number or last up to 4 digits',
      })
    }

    const suffixRegex = new RegExp(`${rawInput}$`)
    const matches = await Student.find({ enrollmentNo: suffixRegex }).select('enrollmentNo').lean()

    if (matches.length === 0) {
      return res.status(404).json({ message: 'No student found for this suffix' })
    }

    if (matches.length > 1) {
      return res.status(409).json({
        message: 'Suffix matches multiple students. Please enter full enrollment number.',
      })
    }

    return res.json({ enrollmentNo: matches[0].enrollmentNo, matchedBy: 'suffix' })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', requireAuth, requireStudent, async (req, res, next) => {
  try {
    const enrollmentNo = req.user.enrollmentNo

    const [student, streak, allStreaks, allStudents, heatmapAggregation] = await Promise.all([
      Student.findOne({ enrollmentNo }).select('-passwordHash').lean(),
      Streak.findOne({ enrollmentNo }).lean(),
      Streak.find({}).lean(),
      Student.find({}).select('enrollmentNo').lean(),
      Submission.aggregate([
        { $match: { enrollmentNo } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
            count: { $sum: 1 },
          },
        },
      ]),
    ])

    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }

    const streakMap = new Map(allStreaks.map((row) => [row.enrollmentNo, row]))
    const leaderboardRows = allStudents.map((row) => {
      const rowStreak = streakMap.get(row.enrollmentNo)
      return {
        enrollmentNo: row.enrollmentNo,
        totalSolved: rowStreak?.totalSolved || 0,
        streak: rowStreak?.currentStreak || 0,
        lastSubmissionDate: rowStreak?.lastSubmissionDate || null,
      }
    })

    leaderboardRows.sort(compareLeaderboardRows)
    const rankIndex = leaderboardRows.findIndex((row) => row.enrollmentNo === enrollmentNo)

    const dayCounts = new Map(heatmapAggregation.map((row) => [row._id, row.count]))

    return res.json({
      profile: student,
      streak: streak || {
        enrollmentNo,
        currentStreak: 0,
        longestStreak: 0,
        lastSubmissionDate: null,
        totalSolved: 0,
      },
      rank: {
        position: rankIndex >= 0 ? rankIndex + 1 : null,
        totalStudents: leaderboardRows.length,
        rules: LEADERBOARD_RULES,
      },
      heatmap: buildHeatmapDays(dayCounts, 180),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/:enrollmentNo', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const enrollmentNo = String(req.params.enrollmentNo).toUpperCase().trim()

    const [student, streak, submissions] = await Promise.all([
      Student.findOne({ enrollmentNo }).select('-passwordHash').lean(),
      Streak.findOne({ enrollmentNo }).lean(),
      Submission.find({ enrollmentNo }).sort({ submittedAt: -1 }).lean(),
    ])

    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }

    return res.json({ profile: student, streak, submissions })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:enrollmentNo', requireAuth, requireTeacher, async (req, res, next) => {
  try {
    const enrollmentNo = String(req.params.enrollmentNo).toUpperCase().trim()

    const student = await Student.findOneAndDelete({ enrollmentNo }).lean()
    if (!student) {
      return res.status(404).json({ message: 'Student not found' })
    }

    await Promise.all([
      Submission.deleteMany({ enrollmentNo }),
      Streak.deleteOne({ enrollmentNo }),
    ])

    return res.json({ message: 'Student deleted successfully' })
  } catch (error) {
    return next(error)
  }
})

export default router
