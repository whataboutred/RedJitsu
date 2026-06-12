import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import type { Profile } from '@/types/domain'
import type { TablesUpdate } from '@/types/database'

/** Full profile row, or null when none exists yet. */
export async function getProfile(userId: string): Promise<Profile | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  })
}

export async function updateProfile(
  userId: string,
  updates: TablesUpdate<'profiles'>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
}
