import mongoose from 'mongoose'

const streakSchema = new mongoose.Schema(
  {
    enrollmentNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastSubmissionDate: { type: String, default: null },
    totalSolved: { type: Number, default: 0 },
  },
  { versionKey: false }
)

export const Streak = mongoose.model('Streak', streakSchema)
