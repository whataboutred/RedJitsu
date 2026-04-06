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
