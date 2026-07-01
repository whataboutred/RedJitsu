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
  Play,
  ArrowRight,
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import CountUp from '@/components/ui/CountUp'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { getDailyQuote, refreshQuote, type Quote } from '@/lib/quoteService'
import ActivityHeatmap from '@/components/ActivityHeatmap'
import BackgroundLogo from '@/components/BackgroundLogo'
import OnboardingWizard from '@/components/OnboardingWizard'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { startOfLocalWeek } from '@/lib/dateUtils'

type ProgramDay = {
  id: string
  name: string
  dows: number[] | null
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [thisWeekCount, setThisWeekCount] = useState(0)
  const [totalWorkouts, setTotalWorkouts] = useState(0)
  const [displayName, setDisplayName] = useState<string>('')
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [todayWorkoutDay, setTodayWorkoutDay] = useState<string | null>(null)
  const [todayWorkoutDayId, setTodayWorkoutDayId] = useState<string | null>(null)
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

    // Head-count queries: the dashboard only needs two numbers, not rows
    const weekStartISO = startOfLocalWeek().toISOString()
    const [profRes, weekCountRes, totalCountRes, activeProgramRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name,weekly_goal')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('performed_at', weekStartISO),
      supabase
        .from('workouts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('programs')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle(),
    ])

    const prof = profRes.data
    if (prof) {
      setDisplayName(prof.display_name ?? '')
      setWeeklyGoal(prof.weekly_goal ?? 4)
    } else if (!DEMO) {
      // No profile yet — brand-new account, run first-time setup
      setOnboardingUserId(userId)
    }

    setThisWeekCount(weekCountRes.count ?? 0)
    setTotalWorkouts(totalCountRes.count ?? 0)

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
      setTodayWorkoutDayId(todaysDay?.id ?? null)
    } else {
      setTodayWorkoutDay(null)
      setTodayWorkoutDayId(null)
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

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 relative z-10">
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
        <h1 className="text-4xl font-display uppercase text-white">
          {greeting}{displayName ? <span>, <span className="text-brand-red">{displayName}</span></span> : ''}
        </h1>
        <p className="text-zinc-500 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {todayWorkoutDay && <span> &middot; <span className="text-brand-red font-medium">{todayWorkoutDay}</span> day</span>}
        </p>
      </motion.div>

      {/* Quick stats — kept deliberately minimal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 gap-4 pt-1"
      >
        <Link href="/workouts/new" className="block active:scale-[0.98] transition-transform">
          <p className="text-6xl font-display text-white leading-none">
            <CountUp value={thisWeekCount} />
            {weeklyGoal > 0 && <span className="text-3xl text-zinc-600"> / {weeklyGoal}</span>}
          </p>
          <p className="text-sm text-zinc-500 mt-2 uppercase tracking-wide">Workouts this week</p>
        </Link>
        <Link href="/history" className="block active:scale-[0.98] transition-transform">
          <p className="text-6xl font-display text-brand-red leading-none"><CountUp value={totalWorkouts} /></p>
          <p className="text-sm text-zinc-500 mt-2 uppercase tracking-wide">Total workouts</p>
        </Link>
      </motion.div>

      {/* Today's scheduled session — only shown when today maps to a program day */}
      {todayWorkoutDay && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Link
            href={todayWorkoutDayId ? `/workouts/new?day=${todayWorkoutDayId}` : '/workouts/new'}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface border border-white/[0.07] border-l-2 border-l-brand-red p-4 active:scale-[0.99] transition-transform"
          >
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Today&apos;s session</p>
              <p className="text-xl font-display uppercase text-white truncate">{todayWorkoutDay}</p>
            </div>
            <span className="btn btn-sm flex-shrink-0">
              <Play className="w-4 h-4" />
              Start
            </span>
          </Link>
        </motion.div>
      )}

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
              aria-label="Get new quote"
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

      {/* Goal progress, activity heatmap, and recent activity now live in the
          Activity/History tab to keep Home clean. */}

      {/* Brand sign-off — fills the lower space and signs the page */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col items-center gap-3 pt-12 pb-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/red-jitsu-mark.png"
          alt="Red Jitsu"
          className="w-16 h-16 opacity-90"
          style={{ filter: 'drop-shadow(0 0 16px rgba(220,38,38,0.18))' }}
        />
        <div className="flex items-center gap-2 opacity-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/redlabs-mark.png"
            alt=""
            className="h-3.5 w-auto"
            style={{ mixBlendMode: 'lighten' }}
          />
          <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            A Red Labs App
          </span>
        </div>
        <Link
          href="/about"
          className="group mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-red/30 bg-brand-red/[0.06] text-brand-red text-sm font-medium hover:bg-brand-red/[0.12] hover:border-brand-red/50 active:scale-95 transition-all shadow-[0_0_20px_rgba(220,38,38,0.08)]"
        >
          Why I built this
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>

    </div>
  )
}
