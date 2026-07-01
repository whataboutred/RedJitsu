/**
 * Timezone-safe utilities for datetime-local inputs.
 *
 * <input type="datetime-local"> works in LOCAL time but returns a string
 * like "2024-01-15T15:00" with no timezone info. These helpers ensure
 * consistent conversion between local display and UTC storage.
 */

/**
 * Format a Date object for <input type="datetime-local">.
 * Returns a string like "2024-01-15T15:00" representing LOCAL time.
 */
export function toDatetimeLocal(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Parse a datetime-local input value to an ISO string (UTC).
 * Explicitly constructs a Date from local time components to avoid
 * cross-browser parsing inconsistencies with new Date(string).
 */
export function datetimeLocalToISO(value: string): string {
  // Parse "YYYY-MM-DDTHH:MM" explicitly as local time
  const [datePart, timePart] = value.split('T')
  if (!datePart || !timePart) return new Date().toISOString()

  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)

  // Construct Date using local time components (avoids browser parsing quirks)
  const date = new Date(year, month - 1, day, hours, minutes)
  return date.toISOString()
}

/**
 * Convert a UTC ISO string (from the database) to a datetime-local value.
 * Used when loading existing records into edit forms.
 */
export function isoToDatetimeLocal(isoString: string): string {
  return toDatetimeLocal(new Date(isoString))
}

/*
 * Calendar math in the athlete's timezone.
 *
 * Timestamps are stored in UTC, but streaks, "this week", and goal-hit weeks
 * are questions about the athlete's local calendar: an 8pm workout in New York
 * is a next-day workout in UTC and must not count toward the wrong day or
 * week. Everything below takes an optional IANA timezone so the server (AI
 * digest) can compute the exact same buckets the client sees; omitted, it
 * uses the runtime's local zone. Weeks start on Sunday.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function partsInZone(date: Date, timeZone?: string): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  let y = 0, m = 0, d = 0, weekday = 0
  for (const part of fmt.formatToParts(date)) {
    if (part.type === 'year') y = Number(part.value)
    else if (part.type === 'month') m = Number(part.value)
    else if (part.type === 'day') d = Number(part.value)
    else if (part.type === 'weekday') weekday = WEEKDAYS.indexOf(part.value)
  }
  return { y, m, d, weekday }
}

/** "YYYY-MM-DD" of the given instant, on the calendar of the given timezone. */
export function localDateKey(date: Date | string, timeZone?: string): string {
  const { y, m, d } = partsInZone(typeof date === 'string' ? new Date(date) : date, timeZone)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Day of week (0 = Sunday) of the given instant in the given timezone. */
export function localDayOfWeek(date: Date | string, timeZone?: string): number {
  return partsInZone(typeof date === 'string' ? new Date(date) : date, timeZone).weekday
}

/** "YYYY-MM-DD" of the Sunday starting the week that contains the instant. */
export function localWeekStartKey(date: Date | string, timeZone?: string): string {
  const { y, m, d, weekday } = partsInZone(typeof date === 'string' ? new Date(date) : date, timeZone)
  // Anchor at UTC noon so subtracting whole days can't slip a calendar day
  const sunday = new Date(Date.UTC(y, m - 1, d, 12) - weekday * DAY_MS)
  return sunday.toISOString().split('T')[0]
}

/** Whole weeks between two week-start keys (0 = same week; positive = a is later). */
export function weeksBetweenKeys(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T12:00:00Z`).getTime()
  const b = new Date(`${bKey}T12:00:00Z`).getTime()
  return Math.round((a - b) / (7 * DAY_MS))
}

/** Step a "YYYY-MM-DD" key backward/forward by whole days. */
export function shiftDateKey(key: string, days: number): string {
  const t = new Date(`${key}T12:00:00Z`).getTime() + days * DAY_MS
  return new Date(t).toISOString().split('T')[0]
}

/**
 * Local start of the current week (Sunday 00:00) as a Date, for query bounds.
 * Client-side only — uses the device's timezone.
 */
export function startOfLocalWeek(now: Date = new Date()): Date {
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  return start
}
