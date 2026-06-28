'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  Flame,
  TrendingUp,
  FileText,
  X,
  Plus,
  Dumbbell,
  Bike,
  Mountain,
  Users,
  Search,
  Sparkles,
  Activity
} from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { BottomSheet, Modal } from '@/components/ui/BottomSheet'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { useToast } from '@/components/Toast'
import { toDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { hapticSuccess } from '@/lib/haptics'
import { insertCardioSession } from '@/lib/api'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackgroundLogo from '@/components/BackgroundLogo'

interface CardioSession {
  activity: string
  duration_minutes?: number
  distance?: number
  distance_unit: 'miles' | 'km'
  intensity: 'low' | 'medium' | 'high'
  calories?: number
  notes?: string
}

interface WeekStats {
  sessions: number
  totalMinutes: number
  totalDistance: number
  totalCalories: number
}

const ACTIVITY_CATEGORIES = {
  'Machine Cardio': {
    icon: <Dumbbell className="w-5 h-5" />,
    activities: ['Treadmill', 'Elliptical', 'Stationary Bike', 'Rowing Machine', 'StairMaster', 'Arc Trainer'],
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-300'
  },
  'Outdoor': {
    icon: <Mountain className="w-5 h-5" />,
    activities: ['Running', 'Walking', 'Cycling', 'Swimming', 'Hiking', 'Rock Climbing'],
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-300'
  },
  'Sports': {
    icon: <Activity className="w-5 h-5" />,
    activities: ['Basketball', 'Soccer', 'Tennis', 'Volleyball', 'Pickup Sports', 'Martial Arts'],
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-300'
  },
  'Classes': {
    icon: <Users className="w-5 h-5" />,
    activities: ['Spin Class', 'Yoga', 'Pilates', 'Dance Class', 'Aerobics', 'CrossFit'],
    gradient: 'from-emerald-500/20 to-emerald-700/10',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-300'
  }
}

const INTENSITY_OPTIONS = [
  {
    value: 'low' as const,
    label: 'Low',
    description: 'Easy pace, conversational',
    color: 'bg-emerald-500/10',
    activeColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60'
  },
  {
    value: 'medium' as const,
    label: 'Medium',
    description: 'Steady effort, breathing harder',
    color: 'bg-amber-500/10',
    activeColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/60'
  },
  {
    value: 'high' as const,
    label: 'High',
    description: 'All out effort, HIIT',
    color: 'bg-red-500/10',
    activeColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/60'
  }
]

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90]

