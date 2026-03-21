import { Submission } from '../models/Submission.js'
import { Streak } from '../models/Streak.js'
import { dayDifference, toDayString } from '../utils/date.js'

function buildStreakFromDays(days) {
  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastSubmissionDate: null }
  }

  let longest = 1
  let running = 1

  for (let i = 1; i < days.length; i += 1) {
    if (dayDifference(days[i - 1], days[i]) === 1) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 1
    }
  }

  let tail = 1
  for (let i = days.length - 1; i > 0; i -= 1) {
    if (dayDifference(days[i - 1], days[i]) === 1) {
      tail += 1
    } else {
      break
    }
  }

  return {
    currentStreak: tail,
    longestStreak: longest,
    lastSubmissionDate: days[days.length - 1],
  }
}

export async function recomputeStreakFromSubmissions(enrollmentNo) {
  const normalized = enrollmentNo.toUpperCase()
  const submissions = await Submission.find({ enrollmentNo: normalized })
    .sort({ submittedAt: 1 })
    .select('submittedAt')
    .lean()

  const totalSolved = submissions.length
  const uniqueDays = [...new Set(submissions.map((row) => toDayString(row.submittedAt)))].sort()
  const streakValues = buildStreakFromDays(uniqueDays)

  return Streak.findOneAndUpdate(
    { enrollmentNo: normalized },
    { enrollmentNo: normalized, totalSolved, ...streakValues },
    { upsert: true, new: true }
  )
}

export async function updateStreakOnSubmission(enrollmentNo, submittedAt = new Date()) {
  const normalized = enrollmentNo.toUpperCase()
  const today = toDayString(submittedAt)
  const streak = await Streak.findOne({ enrollmentNo: normalized })

  if (!streak) {
    return Streak.create({
      enrollmentNo: normalized,
      currentStreak: 1,
      longestStreak: 1,
      lastSubmissionDate: today,
      totalSolved: 1,
    })
  }

  streak.totalSolved += 1

  if (streak.lastSubmissionDate !== today) {
    if (streak.lastSubmissionDate && dayDifference(streak.lastSubmissionDate, today) === 1) {
      streak.currentStreak += 1
    } else {
      streak.currentStreak = 1
    }

    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak)
    streak.lastSubmissionDate = today
  }

  await streak.save()
  return streak
}
