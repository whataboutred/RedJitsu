import { describe, it, expect } from 'vitest'
import {
  mapExerciseToCardio,
  mapExerciseToMetrics,
  isStrengthSession,
  isWalk,
  moderatePlusMinutes,
  type GoogleExerciseDataPoint,
} from '@/lib/fitbit/map'

function dp(overrides: Record<string, unknown> = {}): GoogleExerciseDataPoint {
  return {
    name: 'users/me/dataPoints/abc123',
    exercise: {
      exerciseType: 'RUNNING',
      displayName: 'Run',
      interval: { startTime: '2026-07-01T10:00:00Z', endTime: '2026-07-01T10:45:00Z' },
      activeDuration: '2700s',
      metricsSummary: {
        caloriesKcal: 412,
        distanceMillimeters: 8_046_720, // ~5 miles
        averageHeartRateBeatsPerMinute: '141.2',
        heartRateZoneDurations: {
          lightTime: '300s',
          moderateTime: '1500s',
          vigorousTime: '600s',
          peakTime: '0s',
        },
      },
      ...overrides,
    },
  }
}

describe('exclusion model', () => {
  it('imports everything when nothing is excluded', () => {
    const row = mapExerciseToCardio(dp(), [])
    expect(row).not.toBeNull()
    expect(row!.activity).toBe('Run')
    expect(row!.duration_minutes).toBe(45)
  })

  it('skips activities on the exclusion list (with stem matching)', () => {
    const bike = dp({ exerciseType: 'BIKE', displayName: undefined })
    expect(mapExerciseToCardio(bike, ['Biking'])).toBeNull()
    expect(mapExerciseToCardio(bike, ['Yoga'])).not.toBeNull()
  })

  it('never imports strength sessions as cardio, regardless of exclusions', () => {
    const lift = dp({ exerciseType: 'WEIGHTLIFTING', displayName: 'Weights' })
    expect(mapExerciseToCardio(lift, [])).toBeNull()
    const strength = dp({ exerciseType: 'STRENGTH_TRAINING', displayName: undefined })
    expect(mapExerciseToCardio(strength, [])).toBeNull()
  })
})

describe('walk HR gate', () => {
  const walkWith = (moderateSecs: number, vigorousSecs = 0) =>
    dp({
      exerciseType: 'WALKING',
      displayName: 'Walk',
      metricsSummary: {
        heartRateZoneDurations: {
          lightTime: '1800s',
          moderateTime: `${moderateSecs}s`,
          vigorousTime: `${vigorousSecs}s`,
          peakTime: '0s',
        },
      },
    })

  it('drops a casual stroll (under the moderate-minutes threshold)', () => {
    expect(mapExerciseToCardio(walkWith(600), [], 15)).toBeNull() // 10 min moderate
  })

  it('imports a walk that earned 15+ moderate-or-higher minutes', () => {
    expect(mapExerciseToCardio(walkWith(900), [], 15)).not.toBeNull() // exactly 15 min
    expect(mapExerciseToCardio(walkWith(600, 400), [], 15)).not.toBeNull() // 10 mod + ~7 vig
  })

  it('drops walks with no HR zone data at all', () => {
    const bare = dp({ exerciseType: 'WALKING', displayName: 'Walk', metricsSummary: undefined })
    expect(mapExerciseToCardio(bare, [], 15)).toBeNull()
  })

  it('does not apply the gate to non-walks', () => {
    const easySwim = dp({
      exerciseType: 'SWIMMING',
      displayName: 'Swim',
      metricsSummary: { heartRateZoneDurations: { lightTime: '1800s' } },
    })
    expect(mapExerciseToCardio(easySwim, [], 15)).not.toBeNull()
  })
})

describe('classification helpers', () => {
  it('detects strength and walk sessions from type or display name', () => {
    expect(isStrengthSession({ exerciseType: 'WEIGHTLIFTING' })).toBe(true)
    expect(isStrengthSession({ displayName: 'Strength training' })).toBe(true)
    expect(isStrengthSession({ exerciseType: 'RUNNING' })).toBe(false)
    expect(isWalk({ exerciseType: 'WALKING' })).toBe(true)
    expect(isWalk({ displayName: 'Dog Walk' })).toBe(true)
    expect(isWalk({ exerciseType: 'RUNNING' })).toBe(false)
  })

  it('sums moderate+vigorous+peak minutes', () => {
    expect(
      moderatePlusMinutes({ moderateTime: '600s', vigorousTime: '300s', peakTime: '60s' })
    ).toBe(16)
    expect(moderatePlusMinutes(undefined)).toBe(0)
  })
})

describe('mapExerciseToMetrics', () => {
  it('maps a strength session to workout metadata', () => {
    const lift = dp({
      exerciseType: 'WEIGHTLIFTING',
      displayName: 'Weights',
      interval: { startTime: '2026-07-01T17:00:00Z', endTime: '2026-07-01T17:50:00Z' },
      activeDuration: '2460s',
      metricsSummary: { caloriesKcal: 480.6, averageHeartRateBeatsPerMinute: '131.7' },
    })
    const m = mapExerciseToMetrics(lift)
    expect(m).not.toBeNull()
    expect(m!.avg_hr).toBe(132)
    expect(m!.calories).toBe(481)
    expect(m!.active_minutes).toBe(41)
    expect(m!.start_ms).toBe(new Date('2026-07-01T17:00:00Z').getTime())
    expect(m!.end_ms).toBe(new Date('2026-07-01T17:50:00Z').getTime())
    expect(m!.external_id).toBe('users/me/dataPoints/abc123')
  })

  it('returns null for non-strength sessions', () => {
    expect(mapExerciseToMetrics(dp())).toBeNull()
  })
})
