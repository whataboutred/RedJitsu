import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'

// Only accept endpoints from real browser push services — otherwise a stored
// endpoint becomes a server-side request target (SSRF) when the cron sends.
function allowedEndpoint(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const h = u.hostname
    return (
      h.endsWith('.push.apple.com') ||
      h === 'fcm.googleapis.com' ||
      h.endsWith('.push.services.mozilla.com') ||
      h.endsWith('.notify.windows.com')
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !allowedEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  }
  if (typeof p256dh !== 'string' || typeof authKey !== 'string' || p256dh.length > 512 || authKey.length > 512) {
    return NextResponse.json({ error: 'Invalid keys' }, { status: 400 })
  }

  // Reclaim the endpoint for this user (refreshes rotated keys / re-subscribe).
  await auth.supabase.from('push_subscriptions').delete().eq('user_id', auth.userId).eq('endpoint', endpoint)
  const { error } = await auth.supabase
    .from('push_subscriptions')
    .insert({ user_id: auth.userId, endpoint, p256dh, auth: authKey })
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
