import { NextRequest, NextResponse } from 'next/server'
import { getUserFromBearer } from '@/lib/fitbit/server'
import { FITBIT_ACTIVITY_OPTIONS } from '@/lib/fitbit/constants'

// Update which Fitbit activity types are skipped (the exclusion list).
// Everything else imports; strength and low-effort walks are filtered by
// built-in rules in the mapper.
export async function POST(req: NextRequest) {
  const auth = await getUserFromBearer(req)
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const excluded = Array.isArray(body?.excluded_activities) ? body.excluded_activities : null
  if (!excluded) return NextResponse.json({ error: 'excluded_activities required' }, { status: 400 })

  // Only accept known options (defensive; caps list size)
  const valid = excluded
    .filter((a: unknown): a is string => typeof a === 'string')
    .filter((a: string) => (FITBIT_ACTIVITY_OPTIONS as readonly string[]).includes(a))
    .slice(0, 50)

  const { error } = await auth.supabase
    .from('fitbit_connections')
    .update({ excluded_activities: valid, updated_at: new Date().toISOString() })
    .eq('user_id', auth.userId)
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true, excluded_activities: valid })
}
