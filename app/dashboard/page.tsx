'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { logger, EventType } from '@/lib/splunkLogger'
import {
  Dumbbell,
  Activity,
  Heart,
  ChevronRight,
  Target,
  Flame,
  RefreshCw,
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { getDailyQuote, refreshQuote, type Quote } from '@/lib/quoteService'
import ActivityHeatmap from '@/components/ActivityHeatmap'
import BackgroundLogo from '@/components/BackgroundLogo'
import OnboardingWizard from '@/components/OnboardingWizard'
import { useDataRefresh } from '@/hooks/useDataRefresh'

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
type ProgramDay = {
  id: string
  name: string
  dows: number[] | null
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

// Goal Card Component - Compact version
function GoalCard({
  type,
  icon: Icon,
  label,
  current,
  goal,
  streak,
  isOnTrack,
  color,
  href,
}: {
  type: 'strength' | 'bjj' | 'cardio'
  icon: React.ElementType
  label: string
  current: number
  goal: number
  streak: number
  isOnTrack: boolean
  color: string
  href: string
}) {
  const progress = Math.min((current / goal) * 100, 100)
  const colorMap = {
    strength: { ring: '#ef4444', bg: 'from-red-500/10', border: 'border-red-500/20', glow: 'shadow-glow-red-soft' },
    bjj: { ring: '#a855f7', bg: 'from-purple-500/10', border: 'border-purple-500/20', glow: 'shadow-glow-purple' },
    cardio: { ring: '#10b981', bg: 'from-emerald-500/10', border: 'border-emerald-500/20', glow: 'shadow-glow-green' },
  }

  return (
    <Link href={href}>
      <AnimatedCard
        className={`bg-gradient-to-br ${colorMap[type].bg} to-transparent ${colorMap[type].border} p-4 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer`}
        delay={type === 'strength' ? 0 : type === 'bjj' ? 0.1 : 0.2}
      >
        <div className="flex items-center gap-4">
          <ProgressRing progress={progress} size={64} strokeWidth={5} color={colorMap[type].ring} showLabel />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="font-semibold text-white text-sm">{label}</span>
              {streak > 0 && (
                <div className="flex items-center gap-0.5 px-2 py-0.5 bg-amber-500/15 rounded-md text-xs">
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse-soft" />
                  <span className="font-bold text-amber-400">{streak}w</span>
                </div>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{current}</span>
              <span className="text-zinc-500 text-sm">/ {goal}</span>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-md ${
                isOnTrack ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
              }`}>
                {isOnTrack ? 'On Track' : 'Catch Up'}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
        </div>
      </AnimatedCard>
    </Link>
  )
}


export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const [cardio, setCardio] = useState<Cardio[]>([])
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState<number>(3)
  const [showStrengthGoal, setShowStrengthGoal] = useState<boolean>(true)
  const [showBjjGoal, setShowBjjGoal] = useState<boolean>(true)
  const [showCardioGoal, setShowCardioGoal] = useState<boolean>(false)
  const [todayWorkoutDay, setTodayWorkoutDay] = useState<string | null>(null)
  const [todayQuote, setTodayQuote] = useState<Quote | null>(null)
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false)
  const [onboardingUserId, setOnboardingUserId] = useState<string | null>(null)

  // Load daily quote
  useEffect(() => {
    getDailyQuote().then(setTodayQuote)
  }, [])

  const handleRefreshQuote = async () => {
    setIsRefreshingQuote(true)
    const newQuote = await refreshQuote()
    setTodayQuote(newQuote)
    setIsRefreshingQuote(false)
  }

  const loadDashboardData = useCallback(async () => {
    const userId = await getActiveUserId()
    if (!userId) return

    const [profRes, workoutsRes, bjjRes, cardioRes, activeProgramRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('weekly_goal,target_weeks,goal_start,bjj_weekly_goal,cardio_weekly_goal,show_strength_goal,show_bjj_goal,show_cardio_goal')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('workouts')
        .select('id,performed_at,title')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000),
      supabase
        .from('bjj_sessions')
        .select('id,performed_at,duration_min,kind')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000),
      supabase
        .from('cardio_sessions')
        .select('id,performed_at,activity,duration_minutes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1000),
      supabase
        .from('programs')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    const prof = profRes.data
    if (prof) {
      setWeeklyGoal(prof.weekly_goal ?? 4)
      setBjjWeeklyGoal(prof.bjj_weekly_goal ?? 2)
      setCardioWeeklyGoal(prof.cardio_weekly_goal ?? 3)
      setShowStrengthGoal(prof.show_strength_goal ?? true)
      setShowBjjGoal(prof.show_bjj_goal ?? true)
      setShowCardioGoal(prof.show_cardio_goal ?? false)
    } else if (!DEMO) {
      // No profile yet — brand-new account, run first-time setup
      setOnboardingUserId(userId)
    }

    setWorkouts((workoutsRes.data || []) as Workout[])
    setBjj((bjjRes.data || []) as BJJ[])
    setCardio((cardioRes.data || []) as Cardio[])

    const activeProgram = activeProgramRes.data
    if (activeProgram) {
      const todayDow = new Date().getDay()
      const { data: programDays } = await supabase
        .from('program_days')
        .select('id,name,dows')
        .eq('program_id', activeProgram.id)

      const todaysDay = (programDays || []).find((day: ProgramDay) =>
        day.dows && day.dows.includes(todayDow)
      )
      setTodayWorkoutDay(todaysDay?.name ?? null)
    } else {
      setTodayWorkoutDay(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const userId = await getActiveUserId()
      if (cancelled) return
      if (!userId) {
        if (!DEMO) {
          router.push('/login')
        }
        setLoading(false)
        return
      }

      logger.info(EventType.API_REQUEST, 'Dashboard page loaded', { user_id: userId }, userId)
      await loadDashboardData()
      if (!cancelled) setLoading(false)
    })()

    return () => { cancelled = true }
  }, [loadDashboardData, router])

  // Refetch when data changes anywhere or the tab regains focus
  useDataRefresh(loadDashboardData)

  const now = new Date()
  const thisWeekKey = weekKey(now)
  const dayIndex = now.getDay()

  // Calculate weekly stats
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
      if (c >= weeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < weeklyGoal) continue
        break
      }
    }
    return streak
  }, [wkCounts, weeklyGoal, thisWeekKey])

  // On Sunday (day 0), don't expect any workouts yet — the week just started
  const expectedByToday = dayIndex === 0 ? 0 : Math.ceil((weeklyGoal * dayIndex) / 7)
  const onTrackStrength = thisWeekCount >= expectedByToday

  // BJJ stats
  const bjjWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of bjj) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [bjj])

  const bjjThisWeekCount = bjjWeekCounts.get(thisWeekKey) || 0

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
      if (c >= bjjWeeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < bjjWeeklyGoal) continue
        break
      }
    }
    return streak
  }, [bjjWeekCounts, bjjWeeklyGoal, thisWeekKey])

  const bjjExpectedByToday = dayIndex === 0 ? 0 : Math.ceil((bjjWeeklyGoal * dayIndex) / 7)
  const onTrackBjj = bjjThisWeekCount >= bjjExpectedByToday

  // Cardio stats
  const cardioWeekCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of cardio) {
      const k = weekKey(new Date(s.performed_at))
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [cardio])

  const cardioThisWeekCount = cardioWeekCounts.get(thisWeekKey) || 0

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
      if (c >= cardioWeeklyGoal) streak++
      else {
        if (k === thisWeekKey && c < cardioWeeklyGoal) continue
        break
      }
    }
    return streak
  }, [cardioWeekCounts, cardioWeeklyGoal, thisWeekKey])

  const cardioExpectedByToday = dayIndex === 0 ? 0 : Math.ceil((cardioWeeklyGoal * dayIndex) / 7)
  const onTrackCardio = cardioThisWeekCount >= cardioExpectedByToday

  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-6 relative z-10">
        <BackgroundLogo />
        <div className="space-y-2">
          <Skeleton width={200} height={32} />
          <Skeleton width={300} height={20} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    )
  }

  const enabledGoals = [
    showStrengthGoal && 'strength',
    showBjjGoal && 'bjj',
    showCardioGoal && 'cardio',
  ].filter(Boolean)

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 relative z-10">
      <BackgroundLogo />

      {onboardingUserId && (
        <OnboardingWizard
          userId={onboardingUserId}
          onComplete={() => {
            setOnboardingUserId(null)
            loadDashboardData()
          }}
        />
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1 pt-1"
      >
        <h1 className="text-2xl font-bold text-white">
          {greeting}
        </h1>
        <p className="text-zinc-500 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {todayWorkoutDay && <span> &middot; <span className="text-brand-red font-medium">{todayWorkoutDay}</span> day</span>}
        </p>
      </motion.div>

      {/* Motivational Quote — compact */}
      {todayQuote && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative py-4 px-4"
        >
          <div className="border-l-2 border-l-red-500/30 pl-4">
            <button
              onClick={handleRefreshQuote}
              disabled={isRefreshingQuote}
              className="absolute top-3 right-3 p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
              title="Get new quote"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuote ? 'animate-spin' : ''}`} />
            </button>
            <p className="text-zinc-200 italic text-base leading-relaxed">
              &ldquo;{todayQuote.text}&rdquo;
            </p>
            <p className="text-zinc-400 text-sm mt-1 not-italic">— {todayQuote.author}</p>
          </div>
        </motion.div>
      )}

      {/* Goal Cards */}
      {enabledGoals.length > 0 ? (
        <div className={`grid gap-4 ${
          enabledGoals.length === 1
            ? 'grid-cols-1'
            : enabledGoals.length === 2
              ? 'sm:grid-cols-2'
              : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {showStrengthGoal && (
            <GoalCard
              type="strength"
              icon={Dumbbell}
              label="Strength"
              current={thisWeekCount}
              goal={weeklyGoal}
              streak={strengthStreak}
              isOnTrack={onTrackStrength}
              color="#ef4444"
              href="/workouts/new"
            />
          )}
          {showBjjGoal && (
            <GoalCard
              type="bjj"
              icon={Activity}
              label="Jiu-Jitsu"
              current={bjjThisWeekCount}
              goal={bjjWeeklyGoal}
              streak={bjjStreak}
              isOnTrack={onTrackBjj}
              color="#a855f7"
              href="/jiu-jitsu"
            />
          )}
          {showCardioGoal && (
            <GoalCard
              type="cardio"
              icon={Heart}
              label="Cardio"
              current={cardioThisWeekCount}
              goal={cardioWeeklyGoal}
              streak={cardioStreak}
              isOnTrack={onTrackCardio}
              color="#10b981"
              href="/cardio"
            />
          )}
        </div>
      ) : (
        <AnimatedCard className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-7 h-7 text-brand-red/50" />
          </div>
          <h3 className="font-semibold text-zinc-300 mb-2">No goals configured</h3>
          <p className="text-zinc-500 text-sm mb-4">Set up weekly goals to track your progress</p>
          <Link href="/settings" className="btn btn-sm">
            Configure Goals
          </Link>
        </AnimatedCard>
      )}

      {/* Activity Heatmap */}
      {!loading && (
        <ActivityHeatmap
          activities={[
            ...workouts.map(w => ({ date: w.performed_at.split('T')[0], type: 'strength' as const })),
            ...bjj.map(b => ({ date: b.performed_at.split('T')[0], type: 'bjj' as const })),
            ...cardio.map(c => ({ date: c.performed_at.split('T')[0], type: 'cardio' as const })),
          ]}
        />
      )}

      {/* Recent Activity */}
      {(() => {
        const recent = [
          ...workouts.map(w => ({ type: 'strength' as const, title: w.title || 'Strength Training', date: w.performed_at })),
          ...bjj.map(b => ({ type: 'bjj' as const, title: b.kind.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()), date: b.performed_at })),
          ...cardio.map(c => ({ type: 'cardio' as const, title: c.activity, date: c.performed_at })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

        if (recent.length === 0) return null

        const typeConfig = {
          strength: { border: 'border-l-red-500', bg: 'bg-red-500/[0.05]', icon: Dumbbell, color: 'text-red-400' },
          bjj: { border: 'border-l-purple-500', bg: 'bg-purple-500/[0.05]', icon: Activity, color: 'text-purple-400' },
          cardio: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/[0.05]', icon: Heart, color: 'text-emerald-400' },
        }

        return (
          <AnimatedCard delay={0.2}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-brand-red rounded-full" />
              <h3 className="font-semibold text-white text-sm">Recent Activity</h3>
            </div>
            <div className="space-y-2">
              {recent.map((item, i) => {
                const cfg = typeConfig[item.type]
                const ItemIcon = cfg.icon
                return (
                  <div key={i} className={`border-l-2 ${cfg.border} ${cfg.bg} rounded-xl px-3 py-3`}>
                    <div className="flex items-center gap-3">
                      <ItemIcon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
                      <span className="text-sm text-white flex-1 truncate">{item.title}</span>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </AnimatedCard>
        )
      })()}

    </div>
  )
}
