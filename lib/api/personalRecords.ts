import { supabase } from '@/lib/supabaseClient'
import { estimated1RM, detectPR } from '@/lib/formulas'

export type NewPR = {
  exerciseId: string
  exerciseName: string
  weight: number
  reps: number
  estimated1rm: number
  /** True when this is the first time the exercise has ever been logged. */
  isFirst: boolean
}

type SavedExercise = {
  exerciseId: string
  name: string
  sets: { weight: number; reps: number; isWarmup: boolean; isCompleted: boolean }[]
}

/**
 * Compares the best working set of each exercise in a just-saved workout
 * against all prior history, records any new personal records in the
 * personal_records table, and returns them for celebration UI.
 *
 * `workoutId` is the workout that was just saved — it's excluded from the
 * historical baseline so a workout can't PR against itself.
 */
export async function detectAndSaveNewPRs(
  userId: string,
  workoutId: string,
  exercises: SavedExercise[]
): Promise<NewPR[]> {
  // Best completed working set per exercise (by estimated 1RM)
  const bests = exercises
    .map((ex) => {
      const working = ex.sets.filter(
        (s) => !s.isWarmup && s.isCompleted && s.weight > 0 && s.reps > 0
      )
      if (working.length === 0) return null
      const best = working.reduce((a, b) =>
        estimated1RM(b.weight, b.reps) > estimated1RM(a.weight, a.reps) ? b : a
      )
      return { exerciseId: ex.exerciseId, name: ex.name, weight: best.weight, reps: best.reps }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)

  if (bests.length === 0) return []

  // Historical max weight / estimated 1RM per exercise, excluding this workout.
  // Scope to THIS user via an inner join on workouts — otherwise the demo
  // account's public-readable workout_exercises (same global exercise_id) leak
  // in and pollute the real user's PR baseline.
  const { data: history, error } = await supabase
    .from('workout_exercises')
    .select('exercise_id, sets(weight, reps, set_type), workouts!inner(user_id)')
    .eq('workouts.user_id', userId)
    .in('exercise_id', bests.map((b) => b.exerciseId))
    .neq('workout_id', workoutId)
  if (error) throw error

  const historicalMax = new Map<string, { weight: number; reps: number; estimated1rm: number }>()
  for (const row of history ?? []) {
    for (const s of row.sets ?? []) {
      if (s.set_type === 'warmup' || s.weight <= 0 || s.reps <= 0) continue
      const e1rm = estimated1RM(s.weight, s.reps)
      const prev = historicalMax.get(row.exercise_id)
      historicalMax.set(row.exercise_id, {
        weight: Math.max(prev?.weight ?? 0, s.weight),
        reps: s.reps,
        estimated1rm: Math.max(prev?.estimated1rm ?? 0, e1rm),
      })
    }
  }

  const newPRs: NewPR[] = []
  for (const best of bests) {
    const prior = historicalMax.get(best.exerciseId) ?? null
    if (detectPR(best.weight, best.reps, prior)) {
      newPRs.push({
        exerciseId: best.exerciseId,
        exerciseName: best.name,
        weight: best.weight,
        reps: best.reps,
        estimated1rm: estimated1RM(best.weight, best.reps),
        isFirst: prior === null,
      })
    }
  }

  if (newPRs.length > 0) {
    const { error: insertError } = await supabase.from('personal_records').insert(
      newPRs.map((pr) => ({
        user_id: userId,
        exercise_id: pr.exerciseId,
        weight: pr.weight,
        reps: pr.reps,
        estimated_1rm: pr.estimated1rm,
        achieved_at: new Date().toISOString(),
      }))
    )
    // Recording the PR shouldn't block the celebration
    if (insertError) console.error('Failed to record PRs:', insertError)
  }

  return newPRs
}
