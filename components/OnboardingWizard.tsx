'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Dumbbell, Target, Rocket, ChevronRight, ChevronLeft, Award } from 'lucide-react'
import { upsertProfile } from '@/lib/api'
import { supabase } from '@/lib/supabaseClient'
import { hapticSuccess } from '@/lib/haptics'
import { BELT_ORDER, BELTS, beltStyle } from '@/lib/belt'
import { BeltBar } from '@/components/BeltBar'

/**
 * First-run setup shown when a user has no profile row yet:
 * units → weekly goals → start training.
 */
export default function OnboardingWizard({
  userId,
  onComplete,
}: {
  userId: string
  onComplete: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [weeklyGoal, setWeeklyGoal] = useState(4)
  const [bjjGoal, setBjjGoal] = useState(2)
  const [cardioGoal, setCardioGoal] = useState(3)
  const [belt, setBelt] = useState('white')
  const [stripes, setStripes] = useState(0)

  async function finish(destination: 'workout' | 'dashboard') {
    setSaving(true)
    try {
      await upsertProfile(userId, {
        unit,
        weekly_goal: weeklyGoal,
        bjj_weekly_goal: bjjGoal,
        cardio_weekly_goal: cardioGoal,
        bjj_belt: belt,
        bjj_stripes: stripes,
      })
      // Seed the promotion timeline with their starting rank.
      await supabase.from('bjj_promotions').insert({ user_id: userId, belt, stripes }).then(() => {}, () => {})
      hapticSuccess()
      onComplete()
      if (destination === 'workout') router.push('/workouts/new')
    } catch (e) {
      console.error('Onboarding save failed:', e)
      // Let them through anyway — settings can fix it later
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  function GoalStepper({
    label,
    value,
    onChange,
    accent,
  }: {
    label: string
    value: number
    onChange: (v: number) => void
    accent: string
  }) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface-elevated px-4 py-3">
        <span className="text-sm text-zinc-300">{label}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            className="h-11 w-11 rounded-lg bg-surface-elevated text-lg text-zinc-300 hover:bg-surface-pressed"
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
          <span className={`w-8 text-center text-lg font-bold ${accent}`}>{value}</span>
          <button
            onClick={() => onChange(Math.min(14, value + 1))}
            className="h-11 w-11 rounded-lg bg-surface-elevated text-lg text-zinc-300 hover:bg-surface-pressed"
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
    )
  }

  const steps = [
    {
      icon: <Dumbbell className="h-8 w-8 text-brand-red" />,
      title: 'Welcome to Red Jitsu Training',
      body: (
        <>
          <p className="mb-6 text-sm text-zinc-400">
            Track your lifting, Jiu-Jitsu, and cardio in one place. First — how do you weigh
            your plates?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['lb', 'kg'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`rounded-xl border px-4 py-4 text-lg font-semibold transition-all ${
                  unit === u
                    ? 'border-brand-red bg-brand-red/15 text-white'
                    : 'border-white/10 bg-surface-elevated text-zinc-400 hover:border-white/25'
                }`}
              >
                {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: <Target className="h-8 w-8 text-amber-400" />,
      title: 'Set your weekly goals',
      body: (
        <>
          <p className="mb-6 text-sm text-zinc-400">
            Sessions per week you want to hit. Set anything to 0 to hide it from your
            dashboard — you can change these anytime in Settings.
          </p>
          <div className="space-y-3">
            <GoalStepper label="Strength workouts" value={weeklyGoal} onChange={setWeeklyGoal} accent="text-brand-red" />
            <GoalStepper label="BJJ sessions" value={bjjGoal} onChange={setBjjGoal} accent="text-bjj" />
            <GoalStepper label="Cardio sessions" value={cardioGoal} onChange={setCardioGoal} accent="text-cardio" />
          </div>
        </>
      ),
    },
    {
      icon: <Award className="h-8 w-8" style={{ color: beltStyle(belt).hex }} />,
      title: 'Your BJJ belt',
      body: (
        <>
          <p className="mb-5 text-sm text-zinc-400">
            Your belt personalizes the app — it sets your Jiu-Jitsu color and starts your promotion timeline. Not a grappler? Leave it on White.
          </p>
          <div className="space-y-2">
            {BELT_ORDER.map((b) => {
              const st = BELTS[b]
              const active = belt === b
              return (
                <button
                  key={b}
                  onClick={() => setBelt(b)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 transition-all ${active ? 'border-white/25 bg-white/[0.04]' : 'border-white/10 hover:border-white/20'}`}
                >
                  <BeltBar belt={b} stripes={active ? stripes : 0} className="w-24" />
                  <span className="text-sm font-medium" style={{ color: st.hex }}>{st.label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Stripes</span>
            <div className="flex gap-1.5 ml-auto">
              {[0, 1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setStripes(s)}
                  aria-label={`${s} stripes`}
                  className={`h-11 w-11 rounded-lg text-sm font-semibold transition-all ${stripes === s ? '' : 'bg-surface-elevated text-zinc-500 hover:text-white'}`}
                  style={stripes === s ? { backgroundColor: beltStyle(belt).hex, color: beltStyle(belt).onAccent } : undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </>
      ),
    },
    {
      icon: <Rocket className="h-8 w-8 text-emerald-400" />,
      title: "You're all set",
      body: (
        <p className="mb-2 text-sm text-zinc-400">
          Your dashboard tracks weekly consistency and streaks against these goals — and
          every new personal record gets celebrated. Best way to start? Log something.
        </p>
      ),
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-surface p-6"
      >
        {/* Step dots */}
        <div className="mb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-brand-red' : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.06]">
              {current.icon}
            </div>
            <h2 className="mb-3 text-center text-2xl font-display uppercase text-white">{current.title}</h2>
            <div className="text-center">{current.body}</div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="toggle flex items-center gap-1 px-4"
              disabled={saving}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {!isLast ? (
            <button onClick={() => setStep(step + 1)} className="btn flex-1">
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex flex-1 flex-col gap-2">
              <button onClick={() => finish('workout')} className="btn w-full" disabled={saving}>
                {saving ? 'Saving…' : 'Log My First Workout'}
              </button>
              <button
                onClick={() => finish('dashboard')}
                className="text-sm text-zinc-500 hover:text-zinc-300"
                disabled={saving}
              >
                Explore the dashboard first
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
