import { createClient } from '@supabase/supabase-js'
import { localDateKey, localDayOfWeek, localWeekStartKey, weeksBetweenKeys, shiftDateKey } from '@/lib/dateUtils'

export type AnalyticsDigest = {
  period: string
  strength: {
    totalWorkouts: number
    avgPerWeek: number
    weeklyGoal: number
    goalHitWeeks: number
    totalWeeksTracked: number
    topExercises: Array<{
      name: string
      firstWeight: number
      latestWeight: number
      changePercent: number
      sessions: number
    }>
    volumeTrendLast4Weeks: number[] // total volume per week
    mostFrequentDay: string | null
  }
  bjj: {
    totalSessions: number
    avgPerWeek: number
    weeklyGoal: number
    totalMatMinutes: number
    intensityBreakdown: Record<string, number>
    typeBreakdown: Record<string, number>
  }
  cardio: {
    totalSessions: number
    avgPerWeek: number
    weeklyGoal: number
    totalMinutes: number
    totalDistanceMiles: number
    totalDistanceKm: number
    activities: Record<string, number>
    intensityBreakdown: Record<string, number>
  }
  consistency: {
    activeDaysLast30: number
    longestGapDays: number
    currentStreakDays: number
  }
}

/**
 * Builds a compact analytics digest from the user's training data.
 * Uses the access token for RLS — only the authenticated user's data is returned.
 * timeZone is the athlete's IANA zone: days, weeks, and streaks are bucketed on
 * their calendar so the digest agrees with what the dashboard shows them.
 */
