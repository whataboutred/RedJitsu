import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/lib/queryUtils'
import { notifyDataChanged } from '@/lib/dataSync'
import type { CardioSession } from '@/types/domain'
import type { TablesInsert, TablesUpdate } from '@/types/database'

export async function getCardioSession(
  id: string,
  userId: string
): Promise<CardioSession | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('cardio_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data
  })
}

/** Sessions for a user, newest first, optionally bounded by ISO timestamps. */
export async function getCardioSessions(
  userId: string,
  options: { fromISO?: string; toISO?: string; limit?: number } = {}
): Promise<CardioSession[]> {
  return withRetry(async () => {
    let query = supabase
      .from('cardio_sessions')
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

export async function insertCardioSession(
  row: TablesInsert<'cardio_sessions'>
): Promise<void> {
  const { error } = await supabase.from('cardio_sessions').insert(row)
  if (error) throw error
  notifyDataChanged()
}

export async function updateCardioSession(
  id: string,
  userId: string,
  updates: TablesUpdate<'cardio_sessions'>
): Promise<void> {
  const { error } = await supabase
    .from('cardio_sessions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  notifyDataChanged()
}

export async function deleteCardioSession(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('cardio_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  notifyDataChanged()
}
