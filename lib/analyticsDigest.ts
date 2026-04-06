import { createClient } from '@supabase/supabase-js'

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
    totalDistance: number
    distanceUnit: string
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
 * Creates a server-side Supabase client using the service role or
 * the user's access token forwarded from the client.
 */
function createServerSupabase(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  })
}

export async function buildAnalyticsDigest(
  userId: string,
  accessToken?: string
): Promise<AnalyticsDigest> {
  const supabase = createServerSupabase(accessToken)

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all data in parallel
  const [profileRes, workoutsRes, exerciseDataRes, bjjRes, cardioRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('weekly_goal, bjj_weekly_goal, cardio_weekly_goal')
      .eq('id', userId)
      .single(),
    supabase
      .from('workouts')
      .select('id, performed_at, title')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true }),
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
  const workouts = workoutsRes.data || []
  const exerciseData = exerciseDataRes.data || []
  const bjjSessions = bjjRes.data || []
  const cardioSessions = cardioRes.data || []

  const weeklyGoal = profile?.weekly_goal ?? 4
  const bjjWeeklyGoal = profile?.bjj_weekly_goal ?? 2
  const cardioWeeklyGoal = profile?.cardio_weekly_goal ?? 3

  // --- Strength stats ---
  const weeksTracked = Math.max(1, Math.ceil(90 / 7))
  const avgPerWeek = Math.round((workouts.length / weeksTracked) * 10) / 10

  // Count goal-hit weeks
  const weekBuckets = new Map<string, number>()
  workouts.forEach(w => {
    const d = new Date(w.performed_at)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().split('T')[0]
    weekBuckets.set(key, (weekBuckets.get(key) || 0) + 1)
  })
  const goalHitWeeks = Array.from(weekBuckets.values()).filter(c => c >= weeklyGoal).length

  // Volume trend last 4 weeks
  const volumeByWeek: number[] = [0, 0, 0, 0]
  exerciseData.forEach((w: any) => {
    const weeksAgo = Math.floor((now.getTime() - new Date(w.performed_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
    if (weeksAgo < 4) {
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
    firstDate: string
    latestDate: string
  }>()

  exerciseData.forEach((w: any) => {
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
          firstDate: w.performed_at,
          latestDate: w.performed_at,
        })
      } else {
        const entry = exerciseMap.get(id)!
        entry.sessions++
        entry.latestWeight = maxWeight
        entry.latestDate = w.performed_at
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
    dayCounts[new Date(w.performed_at).getDay()]++
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

  // --- Cardio stats ---
  const cardioActivities: Record<string, number> = {}
  const cardioIntensity: Record<string, number> = {}
  let totalCardioMinutes = 0
  let totalDistance = 0
  let distanceUnit = 'miles'

  cardioSessions.forEach(s => {
    totalCardioMinutes += s.duration_minutes || 0
    totalDistance += s.distance || 0
    if (s.distance_unit) distanceUnit = s.distance_unit
    cardioActivities[s.activity] = (cardioActivities[s.activity] || 0) + 1
    if (s.intensity) cardioIntensity[s.intensity] = (cardioIntensity[s.intensity] || 0) + 1
  })

  // --- Consistency ---
  const allDates = new Set<string>()
  workouts.forEach(w => allDates.add(new Date(w.performed_at).toISOString().split('T')[0]))
  bjjSessions.forEach(s => allDates.add(new Date(s.performed_at).toISOString().split('T')[0]))
  cardioSessions.forEach(s => allDates.add(new Date(s.performed_at).toISOString().split('T')[0]))

  // Active days in last 30
  const thirtyDaysAgoDate = new Date(thirtyDaysAgo)
  const activeDaysLast30 = Array.from(allDates).filter(
    d => new Date(d) >= thirtyDaysAgoDate
  ).length

  // Current streak (consecutive days from today backward)
  const sortedDates = Array.from(allDates).sort().reverse()
  let currentStreakDays = 0
  const today = now.toISOString().split('T')[0]
  let checkDate = new Date(today)

  for (let i = 0; i < 90; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (allDates.has(dateStr)) {
      currentStreakDays++
    } else if (i > 0) {
      break
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Longest gap
  let longestGapDays = 0
  const sortedAsc = Array.from(allDates).sort()
  for (let i = 1; i < sortedAsc.length; i++) {
    const gap = Math.round(
      (new Date(sortedAsc[i]).getTime() - new Date(sortedAsc[i - 1]).getTime()) /
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
      avgPerWeek: Math.round((bjjSessions.length / weeksTracked) * 10) / 10,
      weeklyGoal: bjjWeeklyGoal,
      totalMatMinutes,
      intensityBreakdown: bjjIntensity,
      typeBreakdown: bjjTypes,
    },
    cardio: {
      totalSessions: cardioSessions.length,
      avgPerWeek: Math.round((cardioSessions.length / weeksTracked) * 10) / 10,
      weeklyGoal: cardioWeeklyGoal,
      totalMinutes: totalCardioMinutes,
      totalDistance: Math.round(totalDistance * 10) / 10,
      distanceUnit,
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
