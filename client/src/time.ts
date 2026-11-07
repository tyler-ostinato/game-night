// Date helpers for entering past game nights.

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// A night is dated by when it started, so a time before 6am means the early hours of the next day.
export function endTimeFor(date: string, time: string): string | null {
  if (!time) return null
  const d = new Date(`${date}T${time}`)
  if (time < '06:00') d.setDate(d.getDate() + 1)
  return d.toISOString()
}
