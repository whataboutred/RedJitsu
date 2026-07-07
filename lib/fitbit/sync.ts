import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from './crypto'
import { refreshTokens, fetchExercisesSince } from './client'
import { mapExerciseToCardio, mapExerciseToMetrics, type MappedWorkoutMetrics } from './map'
import { WALK_MIN_MODERATE_MINUTES, METRICS_MATCH_TOLERANCE_MS } from './constants'

export type FitbitConnectionRow = {
  user_id: string
  fitbit_user_id: string | null
  access_token_enc: string | null
  refresh_token_enc: string | null
  expires_at: string | null
  scopes: string | null
  excluded_activities: string[]
  last_sync_at: string | null
  connected_at: string | null
  needs_reconnect: boolean
}

export async function loadConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<FitbitConnectionRow | null> {
  const { data } = await supabase
    .from('fitbit_connections')
    .select('user_id,fitbit_user_id,access_token_enc,refresh_token_enc,expires_at,scopes,excluded_activities,last_sync_at,connected_at,needs_reconnect')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as FitbitConnectionRow) ?? null
}

// A refresh/auth failure (vs. a transient network error) means the token is
// dead and the user must re-authorize.
export function isAuthFailure(message: string): boolean {
  return /invalid_grant|invalid_token|unauthorized|\b401\b|refresh/i.test(message)
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

// The incremental sync filters by each session's START time. Fitbit->Google
// sync is often delayed, so a session can land in Google *after* a cron already
// advanced past its start time — and would then never be re-scanned. Re-scan a
// few days of overlap each run so late arrivals are caught automatically
// (dedupe by external_id makes the overlap free).
const INCREMENTAL_BUFFER_DAYS = 4

// Look-back start time as ISO 8601 without a zone suffix (Google's
// civil_start_time format). With lookbackDays, ignore last_sync (a backfill);
// otherwise sync incrementally from (last sync − buffer); 30-day first run.
function afterDateFor(conn: FitbitConnectionRow, lookbackDays?: number): string {
  let base: Date
  if (lookbackDays) {
    base = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  } else if (conn.last_sync_at) {
    base = new Date(new Date(conn.last_sync_at).getTime() - INCREMENTAL_BUFFER_DAYS * 24 * 60 * 60 * 1000)
  } else {
    base = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  }
  return base.toISOString().slice(0, 19) // YYYY-MM-DDTHH:MM:SS
}

export type SyncResult = { imported: number; scanned: number; matched: number; linked: number }

// Correlate Fitbit strength sessions with logged workouts by time: a workout's
// performed_at must fall inside the session interval (± tolerance). Each
// workout links to at most one session and vice versa; closest start wins.
// Idempotent via the (user_id, external_id) unique index.
async function linkStrengthSessions(
  supabase: SupabaseClient,
  userId: string,
  sessions: MappedWorkoutMetrics[]
): Promise<number> {
  if (sessions.length === 0) return 0

  const minStart = Math.min(...sessions.map((s) => s.start_ms)) - METRICS_MATCH_TOLERANCE_MS
  const maxEnd = Math.max(...sessions.map((s) => s.end_ms)) + METRICS_MATCH_TOLERANCE_MS

  const [workoutsRes, existingRes] = await Promise.all([
    supabase
      .from('workouts')
      .select('id,performed_at')
      .eq('user_id', userId)
      .gte('performed_at', new Date(minStart).toISOString())
      .lte('performed_at', new Date(maxEnd).toISOString()),
    supabase
      .from('workout_metrics')
      .select('workout_id,external_id')
      .eq('user_id', userId),
  ])

  const workouts = workoutsRes.data ?? []
  const linkedWorkouts = new Set((existingRes.data ?? []).map((m) => m.workout_id))
  const importedIds = new Set((existingRes.data ?? []).map((m) => m.external_id))

  const rows: Array<Record<string, unknown>> = []
  // Deterministic claim order that favors tight matches: the session with the
  // smallest gap to any workout claims first, so two nearby sessions can't
  // have API return-order hand a workout to the wrong one.
  const gapTo = (s: MappedWorkoutMetrics) =>
    workouts.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...workouts.map((w) => Math.abs(new Date(w.performed_at).getTime() - s.start_ms)))
  const ordered = [...sessions].sort((a, b) => gapTo(a) - gapTo(b))
  for (const s of ordered) {
    if (importedIds.has(s.external_id)) continue
    const candidates = workouts.filter((w) => {
      if (linkedWorkouts.has(w.id)) return false
      const t = new Date(w.performed_at).getTime()
      return t >= s.start_ms - METRICS_MATCH_TOLERANCE_MS && t <= s.end_ms + METRICS_MATCH_TOLERANCE_MS
    })
    if (candidates.length === 0) continue
    const best = candidates.reduce((a, b) =>
      Math.abs(new Date(a.performed_at).getTime() - s.start_ms) <=
      Math.abs(new Date(b.performed_at).getTime() - s.start_ms) ? a : b
    )
    linkedWorkouts.add(best.id)
    rows.push({
      user_id: userId,
      workout_id: best.id,
      source: 'fitbit',
      external_id: s.external_id,
      avg_hr: s.avg_hr,
      calories: s.calories,
      active_minutes: s.active_minutes,
    })
  }

  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('workout_metrics')
    .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// Pull Fitbit/Google-Health exercise sessions. Cardio imports everything not
// excluded (strength and low-effort walks are filtered in the mapper); strength
// sessions attach their watch metadata to time-matched logged workouts.
// Idempotent: re-imports are skipped via (user_id, external_id) unique indexes,
// and existing rows are never overwritten (preserves any manual edits).
// scanned = raw sessions Google returned; matched = imported as cardio;
// linked = strength sessions attached to workouts.
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
      .map((p) => mapExerciseToCardio(p, conn.excluded_activities ?? [], WALK_MIN_MODERATE_MINUTES))
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

    const strengthSessions = points
      .map(mapExerciseToMetrics)
      .filter((m): m is MappedWorkoutMetrics => m !== null)
    const linked = await linkStrengthSessions(supabase, userId, strengthSessions)

    await supabase
      .from('fitbit_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null, needs_reconnect: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    return { imported, scanned: points.length, matched: rows.length, linked }
  } catch (err: any) {
    const message = String(err?.message ?? err)
    await supabase
      .from('fitbit_connections')
      .update({
        last_error: message.slice(0, 500),
        // Auth failures mean the refresh token expired/was revoked -> reconnect.
        ...(isAuthFailure(message) ? { needs_reconnect: true } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    throw err
  }
}
