// Achievement definitions + computation. Pure logic, no UI.
// Driven by data we already track (all-time counts per discipline + weekly streak).

export type Tier = 'bronze' | 'silver' | 'gold'

export type AchievementGroup = 'Workouts' | 'BJJ' | 'Cardio' | 'Streaks'

export type Achievement = {
  id: string
  group: AchievementGroup
  label: string // shown inside the badge, e.g. "10" or "4w"
  title: string // shown under the badge, e.g. "10 Workouts"
  description: string
  earned: boolean
  tier: Tier
}

export type AchievementStats = {
  totalWorkouts: number
  streakWeeks: number
  bjjSessions: number
  cardioSessions: number
}

type Step = { n: number; tier: Tier }

const WORKOUT_MILESTONES: Step[] = [
  { n: 1, tier: 'bronze' },
  { n: 5, tier: 'bronze' },
  { n: 10, tier: 'silver' },
  { n: 25, tier: 'silver' },
  { n: 50, tier: 'gold' },
  { n: 100, tier: 'gold' },
  { n: 200, tier: 'gold' },
  { n: 365, tier: 'gold' },
  { n: 500, tier: 'gold' },
  { n: 1000, tier: 'gold' },
]

// Session-count ladders for the other disciplines.
const DISCIPLINE_MILESTONES: Step[] = [
  { n: 1, tier: 'bronze' },
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
  { w: 52, tier: 'gold' },
]

export function computeAchievements(stats: AchievementStats): Achievement[] {
  const workouts: Achievement[] = WORKOUT_MILESTONES.map((m) => ({
    id: `workout-${m.n}`,
    group: 'Workouts',
    label: String(m.n),
    title: `${m.n} Workout${m.n > 1 ? 's' : ''}`,
    description: `Complete ${m.n} total workouts`,
    earned: stats.totalWorkouts >= m.n,
    tier: m.tier,
  }))

  const bjj: Achievement[] = DISCIPLINE_MILESTONES.map((m) => ({
    id: `bjj-${m.n}`,
    group: 'BJJ',
    label: String(m.n),
    title: `${m.n} Session${m.n > 1 ? 's' : ''}`,
    description: `Log ${m.n} BJJ session${m.n > 1 ? 's' : ''}`,
    earned: stats.bjjSessions >= m.n,
    tier: m.tier,
  }))

  const cardio: Achievement[] = DISCIPLINE_MILESTONES.map((m) => ({
    id: `cardio-${m.n}`,
    group: 'Cardio',
    label: String(m.n),
    title: `${m.n} Session${m.n > 1 ? 's' : ''}`,
    description: `Log ${m.n} cardio session${m.n > 1 ? 's' : ''}`,
    earned: stats.cardioSessions >= m.n,
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

  return [...workouts, ...bjj, ...cardio, ...streaks]
}
