'use client'

import { Suspense, useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Dumbbell,
  Target,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
  Watch,
  Filter,
  ChevronDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'
import { AnimatedCard, StatCard } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { Sparkline } from '@/components/ui/Sparkline'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { useToast } from '@/components/Toast'
import { deleteWorkout, deleteBjjSession, deleteCardioSession } from '@/lib/api'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { useSearchParams, useRouter } from 'next/navigation'
import WorkoutDetail from '@/components/WorkoutDetail'
import BJJDetail from '@/components/BJJDetail'
import Achievements from '@/components/Achievements'
import ActivityHeatmap from '@/components/ActivityHeatmap'
import CardioDetail from '@/components/CardioDetail'
import AIInsights from '@/components/AIInsights'
import BackgroundLogo from '@/components/BackgroundLogo'

type WorkoutMetrics = { avg_hr: number | null; calories: number | null; active_minutes: number | null }
type Workout = {
  id: string
  performed_at: string
  title: string | null
  exercise_count?: number
  workout_metrics?: WorkoutMetrics[]
}
type BJJ = { id: string; performed_at: string; duration_min: number; kind: 'class' | 'drilling' | 'open_mat'; intensity: string | null; notes: string | null }
type Cardio = { id: string; performed_at: string; activity: string; duration_minutes: number | null; distance: number | null; distance_unit: string | null; intensity: string | null; notes: string | null; source: string | null }

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
  /** Max working weight per session, chronological — feeds the sparkline */
  series: number[]
}

type StreakData = {
  strength: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
  bjj: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
  cardio: { current: number; thisWeek: number; goal: number; isOnTrack: boolean }
}

export const dynamic = 'force-dynamic'


