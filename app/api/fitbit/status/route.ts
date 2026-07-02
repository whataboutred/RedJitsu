import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { loadConnection } from '@/lib/fitbit/sync'

export async function GET(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const conn = await loadConnection(auth.supabase, auth.userId)
  if (!conn || !conn.access_token_enc) {
    return NextResponse.json({ connected: false })
  }
  return NextResponse.json({
    connected: true,
    fitbitUserId: conn.fitbit_user_id,
    lastSyncAt: conn.last_sync_at,
    excludedActivities: conn.excluded_activities ?? [],
  })
}
