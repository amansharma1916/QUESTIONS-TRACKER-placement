import express from 'express'
import { updateStreakOnSubmission } from '../services/streakService.js'

const router = express.Router()

router.post('/update/:enrollmentNo', async (req, res, next) => {
  try {
    const enrollmentNo = String(req.params.enrollmentNo).toUpperCase().trim()
    const streak = await updateStreakOnSubmission(enrollmentNo, new Date())
    return res.json({ streak })
  } catch (error) {
    return next(error)
  }
})

export default router
