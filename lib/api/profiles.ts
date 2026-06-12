import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import { notifyDataChanged } from '@/lib/dataSync'
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

/** Returns the profile, creating one with default goals when none exists. */
export async function ensureProfile(userId: string): Promise<Profile | null> {
  const existing = await getProfile(userId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        unit: 'lb',
        weekly_goal: 4,
        bjj_weekly_goal: 2,
        cardio_weekly_goal: 3,
        show_strength_goal: true,
        show_bjj_goal: true,
        show_cardio_goal: false,
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function upsertProfile(
  userId: string,
  updates: Omit<TablesUpdate<'profiles'>, 'id'>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates }, { onConflict: 'id' })
  if (error) throw error
  notifyDataChanged()
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
  notifyDataChanged()
}
