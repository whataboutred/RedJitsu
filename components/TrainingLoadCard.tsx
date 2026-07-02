'use client'

import { Activity } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { computeWeeklyLoads, readiness, type LoadInputs } from '@/lib/trainingLoad'

const STATUS_STYLE: Record<string, string> = {
  ramping: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  steady: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  light: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  building: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
}

export function TrainingLoadCard({ inputs, bjjHex = '#8B5CF6' }: { inputs: LoadInputs; bjjHex?: string }) {
  const weeks = computeWeeklyLoads(inputs)
  const r = readiness(weeks)
  const max = Math.max(1, ...weeks.map((w) => w.total))
  const current = weeks[weeks.length - 1]
  const H = 96

  const hasAny = weeks.some((w) => w.total > 0)

  return (
    <AnimatedCard delay={0.05}>
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-5 h-5 text-brand-red" />
        <h3 className="font-display uppercase text-lg text-white">Training Load</h3>
        <span className="text-[11px] text-zinc-500 ml-auto">8 weeks · all disciplines</span>
      </div>

      {!hasAny ? (
        <p className="text-sm text-zinc-500 py-6 text-center">Log across strength, BJJ, and cardio to see your combined load.</p>
      ) : (
        <>
          <div className="flex items-end justify-between mt-2 mb-4">
            <div>
              <div className="font-display text-3xl text-white leading-none">{current.total.toLocaleString()}</div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-500 mt-1">This week&apos;s load</div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLE[r.status]}`}>{r.label}</span>
          </div>

          {/* Stacked weekly bars */}
          <div className="flex items-end gap-1.5" style={{ height: H }}>
            {weeks.map((w, i) => {
              const seg = (v: number) => Math.round((v / max) * H)
              const isCurrent = i === weeks.length - 1
              return (
                <div key={i} className={`flex-1 flex flex-col justify-end gap-px ${isCurrent ? '' : 'opacity-80'}`} title={`${w.label}: ${w.total}`}>
                  {seg(w.cardio) > 0 && <div style={{ height: seg(w.cardio), backgroundColor: '#10B981' }} className="rounded-t-sm" />}
                  {seg(w.bjj) > 0 && <div style={{ height: seg(w.bjj), backgroundColor: bjjHex }} />}
                  {seg(w.strength) > 0 && <div style={{ height: seg(w.strength), backgroundColor: '#DC2626' }} className="rounded-b-sm" />}
                  {w.total === 0 && <div className="h-1 rounded-sm bg-white/[0.06]" />}
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-zinc-600">
            <span>{weeks[0].label}</span>
            <span>This week</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#DC2626' }} />Strength</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bjjHex }} />BJJ</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#10B981' }} />Cardio</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed mt-3 pt-3 border-t border-white/[0.06]">{r.note}</p>
        </>
      )}
    </AnimatedCard>
  )
}
