'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { computeAchievements, type Achievement, type Tier } from '@/lib/achievements'
import { AnimatedCard } from '@/components/ui/Card'
import { useToast } from '@/components/Toast'

const SEEN_KEY = 'rj-seen-achievements'

// Shared gradient/shine defs (rendered once) so the badges get depth + gloss.
function BadgeDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="rj-badge-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0473D" />
          <stop offset="100%" stopColor="#A1151B" />
        </linearGradient>
        <radialGradient id="rj-badge-shine" cx="50%" cy="22%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

// On-brand "patch": tier-colored embroidered edge, dashed stitch, glossy
// red gradient + shine when earned, the label in the Anton display font.
function AchievementBadge({
  label,
  earned,
  tier,
}: {
  label: string
  earned: boolean
  tier: Tier
}) {
  const ring = earned
    ? tier === 'gold'
      ? '#FBBF24'
      : tier === 'silver'
        ? '#D1D5DB'
        : '#C2703D'
    : '#3F3F46'
  const text = earned ? '#FFFFFF' : '#52525B'
  const stitch = earned ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.1)'

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect
        x="11"
        y="11"
        width="78"
        height="78"
        rx="24"
        fill={earned ? 'url(#rj-badge-fill)' : '#1A1518'}
        stroke={ring}
        strokeWidth="5"
      />
      {earned && <rect x="11" y="11" width="78" height="78" rx="24" fill="url(#rj-badge-shine)" />}
      <rect
        x="20"
        y="20"
        width="60"
        height="60"
        rx="17"
        fill="none"
        stroke={stitch}
        strokeWidth="1.5"
        strokeDasharray="3.5 3.5"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
        fontSize="34"
        fill={text}
      >
        {label}
      </text>
    </svg>
  )
}

export default function Achievements({
  totalWorkouts,
  streakWeeks,
}: {
  totalWorkouts: number
  streakWeeks: number
}) {
  const toast = useToast()
  const all = computeAchievements({ totalWorkouts, streakWeeks })
  const earnedCount = all.filter((a) => a.earned).length
  const groups: Achievement['group'][] = ['Milestones', 'Streaks']

  // Patches earned since the last visit get a one-time celebration (pop + glow + toast).
  const [newlyEarned, setNewlyEarned] = useState<Set<string>>(new Set())

  useEffect(() => {
    const earnedIds = computeAchievements({ totalWorkouts, streakWeeks })
      .filter((a) => a.earned)
      .map((a) => a.id)

    let seen: unknown = null
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null')
    } catch {
      /* ignore */
    }

    // First run on this device: seed the baseline without celebrating existing patches.
    if (!Array.isArray(seen)) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(earnedIds))
      } catch {
        /* ignore */
      }
      return
    }

    const fresh = earnedIds.filter((id) => !(seen as string[]).includes(id))
    if (fresh.length > 0) {
      setNewlyEarned(new Set(fresh))
      const titles = computeAchievements({ totalWorkouts, streakWeeks })
        .filter((a) => fresh.includes(a.id))
        .map((a) => a.title)
      toast.success(
        fresh.length === 1 ? `Patch unlocked — ${titles[0]}` : `${fresh.length} new patches unlocked!`
      )
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(earnedIds))
      } catch {
        /* ignore */
      }
    }
    // toast is stable (from context); intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWorkouts, streakWeeks])

  return (
    <AnimatedCard delay={0.15}>
      <BadgeDefs />
      <div className="flex items-end justify-between mb-5">
        <h3 className="text-2xl font-display uppercase text-white">Achievements</h3>
        <span className="text-sm text-zinc-500">
          <span className="font-display text-brand-red text-base">{earnedCount}</span> / {all.length} earned
        </span>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const items = all.filter((a) => a.group === g)
          return (
            <div key={g} className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {g}
              </h4>
              <div className="grid grid-cols-3 gap-x-4 gap-y-5">
                {items.map((a, i) => {
                  const isNew = newlyEarned.has(a.id)
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.03 * i }}
                      className={`flex flex-col items-center text-center ${
                        a.earned ? '' : 'opacity-45'
                      }`}
                    >
                      <motion.div
                        className="w-[72px] h-[72px]"
                        animate={isNew ? { scale: [1, 1.2, 1] } : undefined}
                        transition={isNew ? { duration: 0.7, ease: 'easeOut', delay: 0.3 } : undefined}
                        style={
                          isNew
                            ? { filter: 'drop-shadow(0 0 10px rgba(220,38,38,0.75))' }
                            : a.earned
                              ? { filter: 'drop-shadow(0 0 5px rgba(220,38,38,0.4))' }
                              : undefined
                        }
                      >
                        <AchievementBadge label={a.label} earned={a.earned} tier={a.tier} />
                      </motion.div>
                      <span className="mt-1.5 text-xs font-medium text-white leading-tight">
                        {a.title}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </AnimatedCard>
  )
}
