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
 *
 * Location-based loading with fallback:
 * 1. First tries to find workout data from the specified location
 * 2. For exercises without location-specific data, falls back to any location
 * This helps with gym-specific settings (different machine weights, etc.)
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
    // First pass: prioritize location-specific data
    const exerciseMapWithLocation = new Map<string, { date: string; sets: WorkoutSet[]; fromLocation: string | null }>()
    // Second pass: fallback data from any location
    const exerciseMapAnyLocation = new Map<string, { date: string; sets: WorkoutSet[]; fromLocation: string | null }>()

    for (const workout of data) {
      const workoutDate = workout.performed_at
      const workoutLocation = workout.location // May be null
      const workoutExercises = workout.workout_exercises || []

      for (const wex of workoutExercises) {
        const exerciseId = wex.exercise_id
        const sets = wex.sets || []

        // Only process exercises we're interested in
        if (!exerciseIds.includes(exerciseId)) {
          continue
        }

        // Skip if no sets
        if (sets.length === 0) {
          continue
        }

        const formattedSets = sets
          .sort((a: any, b: any) => (a.set_index || 0) - (b.set_index || 0))
          .map((s: any) => ({
            weight: Number(s.weight),
            reps: Number(s.reps),
            set_type: s.set_type as 'warmup' | 'working',
            set_index: s.set_index,
          }))

        // Check if this matches the requested location
        const matchesLocation = location && workoutLocation === location

        if (matchesLocation && !exerciseMapWithLocation.has(exerciseId)) {
          // First location-matching workout for this exercise
          exerciseMapWithLocation.set(exerciseId, {
            date: workoutDate,
            sets: formattedSets,
            fromLocation: workoutLocation,
          })
          console.log('[workoutSuggestions] Found location-specific data for exercise:', exerciseId, 'from:', workoutLocation)
        }

        // Always track the first workout for each exercise (any location)
        // (data is ordered by date desc, so first occurrence is most recent)
        if (!exerciseMapAnyLocation.has(exerciseId)) {
          exerciseMapAnyLocation.set(exerciseId, {
            date: workoutDate,
            sets: formattedSets,
            fromLocation: workoutLocation,
          })
        }
      }
    }

    // Build final result: prefer location-specific data, fall back to any location
    const result = new Map<string, WorkoutSet[]>()

    for (const exerciseId of exerciseIds) {
      // First try location-specific data
      if (exerciseMapWithLocation.has(exerciseId)) {
        const data = exerciseMapWithLocation.get(exerciseId)!
        result.set(exerciseId, data.sets)
        console.log('[workoutSuggestions] Using location-specific data for:', exerciseId)
      }
      // Fall back to any location
      else if (exerciseMapAnyLocation.has(exerciseId)) {
        const data = exerciseMapAnyLocation.get(exerciseId)!
        result.set(exerciseId, data.sets)
        console.log('[workoutSuggestions] Falling back to any-location data for:', exerciseId, 'from:', data.fromLocation || 'no location')
      }
    }

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
      // First get workout_exercises for this exercise
      const { data: wexData } = await supabase
        .from('workout_exercises')
        .select('id, workout_id')
        .eq('exercise_id', exerciseId)

      if (!wexData || wexData.length === 0) {
        return []
      }

      const workoutIds = [...new Set(wexData.map(we => we.workout_id))]

      // Then get the workouts with all their data
      let query = supabase
        .from('workouts')
        .select(`
          id,
          performed_at,
          location,
          workout_exercises(
            exercise_id,
            sets(weight, reps, set_type, set_index)
          )
        `)
        .eq('user_id', userId)
        .in('id', workoutIds)
        .order('performed_at', { ascending: false })
        .limit(10)

      data = await querySupabase<any>(query, { timeout: 8000, maxRetries: 2 })
    } catch (queryError) {
      // Fallback: try simpler query
      try {
        const { data: wexData } = await supabase
          .from('workout_exercises')
          .select('id, workout_id')
          .eq('exercise_id', exerciseId)

        if (!wexData || wexData.length === 0) {
          return []
        }

        const workoutIds = [...new Set(wexData.map(we => we.workout_id))]

        let fallbackQuery = supabase
          .from('workouts')
          .select(`
            id,
            performed_at,
            workout_exercises(
              exercise_id,
              sets(weight, reps, set_type, set_index)
            )
          `)
          .eq('user_id', userId)
          .in('id', workoutIds)
          .order('performed_at', { ascending: false })
          .limit(10)

        data = await querySupabase<any>(fallbackQuery, { timeout: 8000, maxRetries: 2 })
      } catch (fallbackError) {
        console.error('[getLastThreeWorkouts] Fallback query also failed:', fallbackError)
        return []
      }
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
