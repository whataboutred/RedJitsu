import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { runSync } from '@/lib/fitbit/sync'

export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    // Manual sync backfills the last 12 months (idempotent via dedupe); the cron
    // syncs incrementally. So tapping "Sync now" catches up your whole history.
    const result = await runSync(auth.supabase, auth.userId, 365)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    const message = String(err?.message ?? err)
    // Token revoked/expired beyond refresh -> tell the client to reconnect.
    const needsReconnect = /invalid_grant|invalid_token|401|refresh/i.test(message)
    return NextResponse.json(
      { error: needsReconnect ? 'Fitbit needs to be reconnected.' : 'Sync failed. Please try again.', needsReconnect },
      { status: needsReconnect ? 409 : 500 }
    )
  }
}
