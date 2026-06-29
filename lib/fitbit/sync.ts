import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from './crypto'
import { refreshTokens, fetchExercisesSince } from './client'
import { mapExerciseToCardio } from './map'

export type FitbitConnectionRow = {
  user_id: string
  fitbit_user_id: string | null
  access_token_enc: string | null
  refresh_token_enc: string | null
  expires_at: string | null
  scopes: string | null
  allowed_activities: string[]
  last_sync_at: string | null
}

export async function loadConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<FitbitConnectionRow | null> {
  const { data } = await supabase
    .from('fitbit_connections')
    .select('user_id,fitbit_user_id,access_token_enc,refresh_token_enc,expires_at,scopes,allowed_activities,last_sync_at')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as FitbitConnectionRow) ?? null
}

// Returns a valid access token, refreshing + persisting if the current one is
// expired (or expires within 60s).
export async function ensureFreshToken(
  supabase: SupabaseClient,
  conn: FitbitConnectionRow
): Promise<string> {
  if (!conn.access_token_enc || !conn.refresh_token_enc) {
    throw new Error('No Fitbit tokens stored')
  }
  const exped = conn.expires_at ? new Date(conn.expires_at).getTime() : 0
  if (exped - Date.now() > 60_000) {
    return decryptToken(conn.access_token_enc)
  }
  // Refresh. Google omits refresh_token on refresh, so keep the stored one.
  const fresh = await refreshTokens(decryptToken(conn.refresh_token_enc))
  await supabase
    .from('fitbit_connections')
    .update({
      access_token_enc: encryptToken(fresh.accessToken),
      refresh_token_enc: fresh.refreshToken ? encryptToken(fresh.refreshToken) : conn.refresh_token_enc,
      expires_at: fresh.expiresAt,
      scopes: fresh.scope || conn.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', conn.user_id)
  return fresh.accessToken
}

// Look-back start time as ISO 8601 without a zone suffix (Google's
// civil_start_time format). With lookbackDays, ignore last_sync (a backfill);
// otherwise sync incrementally from the last sync (default 30-day first run).
function afterDateFor(conn: FitbitConnectionRow, lookbackDays?: number): string {
  let base: Date
  if (lookbackDays) {
    base = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  } else {
    base = conn.last_sync_at
      ? new Date(conn.last_sync_at)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
  return base.toISOString().slice(0, 19) // YYYY-MM-DDTHH:MM:SS
}

export type SyncResult = { imported: number; scanned: number; matched: number }

// Pull Fitbit/Google-Health exercise sessions and import the allowlisted ones.
// Idempotent: re-imports are skipped via the (user_id, external_id) unique index,
// and existing rows are never overwritten (preserves any manual edits).
// scanned = raw sessions Google returned; matched = passed the activity allowlist.
export async function runSync(
  supabase: SupabaseClient,
  userId: string,
  lookbackDays?: number
): Promise<SyncResult> {
  const conn = await loadConnection(supabase, userId)
  if (!conn) throw new Error('Fitbit not connected')

  try {
    const accessToken = await ensureFreshToken(supabase, conn)
    const points = await fetchExercisesSince(accessToken, afterDateFor(conn, lookbackDays))

    const rows = points
      .map((p) => mapExerciseToCardio(p, conn.allowed_activities))
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ ...r, user_id: userId }))

    let imported = 0
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('cardio_sessions')
        .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
        .select('id')
      if (error) throw error
      imported = data?.length ?? 0
    }

    await supabase
      .from('fitbit_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    return { imported, scanned: points.length, matched: rows.length }
  } catch (err: any) {
    await supabase
      .from('fitbit_connections')
      .update({ last_error: String(err?.message ?? err).slice(0, 500), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    throw err
  }
}
