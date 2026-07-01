import { describe, it, expect } from 'vitest'
import {
  datetimeLocalToISO,
  isoToDatetimeLocal,
  localDateKey,
  localDayOfWeek,
  localWeekStartKey,
  weeksBetweenKeys,
  shiftDateKey,
} from '@/lib/dateUtils'

describe('datetime-local round trip', () => {
  it('survives local → ISO → local unchanged', () => {
    expect(isoToDatetimeLocal(datetimeLocalToISO('2026-07-01T15:30'))).toBe('2026-07-01T15:30')
    expect(isoToDatetimeLocal(datetimeLocalToISO('2026-12-31T23:59'))).toBe('2026-12-31T23:59')
  })
})

describe('localDateKey', () => {
  it('uses the calendar of the given timezone', () => {
    // 2am UTC is still the previous evening in New York
    const instant = '2026-07-01T02:00:00Z'
    expect(localDateKey(instant, 'UTC')).toBe('2026-07-01')
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-06-30')
  })

  it('accepts Date objects and ISO strings alike', () => {
    expect(localDateKey(new Date('2026-07-01T12:00:00Z'), 'UTC')).toBe('2026-07-01')
  })
})

describe('localDayOfWeek', () => {
  it('matches the UTC weekday when zone is UTC', () => {
    const instant = new Date('2026-07-01T12:00:00Z')
    expect(localDayOfWeek(instant, 'UTC')).toBe(instant.getUTCDay())
  })

  it('shifts across midnight in the local zone', () => {
    // 2026-07-01T02:00Z = 2026-06-30 22:00 in New York
    const instant = new Date('2026-07-01T02:00:00Z')
    expect(localDayOfWeek(instant, 'America/New_York')).toBe(
      new Date('2026-06-30T12:00:00Z').getUTCDay()
    )
  })
})

describe('localWeekStartKey', () => {
  it('returns the Sunday of the containing week', () => {
    // 2026-07-01 is a Wednesday (UTC weekday 3) → week starts Sunday 2026-06-28
    expect(new Date('2026-07-01T12:00:00Z').getUTCDay()).toBe(3)
    expect(localWeekStartKey('2026-07-01T12:00:00Z', 'UTC')).toBe('2026-06-28')
  })

  it('is idempotent on a Sunday', () => {
    expect(localWeekStartKey('2026-06-28T12:00:00Z', 'UTC')).toBe('2026-06-28')
  })

  it('an evening workout stays in the local week even when UTC has rolled over', () => {
    // Saturday 2026-06-27 23:00 in New York = Sunday 2026-06-28 03:00 UTC.
    // In UTC this starts a NEW week; on the athlete's calendar it belongs
    // to the week that started Sunday 2026-06-21.
    const instant = '2026-06-28T03:00:00Z'
    expect(localWeekStartKey(instant, 'UTC')).toBe('2026-06-28')
    expect(localWeekStartKey(instant, 'America/New_York')).toBe('2026-06-21')
  })
})

describe('weeksBetweenKeys', () => {
  it('counts whole weeks between week-start keys', () => {
    expect(weeksBetweenKeys('2026-06-28', '2026-06-28')).toBe(0)
    expect(weeksBetweenKeys('2026-07-05', '2026-06-28')).toBe(1)
    expect(weeksBetweenKeys('2026-07-05', '2026-06-07')).toBe(4)
    expect(weeksBetweenKeys('2026-06-28', '2026-07-05')).toBe(-1)
  })
})

describe('shiftDateKey', () => {
  it('steps across month boundaries', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles leap years', () => {
    expect(shiftDateKey('2024-03-01', -1)).toBe('2024-02-29')
  })
})
