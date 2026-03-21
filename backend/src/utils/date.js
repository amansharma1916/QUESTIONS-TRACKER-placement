export function toDayString(input = new Date()) {
  return new Date(input).toISOString().split('T')[0]
}

export function dayDifference(fromDay, toDay) {
  const from = new Date(`${fromDay}T00:00:00.000Z`)
  const to = new Date(`${toDay}T00:00:00.000Z`)
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
