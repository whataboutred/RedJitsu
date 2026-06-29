import { NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/fitbit/server'
import { loadConnection, ensureFreshToken } from '@/lib/fitbit/sync'
import { fetchExercisesSince } from '@/lib/fitbit/client'

// TEMPORARY diagnostic: open this URL in a browser where you're logged in to see
// the raw shape of your Google Health exercise data, so the field mapping can be
// fixed. Returns only YOUR own data (cookie-authenticated). Remove after mapping
// is confirmed.
export async function GET() {
  const auth = await getUserFromCookies()
  if (!auth) return NextResponse.json({ error: 'Not authenticated — open this in the browser tab where you are logged in.' }, { status: 401 })

  const conn = await loadConnection(auth.supabase, auth.userId)
  if (!conn || !conn.access_token_enc) return NextResponse.json({ error: 'Fitbit not connected' }, { status: 400 })

  try {
    const token = await ensureFreshToken(auth.supabase, conn)
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
    const points = await fetchExercisesSince(token, since)
    return NextResponse.json(
      {
        scanned: points.length,
        yourAllowlist: conn.allowed_activities,
        sample: points.slice(0, 3),
      },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
