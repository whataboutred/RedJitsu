import { describe, it, expect } from 'vitest'
import { computeAchievements } from '@/lib/achievements'

const empty = { totalWorkouts: 0, streakWeeks: 0, bjjSessions: 0, cardioSessions: 0 }

describe('computeAchievements', () => {
  it('returns the full ladder with nothing earned for a new account', () => {
    const all = computeAchievements(empty)
    expect(all).toHaveLength(26) // 10 workouts + 5 bjj + 5 cardio + 6 streaks
    expect(all.every((a) => !a.earned)).toBe(true)
  })

  it('earns workout milestones up to the current total', () => {
    const all = computeAchievements({ ...empty, totalWorkouts: 25 })
    const earned = all.filter((a) => a.group === 'Workouts' && a.earned).map((a) => a.id)
    expect(earned).toEqual(['workout-1', 'workout-5', 'workout-10', 'workout-25'])
  })

  it('earns streak badges at exact thresholds', () => {
    const all = computeAchievements({ ...empty, streakWeeks: 8 })
    const earned = all.filter((a) => a.group === 'Streaks' && a.earned).map((a) => a.id)
    expect(earned).toEqual(['streak-2', 'streak-4', 'streak-8'])
  })

  it('tracks disciplines independently', () => {
    const all = computeAchievements({ ...empty, bjjSessions: 10, cardioSessions: 1 })
    expect(all.filter((a) => a.group === 'BJJ' && a.earned)).toHaveLength(2) // 1, 10
    expect(all.filter((a) => a.group === 'Cardio' && a.earned)).toHaveLength(1) // 1
  })
})
