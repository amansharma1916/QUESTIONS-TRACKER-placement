import cors from 'cors'
import express from 'express'
import { connectDatabase } from './config/db.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import streakRoutes from './routes/streaks.js'
import studentRoutes from './routes/students.js'
import submissionRoutes from './routes/submissions.js'
import teacherRoutes from './routes/teacher.js'

const app = express()

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/streaks', streakRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

connectDatabase()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Backend listening on http://localhost:${env.port}`)
    })
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message)
    process.exit(1)
    
  })
