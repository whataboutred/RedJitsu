'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { deleteWorkout } from '@/lib/api'
import { getActiveUserId } from '@/lib/activeUser'
import { Edit3, Trash2, Copy, Trophy, Watch } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { BottomSheet, ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { estimated1RM } from '@/lib/formulas'

type WorkoutSet = {
  id: string
  exercise_id: string
  weight: number | null
  reps: number | null
  set_type: string
  set_index: number
  completed: boolean | null
}

type Exercise = {
  id: string
  name: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export default function WorkoutDetail({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workout, setWorkout] = useState<{ performed_at: string; title: string | null } | null>(null)
  const [metrics, setMetrics] = useState<{ avg_hr: number | null; calories: number | null; active_minutes: number | null } | null>(null)
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [open, setOpen] = useState(true)
  const router = useRouter()
  const toast = useToast()

  // Play the sheet's slide-down exit before unmounting.
  const close = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 250)
  }, [onClose])

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      if (!userId) {
        return
      }

      // Weight labels follow the profile's unit
      supabase.from('profiles').select('unit').eq('id', userId).maybeSingle().then(({ data }) => {
        if (data?.unit === 'kg' || data?.unit === 'lb') setUnit(data.unit)
      })

      // Step 1: Query workout basic info (+ any watch metadata from Fitbit)
      const { data: workoutResults, error: workoutError } = await supabase
        .from('workouts')
        .select('id, performed_at, title, workout_metrics(avg_hr, calories, active_minutes)')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .limit(1)

      const workoutData = workoutResults?.[0]
      if (!workoutData) {
        setLoading(false)
        return
      }

      setWorkout({ performed_at: workoutData.performed_at, title: workoutData.title })
      setMetrics(workoutData.workout_metrics?.[0] ?? null)

      // Step 2: Query workout_exercises (without nested sets to avoid 400 error)
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id, display_name, order_index')
        .eq('workout_id', workoutId)
        .order('order_index', { nullsFirst: true })

      if (exerciseData && exerciseData.length > 0) {
        // Build exercise name map
        const exerciseNameMap: Exercise[] = exerciseData.map((wex: any) => ({
          id: wex.exercise_id,
          name: wex.display_name
        }))
        setExercises(exerciseNameMap)

        // Step 3: Query sets separately using workout_exercise IDs
        const wexIds = exerciseData.map((wex: any) => wex.id)
        const { data: setsData, error: setsError } = await supabase
          .from('sets')
          .select('id, workout_exercise_id, weight, reps, set_type, set_index, completed')
          .in('workout_exercise_id', wexIds)
          .order('set_index')

        // Build workout_exercise_id to exercise_id map
        const wexToExercise = new Map(exerciseData.map((wex: any) => [wex.id, wex.exercise_id]))

        // Transform to flat sets array
        const allSets: WorkoutSet[] = (setsData || []).map((set: any) => ({
          id: set.id,
          exercise_id: wexToExercise.get(set.workout_exercise_id) as string,
          weight: set.weight,
          reps: set.reps,
          set_type: set.set_type,
          set_index: set.set_index,
          completed: set.completed
        }))

        setSets(allSets)
      } else {
        setSets([])
      }

      setLoading(false)
    })()
  }, [workoutId])

  function getExerciseName(exerciseId: string) {
    return exercises.find(e => e.id === exerciseId)?.name || 'Unknown exercise'
  }

  // Group sets by exercise
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exercise_id]) {
      acc[set.exercise_id] = []
    }
    acc[set.exercise_id].push(set)
    return acc
  }, {} as Record<string, WorkoutSet[]>)

  // Stats count only completed working sets — planned/skipped sets aren't work done
  const workingSetsAll = sets.filter(s => s.set_type !== 'warmup' && s.completed !== false)
  const totalVolume = Math.round(
    workingSetsAll.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
  )

  async function handleDelete() {
    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      await deleteWorkout(workoutId, userId)

      // lib/api notifies the open pages, which refetch — no reload needed
      close()
    } catch (error) {
      toast.error('Failed to delete workout')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    router.push(`/workouts/edit/${workoutId}`)
  }

  function handleRepeat() {
    // Store workout data in sessionStorage for the new workout page to pick up
    const repeatData = Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => ({
      exerciseId,
      exerciseName: getExerciseName(exerciseId),
      sets: exerciseSets
        .filter(s => s.set_type !== 'warmup')
        .map(s => ({ weight: s.weight || 0, reps: s.reps || 0 })),
    }))
    sessionStorage.setItem('repeat-workout', JSON.stringify({
      title: workout?.title || '',
      exercises: repeatData,
    }))
    router.push('/workouts/new?repeat=true')
    onClose()
  }

  const header = workout ? (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-brand-red font-semibold mb-1">Strength</p>
          <h2 className="text-2xl font-display uppercase text-white leading-none truncate">
            {workout.title || 'Untitled workout'}
          </h2>
          <p className="text-sm text-zinc-500 mt-1.5">{formatWhen(workout.performed_at)}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
          <button
            onClick={handleRepeat}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Repeat this workout"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button
            onClick={handleEdit}
            className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Edit workout"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="p-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Delete workout"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      {metrics && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] border border-white/[0.12] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
          <Watch className="w-3 h-3" />
          {[
            metrics.avg_hr && `avg HR ${metrics.avg_hr}`,
            metrics.calories && `${metrics.calories} cal`,
            metrics.active_minutes && `${metrics.active_minutes} min active`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </div>
  ) : undefined

  return (
    <>
      <BottomSheet isOpen={open} onClose={close} snapPoints={[0.92]} header={header}>
        {loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="rounded" className="h-20 w-full" />
            <Skeleton variant="rounded" className="h-24 w-full" />
            <Skeleton variant="rounded" className="h-24 w-full" />
          </div>
        ) : !workout ? (
          <p className="text-zinc-400 pt-2">Workout not found or access denied.</p>
        ) : (
          <div className="space-y-3">
            {/* Session totals */}
            {sets.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-white leading-none">{Object.keys(groupedSets).length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">Exercises</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-white leading-none">{workingSetsAll.length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">Sets</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-brand-red leading-none">{totalVolume.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">Volume ({unit})</div>
                </div>
              </div>
            )}

            {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => {
              const workingSets = exerciseSets.filter(s => s.set_type !== 'warmup')
              const setsWithData = workingSets.filter(s => s.completed !== false && (s.weight !== null || s.reps !== null)).length
              const totalSets = workingSets.length
              // Best estimated 1RM among completed sets only
              const best1RM = Math.max(
                ...workingSets
                  .filter(s => s.completed !== false && s.weight && s.reps)
                  .map(s => estimated1RM(s.weight!, s.reps!)),
                0
              )
              return (
                <div key={exerciseId} className="bg-surface-elevated rounded-xl border border-white/[0.05] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-white truncate">{getExerciseName(exerciseId)}</div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {best1RM > 0 && (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          1RM: {best1RM}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">{setsWithData}/{totalSets}</span>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    {exerciseSets.map((set) => {
                      const hasData = set.weight !== null || set.reps !== null
                      const skipped = set.completed === false
                      return (
                        <div
                          key={set.id}
                          className={`flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0 text-sm tabular-nums ${skipped ? 'opacity-50' : ''}`}
                        >
                          <span className="w-4 text-xs text-zinc-600">{set.set_index}</span>
                          {hasData ? (
                            <>
                              {/* Weight 0 with reps = bodyweight, not "0 lb" */}
                              {set.weight !== null && (
                                <span className="text-white font-medium">
                                  {set.weight === 0 && (set.reps ?? 0) > 0 ? 'BW' : `${set.weight} ${unit}`}
                                </span>
                              )}
                              {set.weight !== null && set.reps !== null && <span className="text-zinc-600">×</span>}
                              {set.reps !== null && <span className="text-zinc-300">{set.reps} reps</span>}
                            </>
                          ) : (
                            <span className="text-zinc-600 italic">No data recorded</span>
                          )}
                          {set.set_type === 'warmup' ? (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-400/80">warmup</span>
                          ) : skipped ? (
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-600">skipped</span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {!sets.length && (
              <div className="text-center py-8">
                <p className="text-zinc-400">No sets recorded for this workout.</p>
                <p className="text-xs text-zinc-600 mt-2">
                  This workout may have been saved before set tracking was set up.
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete workout?"
        message="This workout and all its sets will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}
