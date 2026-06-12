import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import type { Exercise } from '@/types/domain'

/** Global exercises plus the user's own, alphabetical. */
export async function listExercises(): Promise<Exercise[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('name')
    if (error) throw error
    return data ?? []
  })
}

export async function createExercise(
  name: string,
  owner: string,
  category: Exercise['category'] = 'other'
): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name, owner, category, is_global: false })
    .select('*')
    .single()
  if (error) throw error
  return data
}
