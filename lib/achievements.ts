// Achievement definitions + computation. Pure logic, no UI.
// Driven by data we already have (all-time workout count, weekly streak).

export type Tier = 'bronze' | 'silver' | 'gold'

export type Achievement = {
  id: string
  group: 'Milestones' | 'Streaks'
  label: string // shown inside the badge, e.g. "10" or "4w"
  title: string // shown under the badge, e.g. "10 Workouts"
  description: string
  earned: boolean
  tier: Tier
}

export type AchievementStats = {
  totalWorkouts: number
  streakWeeks: number
}

const MILESTONES: { n: number; tier: Tier }[] = [
  { n: 1, tier: 'bronze' },
  { n: 5, tier: 'bronze' },
  { n: 10, tier: 'silver' },
  { n: 25, tier: 'silver' },
  { n: 50, tier: 'gold' },
  { n: 100, tier: 'gold' },
]

const STREAKS: { w: number; tier: Tier }[] = [
  { w: 2, tier: 'bronze' },
  { w: 4, tier: 'silver' },
  { w: 8, tier: 'silver' },
  { w: 12, tier: 'gold' },
  { w: 26, tier: 'gold' },
]

export function computeAchievements(stats: AchievementStats): Achievement[] {
  const milestones: Achievement[] = MILESTONES.map((m) => ({
    id: `milestone-${m.n}`,
    group: 'Milestones',
    label: String(m.n),
    title: `${m.n} Workout${m.n > 1 ? 's' : ''}`,
    description: `Complete ${m.n} total workouts`,
    earned: stats.totalWorkouts >= m.n,
    tier: m.tier,
  }))

  const streaks: Achievement[] = STREAKS.map((s) => ({
    id: `streak-${s.w}`,
    group: 'Streaks',
    label: `${s.w}w`,
    title: `${s.w} Weeks`,
    description: `Hit your weekly goal ${s.w} weeks in a row`,
    earned: stats.streakWeeks >= s.w,
    tier: s.tier,
  }))

  return [...milestones, ...streaks]
}
