'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { computeAchievements, type Achievement, type Tier } from '@/lib/achievements'
import { useToast } from '@/components/Toast'

const SEEN_KEY = 'rj-seen-achievements'

const TIER_RING: Record<Tier, string> = { gold: '#FBBF24', silver: '#D1D5DB', bronze: '#C2703D' }

// SVG fallback "patch" — shown until the rendered PNG badges exist in
// /public/badges/. Once those load, this is never used.
function FallbackBadge({ label, earned, tier }: { label: string; earned: boolean; tier: Tier }) {
  const ring = earned ? TIER_RING[tier] : '#3F3F46'
  const text = earned ? '#FFFFFF' : '#52525B'
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <defs>
        <linearGradient id="rj-badge-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0473D" />
          <stop offset="100%" stopColor="#A1151B" />
        </linearGradient>
      </defs>
      <rect x="11" y="11" width="78" height="78" rx="24" fill={earned ? 'url(#rj-badge-fill)' : '#1A1518'} stroke={ring} strokeWidth="5" />
      <text x="50" y="55" textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }} fontSize="34" fill={text}>
        {label}
      </text>
    </svg>
  )
}

// Rendered badge: a tier/type PNG with the count overlaid in the Anton font.
// Falls back to the SVG patch if the image isn't there yet.
function BadgeIcon({ a }: { a: Achievement }) {
  const [imgError, setImgError] = useState(false)
  const type = a.group === 'Streaks' ? 'streak' : 'milestone'
  const num = a.label.replace('w', '')

  if (imgError) return <FallbackBadge label={a.label} earned={a.earned} tier={a.tier} />

  return (
    <div className="relative w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/badges/${type}-${a.tier}.png`}
        alt=""
        onError={() => setImgError(true)}
        className={`w-full h-full object-contain transition ${a.earned ? '' : 'grayscale opacity-40'}`}
      />
      <span
        className={`absolute left-0 right-0 -translate-y-1/2 flex items-center justify-center font-display italic text-lg leading-none ${type === 'streak' ? 'top-[60%]' : 'top-[53%]'} ${a.earned ? 'text-white' : 'text-zinc-400'}`}
        style={{ textShadow: '0 2px 6px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.95)' }}
      >
        {num}
      </span>
    </div>
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

  // Badges earned since the last visit get a one-time celebration (pop + glow + toast).
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

    // First run on this device: seed the baseline without celebrating existing badges.
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
        fresh.length === 1 ? `Badge unlocked — ${titles[0]}` : `${fresh.length} new badges unlocked!`
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
    <div className="space-y-9">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-display uppercase text-white">Achievements</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Earned by showing up</p>
        </div>
        <span className="text-sm text-zinc-500">
          <span className="font-display text-brand-red text-xl">{earnedCount}</span>
          <span className="text-zinc-600"> / {all.length}</span>
        </span>
      </div>

      {groups.map((g) => {
        const items = all.filter((a) => a.group === g)
        const earned = items.filter((i) => i.earned).length
        return (
          <section key={g}>
            <div className="flex items-center gap-3 mb-5">
              <h3 className="font-display uppercase text-lg text-white">{g}</h3>
              <span className="text-xs text-zinc-600">{earned}/{items.length}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-7">
              {items.map((a, i) => {
                const isNew = newlyEarned.has(a.id)
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.03 * i }}
                    className="flex flex-col items-center text-center"
                  >
                    <motion.div
                      className="w-[84px] h-[84px]"
                      animate={isNew ? { scale: [1, 1.18, 1] } : undefined}
                      transition={isNew ? { duration: 0.7, ease: 'easeOut', delay: 0.3 } : undefined}
                      style={
                        isNew
                          ? { filter: 'drop-shadow(0 0 12px rgba(220,38,38,0.8))' }
                          : a.earned
                            ? { filter: 'drop-shadow(0 0 8px rgba(220,38,38,0.35))' }
                            : undefined
                      }
                    >
                      <BadgeIcon a={a} />
                    </motion.div>
                    <span className={`mt-2 text-xs font-medium leading-tight ${a.earned ? 'text-white' : 'text-zinc-500'}`}>
                      {a.title}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
