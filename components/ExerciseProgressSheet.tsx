'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MetricChart } from '@/components/ui/MetricChart'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { estimated1RM } from '@/lib/formulas'
import { localWeekStartKey } from '@/lib/dateUtils'

export type ExercisePoint = { date: string; oneRepMax: number; maxWeight: number }

export type ExerciseDetail = {
  name: string
  unit: string
  points: ExercisePoint[]
}

type WindowKey = '90d' | '1y' | 'all'
const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
]

// Session points for one exercise over a window. 'all' buckets by week
// (best e1RM per week) so multi-year charts stay readable and bounded.
async function fetchPoints(exerciseId: string, win: WindowKey): Promise<ExercisePoint[]> {
  const userId = await getActiveUserId()
  if (!userId) return []

  let q = supabase
    .from('workout_exercises')
    .select('workout_id, workouts!inner(user_id, performed_at), sets(weight, reps, set_type, completed)')
    .eq('exercise_id', exerciseId)
    .eq('workouts.user_id', userId)
  if (win === '1y') {
    q = q.gte('workouts.performed_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
  }
  const { data } = await q

  const byKey = new Map<string, ExercisePoint>()
  for (const row of (data ?? []) as any[]) {
    const performedAt = row.workouts?.performed_at
    if (!performedAt) continue
    const working = (row.sets ?? []).filter(
      (s: any) => s.set_type === 'working' && s.completed !== false && s.weight > 0
    )
    if (working.length === 0) continue
    const maxWeight = Math.max(...working.map((s: any) => s.weight))
    const e1 = Math.max(...working.map((s: any) => estimated1RM(s.weight, s.reps)))
    const key = win === 'all' ? localWeekStartKey(performedAt) : String(performedAt).slice(0, 10)
    const prev = byKey.get(key)
    if (prev) {
      prev.maxWeight = Math.max(prev.maxWeight, maxWeight)
      prev.oneRepMax = Math.max(prev.oneRepMax, e1)
    } else {
      byKey.set(key, { date: key, maxWeight, oneRepMax: e1 })
    }
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export default function ExerciseProgressSheet({
  isOpen,
  onClose,
  exercise,
  exerciseId,
}: {
  isOpen: boolean
  onClose: () => void
  exercise: ExerciseDetail | null
  exerciseId?: string | null
}) {
  const [win, setWin] = useState<WindowKey>('90d')
  const [cache, setCache] = useState<Partial<Record<WindowKey, ExercisePoint[]>>>({})
  const [loading, setLoading] = useState(false)

  // Fresh exercise = fresh state
  useEffect(() => {
    setWin('90d')
    setCache({})
  }, [exerciseId])

  useEffect(() => {
    if (win === '90d' || !exerciseId || cache[win]) return
    let cancelled = false
    setLoading(true)
    fetchPoints(exerciseId, win).then((pts) => {
      if (cancelled) return
      setCache((c) => ({ ...c, [win]: pts }))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [win, exerciseId, cache])

  const points = win === '90d' ? exercise?.points ?? [] : cache[win] ?? []

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={exercise?.name ?? 'Exercise'}>
      {exercise ? (
        <div className="space-y-5 pb-2">
          {/* Window tabs — only useful once there's history beyond 90 days */}
          {exerciseId && (
            <div className="flex gap-1 -ml-1 -mt-1">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  onClick={() => setWin(w.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    win === w.key ? 'bg-white/[0.06] text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">Loading…</p>
          ) : points.length > 0 ? (
            <ExerciseBody unit={exercise.unit} points={points} weekly={win === 'all'} />
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">No progression data in this window.</p>
          )}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-zinc-500">No progression data yet for this lift.</p>
      )}
    </BottomSheet>
  )
}

function ExerciseBody({ unit, points, weekly }: { unit: string; points: ExercisePoint[]; weekly: boolean }) {
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
    <div className="space-y-5">
      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Current e1RM" value={`${current}`} unit={unit} />
        <Stat label="Best e1RM" value={`${best}`} unit={unit} accent="text-amber-400" />
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
          <div className={`flex items-center justify-center gap-1 font-display text-2xl leading-none ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            {pct > 0 ? '+' : ''}{pct}%
          </div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-zinc-500">Change</div>
        </div>
      </div>

      {/* e1RM chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-display uppercase tracking-wider text-zinc-400">Estimated 1RM</h4>
          <span className="text-[11px] text-zinc-600">{points.length} {weekly ? 'weeks' : 'sessions'}</span>
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
        <h4 className="text-xs font-display uppercase tracking-wider text-zinc-400 mb-2">
          {weekly ? 'Recent weeks (best set)' : 'Recent sessions'}
        </h4>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          {recent.map((p, i) => (
            <div
              key={`${p.date}-${i}`}
              className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <span className="text-sm text-zinc-400">
                {new Date(`${p.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  ...(weekly ? { year: '2-digit' } : {}),
                })}
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
