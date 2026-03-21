import express from 'express'
import { requireAuth, requireStudent } from '../middleware/auth.js'
import { Submission } from '../models/Submission.js'
import { Student } from '../models/Student.js'
import { updateStreakOnSubmission } from '../services/streakService.js'

const router = express.Router()

router.post('/', async (req, res, next) => {
  try {
    const { enrollmentNo, questionTitle, code, language, topic, difficulty } = req.body

    if (!enrollmentNo || !questionTitle || !code || !language || !topic || !difficulty) {
      return res.status(400).json({
        message: 'enrollmentNo, questionTitle, code, language, topic and difficulty are required',
      })
    }

    const normalized = String(enrollmentNo).toUpperCase().trim()
    const student = await Student.findOne({ enrollmentNo: normalized }).lean()
    const isAnonymous = !student

    const submission = await Submission.create({
      enrollmentNo: normalized,
      questionTitle,
      code,
      language,
      topic,
      difficulty,
      isAnonymous,
      submittedAt: new Date(),
    })

    await updateStreakOnSubmission(normalized, submission.submittedAt)
    if (student) {
      await Student.updateOne({ enrollmentNo: normalized }, { $set: { lastActiveAt: new Date() } })
    }

    return res.status(201).json({ submission })
  } catch (error) {
    return next(error)
  }
})

router.patch('/item/:submissionId', requireAuth, requireStudent, async (req, res, next) => {
  try {
    const { submissionId } = req.params
    const { questionTitle, code, language, topic, difficulty } = req.body

    const submission = await Submission.findById(submissionId)
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' })
    }

    if (submission.enrollmentNo !== req.user.enrollmentNo) {
      return res.status(403).json({ message: 'You can only edit your own submissions' })
    }

    if (questionTitle !== undefined) {
      submission.questionTitle = questionTitle
    }
    if (code !== undefined) {
      submission.code = code
    }
    if (language !== undefined) {
      submission.language = language
    }
    if (topic !== undefined) {
      submission.topic = topic
    }
    if (difficulty !== undefined) {
      submission.difficulty = difficulty
    }

    await submission.save()
    await Student.updateOne(
      { enrollmentNo: submission.enrollmentNo },
      { $set: { lastActiveAt: new Date() } }
    )

    return res.json({ submission })
  } catch (error) {
    return next(error)
  }
})

router.get('/:enrollmentNo', requireAuth, async (req, res, next) => {
  try {
    const requested = String(req.params.enrollmentNo).toUpperCase().trim()
    const requesterRole = req.user.role
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '5'), 10) || 5))

    if (requesterRole === 'student' && req.user.enrollmentNo !== requested) {
      return res.status(403).json({ message: 'You can only access your own submissions' })
    }

    const [submissions, totalItems] = await Promise.all([
      Submission.find({ enrollmentNo: requested })
        .sort({ submittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Submission.countDocuments({ enrollmentNo: requested }),
    ])

    const totalPages = Math.max(1, Math.ceil(totalItems / limit))

    return res.json({
      submissions,
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

export default router
