// Pure mapping helpers: Google Health "exercise" dataPoint -> cardio_sessions row.
// No I/O so it's trivially testable. Schema per the Google Health API v4 docs.

// A Duration in REST JSON is a string like "1800s" (may be fractional). We also
// tolerate a number (seconds) or { seconds } object defensively.
function durationSeconds(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/s$/, '')) || 0
  if (typeof v === 'object' && v !== null && 'seconds' in (v as any)) return Number((v as any).seconds) || 0
  return 0
}

export type GoogleExercise = {
  interval?: { startTime?: string; endTime?: string }
  exerciseType?: string
  displayName?: string
  metricsSummary?: {
    caloriesKcal?: number
    distanceMillimeters?: number
    activeDuration?: unknown // Duration
  }
  heartRateZoneDurations?: {
    lightTime?: unknown
    moderateTime?: unknown
    vigorousTime?: unknown
    peakTime?: unknown
  }
}

// A dataPoint may carry the exercise under an `exercise` key (the filter uses
// `exercise.interval...`) with an id alongside it.
export type GoogleExerciseDataPoint = {
  dataPointId?: string
  name?: string
  exercise?: GoogleExercise
} & Partial<GoogleExercise>

export type Intensity = 'low' | 'medium' | 'high'

// Google already reports time in light / moderate / vigorous / peak. Collapse to
// our three levels (light=low, moderate=medium, vigorous+peak=high) and pick the
// dominant bucket; ties round up. No zone data -> medium.
export function deriveIntensity(zones: GoogleExercise['heartRateZoneDurations']): Intensity {
  if (!zones) return 'medium'
  const low = durationSeconds(zones.lightTime)
  const medium = durationSeconds(zones.moderateTime)
  const high = durationSeconds(zones.vigorousTime) + durationSeconds(zones.peakTime)
  if (low === 0 && medium === 0 && high === 0) return 'medium'
  if (high >= medium && high >= low) return 'high'
  if (medium >= low) return 'medium'
  return 'low'
}

function buildNote(ex: GoogleExercise, intensity: Intensity): string {
  const parts: string[] = ['Imported from Fitbit']
  const z = ex.heartRateZoneDurations
  if (z) {
    const vigorous = Math.round((durationSeconds(z.vigorousTime) + durationSeconds(z.peakTime)) / 60)
    const moderate = Math.round(durationSeconds(z.moderateTime) / 60)
    const summary: string[] = []
    if (vigorous > 0) summary.push(`${vigorous}m vigorous`)
    if (moderate > 0) summary.push(`${moderate}m moderate`)
    if (summary.length) parts.push(summary.join(' / '))
  }
  return parts.join(' · ')
}

function prettyType(ex: GoogleExercise): string {
  if (ex.displayName) return ex.displayName
  if (ex.exerciseType) {
    return ex.exerciseType
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return 'Workout'
}

function matchesAllowed(ex: GoogleExercise, allowed: string[]): boolean {
  if (allowed.length === 0) return false
  const hay = `${ex.displayName ?? ''} ${ex.exerciseType ?? ''}`.toLowerCase().replace(/_/g, ' ')
  const words = hay.split(/\s+/).filter(Boolean)
  return allowed.some((a) => {
    const al = a.toLowerCase()
    if (hay.includes(al)) return true
    // Stem overlap so "Biking" matches "BIKE", "Running" matches "RUN", etc.
    return words.some((w) => w.length >= 3 && al.length >= 3 && w.slice(0, 3) === al.slice(0, 3))
  })
}

export type MappedCardio = {
  external_id: string
  source: 'fitbit'
  activity: string
  duration_minutes: number
  distance: number | null
  distance_unit: 'miles'
  intensity: Intensity
  calories: number | null
  notes: string
  performed_at: string
}

export function mapExerciseToCardio(
  dp: GoogleExerciseDataPoint,
  allowed: string[]
): MappedCardio | null {
  const ex: GoogleExercise = dp.exercise ?? (dp as GoogleExercise)
  const start = ex.interval?.startTime
  if (!start) return null
  if (!matchesAllowed(ex, allowed)) return null

  const minutes = Math.round(durationSeconds(ex.metricsSummary?.activeDuration) / 60)
  if (minutes < 1) return null

  const mm = ex.metricsSummary?.distanceMillimeters
  const miles = typeof mm === 'number' && mm > 0 ? Number((mm / 1_609_344).toFixed(2)) : null

  const cal = ex.metricsSummary?.caloriesKcal
  const intensity = deriveIntensity(ex.heartRateZoneDurations)

  // Stable id for idempotent dedupe.
  const externalId = dp.dataPointId || dp.name || `${start}|${ex.exerciseType ?? ex.displayName ?? 'ex'}`

  return {
    external_id: String(externalId),
    source: 'fitbit',
    activity: prettyType(ex),
    duration_minutes: minutes,
    distance: miles,
    distance_unit: 'miles',
    intensity,
    calories: typeof cal === 'number' && cal > 0 ? Math.round(cal) : null,
    notes: buildNote(ex, intensity),
    performed_at: new Date(start).toISOString(),
  }
}
