'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Flame,
  Zap,
  Play,
  Pause,
  Check,
  ChevronRight,
  Calendar,
  Target,
  Trophy,
  Sparkles,
  X,
  Timer,
  FileText,
  TrendingUp
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { hapticSuccess } from '@/lib/haptics'
import { insertBjjSession } from '@/lib/api'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { toDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useRouter } from 'next/navigation'
import BackgroundLogo from '@/components/BackgroundLogo'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

interface SessionPattern {
  kind: Kind
  avgDuration: number
  commonIntensity: Intensity
  frequency: number
  lastUsed: string
}

interface WeekStats {
  sessions: number
  totalMinutes: number
  weeklyGoal: number
}

const SESSION_TYPES = [
  {
    value: 'Class' as Kind,
    icon: <Target className="w-6 h-6" />,
    label: 'Class',
    description: 'Structured instruction',
    suggestedDuration: 60,
    suggestedIntensity: 'medium' as Intensity,
    gradient: 'from-purple-500/20 to-purple-700/10',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-300',
    activeGradient: 'from-purple-500/40 to-purple-700/20',
    borderColor: 'border-purple-500/50'
  },
  {
    value: 'Drilling' as Kind,
    icon: <Flame className="w-6 h-6" />,
    label: 'Drilling',
    description: 'Focused technique',
    suggestedDuration: 45,
    suggestedIntensity: 'high' as Intensity,
    gradient: 'from-purple-500/20 to-purple-700/10',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-300',
    activeGradient: 'from-purple-500/40 to-purple-700/20',
    borderColor: 'border-purple-500/50'
  },
  {
    value: 'Open Mat' as Kind,
    icon: <Zap className="w-6 h-6" />,
    label: 'Open Mat',
    description: 'Free rolling',
    suggestedDuration: 90,
    suggestedIntensity: 'medium' as Intensity,
    gradient: 'from-purple-500/20 to-purple-700/10',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-300',
    activeGradient: 'from-purple-500/40 to-purple-700/20',
    borderColor: 'border-purple-500/50'
  }
]

const INTENSITY_OPTIONS = [
  {
    value: 'low' as Intensity,
    label: 'Low',
    description: 'Easy flow, technique focus',
    color: 'bg-emerald-500/10',
    activeColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60'
  },
  {
    value: 'medium' as Intensity,
    label: 'Medium',
    description: 'Good pace, some intensity',
    color: 'bg-amber-500/10',
    activeColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/60'
  },
  {
    value: 'high' as Intensity,
    label: 'High',
    description: 'Hard rolls, competition prep',
    color: 'bg-red-500/10',
    activeColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/60'
  }
]

const DURATION_PRESETS = [30, 45, 60, 75, 90, 120]

const NOTE_TEMPLATES = [
  'Worked on guard passes and escapes',
  'Drilled submissions from guard',
  'Good rolls with higher belts',
  'Focused on takedowns',
  'Mental game and strategy focus',
  'Great training partners today',
]

// Progress ring component
function ProgressRing({ progress, size = 80, strokeWidth = 6, color = '#a855f7' }: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  )
}

