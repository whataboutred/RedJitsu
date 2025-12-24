'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  Trophy,
  Zap,
  Activity,
  Filter,
  ChevronDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'
import { AnimatedCard, StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { useSearchParams, useRouter } from 'next/navigation'
import WorkoutDetail from '@/components/WorkoutDetail'
import BJJDetail from '@/components/BJJDetail'
import CardioDetail from '@/components/CardioDetail'

type Workout = { id: string; performed_at: string; title: string | null; exercise_count?: number }
type BJJ = { id: string; performed_at: string; duration_min: number; kind: 'class' | 'drilling' | 'open_mat'; intensity: string | null; notes: string | null }
type Cardio = { id: string; performed_at: string; activity: string; duration_minutes: number | null; distance: number | null; distance_unit: string | null; intensity: string | null; notes: string | null }

type ProgressionData = {
  exerciseId: string
  exerciseName: string
  data: Array<{
    date: string
    maxWeight: number
    totalVolume: number
    oneRepMax: number
  }>
}

type VolumeData = {
  date: string
  upperVolume: number
  lowerVolume: number
  totalSets: number
}

type ExerciseProgress = {
  exerciseId: string
  exerciseName: string
  firstWeight: number
  latestWeight: number
  firstReps: number
  latestReps: number
  weightChange: number
  repsChange: number
  percentChange: number
  sessionCount: number
  trend: 'up' | 'down' | 'stagnant'
}

type StreakData = {
  strength: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
  bjj: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
  cardio: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
}

export const dynamic = 'force-dynamic'

// Progress ring component
function ProgressRing({ progress, size = 60, strokeWidth = 5, color = '#ef4444' }: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  )
}

// Mini bar chart for volume
function MiniBarChart({ data, maxValue }: { data: number[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-gradient-to-t from-red-500 to-orange-400 rounded-t"
          initial={{ height: 0 }}
          animate={{ height: `${(value / maxValue) * 100}%` }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        />
      ))}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <HistoryClient />
    </Suspense>
  )
}

function HistoryLoading() {
  return (
    <div className="min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
      <Skeleton variant="rectangular" className="h-10 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-24" />
      </div>
      <SkeletonCard className="h-64" />
      <SkeletonCard className="h-48" />
    </div>
  )
}

