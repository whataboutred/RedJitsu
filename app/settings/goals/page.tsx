'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Dumbbell, Target, Activity, Sparkles } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/Toast'
import { ensureProfile, upsertProfile } from '@/lib/api'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import BackgroundLogo from '@/components/BackgroundLogo'

function GoalSlider({
  icon,
  title,
  value,
  onChange,
  accent,
  text,
}: {
  icon: React.ReactNode
  title: string
  value: number
  onChange: (v: number) => void
  accent: string
  text: string
}) {
  return (
    <AnimatedCard>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-display uppercase text-lg text-white">{title}</h3>
      </div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-zinc-500">Sessions per week <span className="text-zinc-600">· 0 = off</span></p>
        <span className={`font-display text-2xl ${text}`}>{value === 0 ? 'Off' : value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={14}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 cursor-pointer"
        style={{ accentColor: accent }}
      />
    </AnimatedCard>
  )
}

export default function GoalsPage() {
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [weeklyGoal, setWeeklyGoal] = useState(4)
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState(2)
  const [cardioWeeklyGoal, setCardioWeeklyGoal] = useState(3)
  const [coachContext, setCoachContext] = useState('')

  useEffect(() => {
    ;(async () => {
      const userId = await getActiveUserId()
      if (!userId) { router.push('/login'); return }
      try {
        const p = await ensureProfile(userId)
        if (p) {
          setWeeklyGoal(p.weekly_goal ?? 4)
          setBjjWeeklyGoal(p.bjj_weekly_goal ?? 2)
          setCardioWeeklyGoal(p.cardio_weekly_goal ?? 3)
          setCoachContext(p.coach_context ?? '')
        }
      } catch (err) {
        console.error('Error loading goals:', err)
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (await isDemoVisitor()) { toast.warning('Sign in to set your goals'); return }
    const userId = await getActiveUserId()
    if (!userId) { toast.error('Please sign in again'); return }
    setSaving(true)
    try {
      await upsertProfile(userId, {
        weekly_goal: Math.min(14, Math.max(0, weeklyGoal)),
        bjj_weekly_goal: Math.min(14, Math.max(0, bjjWeeklyGoal)),
        cardio_weekly_goal: Math.min(14, Math.max(0, cardioWeeklyGoal)),
        coach_context: coachContext.trim() || null,
      })
      toast.success('Goals saved!')
      setTimeout(() => router.push('/settings'), 400)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-brand-dark pb-32">
      <BackgroundLogo />

      {/* Header */}
      <div className="border-b border-red-500/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display uppercase text-white leading-none">Goals</h1>
            <p className="text-sm text-zinc-500 mt-1">Your weekly targets</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-4 text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="p-4 space-y-4">
          <GoalSlider
            icon={<Dumbbell className="w-5 h-5 text-red-400" />}
            title="Strength Goal"
            value={weeklyGoal}
            onChange={setWeeklyGoal}
            accent="#DC2626"
            text="text-red-400"
          />
          <GoalSlider
            icon={<Target className="w-5 h-5 text-purple-400" />}
            title="BJJ Goal"
            value={bjjWeeklyGoal}
            onChange={setBjjWeeklyGoal}
            accent="#7C3AED"
            text="text-purple-400"
          />
          <GoalSlider
            icon={<Activity className="w-5 h-5 text-emerald-400" />}
            title="Cardio Goal"
            value={cardioWeeklyGoal}
            onChange={setCardioWeeklyGoal}
            accent="#10B981"
            text="text-emerald-400"
          />

          {/* AI Coach Context */}
          <AnimatedCard>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <h3 className="font-display uppercase text-lg text-white">AI Coach Context</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Tell the AI coach about your goals, injuries, or anything else it should factor
              into your insights — e.g. &quot;cutting until August, left shoulder impingement,
              prepping for my first BJJ competition.&quot;
            </p>
            <textarea
              value={coachContext}
              onChange={(e) => setCoachContext(e.target.value.slice(0, 1000))}
              placeholder="Your goals, injuries, schedule constraints…"
              className="w-full h-28 bg-surface border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 outline-none resize-none transition-all duration-200 focus:border-brand-red focus:ring-2 focus:ring-brand-red/25"
            />
            <p className="mt-1.5 text-xs text-zinc-600 text-right">{coachContext.length}/1000</p>
          </AnimatedCard>
        </div>
      )}

      {/* Sticky Save */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent p-4"
        style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-lg mx-auto">
          <Button fullWidth size="lg" loading={saving} onClick={save}>
            Save Goals
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
