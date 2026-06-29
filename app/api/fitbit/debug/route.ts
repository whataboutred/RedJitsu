import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { loadConnection, ensureFreshToken } from '@/lib/fitbit/sync'
import { fetchExercisesSince } from '@/lib/fitbit/client'

// TEMPORARY diagnostic: returns the caller's own first few raw Google Health
// exercise dataPoints + their allowlist, so the field mapping (250 sessions
// matched 0) can be corrected against real data. Remove once confirmed.
export async function GET(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const conn = await loadConnection(auth.supabase, auth.userId)
  if (!conn || !conn.access_token_enc) return NextResponse.json({ error: 'Fitbit not connected' }, { status: 400 })

  try {
    const token = await ensureFreshToken(auth.supabase, conn)
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
    const points = await fetchExercisesSince(token, since)
    return NextResponse.json(
      { scanned: points.length, yourAllowlist: conn.allowed_activities, sample: points.slice(0, 3) },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
