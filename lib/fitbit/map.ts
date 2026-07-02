// Pure mapping helpers: Google Health "exercise" dataPoint -> cardio_sessions row.
// Field paths verified against real Fitbit-via-Google-Health data.

// A Duration in REST JSON is a string like "2775s" (may be fractional). We also
// tolerate a number (seconds) or { seconds } object defensively.
function durationSeconds(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/s$/, '')) || 0
  if (typeof v === 'object' && v !== null && 'seconds' in (v as any)) return Number((v as any).seconds) || 0
  return 0
}

type HeartRateZoneDurations = {
  lightTime?: unknown
  moderateTime?: unknown
  vigorousTime?: unknown
  peakTime?: unknown
}

export type GoogleExercise = {
  interval?: { startTime?: string; endTime?: string }
  exerciseType?: string
  displayName?: string
  activeDuration?: unknown // Duration, at the exercise level
  metricsSummary?: {
    caloriesKcal?: number
    distanceMillimeters?: number
    averageHeartRateBeatsPerMinute?: string | number
    activeDuration?: unknown // sometimes here too — checked as a fallback
    heartRateZoneDurations?: HeartRateZoneDurations
  }
}

export type GoogleExerciseDataPoint = {
  name?: string
  dataPointId?: string
  exercise?: GoogleExercise
} & Partial<GoogleExercise>

export type Intensity = 'low' | 'medium' | 'high'

// Google reports time in light / moderate / vigorous / peak zones. Collapse to
// our three levels (light=low, moderate=medium, vigorous+peak=high), dominant
// bucket wins; ties round up. No zone data -> medium.
export function deriveIntensity(zones: HeartRateZoneDurations | undefined): Intensity {
  if (!zones) return 'medium'
  const low = durationSeconds(zones.lightTime)
  const medium = durationSeconds(zones.moderateTime)
  const high = durationSeconds(zones.vigorousTime) + durationSeconds(zones.peakTime)
  if (low === 0 && medium === 0 && high === 0) return 'medium'
  if (high >= medium && high >= low) return 'high'
  if (medium >= low) return 'medium'
  return 'low'
}

function exerciseMinutes(ex: GoogleExercise): number {
  let secs = durationSeconds(ex.activeDuration ?? ex.metricsSummary?.activeDuration)
  if (secs < 1 && ex.interval?.startTime && ex.interval?.endTime) {
    secs = (new Date(ex.interval.endTime).getTime() - new Date(ex.interval.startTime).getTime()) / 1000
  }
  return Math.round(secs / 60)
}

function buildNote(ex: GoogleExercise, intensity: Intensity): string {
  const parts: string[] = ['Imported from Fitbit']
  const avg = Number(ex.metricsSummary?.averageHeartRateBeatsPerMinute)
  if (avg > 0) parts.push(`avg HR ${Math.round(avg)}`)
  const z = ex.metricsSummary?.heartRateZoneDurations
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
    return ex.exerciseType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return 'Workout'
}

function matchesActivity(ex: GoogleExercise, list: string[]): boolean {
  if (list.length === 0) return false
  const hay = `${ex.displayName ?? ''} ${ex.exerciseType ?? ''}`.toLowerCase().replace(/_/g, ' ')
  const words = hay.split(/\s+/).filter(Boolean)
  return list.some((a) => {
    const al = a.toLowerCase()
    if (hay.includes(al)) return true
    // Stem overlap so "Biking" matches "BIKE", "Running" matches "RUN", etc.
    return words.some((w) => w.length >= 3 && al.length >= 3 && w.slice(0, 3) === al.slice(0, 3))
  })
}

// Strength sessions never import as cardio — they correlate to logged
// workouts instead (mapExerciseToMetrics).
export function isStrengthSession(ex: GoogleExercise): boolean {
  const hay = `${ex.displayName ?? ''} ${ex.exerciseType ?? ''}`.toLowerCase().replace(/_/g, ' ')
  return /weight|strength|lift/.test(hay)
}

export function isWalk(ex: GoogleExercise): boolean {
  const hay = `${ex.displayName ?? ''} ${ex.exerciseType ?? ''}`.toLowerCase().replace(/_/g, ' ')
  return /\bwalk/.test(hay)
}

/** Total minutes at moderate intensity or higher (moderate + vigorous + peak). */
export function moderatePlusMinutes(zones: HeartRateZoneDurations | undefined): number {
  if (!zones) return 0
  const secs =
    durationSeconds(zones.moderateTime) +
    durationSeconds(zones.vigorousTime) +
    durationSeconds(zones.peakTime)
  return Math.round(secs / 60)
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

// Exclusion model: everything imports as cardio unless it matches the user's
// excluded activities, is a strength session (correlated to workouts instead),
// or is a walk that never spent enough time in the moderate HR zone.
export function mapExerciseToCardio(
  dp: GoogleExerciseDataPoint,
  excluded: string[],
  walkMinModerateMinutes = 15
): MappedCardio | null {
  const ex: GoogleExercise = dp.exercise ?? (dp as GoogleExercise)
  const start = ex.interval?.startTime
  if (!start) return null
  if (isStrengthSession(ex)) return null
  if (matchesActivity(ex, excluded)) return null
  if (isWalk(ex) && moderatePlusMinutes(ex.metricsSummary?.heartRateZoneDurations) < walkMinModerateMinutes) {
    return null // just steps — the walk never earned moderate-zone time
  }

  const minutes = exerciseMinutes(ex)
  if (minutes < 1) return null

  const mm = ex.metricsSummary?.distanceMillimeters
  const miles = typeof mm === 'number' && mm > 0 ? Number((mm / 1_609_344).toFixed(2)) : null

  const cal = ex.metricsSummary?.caloriesKcal
  const intensity = deriveIntensity(ex.metricsSummary?.heartRateZoneDurations)

  const externalId = dp.name || dp.dataPointId || `${start}|${ex.exerciseType ?? ex.displayName ?? 'ex'}`

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

export type MappedWorkoutMetrics = {
  external_id: string
  avg_hr: number | null
  calories: number | null
  active_minutes: number | null
  start_ms: number
  end_ms: number
}

// Strength session -> watch metadata for correlating with a logged workout.
// Returns null for anything that isn't strength or has no usable interval.
export function mapExerciseToMetrics(dp: GoogleExerciseDataPoint): MappedWorkoutMetrics | null {
  const ex: GoogleExercise = dp.exercise ?? (dp as GoogleExercise)
  if (!isStrengthSession(ex)) return null
  const start = ex.interval?.startTime
  if (!start) return null

  const startMs = new Date(start).getTime()
  const minutes = exerciseMinutes(ex)
  const endMs = ex.interval?.endTime
    ? new Date(ex.interval.endTime).getTime()
    : startMs + minutes * 60_000

  const avg = Number(ex.metricsSummary?.averageHeartRateBeatsPerMinute)
  const cal = ex.metricsSummary?.caloriesKcal
  const externalId = dp.name || dp.dataPointId || `${start}|${ex.exerciseType ?? ex.displayName ?? 'ex'}`

  return {
    external_id: String(externalId),
    avg_hr: avg > 0 ? Math.round(avg) : null,
    calories: typeof cal === 'number' && cal > 0 ? Math.round(cal) : null,
    active_minutes: minutes > 0 ? minutes : null,
    start_ms: startMs,
    end_ms: endMs,
  }
}
