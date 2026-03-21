export const LEADERBOARD_RULES = [
  'Total solved (higher is better)',
  'Current streak (higher is better)',
  'Most recent submission date (newer is better)',
  'Enrollment number (ascending as final tie-break)',
]

export function compareLeaderboardRows(a, b) {
  if (b.totalSolved !== a.totalSolved) {
    return b.totalSolved - a.totalSolved
  }

  if (b.streak !== a.streak) {
    return b.streak - a.streak
  }

  const aDate = a.lastSubmissionDate || ''
  const bDate = b.lastSubmissionDate || ''
  if (bDate !== aDate) {
    return bDate.localeCompare(aDate)
  }

  return a.enrollmentNo.localeCompare(b.enrollmentNo)
}
