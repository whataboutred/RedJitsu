'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { deleteWorkout } from '@/lib/api'
import { getActiveUserId } from '@/lib/activeUser'
import { X, Edit3, Trash2, Copy, Trophy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { estimated1RM } from '@/lib/formulas'

type WorkoutSet = {
  id: string
  exercise_id: string
  weight: number | null
  reps: number | null
  set_type: string
  set_index: number
}

type Exercise = {
  id: string
  name: string
}

export default function WorkoutDetail({ workoutId, onClose }: { workoutId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workout, setWorkout] = useState<{ performed_at: string; title: string | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      if (!userId) {
        return
      }

      // Step 1: Query workout basic info
      const { data: workoutResults, error: workoutError } = await supabase
        .from('workouts')
        .select('id, performed_at, title')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .limit(1)

      const workoutData = workoutResults?.[0]
      if (!workoutData) {
        setLoading(false)
        return
      }

      setWorkout({ performed_at: workoutData.performed_at, title: workoutData.title })

      // Step 2: Query workout_exercises (without nested sets to avoid 400 error)
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id, display_name, order_index')
        .eq('workout_id', workoutId)

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
          .select('id, workout_exercise_id, weight, reps, set_type, set_index')
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
          set_index: set.set_index
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

  async function handleDelete() {
    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      await deleteWorkout(workoutId, userId)

      // lib/api notifies the open pages, which refetch — no reload needed
      onClose()
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

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3 py-1">
            <Skeleton variant="text" className="w-1/2" />
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="rounded" className="h-24 w-full" />
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!workout) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center justify-between">
          <div>Workout not found or access denied.</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="card max-w-lg w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-medium">{workout.title || 'Untitled workout'}</div>
            <div className="text-sm text-white/70">{new Date(workout.performed_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRepeat}
              className="p-1 hover:bg-white/5 rounded-lg text-emerald-400 hover:text-emerald-300"
              title="Repeat this workout"
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              onClick={handleEdit}
              className="p-1 hover:bg-white/5 rounded-lg text-blue-400 hover:text-blue-300"
              title="Edit workout"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="p-1 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50" 
              title="Delete workout"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => {
            const workingSets = exerciseSets.filter(s => s.set_type !== 'warmup')
            const setsWithData = workingSets.filter(s => s.weight !== null || s.reps !== null).length
            const totalSets = workingSets.length
            // Calculate best estimated 1RM for this exercise
            const best1RM = Math.max(
              ...workingSets
                .filter(s => s.weight && s.reps)
                .map(s => estimated1RM(s.weight!, s.reps!)),
              0
            )
            return (
            <div key={exerciseId} className="bg-black/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white/90">{getExerciseName(exerciseId)}</div>
                <div className="flex items-center gap-2">
                  {best1RM > 0 && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      1RM: {best1RM}
                    </span>
                  )}
                  <span className="text-xs text-white/50">{setsWithData}/{totalSets} sets</span>
                </div>
              </div>
              {exerciseSets.map((set, i) => {
                const hasData = set.weight !== null || set.reps !== null
                return (
                <div key={set.id} className={`text-sm pl-2 ${hasData ? 'text-white/70' : 'text-white/40'}`}>
                  <span className="text-white/50">Set {set.set_index}:</span>{' '}
                  {set.weight !== null && `${set.weight} lb`}
                  {set.weight !== null && set.reps !== null && ' × '}
                  {set.reps !== null && `${set.reps} reps`}
                  {!hasData && <span className="italic">No data recorded</span>}
                  {set.set_type === 'warmup' && <span className="text-yellow-400 ml-1">(warmup)</span>}
                </div>
              )})}
            </div>
          )})}


          {!sets.length && (
            <div className="text-white/60 space-y-2">
              <div>No sets recorded for this workout.</div>
              <div className="text-xs text-white/40">
                This workout may have been saved before the data tracking was fully set up,
                or the exercise data wasn&apos;t saved properly.
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete workout?"
        message="This workout and all its sets will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
