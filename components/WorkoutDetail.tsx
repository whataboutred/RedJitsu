'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { X, Edit3, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

type WorkoutSet = {
  id: string
  exercise_id: string
  weight: number | null
  reps: number | null
  set_type: string
  set_index: number
  completed: boolean
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
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      console.log('[WorkoutDetail] Loading workout:', workoutId, 'userId:', userId)
      if (!userId) {
        console.log('[WorkoutDetail] No userId, aborting')
        return
      }

      // Query workout WITH nested workout_exercises in single query
      // This leverages the explicit user_id filter to bypass RLS issues
      const { data: workoutResults, error: workoutError } = await supabase
        .from('workouts')
        .select(`
          id, performed_at, title,
          workout_exercises(id, exercise_id, display_name, order_index)
        `)
        .eq('id', workoutId)
        .eq('user_id', userId)
        .limit(1)

      console.log('[WorkoutDetail] Workout+exercises result:', workoutResults, 'error:', workoutError)

      const workoutData = workoutResults?.[0]
      if (!workoutData) {
        console.log('[WorkoutDetail] Workout not found. userId:', userId, 'workoutId:', workoutId)
        setLoading(false)
        return
      }

      setWorkout({ performed_at: workoutData.performed_at, title: workoutData.title })

      // Extract workout_exercises from nested query result
      const workoutExercises = (workoutData as any).workout_exercises || []
      console.log('[WorkoutDetail] workout_exercises from nested:', workoutExercises.length)

      if (workoutExercises && workoutExercises.length > 0) {
        // Build exercise name map from display_name
        const exerciseNameMap: Exercise[] = workoutExercises.map((wex: any) => ({
          id: wex.exercise_id,
          name: wex.display_name
        }))
        setExercises(exerciseNameMap)

        // Get sets separately using workout_exercise IDs
        const wexIds = workoutExercises.map((we: any) => we.id)
        const { data: setsData, error: setsError } = await supabase
          .from('sets')
          .select('id, workout_exercise_id, weight, reps, set_type, set_index, completed')
          .in('workout_exercise_id', wexIds)
          .order('set_index')

        console.log('[WorkoutDetail] sets result:', setsData?.length, 'error:', setsError)

        // Map workout_exercise_id to exercise_id
        const wexToExercise = new Map(workoutExercises.map((we: any) => [we.id, we.exercise_id]))

        // Transform to flat sets array
        const allSets: WorkoutSet[] = (setsData || []).map((set: any) => ({
          id: set.id,
          exercise_id: wexToExercise.get(set.workout_exercise_id) as string,
          weight: set.weight,
          reps: set.reps,
          set_type: set.set_type,
          set_index: set.set_index,
          completed: set.completed ?? false
        }))

        console.log('[WorkoutDetail] Total sets found:', allSets.length)
        setSets(allSets)
      } else {
        console.log('[WorkoutDetail] No workout_exercises found')
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
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', userId)

      if (error) {
        alert('Failed to delete workout')
        console.error('Delete error:', error)
        return
      }

      // Close modal and refresh the page
      onClose()
      window.location.reload()
    } catch (error) {
      alert('Failed to delete workout')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    // Navigate to edit page with the workout ID
    router.push(`/workouts/edit/${workoutId}`)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center justify-between">
          <div>Loading workout details...</div>
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
              onClick={handleEdit}
              className="p-1 hover:bg-white/5 rounded-lg text-blue-400 hover:text-blue-300" 
              title="Edit workout"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleDelete}
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
            const completedSets = workingSets.filter(s => s.completed).length
            const totalSets = workingSets.length
            return (
            <div key={exerciseId} className="bg-black/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white/90">{getExerciseName(exerciseId)}</div>
                <div className="text-xs text-white/50">{completedSets}/{totalSets} sets</div>
              </div>
              {exerciseSets.map((set, i) => (
                <div key={set.id} className={`text-sm pl-2 ${set.completed ? 'text-white/70' : 'text-white/40'}`}>
                  <span className="text-white/50">Set {set.set_index}:</span>{' '}
                  {set.completed ? (
                    <>
                      {set.weight && `${set.weight} lb`}
                      {set.weight && set.reps && ' × '}
                      {set.reps && `${set.reps} reps`}
                      {!set.weight && !set.reps && 'No details recorded'}
                    </>
                  ) : (
                    <span className="italic">Not completed</span>
                  )}
                  {set.set_type === 'warmup' && <span className="text-yellow-400 ml-1">(warmup)</span>}
                </div>
              ))}
            </div>
          )})}


          {!sets.length && (
            <div className="text-white/60 space-y-2">
              <div>No sets recorded for this workout.</div>
              <div className="text-xs text-white/40">
                This workout may have been saved before the data tracking was fully set up,
                or the exercise data wasn't saved properly.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
