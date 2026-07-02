import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'

export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth
  if (!endpoint || !p256dh || !authKey) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })

  const { error } = await auth.supabase
    .from('push_subscriptions')
    .upsert({ user_id: auth.userId, endpoint, p256dh, auth: authKey }, { onConflict: 'endpoint', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
