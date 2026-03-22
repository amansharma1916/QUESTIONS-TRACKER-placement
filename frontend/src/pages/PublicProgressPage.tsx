import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../api/client'

type StudentRow = {
  name: string
  enrollmentNo: string
  totalSolved: number
  streak: number
  status: 'Active' | 'Inactive'
}

type PublicAnalytics = {
  summary: {
    studentsRegistered: number
    totalSubmissions: number
    activeThisWeek: number
    inactive7Days: number
  }
  top5: StudentRow[]
  topicStats: Array<{ topic: string; studentCount: number; percentage: number }>
  languageStats: Array<{ language: string; count: number; percentage: number }>
  difficultyStats: Array<{ difficulty: string; count: number; percentage: number }>
}

type PublicAnalyticsResponse = {
  sharedBy: string | null
  expiresAt: string | null
  analytics: PublicAnalytics
}

const PIE_COLORS = ['#41b883', '#57a0ff', '#f5b14c', '#de6b88', '#9d8cff', '#5ac8b0']

export function PublicProgressPage() {
  const { token } = useParams<{ token: string }>()
  const [payload, setPayload] = useState<PublicAnalyticsResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Missing public token')
      return
    }

    apiRequest<PublicAnalyticsResponse>(`/teacher/public/analytics/${token}`)
      .then((response) => {
        setPayload(response)
        setError('')
      })
      .catch((loadError) => {
        setPayload(null)
        setError(loadError instanceof Error ? loadError.message : 'Failed to load public progress')
      })
  }, [token])

  const languagePie = useMemo(() => {
    const stats = payload?.analytics.languageStats || []
    if (stats.length === 0) {
      return 'conic-gradient(#2c3440 0deg 360deg)'
    }

    let current = 0
    const slices = stats.map((row, index) => {
      const next = current + ((row.percentage || 0) / 100) * 360
      const color = PIE_COLORS[index % PIE_COLORS.length]
      const segment = `${color} ${current}deg ${next}deg`
      current = next
      return segment
    })

    if (current < 360) {
      slices.push(`#2c3440 ${current}deg 360deg`)
    }

    return `conic-gradient(${slices.join(', ')})`
  }, [payload?.analytics.languageStats])

  const top5Chart = useMemo(() => {
    const rows = payload?.analytics.top5 || []
    const width = 560
    const height = 320
    const margin = { top: 20, right: 16, bottom: 86, left: 52 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    const maxSolved = Math.max(1, ...rows.map((row) => row.totalSolved))

    const yTicks = [
      maxSolved,
      Math.round(maxSolved * 0.75),
      Math.round(maxSolved * 0.5),
      Math.round(maxSolved * 0.25),
      0,
    ]

    const count = Math.max(1, rows.length)
    const groupWidth = innerWidth / count
    const barWidth = Math.max(24, Math.min(72, groupWidth * 0.62))

    return {
      rows,
      width,
      height,
      margin,
      innerHeight,
      maxSolved,
      yTicks,
      groupWidth,
      barWidth,
    }
  }, [payload?.analytics.top5])

  if (error) {
    return (
      <main className="dashboard public-progress">
        <section className="panel">
          <h1>Shared Progress</h1>
          <p className="error-block">{error}</p>
          <p className="sub">This public link may have expired after 24 hours.</p>
        </section>
      </main>
    )
  }

  if (!payload) {
    return (
      <main className="dashboard public-progress">
        <section className="panel">
          <h1>Shared Progress</h1>
          <p className="sub">Loading public analytics...</p>
        </section>
      </main>
    )
  }

  const analytics = payload.analytics

  return (
    <main className="dashboard public-progress">
      <section className="panel">
        <h1>Class Progress Snapshot</h1>
        <p className="sub public-meta">
          Shared by: {payload.sharedBy || 'Teacher'}
          {payload.expiresAt ? ` | valid until ${new Date(payload.expiresAt).toLocaleString()}` : ''}
        </p>
      </section>

      <section className="kpi-grid">
        <article className="panel kpi"><strong>{analytics.summary.studentsRegistered}</strong><span>students registered</span></article>
        <article className="panel kpi"><strong>{analytics.summary.totalSubmissions}</strong><span>total submissions</span></article>
        <article className="panel kpi"><strong>{analytics.summary.activeThisWeek}</strong><span>active this week</span></article>
        <article className="panel kpi"><strong>{analytics.summary.inactive7Days}</strong><span>inactive 7+ days</span></article>
      </section>

      <section className="chart-grid">
        <article className="panel">
          <h2>Top 5 students (bar chart)</h2>
          <div className="xy-chart-wrap">
            <svg
              className="xy-chart"
              viewBox={`0 0 ${top5Chart.width} ${top5Chart.height}`}
              role="img"
              aria-label="Top 5 solved questions as vertical bars on x-y axis"
            >
              {top5Chart.yTicks.map((tick) => {
                const y = top5Chart.margin.top + top5Chart.innerHeight - (tick / top5Chart.maxSolved) * top5Chart.innerHeight
                return (
                  <g key={tick}>
                    <line
                      x1={top5Chart.margin.left}
                      y1={y}
                      x2={top5Chart.width - top5Chart.margin.right}
                      y2={y}
                      className="xy-grid"
                    />
                    <text
                      x={top5Chart.margin.left - 8}
                      y={y + 4}
                      className="xy-tick-label"
                      textAnchor="end"
                    >
                      {tick}
                    </text>
                  </g>
                )
              })}

              <line
                x1={top5Chart.margin.left}
                y1={top5Chart.margin.top}
                x2={top5Chart.margin.left}
                y2={top5Chart.height - top5Chart.margin.bottom}
                className="xy-axis"
              />
              <line
                x1={top5Chart.margin.left}
                y1={top5Chart.height - top5Chart.margin.bottom}
                x2={top5Chart.width - top5Chart.margin.right}
                y2={top5Chart.height - top5Chart.margin.bottom}
                className="xy-axis"
              />

              {top5Chart.rows.map((row, index) => {
                const xCenter = top5Chart.margin.left + top5Chart.groupWidth * index + top5Chart.groupWidth / 2
                const barHeight = (row.totalSolved / top5Chart.maxSolved) * top5Chart.innerHeight
                const y = top5Chart.margin.top + top5Chart.innerHeight - barHeight
                const x = xCenter - top5Chart.barWidth / 2
                const shortName = row.name.length > 10 ? `${row.name.slice(0, 10)}...` : row.name

                return (
                  <g key={row.enrollmentNo}>
                    <rect x={x} y={y} width={top5Chart.barWidth} height={barHeight} rx={6} className="xy-bar" />
                    <text
                      x={xCenter}
                      y={y - 8}
                      className="xy-value-label"
                      textAnchor="middle"
                    >
                      {row.totalSolved}
                    </text>
                    <text
                      x={xCenter}
                      y={top5Chart.height - top5Chart.margin.bottom + 20}
                      className="xy-x-label"
                      textAnchor="middle"
                    >
                      {shortName}
                    </text>
                  </g>
                )
              })}

              <text
                x={top5Chart.width / 2}
                y={top5Chart.height - 14}
                className="xy-axis-title"
                textAnchor="middle"
              >
                Students
              </text>
              <text
                x={16}
                y={top5Chart.height / 2}
                className="xy-axis-title"
                textAnchor="middle"
                transform={`rotate(-90 16 ${top5Chart.height / 2})`}
              >
                Solved Questions
              </text>
            </svg>
          </div>
        </article>

        <article className="panel">
          <h2>Languages used (pie chart)</h2>
          <div className="pie-wrap">
            <div className="pie-chart" style={{ background: languagePie }} aria-label="Language usage pie chart" />
            <div className="pie-legend">
              {analytics.languageStats.map((row, index) => (
                <div key={row.language} className="pie-legend-row">
                  <span className="pie-dot" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span>{row.language}</span>
                  <strong>{row.count} ({row.percentage}%)</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="chart-grid">
        <article className="panel">
          <h2>Topic coverage</h2>
          <div className="bars">
            {analytics.topicStats.map((row) => (
              <div key={row.topic} className="bar-row">
                <p>{row.topic}</p>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${row.percentage}%` }} /></div>
                <span>{row.studentCount}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Difficulty distribution</h2>
          <div className="mini-kpis">
            {analytics.difficultyStats.map((row) => (
              <div key={row.difficulty}>
                <strong>{row.percentage}%</strong>
                <span>{row.difficulty} ({row.count})</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}