// Circular timer progress
function TimerRing({ progress, size = 200, strokeWidth = 8 }: {
  progress: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

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
        stroke="url(#gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Progress ring for week stats
function ProgressRing({ progress, size = 60, strokeWidth = 5, color = '#10b981' }: {
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

export default function CardioPage() {
  const router = useRouter()
  const toast = useToast()
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [performedAt, setPerformedAt] = useState<string>(() => toDatetimeLocal())
  const [session, setSession] = useState<CardioSession>({
    activity: '',
    distance_unit: 'miles',
    intensity: 'medium'
  })

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [customActivity, setCustomActivity] = useState('')
  const [showActivitySheet, setShowActivitySheet] = useState(false)
  const [weekStats, setWeekStats] = useState<WeekStats>({ sessions: 0, totalMinutes: 0, totalDistance: 0, totalCalories: 0 })

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [targetDuration, setTargetDuration] = useState(30) // Default target 30 mins

  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Auth check and load data
  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      await loadWeekStats()
      setLoading(false)
    })()
  }, [])

  // Refetch when data changes anywhere or the tab regains focus
  useDataRefresh(() => {
    if (!demo && !loading) loadWeekStats()
  })

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning])

  async function loadWeekStats() {
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const weekStart = new Date()
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())

      const { data: sessions } = await supabase
        .from('cardio_sessions')
        .select('duration_minutes, distance, calories')
        .eq('user_id', userId)
        .gte('performed_at', weekStart.toISOString())

      if (sessions) {
        setWeekStats({
          sessions: sessions.length,
          totalMinutes: sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
          totalDistance: sessions.reduce((sum, s) => sum + (s.distance || 0), 0),
          totalCalories: sessions.reduce((sum, s) => sum + (s.calories || 0), 0)
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatTimeDisplay(seconds: number) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function handleActivitySelect(activity: string) {
    setSession(prev => ({ ...prev, activity }))
    setShowActivitySheet(false)
    setSelectedCategory('')
  }

  function handleCustomActivitySubmit() {
    if (customActivity.trim()) {
      setSession(prev => ({ ...prev, activity: customActivity.trim() }))
      setCustomActivity('')
      setShowActivitySheet(false)
    }
  }

  function stopTimerAndSetDuration() {
    setTimerRunning(false)
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60))
    setSession(prev => ({ ...prev, duration_minutes: minutes }))
    toast.success(`Duration set to ${minutes} minutes`)
  }

  function resetTimer() {
    setTimerRunning(false)
    setElapsedSeconds(0)
  }

  async function handleSave() {
    if (demo) { toast.warning('Sign in to save your own sessions'); return }
    const userId = await getActiveUserId()
    if (!userId) {
      toast.error('Please sign in to save cardio sessions')
      return
    }

    if (!session.activity.trim()) {
      toast.warning('Please select or enter an activity')
      return
    }

    setSaving(true)
    try {
      const sessionData = {
        user_id: userId,
        activity: session.activity,
        duration_minutes: session.duration_minutes || null,
        distance: session.distance || null,
        distance_unit: session.distance_unit,
        intensity: session.intensity,
        calories: session.calories || null,
        notes: session.notes?.trim() || null,
        performed_at: datetimeLocalToISO(performedAt)
      }

      await insertCardioSession(sessionData)

      hapticSuccess()
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save cardio session')
    } finally {
      setSaving(false)
    }
  }

  function handleFinish() {
    setShowSuccessModal(false)
    router.push('/dashboard')
  }

  const timerProgress = targetDuration > 0 ? (elapsedSeconds / (targetDuration * 60)) * 100 : 0
  const canSave = session.activity.trim().length > 0

  if (loading) {
    return (
      <div className="relative min-h-screen bg-brand-dark p-4 pb-24 space-y-4">
        <BackgroundLogo />
        <Skeleton variant="rectangular" className="h-10 w-48" />
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-48" />
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
              <h1 className="text-4xl font-display uppercase bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
                Cardio Session
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">Track your cardio workout</p>
            </div>
            <Link href="/history" className="text-sm text-emerald-400 hover:text-emerald-300">
              History
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Week Stats Card */}
        <AnimatedCard delay={0} className="overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="relative">
              <ProgressRing
                progress={(weekStats.sessions / 4) * 100}
                size={60}
                strokeWidth={5}
                color="#10b981"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-emerald-400">{weekStats.sessions}</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-2">This Week</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-white">{weekStats.totalMinutes}</p>
                  <p className="text-xs text-zinc-500">mins</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{weekStats.totalDistance.toFixed(1)}</p>
                  <p className="text-xs text-zinc-500">mi</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{weekStats.totalCalories}</p>
                  <p className="text-xs text-zinc-500">cal</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Activity Selection */}
        <AnimatedCard delay={0.05}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="font-display uppercase text-lg text-white">Activity</h3>
            </div>
          </div>

          {!session.activity ? (
            <div className="space-y-3">
              {/* Category Quick Select */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACTIVITY_CATEGORIES).map(([category, data]) => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category)
                      setShowActivitySheet(true)
                    }}
                    className={`p-4 rounded-xl bg-gradient-to-r ${data.gradient} border border-white/[0.07] hover:border-white/20 transition-all text-left group`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${data.iconBg} flex items-center justify-center mb-2 ${data.iconColor}`}>
                      {data.icon}
                    </div>
                    <p className="font-medium text-sm text-white">{category}</p>
                    <p className="text-xs text-zinc-500">{data.activities.length} activities</p>
                  </button>
                ))}
              </div>

              {/* Custom Activity Button */}
              <button
                onClick={() => setShowActivitySheet(true)}
                className="w-full p-4 rounded-xl bg-surface/50 border border-white/[0.07] hover:border-white/20 transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-elevated flex items-center justify-center">
                  <Plus className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">Custom Activity</p>
                  <p className="text-xs text-zinc-500">Enter your own activity</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-emerald-700/10 border border-emerald-500/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{session.activity}</p>
                    <p className="text-xs text-zinc-500">Selected activity</p>
                  </div>
                </div>
                <button
                  onClick={() => setSession(prev => ({ ...prev, activity: '' }))}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </AnimatedCard>

        {/* Timer Card */}
        <AnimatePresence>
          {session.activity && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AnimatedCard delay={0.1} className="bg-gradient-to-br from-emerald-500/10 to-emerald-700/5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Session Timer</h3>
                </div>

                <div className="flex flex-col items-center py-4">
                  {/* Timer Ring */}
                  <div className="relative mb-4">
                    <TimerRing progress={Math.min(timerProgress, 100)} size={180} strokeWidth={8} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-4xl font-bold text-white font-mono">
                        {formatTimeDisplay(elapsedSeconds)}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {timerRunning ? 'Running' : elapsedSeconds > 0 ? 'Paused' : 'Ready'}
                      </p>
                    </div>
                  </div>

                  {/* Timer Controls */}
                  <div className="flex items-center gap-3">
                    <IconButton
                      icon={<RotateCcw className="w-5 h-5" />}
                      variant="ghost"
                      onClick={resetTimer}
                      label="Reset"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => timerRunning ? stopTimerAndSetDuration() : setTimerRunning(true)}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                        timerRunning
                          ? 'bg-red-500 hover:bg-red-600'
                          : 'bg-emerald-500 hover:bg-emerald-600'
                      }`}
                    >
                      {timerRunning ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-1" />
                      )}
                    </motion.button>
                    {elapsedSeconds > 0 && !timerRunning && (
                      <Button
                        size="sm"
                        onClick={stopTimerAndSetDuration}
                        icon={<Check className="w-4 h-4" />}
                      >
                        Use Time
                      </Button>
                    )}
                  </div>

                  {/* Target Duration */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Target:</span>
                    <div className="flex gap-1">
                      {[15, 30, 45, 60].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setTargetDuration(mins)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            targetDuration === mins
                              ? 'bg-emerald-500 text-white'
                              : 'bg-surface-elevated text-zinc-500 hover:bg-surface-pressed'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Details */}
        <AnimatePresence>
          {session.activity && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Date/Time */}
              <AnimatedCard delay={0.15}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">When</h3>
                </div>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none transition-colors"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                />
              </AnimatedCard>

              {/* Duration */}
              <AnimatedCard delay={0.2}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Duration (minutes)</h3>
                </div>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {DURATION_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setSession(prev => ({ ...prev, duration_minutes: preset }))}
                      className={`py-3 rounded-lg text-center transition-all ${
                        session.duration_minutes === preset
                          ? 'bg-emerald-500 text-white font-medium'
                          : 'bg-surface/50 text-zinc-500 hover:bg-surface-elevated'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white text-center text-xl font-bold focus:border-emerald-500 focus:outline-none"
                  value={session.duration_minutes || ''}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    duration_minutes: e.target.value ? Number(e.target.value) : undefined
                  }))}
                  placeholder="Custom duration"
                />
              </AnimatedCard>

              {/* Distance */}
              <AnimatedCard delay={0.25}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Distance</h3>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="flex-1 px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                    value={session.distance || ''}
                    onChange={(e) => setSession(prev => ({
                      ...prev,
                      distance: e.target.value ? Number(e.target.value) : undefined
                    }))}
                    placeholder="Optional"
                  />
                  <div className="flex bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
                    <button
                      className={`px-4 py-3 transition-colors ${
                        session.distance_unit === 'miles'
                          ? 'bg-emerald-500 text-white'
                          : 'text-zinc-500 hover:bg-surface-elevated'
                      }`}
                      onClick={() => setSession(prev => ({ ...prev, distance_unit: 'miles' }))}
                    >
                      mi
                    </button>
                    <button
                      className={`px-4 py-3 transition-colors ${
                        session.distance_unit === 'km'
                          ? 'bg-emerald-500 text-white'
                          : 'text-zinc-500 hover:bg-surface-elevated'
                      }`}
                      onClick={() => setSession(prev => ({ ...prev, distance_unit: 'km' }))}
                    >
                      km
                    </button>
                  </div>
                </div>
              </AnimatedCard>

              {/* Intensity */}
              <AnimatedCard delay={0.3}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Intensity</h3>
                </div>
                <div className="space-y-2">
                  {INTENSITY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSession(prev => ({ ...prev, intensity: option.value }))}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        session.intensity === option.value
                          ? `${option.activeColor} ${option.borderColor} text-white`
                          : `${option.color} border-transparent hover:border-white/10`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${session.intensity === option.value ? 'text-white' : option.textColor}`}>
                            {option.label}
                          </p>
                          <p className={`text-sm ${session.intensity === option.value ? 'text-zinc-200' : 'text-zinc-500'}`}>
                            {option.description}
                          </p>
                        </div>
                        {session.intensity === option.value && (
                          <Check className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </AnimatedCard>

              {/* Calories */}
              <AnimatedCard delay={0.35}>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Calories Burned</h3>
                </div>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                  value={session.calories || ''}
                  onChange={(e) => setSession(prev => ({
                    ...prev,
                    calories: e.target.value ? Number(e.target.value) : undefined
                  }))}
                  placeholder="Optional"
                />
              </AnimatedCard>

              {/* Notes */}
              <AnimatedCard delay={0.4}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display uppercase text-lg text-white">Notes</h3>
                </div>
                <textarea
                  className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
                  rows={3}
                  value={session.notes || ''}
                  onChange={(e) => setSession(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="How did the session feel?"
                />
              </AnimatedCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Save Button — always present, like BJJ */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent px-4 pt-4"
        style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <Button
            fullWidth
            size="lg"
            loading={saving}
            disabled={!canSave}
            onClick={handleSave}
            className="bg-gradient-to-r from-red-500 via-emerald-500 to-emerald-600 hover:from-red-600 hover:via-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
          >
            {canSave
              ? `Save ${session.activity}${session.duration_minutes ? ` (${session.duration_minutes} min)` : ''}`
              : 'Select an Activity'}
          </Button>
          <IconButton
            icon={<X className="w-5 h-5" />}
            variant="default"
            className="!rounded-2xl !w-14 !h-14"
            onClick={() => router.push('/dashboard')}
          />
        </div>
      </motion.div>

      {/* Activity Selection Sheet */}
      <BottomSheet
        isOpen={showActivitySheet}
        onClose={() => {
          setShowActivitySheet(false)
          setSelectedCategory('')
        }}
        title={selectedCategory || 'Select Activity'}
      >
        <div className="py-4 space-y-4">
          {/* Category Tabs */}
          {!selectedCategory && (
            <div className="space-y-2">
              {Object.entries(ACTIVITY_CATEGORIES).map(([category, data]) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="w-full p-4 rounded-xl bg-surface-elevated hover:bg-surface-pressed transition-colors flex items-center gap-3"
                >
                  <div className={`w-10 h-10 rounded-lg ${data.iconBg} flex items-center justify-center ${data.iconColor}`}>
                    {data.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white">{category}</p>
                    <p className="text-xs text-zinc-500">{data.activities.length} activities</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-500" />
                </button>
              ))}

              {/* Custom Input */}
              <div className="pt-4 border-t border-white/[0.07]">
                <p className="text-sm text-zinc-500 mb-2">Or enter custom activity</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none"
                    value={customActivity}
                    onChange={(e) => setCustomActivity(e.target.value)}
                    placeholder="Activity name..."
                    onKeyPress={(e) => e.key === 'Enter' && handleCustomActivitySubmit()}
                  />
                  <Button onClick={handleCustomActivitySubmit} disabled={!customActivity.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Activities in Category */}
          {selectedCategory && (
            <>
              <button
                onClick={() => setSelectedCategory('')}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to categories
              </button>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_CATEGORIES[selectedCategory as keyof typeof ACTIVITY_CATEGORIES].activities.map(activity => (
                  <button
                    key={activity}
                    onClick={() => handleActivitySelect(activity)}
                    className="p-4 rounded-xl bg-surface-elevated hover:bg-surface-pressed transition-colors text-left"
                  >
                    <p className="font-medium text-white">{activity}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={handleFinish}
      >
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mx-auto mb-4"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl font-display uppercase text-white mb-2">Workout Saved!</h2>
          <p className="text-zinc-500 mb-6">
            {session.activity}
            {session.duration_minutes ? ` • ${session.duration_minutes} min` : ''}
            {session.distance ? ` • ${session.distance} ${session.distance_unit}` : ''}
          </p>

          {/* Updated stats */}
          <div className="bg-surface-elevated rounded-xl p-4 mb-6">
            <p className="text-sm text-zinc-500 mb-2">This week&apos;s cardio</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{weekStats.sessions + 1}</p>
                <p className="text-xs text-zinc-500">Sessions</p>
              </div>
              <div className="w-px h-10 bg-surface-pressed" />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {weekStats.totalMinutes + (session.duration_minutes || 0)}
                </p>
                <p className="text-xs text-zinc-500">Minutes</p>
              </div>
            </div>
          </div>

          <Button fullWidth onClick={handleFinish}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  )
}
