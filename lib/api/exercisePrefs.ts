import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'

export type RepRangePref = { min: number; max: number }

/** Per-exercise rep-range overrides for the overload coach. */
export async function getExercisePrefs(
  userId: string,
  exerciseIds: string[]
): Promise<Map<string, RepRangePref>> {
  if (exerciseIds.length === 0) return new Map()
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('exercise_prefs')
      .select('exercise_id,rep_range_min,rep_range_max')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)
    if (error) throw error
    return new Map(
      (data ?? []).map((r) => [r.exercise_id, { min: r.rep_range_min, max: r.rep_range_max }])
    )
  })
}

export async function upsertExercisePref(
  userId: string,
  exerciseId: string,
  pref: RepRangePref
): Promise<void> {
  const { error } = await supabase.from('exercise_prefs').upsert(
    {
      user_id: userId,
      exercise_id: exerciseId,
      rep_range_min: pref.min,
      rep_range_max: pref.max,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,exercise_id' }
  )
  if (error) throw error
}

export async function deleteExercisePref(userId: string, exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_prefs')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
  if (error) throw error
}
