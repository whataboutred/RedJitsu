'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, MapPin, TrendingUp, Flame, FileText, Activity, Check, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import BackgroundLogo from '@/components/BackgroundLogo'
import { AnimatedCard } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { getCardioSession, updateCardioSession } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { isoToDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useToast } from '@/components/Toast'
import { isUuid } from '@/lib/validation'

type CardioSession = {
  activity: string
  duration_minutes?: number
  distance?: number
  distance_unit: 'miles' | 'km'
  intensity: 'low' | 'medium' | 'high'
  calories?: number
  notes?: string
}

// Same building blocks as the create page so edit looks identical.
const DURATION_PRESETS = [15, 20, 30, 45, 60, 90]
const INTENSITY_OPTIONS = [
  { value: 'low' as const, label: 'Low', description: 'Easy pace, conversational', color: 'bg-emerald-500/10', activeColor: 'bg-emerald-500/20', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/60' },
  { value: 'medium' as const, label: 'Medium', description: 'Steady effort, breathing harder', color: 'bg-amber-500/10', activeColor: 'bg-amber-500/20', textColor: 'text-amber-400', borderColor: 'border-amber-500/60' },
  { value: 'high' as const, label: 'High', description: 'All out effort, HIIT', color: 'bg-red-500/10', activeColor: 'bg-red-500/20', textColor: 'text-red-400', borderColor: 'border-red-500/60' },
]

export default function EditCardioPage() {
  const router = useRouter()
  const toast = useToast()
  const params = useParams()
  const cardioId = params.id as string

  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [performedAt, setPerformedAt] = useState<string>('')
  const [session, setSession] = useState<CardioSession>({
    activity: '',
    distance_unit: 'miles',
    intensity: 'medium',
  })

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (isDemo || !isUuid(cardioId)) {
        setNotFound(!isDemo)
        setLoading(false)
        return
      }
      const userId = await getActiveUserId()
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        const data = await getCardioSession(cardioId, userId)
        if (!data) {
          setNotFound(true)
        } else {
          setSession({
            activity: data.activity || '',
            duration_minutes: data.duration_minutes || undefined,
            distance: data.distance || undefined,
            distance_unit: data.distance_unit || 'miles',
            intensity: data.intensity || 'medium',
            calories: data.calories || undefined,
            notes: data.notes || '',
          })
          setPerformedAt(isoToDatetimeLocal(data.performed_at))
        }
      } catch (error) {
        console.error('Error loading cardio data:', error)
        toast.error('Failed to load cardio session')
        setNotFound(true)
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardioId])

  const update = (patch: Partial<CardioSession>) => setSession(prev => ({ ...prev, ...patch }))

  async function handleSave() {
    const userId = await getActiveUserId()
    if (!userId) { toast.warning('Please sign in to save cardio sessions'); return }
    if (!session.activity.trim()) { toast.warning('Please enter an activity'); return }

    setSaving(true)
    try {
      await updateCardioSession(cardioId, userId, {
        activity: session.activity,
        duration_minutes: session.duration_minutes || null,
        distance: session.distance || null,
        distance_unit: session.distance_unit,
        intensity: session.intensity,
        calories: session.calories || null,
        notes: session.notes?.trim() || null,
        performed_at: datetimeLocalToISO(performedAt),
      })
      toast.success('Cardio session updated')
      router.push('/history')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to update cardio session')
    } finally {
      setSaving(false)
    }
  }

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

  if (demo || notFound) {
    return (
      <div className="relative min-h-screen bg-brand-dark">
        <BackgroundLogo />
        <main className="relative z-10 p-4 max-w-xl mx-auto pt-10">
          <h1 className="text-2xl font-display uppercase text-white mb-2">
            {demo ? 'Demo mode' : 'Session not found'}
          </h1>
          <p className="text-zinc-400">
            {demo ? (
              <>This is a read-only demo. <Link href="/login" className="text-emerald-400 underline">Sign in</Link> to edit sessions.</>
            ) : (
              <>That cardio session doesn&apos;t exist. <Link href="/history" className="text-emerald-400 underline">Back to history</Link></>
            )}
          </p>
        </main>
      </div>
    )
  }

  const canSave = session.activity.trim().length > 0

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />
      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link
            href="/history"
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back to history"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-display uppercase bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              Edit Cardio
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">Update your session</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Activity */}
        <AnimatedCard delay={0}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display uppercase text-lg text-white">Activity</h3>
          </div>
          <input
            type="text"
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none transition-colors"
            value={session.activity}
            onChange={(e) => update({ activity: e.target.value })}
            placeholder="Activity name..."
          />
        </AnimatedCard>

        {/* When */}
        <AnimatedCard delay={0.05}>
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
        <AnimatedCard delay={0.1}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display uppercase text-lg text-white">Duration (minutes)</h3>
          </div>
          <div className="grid grid-cols-6 gap-2 mb-4">
            {DURATION_PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => update({ duration_minutes: preset })}
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
            onChange={(e) => update({ duration_minutes: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Custom duration"
          />
        </AnimatedCard>

        {/* Distance */}
        <AnimatedCard delay={0.15}>
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
              onChange={(e) => update({ distance: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Optional"
            />
            <div className="flex bg-surface rounded-xl border border-white/[0.07] overflow-hidden">
              {(['miles', 'km'] as const).map(u => (
                <button
                  key={u}
                  className={`px-4 py-3 transition-colors ${
                    session.distance_unit === u ? 'bg-emerald-500 text-white' : 'text-zinc-500 hover:bg-surface-elevated'
                  }`}
                  onClick={() => update({ distance_unit: u })}
                >
                  {u === 'miles' ? 'mi' : 'km'}
                </button>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Intensity */}
        <AnimatedCard delay={0.2}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display uppercase text-lg text-white">Intensity</h3>
          </div>
          <div className="space-y-2">
            {INTENSITY_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => update({ intensity: option.value })}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  session.intensity === option.value
                    ? `${option.activeColor} ${option.borderColor} text-white`
                    : `${option.color} border-transparent hover:border-white/10`
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${session.intensity === option.value ? 'text-white' : option.textColor}`}>{option.label}</p>
                    <p className={`text-sm ${session.intensity === option.value ? 'text-zinc-200' : 'text-zinc-500'}`}>{option.description}</p>
                  </div>
                  {session.intensity === option.value && <Check className="w-5 h-5 text-white" />}
                </div>
              </button>
            ))}
          </div>
        </AnimatedCard>

        {/* Calories */}
        <AnimatedCard delay={0.25}>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display uppercase text-lg text-white">Calories Burned</h3>
          </div>
          <input
            type="number"
            min="1"
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-emerald-500 focus:outline-none"
            value={session.calories || ''}
            onChange={(e) => update({ calories: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Optional"
          />
        </AnimatedCard>

        {/* Notes */}
        <AnimatedCard delay={0.3}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display uppercase text-lg text-white">Notes</h3>
          </div>
          <textarea
            className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none resize-none"
            rows={3}
            value={session.notes || ''}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="How did the session feel?"
          />
        </AnimatedCard>
      </div>

      {/* Sticky Save Bar — matches the create page */}
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
            Update Session
          </Button>
          <IconButton
            icon={<X className="w-5 h-5" />}
            variant="default"
            className="!rounded-2xl !w-14 !h-14"
            onClick={() => router.push('/history')}
          />
        </div>
      </motion.div>
    </div>
  )
}
