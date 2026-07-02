import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/fitbit/server'

// Daily reminder sender, triggered by Vercel Cron in the evening. Sends at most
// one contextual nudge per user per day, and only when there's a reason to.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return NextResponse.json({ error: 'VAPID keys not set' }, { status: 500 })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@redjitsu.app', pub, priv)

  const admin = serviceClient()
  const { data: subs } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth')
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const byUser = new Map<string, typeof subs>()
  for (const s of subs) {
    const arr = byUser.get(s.user_id) ?? []
    arr.push(s)
    byUser.set(s.user_id, arr)
  }

  const { dow, startOfToday, startOfYesterday } = ctDay(new Date())

  let sent = 0
  for (const [userId, userSubs] of byUser) {
    try {
      const payload = await buildMessage(admin, userId, dow, startOfToday, startOfYesterday)
      if (!payload) continue
      for (const s of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload)
          )
          sent++
        } catch (err: any) {
          // Expired/invalid endpoint -> prune it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      }
    } catch {
      // One user's data error shouldn't stop everyone else's reminders.
      continue
    }
  }
  return NextResponse.json({ ok: true, sent })
}

// Day boundaries + day-of-week in America/Chicago, robust across DST. The cron
// runs in the evening CT, so "today" means the user's local calendar day.
function ctDay(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value])) as Record<string, string>
  const y = +p.year, m = +p.month, d = +p.day
  const wallAsUtc = Date.UTC(y, m - 1, d, +p.hour, +p.minute, +p.second)
  const offset = wallAsUtc - now.getTime() // CT offset from UTC (ms)
  const startTodayUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - offset
  return {
    dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    startOfToday: new Date(startTodayUtc).toISOString(),
    startOfYesterday: new Date(startTodayUtc - 24 * 3600 * 1000).toISOString(),
  }
}

async function count(admin: SupabaseClient, table: string, userId: string, gte: string, lt?: string) {
  let q = admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('performed_at', gte)
  if (lt) q = q.lt('performed_at', lt)
  const { count } = await q
  return count ?? 0
}

async function buildMessage(admin: SupabaseClient, userId: string, dow: number, startOfToday: string, startOfYesterday: string) {
  const trainedToday =
    (await count(admin, 'workouts', userId, startOfToday)) +
    (await count(admin, 'bjj_sessions', userId, startOfToday)) +
    (await count(admin, 'cardio_sessions', userId, startOfToday)) > 0

  // Sunday: weekly review (always).
  if (dow === 0) {
    return { title: 'Your week in review', body: 'See your training load, PRs, and consistency for the week.', url: '/history', tag: 'rj-weekly' }
  }
  if (trainedToday) return null // already trained — don't nag

  // Scheduled program day today?
  const { data: prog } = await admin.from('programs').select('id').eq('user_id', userId).eq('is_active', true).maybeSingle()
  if (prog) {
    const { data: days } = await admin.from('program_days').select('name,dows').eq('program_id', (prog as { id: string }).id)
    const today = (days ?? []).find((d: any) => Array.isArray(d.dows) && d.dows.includes(dow))
    if (today) return { title: `Today is ${today.name} day`, body: 'Log your session to keep your plan on track.', url: '/workouts/new', tag: 'rj-today' }
  }

  // Streak nudge: trained yesterday but not today (won't fire for long-lapsed users).
  const trainedYesterday =
    (await count(admin, 'workouts', userId, startOfYesterday, startOfToday)) +
    (await count(admin, 'bjj_sessions', userId, startOfYesterday, startOfToday)) +
    (await count(admin, 'cardio_sessions', userId, startOfYesterday, startOfToday)) > 0
  if (trainedYesterday) {
    return { title: 'Keep it rolling', body: 'You trained yesterday — log today to keep the streak alive.', url: '/dashboard', tag: 'rj-streak' }
  }

  return null
}