// Mini bar chart for volume
function MiniBarChart({ data, maxValue }: { data: number[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-gradient-to-t from-red-600 to-red-400 rounded-t"
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
    <div className="relative min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
      <BackgroundLogo />
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

const PROGRESS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'history', label: 'History' },
] as const

function HistoryClient() {
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  // True all-time counts (lists are paginated, so .length is only a page).
  // Feeds the Achievements stats header + badge unlocks.
  const [totalCounts, setTotalCounts] = useState({ workouts: 0, bjj: 0, cardio: 0 })
  const [progressionData, setProgressionData] = useState<ProgressionData[]>([])
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgress[]>([])
  const [streakData, setStreakData] = useState<StreakData | null>(null)
  const [activeProgramExercises, setActiveProgramExercises] = useState<Set<string>>(new Set())
  const [hasActiveProgram, setHasActiveProgram] = useState(false)
  const [selectedView, setSelectedView] = useState<'overview' | 'achievements' | 'history'>('overview')
  const [workoutFilter, setWorkoutFilter] = useState<'all' | 'week' | 'month' | 'custom'>('month')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [activityFilter, setActivityFilter] = useState<'all' | 'strength' | 'bjj' | 'cardio'>('all')
  const [customDateFrom, setCustomDateFrom] = useState<string>('')
  const [customDateTo, setCustomDateTo] = useState<string>('')

  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const highlightId = params.get('highlight')
  const highlightType = params.get('type') || 'workout'

  // Swipe-to-delete target awaiting confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'strength' | 'bjj' | 'cardio'
    id: string
    title: string
  } | null>(null)

  async function confirmDeleteActivity() {
    if (!deleteTarget) return
    const { type, id } = deleteTarget
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      if (type === 'strength') {
        await deleteWorkout(id, userId)
        setWorkouts((prev) => prev.filter((w) => w.id !== id))
      } else if (type === 'bjj') {
        await deleteBjjSession(id, userId)
        setBjj((prev) => prev.filter((s) => s.id !== id))
      } else {
        await deleteCardioSession(id, userId)
        setCardio((prev) => prev.filter((s) => s.id !== id))
      }
      toast.success('Deleted')
    } catch (e) {
      console.error('Delete failed:', e)
      toast.error('Failed to delete')
    } finally {
      setDeleteTarget(null)
    }
  }

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

    if (workoutFilter === 'custom' && customDateFrom) {
      const from = new Date(customDateFrom)
      const to = customDateTo ? new Date(customDateTo + 'T23:59:59') : now
      return workouts.filter(w => {
        const d = new Date(w.performed_at)
        return d >= from && d <= to
      })
    }

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
  }, [workouts, workoutFilter, customDateFrom, customDateTo])

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
    // Calculate time cutoff based on workoutFilter
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

    const activities: Array<{
      id: string
      type: 'strength' | 'bjj' | 'cardio'
      date: Date
      title: string
      subtitle: string
      fromFitbit?: boolean
      data: Workout | BJJ | Cardio
    }> = []

    workouts.forEach(w => {
      const hasData = (w.exercise_count || 0) > 0
      const m = w.workout_metrics?.[0]
      const watchBits = m
        ? [m.avg_hr && `${m.avg_hr} bpm`, m.calories && `${m.calories} cal`].filter(Boolean).join(' • ')
        : ''
      activities.push({
        id: w.id,
        type: 'strength',
        date: new Date(w.performed_at),
        title: w.title || 'Strength Training',
        subtitle: (hasData
          ? `${w.exercise_count} exercise${w.exercise_count !== 1 ? 's' : ''} • ${new Date(w.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : `No data • ${new Date(w.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`) +
          (watchBits ? ` • ${watchBits}` : ''),
        fromFitbit: !!m,
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
        fromFitbit: c.source === 'fitbit',
        data: c
      })
    })

    return activities
      .filter(a => activityFilter === 'all' || a.type === activityFilter)
      .filter(a => a.date >= cutoff)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [workouts, bjj, cardio, activityFilter, workoutFilter])

  const loadHistoryData = useCallback(async () => {
    const userId = await getActiveUserId()
    if (!userId) return

    // True all-time counts (head-only, no rows) for achievements
    const [wHead, bjjHead, cardioHead] = await Promise.all([
      supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('bjj_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('cardio_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    setTotalCounts({
      workouts: wHead.count ?? 0,
      bjj: bjjHead.count ?? 0,
      cardio: cardioHead.count ?? 0,
    })

    const { data: w } = await supabase
      .from('workouts')
      .select('id,performed_at,title,workout_metrics(avg_hr,calories,active_minutes)')
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
    setPage(0)
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
      .select('id,performed_at,activity,duration_minutes,distance,distance_unit,intensity,notes,source')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(PAGE_SIZE)
    setCardio((cardioData || []) as Cardio[])

    await loadProgressionData(userId)
    await loadActiveProgramExercises(userId)
    await loadStreakData(userId)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user && !DEMO) { router.push('/login'); return }
      await loadHistoryData()
      setLoading(false)
    })()
  }, [loadHistoryData, router])

  // Refetch when data changes anywhere or the tab regains focus
  useDataRefresh(loadHistoryData)

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
        .select('id,performed_at,title,workout_metrics(avg_hr,calories,active_minutes)')
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
        trend,
        series: data.sessions.map(s => s.maxWeight)
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
        trend,
        series: data.sessions.map(s => s.maxWeight)
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
      case 'strength': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', leftBorder: 'border-l-brand-red/70' }
      case 'bjj': return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', leftBorder: 'border-l-purple-500/70' }
      case 'cardio': return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', leftBorder: 'border-l-emerald-500/70' }
      default: return { bg: 'bg-zinc-500/20', text: 'text-zinc-500', border: 'border-zinc-500/30', leftBorder: 'border-l-zinc-500/70' }
    }
  }

  if (loading) return <HistoryLoading />

  return (
    <div className="relative min-h-screen bg-brand-dark pb-24">
      <BackgroundLogo />
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="px-4 pt-4">
          <h1 className="text-4xl font-display uppercase text-white">Progress</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Insights &amp; training log</p>
          {/* Inline tabs */}
          <div className="flex gap-7 mt-4">
            {PROGRESS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedView(t.id)}
                className={`relative pb-3 -mb-px text-sm font-semibold tracking-wide transition-colors ${selectedView === t.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                {t.label}
                {selectedView === t.id && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-brand-red" />
                )}
              </button>
            ))}
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
        <CardioDetail sessionId={highlightId} onClose={closeModal} />
      )}

      <div className="p-4 space-y-4">
        {selectedView === 'overview' && (
          <>
            {/* AI Coach Insights */}
            {!loading && <AIInsights />}

            {/* Empty state when no data */}
            {!loading && workouts.length === 0 && bjj.length === 0 && cardio.length === 0 && (
              <AnimatedCard className="text-center py-10">
                <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-2xl font-display uppercase text-white mb-2">Your story starts here</h3>
                <p className="text-zinc-500 text-sm mb-6">Log a workout, a roll, or a run — your trends and records show up here.</p>
                <Link href="/workouts/new" className="btn inline-flex">
                  Log Your First Workout
                </Link>
              </AnimatedCard>
            )}

            {/* Exercise Progress Section */}
            <AnimatedCard delay={0}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-red-400" />
                <h3 className="font-display uppercase text-lg text-white">Exercise Progress</h3>
                <span className="text-xs text-zinc-500 ml-auto">
                  {hasActiveProgram && activeProgramExercises.size > 0 ? 'From active program' : 'All exercises'} • Last 90 days
                </span>
              </div>

              {exerciseProgress.length === 0 ? (
                <div className="text-center py-8">
                  <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-500">
                    {hasActiveProgram
                      ? 'Complete more workouts with your program exercises to see progress!'
                      : 'Complete a few workouts to see your progress!'}
                  </p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Top 3 Growth */}
                  <div>
                    <h4 className="text-xs font-display uppercase tracking-wider text-emerald-400 mb-1">Top Growth</h4>
                    {topGrowth.length > 0 ? (
                      <div>
                        {topGrowth.map((exercise, idx) => (
                          <motion.div
                            key={exercise.exerciseId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm truncate">{exercise.exerciseName}</p>
                              <p className="text-xs text-zinc-500">{exercise.firstWeight} → {exercise.latestWeight} lb · {exercise.sessionCount} sessions</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <Sparkline data={exercise.series} stroke="#34D399" />
                              <span className="font-display text-lg text-emerald-400 w-14 text-right">+{exercise.percentChange}%</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-sm py-2">No improving exercises yet.</p>
                    )}
                  </div>

                  {/* Top 3 Need Work */}
                  <div>
                    <h4 className="text-xs font-display uppercase tracking-wider text-amber-400 mb-1">Need Work</h4>
                    {needWork.length > 0 ? (
                      <div>
                        {needWork.map((exercise, idx) => (
                          <motion.div
                            key={exercise.exerciseId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-white text-sm truncate">{exercise.exerciseName}</p>
                              <p className="text-xs text-zinc-500">{exercise.firstWeight} → {exercise.latestWeight} lb · {exercise.trend === 'stagnant' ? 'Stagnant' : 'Regressed'}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <Sparkline data={exercise.series} stroke={exercise.trend === 'down' ? '#F87171' : '#FBBF24'} />
                              <span className={`font-display text-lg w-14 text-right ${exercise.trend === 'down' ? 'text-red-400' : 'text-amber-400'}`}>{exercise.percentChange > 0 ? '+' : ''}{exercise.percentChange}%</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-sm py-2">All exercises progressing well!</p>
                    )}
                  </div>
                </div>
              )}
            </AnimatedCard>

            {/* Consistency — the heatmap carries a single streak callout */}
            <ActivityHeatmap
              streakWeeks={streakData?.strength.current ?? 0}
              activities={[
                ...workouts.map((w) => ({ date: w.performed_at.split('T')[0], type: 'strength' as const })),
                ...bjj.map((b) => ({ date: b.performed_at.split('T')[0], type: 'bjj' as const })),
                ...cardio.map((c) => ({ date: c.performed_at.split('T')[0], type: 'cardio' as const })),
              ]}
            />
          </>
        )}

        {selectedView === 'achievements' && (
          <Achievements
            totalWorkouts={totalCounts.workouts}
            bjjSessions={totalCounts.bjj}
            cardioSessions={totalCounts.cardio}
            streakWeeks={streakData?.strength.current ?? 0}
          />
        )}

        {selectedView === 'history' && (
          /* Workout History View */
          <>
            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'strength', 'bjj', 'cardio'] as const).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActivityFilter(filter)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${activityFilter === filter
                    ? `${getActivityColor(filter === 'all' ? 'strength' : filter).bg} ${getActivityColor(filter === 'all' ? 'strength' : filter).text} ${getActivityColor(filter === 'all' ? 'strength' : filter).border}`
                    : 'bg-surface border-transparent text-zinc-500 hover:text-white'
                    }`}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'strength' && 'Strength'}
                  {filter === 'bjj' && 'BJJ'}
                  {filter === 'cardio' && 'Cardio'}
                </button>
              ))}

              <div className="ml-auto flex gap-2 flex-wrap">
                {(['week', 'month', 'all', 'custom'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setWorkoutFilter(filter)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${workoutFilter === filter
                      ? 'bg-surface-pressed text-white'
                      : 'text-zinc-500 hover:text-white'
                      }`}
                  >
                    {filter === 'week' && 'Week'}
                    {filter === 'month' && 'Month'}
                    {filter === 'all' && 'All'}
                    {filter === 'custom' && 'Custom'}
                  </button>
                ))}
              </div>
              {workoutFilter === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => {
                      setCustomDateFrom(e.target.value)
                      if (!customDateTo) setCustomDateTo(new Date().toISOString().split('T')[0])
                    }}
                    max={customDateTo || new Date().toISOString().split('T')[0]}
                    className="bg-surface-elevated border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <span className="text-zinc-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customDateTo || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    min={customDateFrom}
                    max={new Date().toISOString().split('T')[0]}
                    className="bg-surface-elevated border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-2">
              {allActivities.length === 0 ? (
                <AnimatedCard>
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-500 mb-6">No activities found for this period</p>
                    <Link href="/workouts/new" className="btn inline-flex">
                      Log a Workout
                    </Link>
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
                      <SwipeableRow
                        onDelete={() =>
                          setDeleteTarget({ type: activity.type, id: activity.id, title: activity.title })
                        }
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
                        className={`w-full p-4 rounded-2xl bg-surface border border-white/[0.07] border-l-2 ${colors.leftBorder} hover:border-white/20 transition-all text-left group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center ${colors.text}`}>
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="font-medium text-white truncate">{activity.title}</p>
                              {activity.fromFitbit && (
                                <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                  <Watch className="w-2.5 h-2.5" />
                                  Fitbit
                                </span>
                              )}
                            </div>
                            <p className={`text-xs ${colors.text}`}>
                              {activity.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {activity.subtitle && ` • ${activity.subtitle}`}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                      </SwipeableRow>
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

        <ConfirmDialog
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteActivity}
          title={`Delete "${deleteTarget?.title ?? ''}"?`}
          message="This entry will be permanently deleted. This cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  )
}
