'use client'

import Nav from '@/components/Nav'
import Disclaimer from '@/components/Disclaimer'
import BackgroundLogo from '@/components/BackgroundLogo'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { logger, EventType } from '@/lib/splunkLogger'

type Workout = { id: string; performed_at: string; title: string | null }
type BJJ = {
  id: string
  performed_at: string
  duration_min: number
  kind: 'class' | 'drilling' | 'open_mat'
}
type Cardio = {
  id: string
  performed_at: string
  activity: string
  duration_minutes: number | null
}
type Profile = {
  weekly_goal: number | null
  target_weeks: number | null
  goal_start: string | null
  bjj_weekly_goal: number | null
  cardio_weekly_goal: number | null
  show_strength_goal: boolean | null
  show_bjj_goal: boolean | null
  show_cardio_goal: boolean | null
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
  const router = useRouter()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState<number>(3)
  const [targetWeeks, setTargetWeeks] = useState<number | null>(null)
  const [goalStart, setGoalStart] = useState<string | null>(null)
  
  // Goal visibility settings
  const [showStrengthGoal, setShowStrengthGoal] = useState<boolean>(true)
  const [showBjjGoal, setShowBjjGoal] = useState<boolean>(true)
  const [showCardioGoal, setShowCardioGoal] = useState<boolean>(false)

  const loadProfileData = async () => {
    const userId = await getActiveUserId()
    if (!userId) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
      .eq('id', userId)
      .maybeSingle()
    if (prof) {
      setWeeklyGoal(prof.weekly_goal ?? 4)
      setBjjWeeklyGoal(prof.bjj_weekly_goal ?? 2)
      setCardioWeeklyGoal(prof.cardio_weekly_goal ?? 3)
      setTargetWeeks(prof.target_weeks ?? null)
      setGoalStart(prof.goal_start ?? null)
      setShowStrengthGoal(prof.show_strength_goal ?? true)
      setShowBjjGoal(prof.show_bjj_goal ?? true)
      setShowCardioGoal(prof.show_cardio_goal ?? false)
    }
  }

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

      await loadProfileData()

      // Log dashboard page load
      logger.info(EventType.API_REQUEST, 'Dashboard page loaded', { user_id: userId }, userId)

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

      const { data: cardioData } = await supabase
        .from('cardio_sessions')
        .select('id,performed_at,activity,duration_minutes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000)
      setCardio((cardioData || []) as Cardio[])

      setLoading(false)
    })()
  }, [])

  // Reload profile data when page becomes visible (returning from settings)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadProfileData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
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

  // Cardio weekly
  const cardioWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of cardio) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [cardio])
  const cardioWeekMinutes = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of cardio) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + (s.duration_minutes || 0))
    }
    return map
  }, [cardio])
  const cardioThisWeekCount = cardioWeekCounts.get(thisWeekKey) || 0
  const cardioThisWeekMin = cardioWeekMinutes.get(thisWeekKey) || 0
  const cardioStreak = useMemo(() => {
    const keys: string[] = []
    let cursor = startOfWeekSunday(now)
    for (let i = 0; i < 120; i++) {
      keys.push(cursor.toISOString().slice(0, 10))
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() - 7)
    }
    let streak = 0
    for (const k of keys) {
      const c = cardioWeekCounts.get(k) || 0
      if (c >= (cardioWeeklyGoal || 3)) streak++
      else {
        if (k === thisWeekKey && c < (cardioWeeklyGoal || 3)) continue
        break
      }
    }
    return streak
  }, [cardioWeekCounts, cardioWeeklyGoal, thisWeekKey])
  const cardioExpectedByToday = Math.ceil(((cardioWeeklyGoal || 3) * (dayIndex + 1)) / 7)
  const onTrackCardio = cardioThisWeekCount >= cardioExpectedByToday

  const recentW = workouts.slice(0, 5)
  const recentB = bjj.slice(0, 5)
  const recentC = cardio.slice(0, 5)

  if (loading)
    return (
      <div>
        <Nav />
        <main className="max-w-4xl mx-auto p-4">Loading…</main>
      </div>
    )

  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Dashboard</h1>
          {/* Top CTAs: visible on md+, hidden on phones */}
          <div className="hidden md:flex gap-2">
            <Link href="/workouts/new" className="btn shadow-lg shadow-red-500/20">
              💪 Start workout
            </Link>
            <Link href="/jiu-jitsu" className="toggle border-blue-400/50 hover:bg-blue-500/10">
              🥋 Log Jiu Jitsu
            </Link>
            <Link href="/cardio" className="toggle border-pink-400/50 hover:bg-pink-500/10">
              ❤️ Log Cardio
            </Link>
          </div>
        </div>

        {/* Stats tiles */}
        {(() => {
          const goals = []
          
          // Strength goal
          if (showStrengthGoal) {
            goals.push(
              <div key="strength" className={`card ${onTrackStrength ? 'gradient-green' : strengthStreak > 0 ? 'gradient-red' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-white/70 flex items-center gap-2">
                      <span className="text-red-400">💪</span>
                      Strength — Weekly consistency
                    </div>
                    <div className="text-3xl font-semibold flex items-center gap-2">
                      {strengthStreak} week{strengthStreak === 1 ? '' : 's'}
                      {strengthStreak >= 4 && <span className="text-2xl">🔥</span>}
                    </div>
                    <div className="text-white/70 text-sm mt-1">
                      This week:{' '}
                      <span className="text-white font-semibold">{thisWeekCount}</span>/
                      <span className="text-white font-semibold">{weeklyGoal}</span>{' '}
                      {onTrackStrength ? (
                        <span className="text-green-400 font-medium">• on track ✅</span>
                      ) : (
                        <span className="text-orange-400 font-medium">• catch up ⚡</span>
                      )}
                    </div>
                  </div>
                  <Link href="/settings" className="toggle hover:border-red-400/50">
                    Edit goal
                  </Link>
                </div>
                {goalStart && targetWeeks && (
                  <div className="text-white/60 text-xs mt-2 bg-black/20 rounded-lg p-2">
                    🎯 Goal window: {goalStart} → {targetWeeks} weeks
                  </div>
                )}
              </div>
            )
          }
          
          // BJJ goal
          if (showBjjGoal) {
            goals.push(
              <div key="bjj" className={`card ${onTrackBjj ? 'gradient-green' : bjjStreak > 0 ? 'gradient-blue' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-white/70 flex items-center gap-2">
                      <span className="text-blue-400">🥋</span>
                      Jiu Jitsu — Weekly consistency
                    </div>
                    <div className="text-3xl font-semibold flex items-center gap-2">
                      {bjjStreak} week{bjjStreak === 1 ? '' : 's'}
                      {bjjStreak >= 4 && <span className="text-2xl">🔥</span>}
                    </div>
                    <div className="text-white/70 text-sm mt-1 space-y-1">
                      <div>
                        This week:{' '}
                        <span className="text-white font-semibold">{bjjThisWeekCount}</span>/
                        <span className="text-white font-semibold">{bjjWeeklyGoal}</span>{' '}
                        {onTrackBjj ? (
                          <span className="text-green-400 font-medium">• on track ✅</span>
                        ) : (
                          <span className="text-orange-400 font-medium">• catch up ⚡</span>
                        )}
                      </div>
                      <div className="bg-black/20 rounded px-2 py-1 inline-block">
                        ⏱️ Mat time: <span className="text-purple-400 font-semibold">{bjjThisWeekMin}</span> min
                      </div>
                    </div>
                  </div>
                  <Link href="/settings" className="toggle hover:border-blue-400/50">
                    Edit goal
                  </Link>
                </div>
              </div>
            )
          }
          
          // Cardio goal
          if (showCardioGoal) {
            goals.push(
              <div key="cardio" className={`card ${onTrackCardio ? 'gradient-green' : cardioStreak > 0 ? 'gradient-pink' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-white/70 flex items-center gap-2">
                      <span className="text-pink-400">❤️</span>
                      Cardio — Weekly consistency
                    </div>
                    <div className="text-3xl font-semibold flex items-center gap-2">
                      {cardioStreak} week{cardioStreak === 1 ? '' : 's'}
                      {cardioStreak >= 4 && <span className="text-2xl">🔥</span>}
                    </div>
                    <div className="text-white/70 text-sm mt-1 space-y-1">
                      <div>
                        This week:{' '}
                        <span className="text-white font-semibold">{cardioThisWeekCount}</span>/
                        <span className="text-white font-semibold">{cardioWeeklyGoal}</span>{' '}
                        {onTrackCardio ? (
                          <span className="text-green-400 font-medium">• on track ✅</span>
                        ) : (
                          <span className="text-orange-400 font-medium">• catch up ⚡</span>
                        )}
                      </div>
                      <div className="bg-black/20 rounded px-2 py-1 inline-block">
                        ⏱️ Activity time: <span className="text-purple-400 font-semibold">{cardioThisWeekMin}</span> min
                      </div>
                    </div>
                  </div>
                  <Link href="/settings" className="toggle hover:border-pink-400/50">
                    Edit goal
                  </Link>
                </div>
              </div>
            )
          }
          
          if (goals.length === 0) {
            return (
              <div className="card text-center">
                <div className="text-white/60 mb-4">
                  🎯 No goal tracking enabled
                </div>
                <div className="text-sm text-white/50 mb-4">
                  Enable goal tracking in settings to see your progress here.
                </div>
                <Link href="/settings" className="btn">
                  Configure Goals
                </Link>
              </div>
            )
          }
          
          return (
            <div className={`grid gap-4 ${goals.length === 1 ? 'grid-cols-1' : goals.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {goals}
            </div>
          )
        })()}

        {/* Recent lists */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card border-l-4 border-red-500">
            <div className="font-medium mb-2 flex items-center gap-2">
              <span className="text-red-400">💪</span>
              Recent workouts
            </div>
            <div className="grid gap-2">
              {recentW.map((w, index) => (
                <div key={w.id} className="flex items-center justify-between bg-black/20 rounded-lg p-2 hover:bg-black/30 transition-colors">
                  <div className="text-white/90">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-sm">#{index + 1}</span>
                      <span>{new Date(w.performed_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-white/70 ml-6">{w.title ?? 'Untitled'}</div>
                  </div>
                  <Link
                    href={`/history?highlight=${w.id}`}
                    className="toggle hover:border-red-400/50 text-sm"
                  >
                    Open
                  </Link>
                </div>
              ))}
              {!recentW.length && (
                <div className="text-white/60 text-center py-4">
                  🏋️ No workouts yet. <Link href="/workouts/new" className="text-red-400 hover:text-red-300">Start your first one!</Link>
                </div>
              )}
            </div>
          </div>
          <div className="card border-l-4 border-blue-500">
            <div className="font-medium mb-2 flex items-center gap-2">
              <span className="text-blue-400">🥋</span>
              Recent Jiu Jitsu
            </div>
            <div className="grid gap-2">
              {recentB.map((s, index) => (
                <div key={s.id} className="bg-black/20 rounded-lg p-2 hover:bg-black/30 transition-colors">
                  <div className="flex items-center gap-2 text-white/90">
                    <span className="text-blue-400 text-sm">#{index + 1}</span>
                    <span>{new Date(s.performed_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-white/70 ml-6 flex items-center gap-2">
                    <span className="capitalize">{s.kind.replace('_', ' ')}</span>
                    <span className="text-purple-400">• {s.duration_min} min</span>
                  </div>
                </div>
              ))}
              {!recentB.length && (
                <div className="text-white/60 text-center py-4">
                  🥋 No sessions yet. <Link href="/jiu-jitsu" className="text-blue-400 hover:text-blue-300">Log your first one!</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card text-center border-l-4 border-orange-500 bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="text-orange-400 text-2xl mb-2">💭</div>
          <div className="text-lg italic text-white/90 mb-2">
            "When you want to succeed as bad as you want to breathe then you'll be successful."
          </div>
          <div className="text-sm text-orange-400 font-medium">— Eric Thomas</div>
        </div>
      </main>

      {/* Medical Disclaimer */}
      <Disclaimer />

      {/* Sticky bottom action bar — mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur border-t border-white/10">
        <div className="max-w-4xl mx-auto p-2 flex gap-2">
          <Link href="/workouts/new" className="btn flex-1 py-3 text-center shadow-lg shadow-red-500/30">
            💪 Workout
          </Link>
          <Link href="/jiu-jitsu" className="toggle flex-1 py-3 text-center border-blue-400/50 hover:bg-blue-500/10">
            🥋 Jiu Jitsu
          </Link>
          <Link href="/cardio" className="toggle flex-1 py-3 text-center border-pink-400/50 hover:bg-pink-500/10">
            ❤️ Cardio
          </Link>
        </div>
      </div>
    </div>
  )
}
