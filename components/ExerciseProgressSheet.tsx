'use client'

import { TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MetricChart } from '@/components/ui/MetricChart'

export type ExercisePoint = { date: string; oneRepMax: number; maxWeight: number }

export type ExerciseDetail = {
  name: string
  unit: string
  points: ExercisePoint[]
}

export default function ExerciseProgressSheet({
  isOpen,
  onClose,
  exercise,
}: {
  isOpen: boolean
  onClose: () => void
  exercise: ExerciseDetail | null
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={exercise?.name ?? 'Exercise'}>
      {exercise && exercise.points.length > 0 ? (
        <ExerciseBody exercise={exercise} />
      ) : (
        <p className="py-8 text-center text-sm text-zinc-500">No progression data yet for this lift.</p>
      )}
    </BottomSheet>
  )
}

function ExerciseBody({ exercise }: { exercise: ExerciseDetail }) {
  const { unit, points } = exercise
  const oneRMs = points.map((p) => p.oneRepMax)
  const current = oneRMs[oneRMs.length - 1]
  const best = Math.max(...oneRMs)
  const first = oneRMs[0]
  const pct = first > 0 ? Math.round(((current - first) / first) * 100) : 0

  // Plateau: no strictly-new all-time best in the last 3 sessions (using the
  // FIRST time the max was reached, so a run of equal maxima counts as stalled).
  const bestIdx = oneRMs.indexOf(best)
  const plateau = points.length >= 4 && bestIdx <= points.length - 4

  const trendUp = pct > 0
  const trendFlat = pct === 0
  const trendColor = trendUp ? 'text-emerald-400' : trendFlat ? 'text-zinc-400' : 'text-red-400'
  const TrendIcon = trendUp ? TrendingUp : trendFlat ? Minus : TrendingDown

  const recent = [...points].slice(-8).reverse()

  return (
    <div className="space-y-5 pb-2">
      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Current e1RM" value={`${current}`} unit={unit} />
        <Stat label="Best e1RM" value={`${best}`} unit={unit} accent="text-amber-400" />
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
          <div className={`flex items-center justify-center gap-1 font-display text-2xl leading-none ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            {pct > 0 ? '+' : ''}{pct}%
          </div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">All-time</div>
        </div>
      </div>

      {/* e1RM chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-display uppercase tracking-wider text-zinc-400">Estimated 1RM</h4>
          <span className="text-[11px] text-zinc-600">{points.length} sessions</span>
        </div>
        <MetricChart data={oneRMs} stroke={trendUp ? '#34D399' : trendFlat ? '#A1A1AA' : '#F87171'} />
      </div>

      {plateau && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Plateau — your best on this lift was a few sessions ago. Consider a small load bump, a rep PR, or a deload before pushing again.</span>
        </div>
      )}

      {best === current && !plateau && points.length >= 3 && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-xs text-emerald-200">
          <Trophy className="w-4 h-4 flex-shrink-0" />
          <span>All-time best is your latest session. Momentum is on your side.</span>
        </div>
      )}

      {/* Recent sessions */}
      <div>
        <h4 className="text-xs font-display uppercase tracking-wider text-zinc-400 mb-2">Recent sessions</h4>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          {recent.map((p, i) => (
            <div
              key={`${p.date}-${i}`}
              className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-sm text-zinc-400">
                {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-white">{p.maxWeight} {unit}</span>
                <span className="text-sm font-medium text-zinc-300 w-16 text-right">e1RM {p.oneRepMax}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, unit, accent = 'text-white' }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
      <div className={`font-display text-2xl leading-none ${accent}`}>{value}</div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">{label} · {unit}</div>
    </div>
  )
}
