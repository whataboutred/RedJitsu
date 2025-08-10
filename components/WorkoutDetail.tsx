'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { X } from 'lucide-react'

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

  useEffect(() => {
    (async () => {
      const userId = await getActiveUserId()
      if (!userId) return

      // Load workout details
      const { data: w } = await supabase
        .from('workouts')
        .select('performed_at,title')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single()
      setWorkout(w as any)

      // Load sets through the proper table structure
      const { data: s } = await supabase
        .from('sets')
        .select(`
          id,
          weight,
          reps,
          set_type,
          set_index,
          workout_exercises!inner(
            exercise_id,
            workout_id
          )
        `)
        .eq('workout_exercises.workout_id', workoutId)
        .order('set_index', { ascending: true })
      
      // Transform the data to match the expected format
      const transformedSets = (s || []).map((set: any) => ({
        id: set.id,
        exercise_id: set.workout_exercises.exercise_id,
        weight: set.weight,
        reps: set.reps,
        set_type: set.set_type,
        set_index: set.set_index
      }))
      setSets(transformedSets)

      // Load exercises
      const { data: e } = await supabase
        .from('exercises')
        .select('id,name')
      setExercises((e || []) as Exercise[])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="card max-w-lg w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{workout.title || 'Untitled workout'}</div>
            <div className="text-sm text-white/70">{new Date(workout.performed_at).toLocaleString()}</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => (
          <div key={exerciseId} className="bg-black/30 rounded-xl p-3 space-y-2">
            <div className="font-medium text-white/90">{getExerciseName(exerciseId)}</div>
            {exerciseSets.map((set, i) => (
              <div key={set.id} className="text-white/70 text-sm pl-2">
                <span className="text-white/50">Set {set.set_index}:</span>{' '}
                {set.weight && `${set.weight} lb`}
                {set.weight && set.reps && ' × '}
                {set.reps && `${set.reps} reps`}
                {!set.weight && !set.reps && 'No details recorded'}
                {set.set_type === 'warmup' && <span className="text-yellow-400 ml-1">(warmup)</span>}
              </div>
            ))}
          </div>
        ))}

        {!sets.length && (
          <div className="text-white/60">No sets recorded for this workout.</div>
        )}
      </div>
    </div>
  )
}
