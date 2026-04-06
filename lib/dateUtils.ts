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
 * The input value "2024-01-15T15:00" is treated as LOCAL time
 * and converted to the correct UTC ISO string.
 */
export function datetimeLocalToISO(value: string): string {
  // new Date("2024-01-15T15:00") parses as local time in most browsers
  return new Date(value).toISOString()
}

/**
 * Convert a UTC ISO string (from the database) to a datetime-local value.
 * Used when loading existing records into edit forms.
 */
export function isoToDatetimeLocal(isoString: string): string {
  return toDatetimeLocal(new Date(isoString))
}
