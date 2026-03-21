import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase } from '../config/db.js'
import { Student } from '../models/Student.js'

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Reyansh', 'Kabir', 'Ishaan', 'Krish', 'Rudra', 'Atharv',
  'Anaya', 'Diya', 'Kiara', 'Myra', 'Aadhya', 'Sara', 'Ira', 'Meera', 'Saanvi', 'Siya',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Singh', 'Patel', 'Gupta', 'Jain', 'Mishra', 'Yadav', 'Kumar', 'Nair',
  'Rao', 'Iyer', 'Reddy', 'Das', 'Joshi', 'Malhotra', 'Saxena', 'Mehta', 'Kapoor', 'Bansal',
]

function buildEnrollment(index) {
  return `22CS${String(index).padStart(3, '0')}`
}

function buildName(index) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]
  return `${first} ${last}`
}

async function seedStudents() {
  await connectDatabase()

  const passwordHash = await bcrypt.hash('student@123', 10)
  const now = new Date()

  const operations = Array.from({ length: 100 }, (_, i) => {
    const index = i + 1
    const enrollmentNo = buildEnrollment(index)

    return {
      updateOne: {
        filter: { enrollmentNo },
        update: {
          $setOnInsert: {
            enrollmentNo,
            name: buildName(i),
            department: 'Btech',
            section: 'A',
            passwordHash,
            createdAt: now,
            lastActiveAt: now,
          },
        },
        upsert: true,
      },
    }
  })

  const result = await Student.bulkWrite(operations, { ordered: false })

  const createdCount = result.upsertedCount || 0
  const existingCount = 100 - createdCount

  console.log('Seed complete')
  console.log(`Target students: 100`)
  console.log(`Inserted: ${createdCount}`)
  console.log(`Already existed: ${existingCount}`)
  console.log('Default password for seeded students: student@123')
}

seedStudents()
  .then(async () => {
    await mongoose.connection.close()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Seeding failed:', error.message)
    await mongoose.connection.close()
    process.exit(1)
  })
