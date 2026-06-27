'use client'

import { motion } from 'framer-motion'
import { computeAchievements, type Achievement, type Tier } from '@/lib/achievements'
import { AnimatedCard } from '@/components/ui/Card'

// On-brand flat badge — a diamond (rotated rounded square) with the label
// upright in the center. Earned = red fill + tier-colored ring; locked = dim.
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
  const fill = earned ? '#DC2626' : '#161214'
  const text = earned ? '#FFFFFF' : '#52525B'

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect
        x="22"
        y="22"
        width="56"
        height="56"
        rx="14"
        transform="rotate(45 50 50)"
        fill={fill}
        stroke={ring}
        strokeWidth="3"
      />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        fontSize="25"
        fontWeight="800"
        fontStyle="italic"
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
  const all = computeAchievements({ totalWorkouts, streakWeeks })
  const earnedCount = all.filter((a) => a.earned).length
  const groups: Achievement['group'][] = ['Milestones', 'Streaks']

  return (
    <AnimatedCard delay={0.15}>
      <div className="flex items-end justify-between mb-5">
        <h3 className="text-xl font-bold tracking-tight text-white">Achievements</h3>
        <span className="text-sm text-zinc-500">
          {earnedCount} / {all.length} earned
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
                {items.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.03 * i }}
                    className={`flex flex-col items-center text-center ${
                      a.earned ? '' : 'opacity-45'
                    }`}
                  >
                    <div className="w-[72px] h-[72px]">
                      <AchievementBadge label={a.label} earned={a.earned} tier={a.tier} />
                    </div>
                    <span className="mt-1.5 text-xs font-medium text-white leading-tight">
                      {a.title}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </AnimatedCard>
  )
}
