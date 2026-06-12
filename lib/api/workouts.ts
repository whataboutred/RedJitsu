import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import { notifyDataChanged } from '@/lib/dataSync'
import type { Workout } from '@/types/domain'

/** Workouts for a user, newest first, optionally bounded by ISO timestamps. */
export async function getWorkouts(
  userId: string,
  options: { fromISO?: string; toISO?: string; limit?: number } = {}
): Promise<Workout[]> {
  return withRetry(async () => {
    let query = supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
    if (options.fromISO) query = query.gte('performed_at', options.fromISO)
    if (options.toISO) query = query.lte('performed_at', options.toISO)
    if (options.limit) query = query.limit(options.limit)
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  })
}

/** Deletes a workout; exercises and sets cascade in the database. */
export async function deleteWorkout(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  notifyDataChanged()
}
