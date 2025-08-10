'use client'

import Nav from '@/components/Nav'
import Disclaimer from '@/components/Disclaimer'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'

type Workout = { id: string; performed_at: string; title: string | null }
type BJJ = {
  id: string
  performed_at: string
  duration_min: number
  kind: 'class' | 'drilling' | 'open_mat'
}
type Profile = {
  weekly_goal: number | null
  target_weeks: number | null
  goal_start: string | null
  bjj_weekly_goal: number | null
}

function startOfWeekSunday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  x.setDate(x.getDate() - day)
  return x
}
function weekKey(d: Date) {
  return startOfWeekSunday(d).toISOString().slice(0, 10)
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [targetWeeks, setTargetWeeks] = useState<number | null>(null)
  const [goalStart, setGoalStart] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const userId = await getActiveUserId()
      if (!userId) {
        if (!DEMO) {
          window.location.href = '/login'
        }
        setLoading(false)
        return
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('weekly_goal,target_weeks,goal_start,bjj_weekly_goal')
        .eq('id', userId)
        .maybeSingle()
      if (prof) {
        setWeeklyGoal(prof.weekly_goal ?? 4)
        setBjjWeeklyGoal(prof.bjj_weekly_goal ?? 2)
        setTargetWeeks(prof.target_weeks ?? null)
        setGoalStart(prof.goal_start ?? null)
      }

      const { data: w } = await supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000)
      setWorkouts((w || []) as Workout[])

      const { data: bj } = await supabase
        .from('bjj_sessions')
        .select('id,performed_at,duration_min,kind')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000)
      setBjj((bj || []) as BJJ[])

      setLoading(false)
    })()
  }, [])

  const now = new Date()
  const thisWeekKey = weekKey(now)

  // Strength weekly
  const wkCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of workouts) {
      const k = weekKey(new Date(w.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [workouts])
  const thisWeekCount = wkCounts.get(thisWeekKey) || 0
  const strengthStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = wkCounts.get(k) || 0
      if (c >= (weeklyGoal || 4)) streak++
      else {
        if (k === thisWeekKey && c < (weeklyGoal || 4)) continue
        break
      }
    }
    return streak
  }, [wkCounts, weeklyGoal, thisWeekKey])
  const dayIndex = now.getDay()
  const expectedByToday = Math.ceil(((weeklyGoal || 4) * (dayIndex + 1)) / 7)
  const onTrackStrength = thisWeekCount >= expectedByToday

  // BJJ weekly
  const bjjWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of bjj) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [bjj])
  const bjjWeekMinutes = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of bjj) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + (s.duration_min || 0))
    }
    return map
  }, [bjj])
  const bjjThisWeekCount = bjjWeekCounts.get(thisWeekKey) || 0
  const bjjThisWeekMin = bjjWeekMinutes.get(thisWeekKey) || 0
  const bjjStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = bjjWeekCounts.get(k) || 0
      if (c >= (bjjWeeklyGoal || 2)) streak++
      else {
        if (k === thisWeekKey && c < (bjjWeeklyGoal || 2)) continue
        break
      }
    }
    return streak
  }, [bjjWeekCounts, bjjWeeklyGoal, thisWeekKey])
  const bjjExpectedByToday = Math.ceil(((bjjWeeklyGoal || 2) * (dayIndex + 1)) / 7)
  const onTrackBjj = bjjThisWeekCount >= bjjExpectedByToday

  const recentW = workouts.slice(0, 5)
  const recentB = bjj.slice(0, 5)

  if (loading)
    return (
      <div>
        <Nav />
        <main className="max-w-4xl mx-auto p-4">Loading…</main>
      </div>
    )

  return (
    <div className="relative min-h-screen bg-black">
      {/* Background Logo */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="relative w-[600px] h-[600px] md:w-[800px] md:h-[800px] opacity-[0.15] mix-blend-screen">
          <Image
            src="/red-jitsu-logo.png"
            alt=""
            fill
            style={{ objectFit: 'contain' }}
            priority
            className="select-none"
          />
        </div>
      </div>
      
      <Nav />
      <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Dashboard</h1>
          {/* Top CTAs: visible on md+, hidden on phones */}
          <div className="hidden md:flex gap-2">
            <Link href="/workouts/new" className="btn">
              Start workout
            </Link>
            <Link href="/jiu-jitsu" className="toggle">
              Log Jiu Jitsu
            </Link>
          </div>
        </div>

        {/* Stats tiles */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-white/70">
                  Strength — Weekly consistency
                </div>
                <div className="text-3xl font-semibold">
                  {strengthStreak} week{strengthStreak === 1 ? '' : 's'}
                </div>
                <div className="text-white/70 text-sm mt-1">
                  This week:{' '}
                  <span className="text-white">{thisWeekCount}</span>/
                  <span className="text-white">{weeklyGoal}</span>{' '}
                  {onTrackStrength ? (
                    <span className="text-green-400">• on track</span>
                  ) : (
                    <span className="text-brand-red">• catch up</span>
                  )}
                </div>
              </div>
              <Link href="/settings" className="toggle">
                Edit goal
              </Link>
            </div>
            {goalStart && targetWeeks && (
              <div className="text-white/60 text-xs mt-2">
                Goal window: {goalStart} → {targetWeeks} weeks
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-white/70">
                  Jiu Jitsu — Weekly consistency
                </div>
                <div className="text-3xl font-semibold">
                  {bjjStreak} week{bjjStreak === 1 ? '' : 's'}
                </div>
                <div className="text-white/70 text-sm mt-1">
                  This week:{' '}
                  <span className="text-white">{bjjThisWeekCount}</span>/
                  <span className="text-white">{bjjWeeklyGoal}</span>{' '}
                  {onTrackBjj ? (
                    <span className="text-green-400">• on track</span>
                  ) : (
                    <span className="text-brand-red">• catch up</span>
                  )}{' '}
                  • Mat time: <span className="text-white">{bjjThisWeekMin}</span>{' '}
                  min
                </div>
              </div>
              <Link href="/settings" className="toggle">
                Edit goal
              </Link>
            </div>
          </div>
        </div>

        {/* Recent lists */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card">
            <div className="font-medium mb-2">Recent workouts</div>
            <div className="grid gap-2">
              {recentW.map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <div className="text-white/90">
                    {new Date(w.performed_at).toLocaleDateString()} —{' '}
                    {w.title ?? 'Untitled'}
                  </div>
                  <Link
                    href={`/history?highlight=${w.id}`}
                    className="toggle"
                  >
                    Open
                  </Link>
                </div>
              ))}
              {!recentW.length && (
                <div className="text-white/60">No workouts yet.</div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="font-medium mb-2">Recent Jiu Jitsu</div>
            <div className="grid gap-2">
              {recentB.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="text-white/90">
                    {new Date(s.performed_at).toLocaleDateString()} —{' '}
                    {s.kind.replace('_', ' ')} • {s.duration_min} min
                  </div>
                </div>
              ))}
              {!recentB.length && (
                <div className="text-white/60">No Jiu Jitsu sessions yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card text-center">
          “When you want to succeed as bad as you want to breathe then you’ll be
          successful.” - Eric Thomas
        </div>
      </main>

      {/* Medical Disclaimer */}
      <Disclaimer />

      {/* Sticky bottom action bar — mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur border-t border-white/10">
        <div className="max-w-4xl mx-auto p-2 flex gap-2">
          <Link href="/workouts/new" className="btn flex-1 py-3 text-center">
            Workout
          </Link>
          <Link href="/jiu-jitsu" className="toggle flex-1 py-3 text-center">
            Jiu Jitsu
          </Link>
        </div>
      </div>
    </div>
  )
}
