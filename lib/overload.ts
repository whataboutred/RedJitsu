// Progressive-overload targets via double progression: work up to the top of
// a rep range at a given weight, then add the smallest sensible increment and
// drop back to the bottom of the range. Pure functions — no I/O.

export type PrevSet = { weight: number; reps: number }
export type RepRange = { min: number; max: number }

export type OverloadTarget = {
  kind: 'add-weight' | 'add-reps' | 'bodyweight-reps' | 'deload'
  weight: number // 0 for bodyweight
  reps: number
  reason: string
}

// Sensible default for hypertrophy-style training when the exercise has no
// program-defined rep scheme.
export const DEFAULT_REP_RANGE: RepRange = { min: 8, max: 12 }

// Parse a program template's default_reps ("8-12", "10", 10, "6–8") into a
// range. Time-based schemes ("45-60s") and anything unparseable return null.
export function parseRepRange(defaultReps?: string | number | null): RepRange | null {
  if (defaultReps === null || defaultReps === undefined || defaultReps === '') return null
  const trimmed = String(defaultReps).trim()
  const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (range) {
    const min = Number(range[1])
    const max = Number(range[2])
    return min > 0 && max >= min && max <= 50 ? { min, max } : null
  }
  const single = trimmed.match(/^(\d+)$/)
  if (single) {
    const n = Number(single[1])
    return n > 0 && n <= 50 ? { min: n, max: n } : null
  }
  return null
}

// Smallest practical jump by equipment. Barbells/dumbbells move in full
// plates/handles (kg dumbbell racks commonly step 2.0); cables, machines,
// and unknowns get the micro step.
export function weightIncrement(category: string | undefined, unit: 'lb' | 'kg'): number {
  if (unit === 'kg') {
    if (category === 'barbell') return 2.5
    if (category === 'dumbbell') return 2
    return 1.25
  }
  return category === 'barbell' || category === 'dumbbell' ? 5 : 2.5
}

/**
 * Suggest the next session's working target from the previous session's
 * working sets (warmups excluded by the caller).
 *
 * - Bodyweight (every set at weight 0): +1 rep over the best set.
 * - Three sessions without a new best e1RM (recentBestE1rms, newest first):
 *   deload ~10% and rebuild from the top of the range.
 * - All sets at the top weight reached the range max: add one increment,
 *   reset to the range bottom.
 * - Otherwise: same weight, one more rep than the weakest top-weight set
 *   (capped at the range max).
 */
export function suggestOverload(
  prevSets: PrevSet[],
  opts: {
    category?: string
    unit: 'lb' | 'kg'
    repRange?: RepRange | null
    recentBestE1rms?: number[] // per-session best e1RM, newest first
  }
): OverloadTarget | null {
  const working = prevSets.filter((s) => s.reps > 0)
  if (working.length === 0) return null
  const range = opts.repRange ?? DEFAULT_REP_RANGE

  if (working.every((s) => !s.weight)) {
    const best = Math.max(...working.map((s) => s.reps))
    return {
      kind: 'bodyweight-reps',
      weight: 0,
      reps: best + 1,
      reason: `Beat last session's ${best} reps`,
    }
  }

  const top = Math.max(...working.map((s) => s.weight))

  // Stalled three sessions running? Back off ~10% and rebuild — grinding the
  // same weight a fourth time is how plateaus calcify.
  const bests = opts.recentBestE1rms
  if (bests && bests.length >= 3 && bests[0] > 0 && bests[0] <= bests[1] && bests[0] <= bests[2]) {
    const inc = weightIncrement(opts.category, opts.unit)
    const deloadWeight = Math.max(inc, Math.round((top * 0.9) / inc) * inc)
    return {
      kind: 'deload',
      weight: deloadWeight,
      reps: range.max,
      reason: `3 sessions without a new best — deload, own ${range.max}s, rebuild`,
    }
  }
  const topSets = working.filter((s) => s.weight === top)
  const weakestTopReps = Math.min(...topSets.map((s) => s.reps))

  if (weakestTopReps >= range.max) {
    const inc = weightIncrement(opts.category, opts.unit)
    return {
      kind: 'add-weight',
      weight: top + inc,
      reps: range.min,
      reason:
        range.min === range.max
          ? `Hit ${range.max} on every set — move up`
          : `Topped the range — add ${inc} ${opts.unit}, build back from ${range.min}`,
    }
  }

  const targetReps = Math.min(weakestTopReps + 1, range.max)
  return {
    kind: 'add-reps',
    weight: top,
    reps: targetReps,
    reason: `Same weight — get ${targetReps} on every set`,
  }
}