function HistoryClient() {
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  const [progressionData, setProgressionData] = useState<ProgressionData[]>([])
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>([])
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [activeProgramExercises, setActiveProgramExercises] = useState<Set<string>>(new Set())
  const [hasActiveProgram, setHasActiveProgram] = useState(false)
  const [selectedView, setSelectedView] = useState<'analytics' | 'workouts'>('analytics')
  const [workoutFilter, setWorkoutFilter] = useState<'all' | 'week' | 'month'>('month')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [activityFilter, setActivityFilter] = useState<'all' | 'strength' | 'bjj' | 'cardio'>('all')

  const params = useSearchParams()
  const router = useRouter()
  const highlightId = params.get('highlight')
  const highlightType = params.get('type') || 'workout'

  const closeModal = () => {
    router.push('/history')
  }

  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 50

  // Filter workouts based on selected time period
  const filteredWorkouts = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()

    switch (workoutFilter) {
      case 'week':
        cutoff.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoff.setMonth(now.getMonth() - 1)
        break
      default:
        cutoff.setFullYear(now.getFullYear() - 1)
    }

    return workouts.filter(w => new Date(w.performed_at) >= cutoff)
  }, [workouts, workoutFilter])

  // Calculate workout frequency stats
  const workoutStats = useMemo(() => {
    const now = new Date()
    const thisWeek = workouts.filter(w => {
      const date = new Date(w.performed_at)
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      return date >= weekStart
    }).length

    const thisMonth = workouts.filter(w => {
      const date = new Date(w.performed_at)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).length

    const avgPerWeek = workouts.length > 0 ?
      Math.round((workouts.length / Math.max(1, (Date.now() - new Date(workouts[workouts.length - 1].performed_at).getTime()) / (1000 * 60 * 60 * 24 * 7))) * 10) / 10 : 0

    return { thisWeek, thisMonth, avgPerWeek, total: workouts.length }
  }, [workouts])

  // Combined activities for timeline
  const allActivities = useMemo(() => {
    const activities: Array<{
      id: string
      type: 'strength' | 'bjj' | 'cardio'
      date: Date
      title: string
      subtitle: string
      data: Workout | BJJ | Cardio
    }> = []

    workouts.forEach(w => {
      const hasData = (w.exercise_count || 0) > 0
      activities.push({
        id: w.id,
        type: 'strength',
        date: new Date(w.performed_at),
        title: w.title || 'Strength Training',
        subtitle: hasData
          ? `${w.exercise_count} exercise${w.exercise_count !== 1 ? 's' : ''} • ${new Date(w.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : `⚠️ No data • ${new Date(w.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        data: w
      })
    })

    bjj.forEach(b => {
      activities.push({
        id: b.id,
        type: 'bjj',
        date: new Date(b.performed_at),
        title: b.kind.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        subtitle: `${b.duration_min} min${b.intensity ? ` • ${b.intensity}` : ''}`,
        data: b
      })
    })

    cardio.forEach(c => {
      activities.push({
        id: c.id,
        type: 'cardio',
        date: new Date(c.performed_at),
        title: c.activity,
        subtitle: `${c.duration_minutes ? `${c.duration_minutes} min` : ''}${c.distance ? ` • ${c.distance} ${c.distance_unit}` : ''}`,
        data: c
      })
    })

    return activities
      .filter(a => activityFilter === 'all' || a.type === activityFilter)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [workouts, bjj, cardio, activityFilter])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user && !DEMO) { window.location.href = '/login'; return }

      const userId = await getActiveUserId()
      if (!userId) return

      const { data: w } = await supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)

      // Get exercise counts for these workouts
      const workoutIds = (w || []).map(workout => workout.id)
      const { data: exerciseCounts } = await supabase
        .from('workout_exercises')
        .select('workout_id')
        .in('workout_id', workoutIds)

      // Count exercises per workout
      const countMap = new Map<string, number>()
      exerciseCounts?.forEach(ex => {
        countMap.set(ex.workout_id, (countMap.get(ex.workout_id) || 0) + 1)
      })

      const initialWorkouts = (w || []).map(workout => ({
        ...workout,
        exercise_count: countMap.get(workout.id) || 0
      })) as Workout[]
      setWorkouts(initialWorkouts)
      setHasMore(initialWorkouts.length === PAGE_SIZE)

      const { data: bj } = await supabase
        .from('bjj_sessions')
        .select('id,performed_at,duration_min,kind,intensity,notes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)
      setBjj((bj || []) as BJJ[])

      const { data: cardioData } = await supabase
        .from('cardio_sessions')
        .select('id,performed_at,activity,duration_minutes,distance,distance_unit,intensity,notes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(PAGE_SIZE)
      setCardio((cardioData || []) as Cardio[])

      await loadProgressionData(userId)
      await loadVolumeData(userId)
      await loadActiveProgramExercises(userId)
      await loadStreakData(userId)

      setLoading(false)
    })()
  }, [])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const nextPage = page + 1
      const offset = nextPage * PAGE_SIZE

      const { data: w } = await supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      // Get exercise counts for these workouts
      const workoutIds = (w || []).map(workout => workout.id)
      const { data: exerciseCounts } = await supabase
        .from('workout_exercises')
        .select('workout_id')
        .in('workout_id', workoutIds)

      const countMap = new Map<string, number>()
      exerciseCounts?.forEach(ex => {
        countMap.set(ex.workout_id, (countMap.get(ex.workout_id) || 0) + 1)
      })

      const newWorkouts = (w || []).map(workout => ({
        ...workout,
        exercise_count: countMap.get(workout.id) || 0
      })) as Workout[]
      setWorkouts(prev => [...prev, ...newWorkouts])
      setPage(nextPage)
      setHasMore(newWorkouts.length === PAGE_SIZE)
    } catch (error) {
      console.error('Error loading more workouts:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  async function loadProgressionData(userId: string) {
    // First get workouts for this user in the date range
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, performed_at')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true })

    if (!workouts || workouts.length === 0) {
      setProgressionData([])
      return
    }

    const workoutIds = workouts.map(w => w.id)
    const workoutDateMap = new Map(workouts.map(w => [w.id, w.performed_at]))

    // Then get workout_exercises and sets for those workouts
    const { data: exerciseData } = await supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        display_name,
        workout_id,
        sets(weight, reps, set_type)
      `)
      .in('workout_id', workoutIds)

    if (exerciseData) {
      const exerciseMap = new Map<string, {
        name: string
        sessions: Array<{ date: string; maxWeight: number; totalVolume: number }>
      }>()

      exerciseData.forEach((item: any) => {
        const exerciseId = item.exercise_id
        const performedAt = workoutDateMap.get(item.workout_id)
        if (!performedAt) return
        const date = new Date(performedAt).toISOString().split('T')[0]

        const workingSets = item.sets?.filter((s: any) => s.set_type === 'working' && s.weight > 0) || []
        const maxWeight = workingSets.length > 0 ? Math.max(...workingSets.map((s: any) => s.weight)) : 0
        const totalVolume = workingSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0)

        if (maxWeight > 0) {
          if (!exerciseMap.has(exerciseId)) {
            exerciseMap.set(exerciseId, { name: item.display_name, sessions: [] })
          }

          const existing = exerciseMap.get(exerciseId)!
          const existingSession = existing.sessions.find(s => s.date === date)
          if (existingSession) {
            existingSession.maxWeight = Math.max(existingSession.maxWeight, maxWeight)
            existingSession.totalVolume = Math.max(existingSession.totalVolume, totalVolume)
          } else {
            existing.sessions.push({ date, maxWeight, totalVolume })
          }
        }
      })

      const progression: ProgressionData[] = Array.from(exerciseMap.entries())
        .filter(([_, data]) => data.sessions.length >= 2)
        .map(([exerciseId, data]) => ({
          exerciseId,
          exerciseName: data.name,
          data: data.sessions.map(session => ({
            date: session.date,
            maxWeight: session.maxWeight,
            totalVolume: session.totalVolume,
            oneRepMax: Math.round(session.maxWeight * (1 + 0.0333 * 10))
          }))
        }))
        .sort((a, b) => b.data.length - a.data.length)
        .slice(0, 8)

      setProgressionData(progression)
    }
  }

  async function loadVolumeData(userId: string) {
    const { data: workoutData } = await supabase
      .from('workouts')
      .select(`
        id,
        performed_at,
        title,
        workout_exercises!inner(
          display_name,
          sets(weight, reps, set_type)
        )
      `)
      .eq('user_id', userId)
      .gte('performed_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
      .order('performed_at', { ascending: true })

    if (workoutData) {
      const volumeByDate = new Map<string, { upperVolume: number; lowerVolume: number; totalSets: number }>()

      workoutData.forEach((workout: any) => {
        const date = new Date(workout.performed_at).toISOString().split('T')[0]
        const title = workout.title?.toLowerCase() || ''

        const isUpper = title.includes('upper') || title.includes('push') || title.includes('pull')
        const isLower = title.includes('lower') || title.includes('legs') || title.includes('squat') || title.includes('deadlift')

        let totalVolume = 0
        let totalSets = 0

        workout.workout_exercises.forEach((exercise: any) => {
          const workingSets = exercise.sets?.filter((s: any) => s.set_type === 'working') || []
          totalSets += workingSets.length
          totalVolume += workingSets.reduce((sum: number, s: any) => sum + (s.weight * s.reps), 0)
        })

        if (!volumeByDate.has(date)) {
          volumeByDate.set(date, { upperVolume: 0, lowerVolume: 0, totalSets: 0 })
        }

        const existing = volumeByDate.get(date)!
        existing.totalSets += totalSets

        if (isUpper) {
          existing.upperVolume += totalVolume
        } else if (isLower) {
          existing.lowerVolume += totalVolume
        } else {
          existing.upperVolume += totalVolume / 2
          existing.lowerVolume += totalVolume / 2
        }
      })

      const volumeArray: VolumeData[] = Array.from(volumeByDate.entries()).map(([date, data]) => ({
        date,
        upperVolume: Math.round(data.upperVolume),
        lowerVolume: Math.round(data.lowerVolume),
        totalSets: data.totalSets
      }))

      setVolumeData(volumeArray)
    }
  }

  async function loadActiveProgramExercises(userId: string) {
    // Get active program
    const { data: activeProgram } = await supabase
      .from('programs')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()

    if (!activeProgram) {
      setHasActiveProgram(false)
      setActiveProgramExercises(new Set())
      // Fallback: load progress for all exercises from recent workouts
      await calculateExerciseProgressFromAllWorkouts(userId)
      return
    }

    setHasActiveProgram(true)

    // Get program days with exercises
    const { data: programDays } = await supabase
      .from('program_days')
      .select(`
        id,
        template_exercises(exercise_id, display_name)
      `)
      .eq('program_id', activeProgram.id)

    const exerciseIds = new Set<string>()
    const exerciseNameMap = new Map<string, string>()

    programDays?.forEach((day: any) => {
      day.template_exercises?.forEach((ex: any) => {
        exerciseIds.add(ex.exercise_id)
        exerciseNameMap.set(ex.exercise_id, ex.display_name)
      })
    })

    setActiveProgramExercises(exerciseIds)

    // Calculate progress for active program exercises
    const hasProgress = await calculateExerciseProgress(userId, exerciseIds, exerciseNameMap)

    // If no progress data from program exercises, fallback to all exercises
    if (!hasProgress) {
      await calculateExerciseProgressFromAllWorkouts(userId)
    }
  }

  async function calculateExerciseProgress(userId: string, activeExerciseIds: Set<string>, exerciseNameMap: Map<string, string>): Promise<boolean> {
    if (activeExerciseIds.size === 0) {
      setExerciseProgress([])
      return false
    }

    // First get workouts for this user in the date range
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, performed_at')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true })

    if (!workouts || workouts.length === 0) {
      setExerciseProgress([])
      return false
    }

    const workoutIds = workouts.map(w => w.id)
    const workoutDateMap = new Map(workouts.map(w => [w.id, w.performed_at]))

    // Then get workout_exercises and sets for those workouts, filtered by exercise IDs
    const { data: exerciseData } = await supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        display_name,
        workout_id,
        sets(weight, reps, set_type)
      `)
      .in('workout_id', workoutIds)
      .in('exercise_id', Array.from(activeExerciseIds))

    if (!exerciseData || exerciseData.length === 0) {
      setExerciseProgress([])
      return false
    }

    // Group by exercise and calculate progress
    const exerciseMap = new Map<string, {
      name: string
      sessions: Array<{ date: string; maxWeight: number; avgReps: number }>
    }>()

    exerciseData.forEach((item: any) => {
      const exerciseId = item.exercise_id
      const performedAt = workoutDateMap.get(item.workout_id)
      if (!performedAt) return
      const date = new Date(performedAt).toISOString().split('T')[0]

      const workingSets = item.sets?.filter((s: any) => s.set_type === 'working' && s.weight > 0) || []
      if (workingSets.length === 0) return

      const maxWeight = Math.max(...workingSets.map((s: any) => s.weight))
      const avgReps = workingSets.reduce((sum: number, s: any) => sum + s.reps, 0) / workingSets.length

      if (!exerciseMap.has(exerciseId)) {
        exerciseMap.set(exerciseId, {
          name: exerciseNameMap.get(exerciseId) || item.display_name,
          sessions: []
        })
      }

      const existing = exerciseMap.get(exerciseId)!
      const existingSession = existing.sessions.find(s => s.date === date)
      if (existingSession) {
        existingSession.maxWeight = Math.max(existingSession.maxWeight, maxWeight)
        existingSession.avgReps = Math.max(existingSession.avgReps, avgReps)
      } else {
        existing.sessions.push({ date, maxWeight, avgReps })
      }
    })

    // Calculate progress metrics
    const progress: ExerciseProgress[] = []

    exerciseMap.forEach((data, exerciseId) => {
      if (data.sessions.length < 2) return

      const firstSession = data.sessions[0]
      const latestSession = data.sessions[data.sessions.length - 1]

      const weightChange = latestSession.maxWeight - firstSession.maxWeight
      const repsChange = Math.round(latestSession.avgReps - firstSession.avgReps)

      // Calculate percentage change based on weight primarily
      let percentChange = 0
      if (firstSession.maxWeight > 0) {
        percentChange = ((latestSession.maxWeight - firstSession.maxWeight) / firstSession.maxWeight) * 100
      }

      // Determine trend
      let trend: 'up' | 'down' | 'stagnant' = 'stagnant'
      if (percentChange > 2) trend = 'up'
      else if (percentChange < -2) trend = 'down'

      progress.push({
        exerciseId,
        exerciseName: data.name,
        firstWeight: firstSession.maxWeight,
        latestWeight: latestSession.maxWeight,
        firstReps: Math.round(firstSession.avgReps),
        latestReps: Math.round(latestSession.avgReps),
        weightChange,
        repsChange,
        percentChange: Math.round(percentChange * 10) / 10,
        sessionCount: data.sessions.length,
        trend
      })
    })

    setExerciseProgress(progress)
    return progress.length > 0
  }

  async function calculateExerciseProgressFromAllWorkouts(userId: string) {
    // First get workouts for this user in the date range
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, performed_at')
      .eq('user_id', userId)
      .gte('performed_at', ninetyDaysAgo)
      .order('performed_at', { ascending: true })

    if (!workouts || workouts.length === 0) {
      setExerciseProgress([])
      return
    }

    const workoutIds = workouts.map(w => w.id)
    const workoutDateMap = new Map(workouts.map(w => [w.id, w.performed_at]))

    // Then get workout_exercises and sets for those workouts
    const { data: exerciseData } = await supabase
      .from('workout_exercises')
      .select(`
        exercise_id,
        display_name,
        workout_id,
        sets(weight, reps, set_type)
      `)
      .in('workout_id', workoutIds)

    if (!exerciseData || exerciseData.length === 0) {
      setExerciseProgress([])
      return
    }

    // Group by exercise and calculate progress
    const exerciseMap = new Map<string, {
      name: string
      sessions: Array<{ date: string; maxWeight: number; avgReps: number }>
    }>()

    exerciseData.forEach((item: any) => {
      const exerciseId = item.exercise_id
      const performedAt = workoutDateMap.get(item.workout_id)
      if (!performedAt) return
      const date = new Date(performedAt).toISOString().split('T')[0]

      const workingSets = item.sets?.filter((s: any) => s.set_type === 'working' && s.weight > 0) || []
      if (workingSets.length === 0) return

      const maxWeight = Math.max(...workingSets.map((s: any) => s.weight))
      const avgReps = workingSets.reduce((sum: number, s: any) => sum + s.reps, 0) / workingSets.length

      if (!exerciseMap.has(exerciseId)) {
        exerciseMap.set(exerciseId, {
          name: item.display_name,
          sessions: []
        })
      }

      const existing = exerciseMap.get(exerciseId)!
      const existingSession = existing.sessions.find(s => s.date === date)
      if (existingSession) {
        existingSession.maxWeight = Math.max(existingSession.maxWeight, maxWeight)
        existingSession.avgReps = Math.max(existingSession.avgReps, avgReps)
      } else {
        existing.sessions.push({ date, maxWeight, avgReps })
      }
    })

    // Calculate progress metrics
    const progress: ExerciseProgress[] = []

    exerciseMap.forEach((data, exerciseId) => {
      if (data.sessions.length < 2) return

      const firstSession = data.sessions[0]
      const latestSession = data.sessions[data.sessions.length - 1]

      const weightChange = latestSession.maxWeight - firstSession.maxWeight
      const repsChange = Math.round(latestSession.avgReps - firstSession.avgReps)

      let percentChange = 0
      if (firstSession.maxWeight > 0) {
        percentChange = ((latestSession.maxWeight - firstSession.maxWeight) / firstSession.maxWeight) * 100
      }

      let trend: 'up' | 'down' | 'stagnant' = 'stagnant'
      if (percentChange > 2) trend = 'up'
      else if (percentChange < -2) trend = 'down'

      progress.push({
        exerciseId,
        exerciseName: data.name,
        firstWeight: firstSession.maxWeight,
        latestWeight: latestSession.maxWeight,
        firstReps: Math.round(firstSession.avgReps),
        latestReps: Math.round(latestSession.avgReps),
        weightChange,
        repsChange,
        percentChange: Math.round(percentChange * 10) / 10,
        sessionCount: data.sessions.length,
        trend
      })
    })

    setExerciseProgress(progress)
  }

  async function loadStreakData(userId: string) {
    // Get profile goals
    const { data: prof } = await supabase
      .from('profiles')
      .select('weekly_goal, bjj_weekly_goal, cardio_weekly_goal')
      .eq('id', userId)
      .maybeSingle()

    const strengthGoal = prof?.weekly_goal ?? 4
    const bjjGoal = prof?.bjj_weekly_goal ?? 2
    const cardioGoal = prof?.cardio_weekly_goal ?? 3

    // Fetch recent sessions
    const [workoutsRes, bjjRes, cardioRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('performed_at')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(500),
      supabase
        .from('bjj_sessions')
        .select('performed_at')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(500),
      supabase
        .from('cardio_sessions')
        .select('performed_at')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(500)
    ])

    const now = new Date()
    const startOfWeekSunday = (d: Date) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      const day = x.getDay()
      x.setDate(x.getDate() - day)
      return x
    }
    const weekKey = (d: Date) => startOfWeekSunday(d).toISOString().slice(0, 10)
    const thisWeekKey = weekKey(now)
    const dayIndex = now.getDay()

    // Calculate streaks and weekly counts
    const calculateStats = (sessions: any[], goal: number) => {
      const weekCounts = new Map<string, number>()
      sessions.forEach(s => {
        const k = weekKey(new Date(s.performed_at))
        weekCounts.set(k, (weekCounts.get(k) || 0) + 1)
      })

      const thisWeekCount = weekCounts.get(thisWeekKey) || 0

      // Calculate streak
      const keys: string[] = []
      let cursor = startOfWeekSunday(now)
      for (let i = 0; i < 120; i++) {
        keys.push(cursor.toISOString().slice(0, 10))
        cursor = new Date(cursor)
        cursor.setDate(cursor.getDate() - 7)
      }

      let streak = 0
      for (const k of keys) {
        const c = weekCounts.get(k) || 0
        if (c >= goal) streak++
        else {
          if (k === thisWeekKey && c < goal) continue
          break
        }
      }

      const expectedByToday = Math.ceil((goal * (dayIndex + 1)) / 7)
      const isOnTrack = thisWeekCount >= expectedByToday

      return { current: streak, thisWeek: thisWeekCount, goal, isOnTrack }
    }

    setStreakData({
      strength: calculateStats(workoutsRes.data || [], strengthGoal),
      bjj: calculateStats(bjjRes.data || [], bjjGoal),
      cardio: calculateStats(cardioRes.data || [], cardioGoal)
    })
  }

  // Computed: top growth and need work exercises
  const topGrowth = useMemo(() => {
    return exerciseProgress
      .filter(e => e.trend === 'up')
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 3)
  }, [exerciseProgress])

  const needWork = useMemo(() => {
    return exerciseProgress
      .filter(e => e.trend === 'down' || e.trend === 'stagnant')
      .sort((a, b) => a.percentChange - b.percentChange)
      .slice(0, 3)
  }, [exerciseProgress])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'strength': return <Dumbbell className="w-5 h-5" />
      case 'bjj': return <Target className="w-5 h-5" />
      case 'cardio': return <Activity className="w-5 h-5" />
      default: return <Dumbbell className="w-5 h-5" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'strength': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' }
      case 'bjj': return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' }
      case 'cardio': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' }
      default: return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' }
    }
  }

  if (loading) return <HistoryLoading />

  return (
    <div className="min-h-screen bg-brand-dark pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-brand-dark/80 backdrop-blur-lg border-b border-white/5">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Track your progress</p>
            </div>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedView === 'analytics'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-zinc-400 hover:text-white'
                  }`}
                onClick={() => setSelectedView('analytics')}
              >
                <BarChart3 className="w-4 h-4 inline mr-1" />
                Analytics
              </button>
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedView === 'workouts'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-zinc-400 hover:text-white'
                  }`}
                onClick={() => setSelectedView('workouts')}
              >
                <Calendar className="w-4 h-4 inline mr-1" />
                History
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {highlightId && highlightType === 'workout' && (
        <WorkoutDetail workoutId={highlightId} onClose={closeModal} />
      )}
      {highlightId && highlightType === 'bjj' && (
        <BJJDetail sessionId={highlightId} onClose={closeModal} />
      )}
      {highlightId && highlightType === 'cardio' && (
        <CardioDetail sessionId={highlightId} onClose={closeModal} onUpdate={() => window.location.reload()} />
      )}

      <div className="p-4 space-y-4">
        {selectedView === 'analytics' ? (
          <>
            {/* Exercise Progress Section */}
            <AnimatedCard delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-red-400" />
                <h3 className="font-semibold text-white">Exercise Progress</h3>
                <span className="text-xs text-zinc-500 ml-auto">
                  {hasActiveProgram && activeProgramExercises.size > 0 ? 'From active program' : 'All exercises'} • Last 90 days
                </span>
              </div>

              {exerciseProgress.length === 0 ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">
                    {hasActiveProgram
                      ? 'Complete more workouts with your program exercises to see progress!'
                      : 'Complete a few workouts to see your progress!'}
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top 3 Growth */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <h4 className="text-sm font-medium text-emerald-400">Top Growth</h4>
                    </div>
                    {topGrowth.length > 0 ? (
                      <div className="space-y-2">
                        {topGrowth.map((exercise, idx) => (
                          <motion.div
                            key={exercise.exerciseId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-white text-sm truncate flex-1">{exercise.exerciseName}</span>
                              <span className="text-emerald-400 font-bold text-sm ml-2">
                                +{exercise.percentChange}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span>{exercise.firstWeight} → {exercise.latestWeight} lb</span>
                              <span className="text-zinc-600">•</span>
                              <span>{exercise.sessionCount} sessions</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-900/50 rounded-xl text-center">
                        <p className="text-zinc-500 text-sm">No improving exercises yet</p>
                      </div>
                    )}
                  </div>

                  {/* Top 3 Need Work */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">Need Work</h4>
                    </div>
                    {needWork.length > 0 ? (
                      <div className="space-y-2">
                        {needWork.map((exercise, idx) => (
                          <motion.div
                            key={exercise.exerciseId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`p-3 rounded-xl ${
                              exercise.trend === 'down'
                                ? 'bg-red-500/10 border border-red-500/20'
                                : 'bg-amber-500/10 border border-amber-500/20'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-white text-sm truncate flex-1">{exercise.exerciseName}</span>
                              <div className="flex items-center gap-1 ml-2">
                                {exercise.trend === 'down' ? (
                                  <ArrowDown className="w-3 h-3 text-red-400" />
                                ) : (
                                  <Minus className="w-3 h-3 text-amber-400" />
                                )}
                                <span className={`font-bold text-sm ${
                                  exercise.trend === 'down' ? 'text-red-400' : 'text-amber-400'
                                }`}>
                                  {exercise.percentChange > 0 ? '+' : ''}{exercise.percentChange}%
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <span>{exercise.firstWeight} → {exercise.latestWeight} lb</span>
                              <span className="text-zinc-600">•</span>
                              <span>{exercise.trend === 'stagnant' ? 'Stagnant' : 'Regressed'}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-900/50 rounded-xl text-center">
                        <p className="text-zinc-500 text-sm">All exercises progressing well!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AnimatedCard>

            {/* Streak Info Section */}
            {streakData && (
              <AnimatedCard delay={0.1}>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-white">Current Streaks</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Strength Streak */}
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Dumbbell className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-medium text-red-400">Strength</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xl font-bold text-white">{streakData.strength.current}</span>
                      <span className="text-xs text-zinc-400">wks</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="text-zinc-400">{streakData.strength.thisWeek}/{streakData.strength.goal} this week</span>
                      <div className={`mt-1 ${streakData.strength.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {streakData.strength.isOnTrack ? 'On Track' : 'Catch Up'}
                      </div>
                    </div>
                  </div>

                  {/* BJJ Streak */}
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium text-purple-400">BJJ</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xl font-bold text-white">{streakData.bjj.current}</span>
                      <span className="text-xs text-zinc-400">wks</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="text-zinc-400">{streakData.bjj.thisWeek}/{streakData.bjj.goal} this week</span>
                      <div className={`mt-1 ${streakData.bjj.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {streakData.bjj.isOnTrack ? 'On Track' : 'Catch Up'}
                      </div>
                    </div>
                  </div>

                  {/* Cardio Streak */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400">Cardio</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xl font-bold text-white">{streakData.cardio.current}</span>
                      <span className="text-xs text-zinc-400">wks</span>
                    </div>
                    <div className="mt-2 text-xs">
                      <span className="text-zinc-400">{streakData.cardio.thisWeek}/{streakData.cardio.goal} this week</span>
                      <div className={`mt-1 ${streakData.cardio.isOnTrack ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {streakData.cardio.isOnTrack ? 'On Track' : 'Catch Up'}
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Volume Tracker */}
            {volumeData.length > 0 && (
              <AnimatedCard delay={0.2}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-white">Volume Tracker</h3>
                  <span className="text-xs text-zinc-500 ml-auto">Working sets per session • Last 60 days</span>
                </div>

                <div className="space-y-3">
                  {volumeData.slice(-10).map((day, index) => {
                    const maxTotal = Math.max(...volumeData.slice(-10).map(d => d.upperVolume + d.lowerVolume))

                    return (
                      <motion.div
                        key={day.date}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-16 text-xs text-zinc-400">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex-1 h-6 bg-zinc-900 rounded-full overflow-hidden flex">
                          <motion.div
                            className="bg-gradient-to-r from-red-500 to-orange-500 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(day.upperVolume / maxTotal) * 100}%` }}
                            transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                          />
                          <motion.div
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(day.lowerVolume / maxTotal) * 100}%` }}
                            transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                          />
                        </div>
                        <div className="w-14 text-xs text-zinc-400 text-right">
                          {day.totalSets} sets
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <div className="flex gap-4 text-xs text-zinc-500 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-orange-500" />
                    Upper Body
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-cyan-500" />
                    Lower Body
                  </div>
                </div>
              </AnimatedCard>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AnimatedCard delay={0.25} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Flame className="w-6 h-6 text-red-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-400">{workoutStats.thisWeek}</p>
                <p className="text-xs text-zinc-400">This Week</p>
              </AnimatedCard>

              <AnimatedCard delay={0.3} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-400">{workoutStats.thisMonth}</p>
                <p className="text-xs text-zinc-400">This Month</p>
              </AnimatedCard>

              <AnimatedCard delay={0.35} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{workoutStats.avgPerWeek}</p>
                <p className="text-xs text-zinc-400">Avg/Week</p>
              </AnimatedCard>

              <AnimatedCard delay={0.4} className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-400">{workoutStats.total}</p>
                <p className="text-xs text-zinc-400">Total</p>
              </AnimatedCard>
            </div>
          </>
        ) : (
          /* Workout History View */
          <>
            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'strength', 'bjj', 'cardio'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActivityFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activityFilter === filter
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'strength' && 'Strength'}
                  {filter === 'bjj' && 'BJJ'}
                  {filter === 'cardio' && 'Cardio'}
                </button>
              ))}

              <div className="ml-auto flex gap-2">
                {(['week', 'month', 'all'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setWorkoutFilter(filter)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${workoutFilter === filter
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-white'
                      }`}
                  >
                    {filter === 'week' && 'Week'}
                    {filter === 'month' && 'Month'}
                    {filter === 'all' && 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="space-y-2">
              {allActivities.length === 0 ? (
                <AnimatedCard>
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400">No activities found</p>
                  </div>
                </AnimatedCard>
              ) : (
                allActivities.slice(0, 30).map((activity, index) => {
                  const colors = getActivityColor(activity.type)

                  return (
                    <motion.div
                      key={`${activity.type}-${activity.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <button
                        onClick={() => {
                          if (activity.type === 'strength') {
                            router.push(`/history?highlight=${activity.id}`)
                          } else if (activity.type === 'bjj') {
                            router.push(`/history?highlight=${activity.id}&type=bjj`)
                          } else {
                            router.push(`/history?highlight=${activity.id}&type=cardio`)
                          }
                        }}
                        className={`w-full p-4 rounded-xl ${colors.bg} border ${colors.border} hover:border-white/20 transition-all text-left group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center ${colors.text}`}>
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{activity.title}</p>
                            <p className="text-xs text-zinc-400">
                              {activity.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {activity.subtitle && ` • ${activity.subtitle}`}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                    </motion.div>
                  )
                })
              )}

              {hasMore && activityFilter === 'all' && workoutFilter === 'all' && (
                <div className="text-center pt-4">
                  <Button
                    variant="secondary"
                    onClick={loadMore}
                    loading={loadingMore}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
