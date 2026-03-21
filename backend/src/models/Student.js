import mongoose from 'mongoose'

const DEPARTMENTS = ['Btech', 'BCA']
const BTECH_SECTIONS = ['AI/ML A', 'AI/ML B', 'A', 'B', 'C', 'D']
const BCA_SECTIONS = ['A', 'B', 'C', 'D']
const SECTIONS = [...new Set([...BTECH_SECTIONS, ...BCA_SECTIONS])]

const studentSchema = new mongoose.Schema(
  {
    enrollmentNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    department: { type: String, required: true, enum: DEPARTMENTS, default: 'Btech' },
    section: { type: String, required: true, enum: SECTIONS, default: 'AI/ML A' },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

export const Student = mongoose.model('Student', studentSchema)
export { DEPARTMENTS, BTECH_SECTIONS, BCA_SECTIONS }
