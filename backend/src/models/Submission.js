import mongoose from 'mongoose'

const LANGUAGES = ['python', 'c', 'cpp', 'java', 'javascript']
const DIFFICULTY = ['easy', 'medium', 'hard']
const TOPICS = ['NA', 'Arrays', 'Strings', 'Linked List', 'Trees', 'DP', 'Graphs', 'Sorting', 'Stacks', 'Design']

const submissionSchema = new mongoose.Schema(
  {
    enrollmentNo: { type: String, required: true, uppercase: true, trim: true, index: true },
    questionTitle: { type: String, required: true, trim: true },
    code: { type: String, required: true },
    language: { type: String, required: true, enum: LANGUAGES },
    topic: {
      type: [{ type: String, enum: TOPICS }],
      required: true,
      validate: (topics) => Array.isArray(topics) && topics.length > 0,
    },
    difficulty: { type: String, required: true, enum: DIFFICULTY },
    submittedAt: { type: Date, default: Date.now, index: true },
    isAnonymous: { type: Boolean, default: false },
  },
  { versionKey: false }
)

export const Submission = mongoose.model('Submission', submissionSchema)
export { LANGUAGES, DIFFICULTY, TOPICS }
