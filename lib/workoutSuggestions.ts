import { supabase } from './supabaseClient'
import { querySupabase, QueryRateLimiter } from './queryUtils'

export interface WorkoutSet {
  weight: number
  reps: number
  set_type: 'warmup' | 'working'
  set_index?: number
}

export interface ExerciseSuggestion {
  exerciseId: string
  sets: WorkoutSet[]
  workoutDate: string
}

const rateLimiter = new QueryRateLimiter(3) // Max 3 concurrent queries

/**
 * Optimized function to get last workout sets for multiple exercises
 * Uses a query starting from workouts table to ensure proper ordering
 */
export async function getLastWorkoutSetsForExercises(
  userId: string,
  exerciseIds: string[],
  location?: string
): Promise<Map<string, WorkoutSet[]>> {
  if (exerciseIds.length === 0) {
    return new Map()
  }

  try {
    console.log('[workoutSuggestions] Querying for exercises:', exerciseIds, 'userId:', userId, 'location:', location)

    // Query from workouts table to ensure proper date ordering
    // The key fix: ordering by performed_at works correctly when querying from workouts table
    let data: any[] = []

    try {
      // Query workouts with nested workout_exercises and sets
      let query = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          location,
          workout_exercises!inner(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(50)

      data = await querySupabase<any>(query, { timeout: 8000, maxRetries: 2 })
      console.log('[workoutSuggestions] Query returned:', data.length, 'workouts')
    } catch (queryError: any) {
      console.error('[workoutSuggestions] Query error:', queryError?.message || queryError)
      // Try simpler fallback query without location
      try {
        let fallbackQuery = supabase
          .from('workouts')
          .select(`
            id,
            performed_at,
            workout_exercises!inner(
              exercise_id,
              sets(weight, reps, set_type, set_index)
            )
          `)
          .eq('user_id', userId)
          .order('performed_at', { ascending: false })
          .limit(50)

        data = await querySupabase<any>(fallbackQuery, { timeout: 8000, maxRetries: 2 })
        console.log('[workoutSuggestions] Fallback query returned:', data.length, 'workouts')
      } catch (fallbackError) {
        console.error('[workoutSuggestions] Fallback query also failed:', fallbackError)
        throw fallbackError
      }
    }

    // Group by exercise and find the most recent workout for each
    const exerciseMap = new Map<string, { date: string; sets: WorkoutSet[] }>()

    for (const workout of data) {
      const workoutDate = workout.performed_at
      const workoutLocation = workout.location // May be null
      const workoutExercises = workout.workout_exercises || []

      // Skip if location filter is active and doesn't match
      if (location && workoutLocation && workoutLocation !== location) {
        continue
      }

      for (const wex of workoutExercises) {
        const exerciseId = wex.exercise_id
        const sets = wex.sets || []

        // Only process exercises we're interested in
        if (!exerciseIds.includes(exerciseId)) {
          continue
        }

        // Check if we already have a more recent workout for this exercise
        // (data is ordered by date desc, so first occurrence is most recent)
        if (exerciseMap.has(exerciseId)) {
          continue
        }

        // Store this workout's sets
        if (sets.length > 0) {
          const formattedSets = sets
            .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
            .map((s: any) => ({
              weight: Number(s.weight),
              reps: Number(s.reps),
              set_type: s.set_type as 'warmup' | 'working',
              set_index: s.set_index,
            }))

          exerciseMap.set(exerciseId, {
            date: workoutDate,
            sets: formattedSets,
          })
          console.log('[workoutSuggestions] Found previous data for exercise:', exerciseId, '- sets:', formattedSets.length)
        }
      }
    }

    // Convert to Map<exerciseId, sets[]>
    const result = new Map<string, WorkoutSet[]>()
    exerciseMap.forEach((value, key) => {
      result.set(key, value.sets)
    })

    console.log('[workoutSuggestions] Returning data for', result.size, 'exercises out of', exerciseIds.length, 'requested')
    return result
  } catch (error) {
    console.error('[workoutSuggestions] Error fetching workout suggestions:', error)
    // Return empty map on error instead of throwing
    return new Map()
  }
}

/**
 * Get last workout sets for a single exercise
 * Optimized with rate limiting and caching
 */
export async function getLastWorkoutSets(
  userId: string,
  exerciseId: string,
  location?: string
): Promise<WorkoutSet[] | null> {
  return rateLimiter.execute(async () => {
    const results = await getLastWorkoutSetsForExercises(userId, [exerciseId], location)
    return results.get(exerciseId) || null
  })
}

/**
 * Get last 3 workouts for an exercise to show progression
 */
export async function getLastThreeWorkouts(
  userId: string,
  exerciseId: string,
  location?: string
): Promise<ExerciseSuggestion[]> {
  try {
    // Query from workouts table to ensure proper ordering
    let data: any[] = []

    try {
      let query = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          location,
          workout_exercises!inner(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .eq('workout_exercises.exercise_id', exerciseId)
        .order('performed_at', { ascending: false })
        .limit(10) // Fetch more to account for location filtering

      data = await querySupabase<any>(query, { timeout: 8000, maxRetries: 2 })
    } catch (queryError) {
      // Fallback without location column
      let fallbackQuery = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          workout_exercises!inner(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .eq('workout_exercises.exercise_id', exerciseId)
        .order('performed_at', { ascending: false })
        .limit(10)

      data = await querySupabase<any>(fallbackQuery, { timeout: 8000, maxRetries: 2 })
    }

    const results: ExerciseSuggestion[] = []

    for (const workout of data) {
      // Stop if we have 3 results
      if (results.length >= 3) break

      const workoutDate = workout.performed_at
      const workoutLocation = workout.location
      const workoutExercises = workout.workout_exercises || []

      // Skip if location filter is active and doesn't match
      if (location && workoutLocation && workoutLocation !== location) {
        continue
      }

      // Find the exercise in this workout
      const wex = workoutExercises.find((w: any) => w.exercise_id === exerciseId)
      if (!wex) continue

      const sets = wex.sets || []

      if (sets.length > 0) {
        const formattedSets = sets
          .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
          .map((s: any) => ({
            weight: Number(s.weight),
            reps: Number(s.reps),
            set_type: s.set_type as 'warmup' | 'working',
            set_index: s.set_index,
          }))

        results.push({
          exerciseId: exerciseId,
          sets: formattedSets,
          workoutDate,
        })
      }
    }

    return results
  } catch (error) {
    console.error('Error fetching last three workouts:', error)
    return []
  }
}