export default function BJJPage() {
  const router = useRouter()
  const toast = useToast()
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
  const [performedAt, setPerformedAt] = useState<string>(() => toDatetimeLocal())
  const [kind, setKind] = useState<Kind>('Class')
  const [duration, setDuration] = useState<number>(60)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [notes, setNotes] = useState<string>('')

  // UI state
  const [mode, setMode] = useState<'quick' | 'manual'>('quick')
  const [isLoading, setIsLoading] = useState(false)
  const [patterns, setPatterns] = useState<SessionPattern[]>([])
  const [weekStats, setWeekStats] = useState<WeekStats>({ sessions: 0, totalMinutes: 0, weeklyGoal: 2 })

  // Timer state
  const [sessionTimer, setSessionTimer] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  // Modal state
  const [showNotesSheet, setShowNotesSheet] = useState(false)

  // Auth check
  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)

      // Demo visitors resolve to the demo user id and load the seeded mat
      // history read-only (saving is gated below).
      const userId = await getActiveUserId()
      if (!userId) {
        router.push('/login')
        return
      }

      await loadSessionData()
    })()
  }, [])

  // Refetch when data changes anywhere or the tab regains focus
  useDataRefresh(() => {
    if (!demo && !loading) loadSessionData()
  })

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerRunning) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning])

  async function loadSessionData() {
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      // Get sessions from last 60 days for pattern analysis
      const { data: sessions } = await supabase
        .from('bjj_sessions')
        .select('kind, duration_min, intensity, performed_at, notes')
        .eq('user_id', userId)
        .gte('performed_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .order('performed_at', { ascending: false })

      // Get current week stats
      const weekStart = new Date()
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const { data: weekSessions } = await supabase
        .from('bjj_sessions')
        .select('duration_min')
        .eq('user_id', userId)
        .gte('performed_at', weekStart.toISOString())

      const { data: profile } = await supabase
        .from('profiles')
        .select('bjj_weekly_goal')
        .eq('id', userId)
        .single()

      if (sessions && sessions.length > 0) {
        const typeGroups = sessions.reduce((acc, session) => {
          const kindVal = session.kind === 'open_mat' ? 'Open Mat' :
                      session.kind === 'drilling' ? 'Drilling' : 'Class'

          if (!acc[kindVal]) {
            acc[kindVal] = { durations: [], intensities: [], dates: [] }
          }

          acc[kindVal].durations.push(session.duration_min)
          acc[kindVal].intensities.push(session.intensity ?? 'unknown')
          acc[kindVal].dates.push(session.performed_at)

          return acc
        }, {} as Record<string, { durations: number[], intensities: string[], dates: string[] }>)

        const sessionPatterns: SessionPattern[] = Object.entries(typeGroups).map(([kindKey, data]) => {
          const avgDuration = Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)

          const intensityCounts = data.intensities.reduce((acc, intensityVal) => {
            acc[intensityVal] = (acc[intensityVal] || 0) + 1
            return acc
          }, {} as Record<string, number>)

          const commonIntensity = Object.entries(intensityCounts)
            .sort(([,a], [,b]) => b - a)[0][0] as Intensity

          return {
            kind: kindKey as Kind,
            avgDuration,
            commonIntensity,
            frequency: data.durations.length,
            lastUsed: data.dates[0]
          }
        }).sort((a, b) => b.frequency - a.frequency)

        setPatterns(sessionPatterns)
      }

      const totalMinutes = weekSessions?.reduce((sum, s) => sum + (s.duration_min || 0), 0) || 0
      setWeekStats({
        sessions: weekSessions?.length || 0,
        totalMinutes,
        weeklyGoal: profile?.bjj_weekly_goal || 2
      })
    } catch (error) {
      console.error('Error loading session data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleQuickStart(pattern: { kind: Kind, duration: number, intensity: Intensity }) {
    setKind(pattern.kind)
    setDuration(pattern.duration)
    setIntensity(pattern.intensity)
    setMode('manual')

    const hour = new Date().getHours()
    let smartNote = ''

    if (pattern.kind === 'Class') {
      if (hour < 12) smartNote = 'Morning class - focused on fundamentals'
      else if (hour < 18) smartNote = 'Afternoon class - good energy'
      else smartNote = 'Evening class - great way to end the day'
    } else if (pattern.kind === 'Drilling') {
      smartNote = 'Drilling session - building muscle memory'
    } else {
      smartNote = 'Open mat - free flowing practice'
    }

    setNotes(smartNote)
  }

  function handleSessionTypeSelect(sessionType: typeof SESSION_TYPES[0]) {
    setKind(sessionType.value)
    setDuration(sessionType.suggestedDuration)
    setIntensity(sessionType.suggestedIntensity)
  }

  function formatTimer(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function stopTimerAndSetDuration() {
    const timerMinutes = Math.max(1, Math.round(sessionTimer / 60))
    setDuration(timerMinutes)
    setTimerRunning(false)
    setSessionTimer(0)
    toast.success(`Duration set to ${timerMinutes} minutes`)
  }

  // Use datetimeLocalToISO from lib/dateUtils for timezone-safe conversion

  async function saveSession() {
    setIsLoading(true)

    try {
      if (demo) {
        await saveOffline()
      } else {
        await saveOnline()
      }
      hapticSuccess()
      toast.success('Session saved')
      router.push('/dashboard')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveOnline() {
    const userId = await getActiveUserId()
    if (!userId) {
      toast.error('Please sign in again.')
      return
    }

    const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
    await insertBjjSession({
      user_id: userId,
      performed_at: datetimeLocalToISO(performedAt),
      kind: kind === 'Open Mat' ? ('open_mat' as const) : (kind.toLowerCase() as 'class' | 'drilling'),
      duration_min: minutes,
      intensity,
      notes: notes || null
    })
  }

  async function saveOffline() {
    const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
    const temp = Math.random().toString(36).slice(2)
    const session = {
      tempId: temp,
      performed_at: datetimeLocalToISO(performedAt),
      kind: kind === 'Open Mat' ? 'open_mat' : (kind.toLowerCase()),
      duration_min: minutes,
      intensity,
      notes: notes || null
    }

    const key = `bjj_pending_${temp}`
    localStorage.setItem(key, JSON.stringify(session))
  }

  const canSave = duration > 0 && kind
  const goalProgress = (weekStats.sessions / weekStats.weeklyGoal) * 100
  const selectedSessionType = SESSION_TYPES.find(s => s.value === kind)

  if (loading) {
    return (
      <div className="relative min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
        <BackgroundLogo />
        <Skeleton variant="rectangular" className="h-10 w-48" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-48" />
        <SkeletonCard className="h-32" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />
      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-display uppercase bg-gradient-to-r from-purple-300 to-purple-500 bg-clip-text text-transparent">
                Jiu Jitsu Training
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">Log your mat time</p>
            </div>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  mode === 'quick'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-zinc-500 hover:text-white'
                }`}
                onClick={() => setMode('quick')}
              >
                Quick
              </button>
              <button
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  mode === 'manual'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-zinc-500 hover:text-white'
                }`}
                onClick={() => setMode('manual')}
              >
                Manual
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Week Progress Card */}
        <AnimatedCard delay={0} className="overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="relative">
              <ProgressRing
                progress={goalProgress}
                size={72}
                strokeWidth={6}
                color={goalProgress >= 100 ? '#10b981' : '#a855f7'}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${goalProgress >= 100 ? 'text-emerald-400' : 'text-purple-400'}`}>
                  {weekStats.sessions}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className={`w-4 h-4 ${goalProgress >= 100 ? 'text-emerald-400' : 'text-purple-400'}`} />
                <span className="text-sm font-medium text-white">This Week</span>
                {goalProgress >= 100 && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                    Goal Met!
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-xl font-bold text-white">{weekStats.sessions}/{weekStats.weeklyGoal}</p>
                  <p className="text-xs text-zinc-500">Sessions</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-purple-400">{weekStats.totalMinutes}</p>
                  <p className="text-xs text-zinc-500">Mat Minutes</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Session Timer (when active) */}
        <AnimatePresence>
          {(timerRunning || sessionTimer > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AnimatedCard className="bg-gradient-to-br from-purple-500/15 to-purple-700/5 border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Timer className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-purple-400 font-mono">
                        {formatTimer(sessionTimer)}
                      </p>
                      <p className="text-xs text-zinc-500">Session Timer</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconButton
                      icon={timerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      variant="ghost"
                      onClick={() => setTimerRunning(!timerRunning)}
                    />
                    <Button
                      size="sm"
                      onClick={stopTimerAndSetDuration}
                      icon={<Check className="w-4 h-4" />}
                    >
                      Use {Math.max(1, Math.round(sessionTimer / 60))}m
                    </Button>
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Start Mode */}
        {mode === 'quick' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Training Patterns */}
            {patterns.length > 0 ? (
              <AnimatedCard delay={0.1}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="font-display uppercase text-lg text-white">Your Training Patterns</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {patterns.slice(0, 3).map((pattern, index) => {
                    const sessionType = SESSION_TYPES.find(s => s.value === pattern.kind)
                    const intensityOption = INTENSITY_OPTIONS.find(i => i.value === pattern.commonIntensity)

                    return (
                      <motion.button
                        key={pattern.kind}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${sessionType?.gradient} border border-white/[0.07] hover:border-white/20 transition-all text-left group`}
                        onClick={() => handleQuickStart({
                          kind: pattern.kind,
                          duration: pattern.avgDuration,
                          intensity: pattern.commonIntensity
                        })}
                      >
                        <div className={`w-12 h-12 rounded-xl ${sessionType?.iconBg} flex items-center justify-center ${sessionType?.iconColor}`}>
                          {sessionType?.icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-white">{pattern.kind}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500">{pattern.avgDuration} min</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${intensityOption?.color} ${intensityOption?.textColor}`}>
                              {pattern.commonIntensity}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            Used {pattern.frequency}x • Last: {new Date(pattern.lastUsed).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                      </motion.button>
                    )
                  })}
                </div>
              </AnimatedCard>
            ) : (
              <AnimatedCard delay={0.1}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="font-display uppercase text-lg text-white">Quick Start</h3>
                </div>
                <p className="text-sm text-zinc-500 mb-4">
                  Select a session type to get started
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {SESSION_TYPES.map((sessionType, index) => (
                    <motion.button
                      key={sessionType.value}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${sessionType.gradient} border border-white/[0.07] hover:border-white/20 transition-all text-left group`}
                      onClick={() => handleQuickStart({
                        kind: sessionType.value,
                        duration: sessionType.suggestedDuration,
                        intensity: sessionType.suggestedIntensity
                      })}
                    >
                      <div className={`w-12 h-12 rounded-xl ${sessionType.iconBg} flex items-center justify-center ${sessionType.iconColor}`}>
                        {sessionType.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{sessionType.label}</p>
                        <p className="text-xs text-zinc-500">{sessionType.description}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {sessionType.suggestedDuration} min • {sessionType.suggestedIntensity}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </AnimatedCard>
            )}
          </motion.div>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Date/Time */}
            <AnimatedCard delay={0.05}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-purple-400" />
                <h3 className="font-display uppercase text-lg text-white">When did you train?</h3>
              </div>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-purple-500 focus:outline-none transition-colors"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </AnimatedCard>

            {/* Session Type */}
            <AnimatedCard delay={0.1}>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-purple-400" />
                <h3 className="font-display uppercase text-lg text-white">Training Type</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SESSION_TYPES.map((sessionType) => (
                  <button
                    key={sessionType.value}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      kind === sessionType.value
                        ? `bg-gradient-to-br ${sessionType.activeGradient} ${sessionType.borderColor}`
                        : `bg-surface/50 border-white/[0.07] hover:border-white/20`
                    }`}
                    onClick={() => handleSessionTypeSelect(sessionType)}
                  >
                    <div className={`w-10 h-10 rounded-lg ${sessionType.iconBg} flex items-center justify-center mx-auto mb-2 ${sessionType.iconColor}`}>
                      {sessionType.icon}
                    </div>
                    <p className="font-medium text-sm text-white">{sessionType.label}</p>
                  </button>
                ))}
              </div>
            </AnimatedCard>

            {/* Duration */}
            <AnimatedCard delay={0.15}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h3 className="font-display uppercase text-lg text-white">Duration</h3>
                </div>
                {!timerRunning && sessionTimer === 0 && (
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium hover:bg-purple-500/30 transition-colors"
                    onClick={() => setTimerRunning(true)}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    Start Timer
                  </button>
                )}
              </div>

              {/* Duration Presets */}
              <div className="grid grid-cols-6 gap-2 mb-4">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    className={`py-3 rounded-lg text-center transition-all ${
                      duration === preset
                        ? 'bg-purple-500 text-white font-medium'
                        : 'bg-surface/50 text-zinc-500 hover:bg-surface-elevated hover:text-white'
                    }`}
                    onClick={() => setDuration(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Custom Duration */}
              <div className="flex items-center gap-3">
                <button
                  className="w-12 h-12 rounded-xl bg-surface-elevated text-white font-bold hover:bg-surface-pressed transition-colors"
                  onClick={() => setDuration(Math.max(5, duration - 15))}
                >
                  -15
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    min="5"
                    max="600"
                    className="w-full text-center text-2xl font-bold bg-transparent text-white focus:outline-none"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value || 60))}
                  />
                  <p className="text-xs text-zinc-500 mt-1">minutes</p>
                </div>
                <button
                  className="w-12 h-12 rounded-xl bg-surface-elevated text-white font-bold hover:bg-surface-pressed transition-colors"
                  onClick={() => setDuration(Math.min(600, duration + 15))}
                >
                  +15
                </button>
              </div>
            </AnimatedCard>

            {/* Intensity */}
            <AnimatedCard delay={0.2}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <h3 className="font-display uppercase text-lg text-white">Intensity</h3>
              </div>
              <div className="space-y-2">
                {INTENSITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      intensity === option.value
                        ? `${option.activeColor} ${option.borderColor} text-white`
                        : `${option.color} border-transparent hover:border-white/10`
                    }`}
                    onClick={() => setIntensity(option.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${intensity === option.value ? 'text-white' : option.textColor}`}>
                          {option.label}
                        </p>
                        <p className={`text-sm ${intensity === option.value ? 'text-zinc-200' : 'text-zinc-500'}`}>
                          {option.description}
                        </p>
                      </div>
                      {intensity === option.value && (
                        <Check className="w-5 h-5 text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </AnimatedCard>

            {/* Notes */}
            <AnimatedCard delay={0.25}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h3 className="font-display uppercase text-lg text-white">Notes</h3>
                </div>
                <button
                  className="text-xs text-purple-400 hover:text-purple-300"
                  onClick={() => setShowNotesSheet(true)}
                >
                  Templates
                </button>
              </div>
              <textarea
                className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                placeholder="Techniques practiced, key insights..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </AnimatedCard>
          </motion.div>
        )}

        {/* Session Preview (in quick mode after selection) */}
        {mode === 'quick' && kind && (
          <AnimatedCard delay={0.2} className={`bg-gradient-to-br ${selectedSessionType?.gradient} border-l-4 ${selectedSessionType?.borderColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <Check className="w-5 h-5 text-purple-400" />
              <h3 className="font-display uppercase text-lg text-white">Session Ready</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`w-10 h-10 rounded-lg ${selectedSessionType?.iconBg} flex items-center justify-center mx-auto mb-2 ${selectedSessionType?.iconColor}`}>
                  {selectedSessionType?.icon}
                </div>
                <p className="text-xs text-zinc-500">{kind}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{duration}</p>
                <p className="text-xs text-zinc-500">Minutes</p>
              </div>
              <div>
                <div className={`w-10 h-10 rounded-lg ${INTENSITY_OPTIONS.find(i => i.value === intensity)?.color} flex items-center justify-center mx-auto mb-2`}>
                  {intensity === 'low' ? <span className="text-emerald-400 font-bold">L</span> :
                   intensity === 'medium' ? <span className="text-amber-400 font-bold">M</span> :
                   <span className="text-red-400 font-bold">H</span>}
                </div>
                <p className="text-xs text-zinc-500 capitalize">{intensity}</p>
              </div>
            </div>
            {notes && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-zinc-500">{notes}</p>
              </div>
            )}
            <button
              className="mt-3 text-xs text-purple-400 hover:text-purple-300"
              onClick={() => setMode('manual')}
            >
              Edit Details
            </button>
          </AnimatedCard>
        )}
      </div>

      {/* Sticky Save Button */}
      <AnimatePresence>
        {canSave && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent px-4 pt-4"
            style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-lg mx-auto flex gap-2">
              <Button
                fullWidth
                size="lg"
                loading={isLoading}
                onClick={saveSession}
                className="bg-gradient-to-r from-red-500 to-purple-600 hover:from-red-600 hover:to-purple-700 shadow-lg shadow-purple-500/30"
              >
                Save {kind} ({duration} min{demo ? ' • Offline' : ''})
              </Button>
              <IconButton
                icon={<X className="w-5 h-5" />}
                variant="default"
                className="!rounded-2xl !w-14 !h-14"
                onClick={() => router.push('/dashboard')}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Templates Sheet */}
      <BottomSheet
        isOpen={showNotesSheet}
        onClose={() => setShowNotesSheet(false)}
        title="Note Templates"
      >
        <div className="space-y-2 py-4">
          {NOTE_TEMPLATES.map((template, index) => (
            <button
              key={index}
              className="w-full text-left p-4 bg-surface-elevated rounded-xl hover:bg-surface-pressed transition-colors"
              onClick={() => {
                setNotes(notes ? `${notes}\n${template}` : template)
                setShowNotesSheet(false)
              }}
            >
              <p className="text-white">{template}</p>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