export async function buildAnalyticsDigest(
  accessToken: string,
  timeZone?: string
): Promise<AnalyticsDigest> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  const userId = user!.id

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all data in parallel — single workouts query with nested exercises/sets
  const [profileRes, exerciseDataRes, bjjRes, cardioRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('weekly_goal, bjj_weekly_goal, cardio_weekly_goal')
      .eq('id', userId)
      .single(),
    supabase
      .from('workouts')
      .select(`
        id, performed_at, title,
        workout_exercises(
          exercise_id, display_name,
          sets(weight, reps, set_type)
        )
      `)
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true }),
    supabase
      .from('bjj_sessions')
      .select('id, performed_at, kind, duration_min, intensity')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true }),
    supabase
      .from('cardio_sessions')
      .select('id, performed_at, activity, duration_minutes, distance, distance_unit, intensity')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true }),
  ])

  const profile = profileRes.data
  const workouts = exerciseDataRes.data || []
  const bjjSessions = bjjRes.data || []
  const cardioSessions = cardioRes.data || []

  const weeklyGoal = profile?.weekly_goal ?? 4
  const bjjWeeklyGoal = profile?.bjj_weekly_goal ?? 2
  const cardioWeeklyGoal = profile?.cardio_weekly_goal ?? 3

  // --- Strength stats ---
  // Calculate actual weeks tracked from data range (not hardcoded 90/7)
  let weeksTracked = 1
  if (workouts.length >= 2) {
    const firstDate = new Date(workouts[0].performed_at)
    const lastDate = new Date(workouts[workouts.length - 1].performed_at)
    weeksTracked = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  }

  const avgPerWeek = Math.round((workouts.length / weeksTracked) * 10) / 10

  // Count goal-hit weeks (Sunday-start calendar weeks in the athlete's timezone)
  const weekBuckets = new Map<string, number>()
  workouts.forEach(w => {
    const key = localWeekStartKey(w.performed_at, timeZone)
    weekBuckets.set(key, (weekBuckets.get(key) || 0) + 1)
  })
  const goalHitWeeks = Array.from(weekBuckets.values()).filter(c => c >= weeklyGoal).length

  // Volume trend, last 4 calendar weeks (same week definition as goal-hit
  // weeks, so the two can't contradict each other). The last bucket is the
  // current, possibly partial, week.
  const currentWeekKey = localWeekStartKey(now, timeZone)
  const volumeByWeek: number[] = [0, 0, 0, 0]
  workouts.forEach((w: any) => {
    const weeksAgo = weeksBetweenKeys(currentWeekKey, localWeekStartKey(w.performed_at, timeZone))
    if (weeksAgo >= 0 && weeksAgo < 4) {
      const weekIdx = 3 - weeksAgo
      w.workout_exercises?.forEach((ex: any) => {
        ex.sets?.forEach((s: any) => {
          if (s.set_type === 'working') {
            volumeByWeek[weekIdx] += s.weight * s.reps
          }
        })
      })
    }
  })

  // Top exercises by frequency with progression
  const exerciseMap = new Map<string, {
    name: string
    sessions: number
    firstWeight: number
    latestWeight: number
  }>()

  workouts.forEach((w: any) => {
    w.workout_exercises?.forEach((ex: any) => {
      const workingSets = ex.sets?.filter((s: any) => s.set_type === 'working' && s.weight > 0) || []
      if (workingSets.length === 0) return

      const maxWeight = Math.max(...workingSets.map((s: any) => s.weight))
      const id = ex.exercise_id

      if (!exerciseMap.has(id)) {
        exerciseMap.set(id, {
          name: ex.display_name,
          sessions: 1,
          firstWeight: maxWeight,
          latestWeight: maxWeight,
        })
      } else {
        const entry = exerciseMap.get(id)!
        entry.sessions++
        entry.latestWeight = maxWeight
      }
    })
  })

  const topExercises = Array.from(exerciseMap.values())
    .filter(e => e.sessions >= 2)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6)
    .map(e => ({
      name: e.name,
      firstWeight: e.firstWeight,
      latestWeight: e.latestWeight,
      changePercent: e.firstWeight > 0
        ? Math.round(((e.latestWeight - e.firstWeight) / e.firstWeight) * 100)
        : 0,
      sessions: e.sessions,
    }))

  // Most frequent training day
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]
  workouts.forEach(w => {
    dayCounts[localDayOfWeek(w.performed_at, timeZone)]++
  })
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const maxDayCount = Math.max(...dayCounts)
  const mostFrequentDay = maxDayCount > 0 ? dayNames[dayCounts.indexOf(maxDayCount)] : null

  // --- BJJ stats ---
  const bjjIntensity: Record<string, number> = {}
  const bjjTypes: Record<string, number> = {}
  let totalMatMinutes = 0

  bjjSessions.forEach(s => {
    totalMatMinutes += s.duration_min || 0
    if (s.intensity) bjjIntensity[s.intensity] = (bjjIntensity[s.intensity] || 0) + 1
    bjjTypes[s.kind] = (bjjTypes[s.kind] || 0) + 1
  })

  // --- Cardio stats --- (normalize distances to both miles and km)
  const cardioActivities: Record<string, number> = {}
  const cardioIntensity: Record<string, number> = {}
  let totalCardioMinutes = 0
  let totalDistanceMiles = 0
  let totalDistanceKm = 0

  cardioSessions.forEach(s => {
    totalCardioMinutes += s.duration_minutes || 0
    if (s.distance) {
      if (s.distance_unit === 'km') {
        totalDistanceKm += s.distance
        totalDistanceMiles += s.distance * 0.621371
      } else {
        totalDistanceMiles += s.distance
        totalDistanceKm += s.distance * 1.60934
      }
    }
    cardioActivities[s.activity] = (cardioActivities[s.activity] || 0) + 1
    if (s.intensity) cardioIntensity[s.intensity] = (cardioIntensity[s.intensity] || 0) + 1
  })

  // --- Consistency --- (all day keys on the athlete's calendar)
  const allDates = new Set<string>()
  workouts.forEach(w => allDates.add(localDateKey(w.performed_at, timeZone)))
  bjjSessions.forEach(s => allDates.add(localDateKey(s.performed_at, timeZone)))
  cardioSessions.forEach(s => allDates.add(localDateKey(s.performed_at, timeZone)))

  // Active days in last 30
  const thirtyDaysAgoKey = localDateKey(new Date(thirtyDaysAgo), timeZone)
  const activeDaysLast30 = Array.from(allDates).filter(d => d >= thirtyDaysAgoKey).length

  // Current streak (consecutive days from the athlete's today, backward;
  // a rest day today doesn't break yesterday's streak)
  let currentStreakDays = 0
  let checkKey = localDateKey(now, timeZone)
  for (let i = 0; i < 90; i++) {
    if (allDates.has(checkKey)) {
      currentStreakDays++
    } else if (i > 0) {
      break
    }
    checkKey = shiftDateKey(checkKey, -1)
  }

  // Longest gap
  let longestGapDays = 0
  const sortedAsc = Array.from(allDates).sort()
  for (let i = 1; i < sortedAsc.length; i++) {
    const gap = Math.round(
      (new Date(`${sortedAsc[i]}T12:00:00Z`).getTime() - new Date(`${sortedAsc[i - 1]}T12:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
    )
    longestGapDays = Math.max(longestGapDays, gap)
  }

  return {
    period: 'last_90_days',
    strength: {
      totalWorkouts: workouts.length,
      avgPerWeek,
      weeklyGoal,
      goalHitWeeks,
      totalWeeksTracked: weeksTracked,
      topExercises,
      volumeTrendLast4Weeks: volumeByWeek,
      mostFrequentDay,
    },
    bjj: {
      totalSessions: bjjSessions.length,
      avgPerWeek: Math.round((bjjSessions.length / Math.max(1, weeksTracked)) * 10) / 10,
      weeklyGoal: bjjWeeklyGoal,
      totalMatMinutes,
      intensityBreakdown: bjjIntensity,
      typeBreakdown: bjjTypes,
    },
    cardio: {
      totalSessions: cardioSessions.length,
      avgPerWeek: Math.round((cardioSessions.length / Math.max(1, weeksTracked)) * 10) / 10,
      weeklyGoal: cardioWeeklyGoal,
      totalMinutes: totalCardioMinutes,
      totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      activities: cardioActivities,
      intensityBreakdown: cardioIntensity,
    },
    consistency: {
      activeDaysLast30,
      longestGapDays,
      currentStreakDays,
    },
  }
}
