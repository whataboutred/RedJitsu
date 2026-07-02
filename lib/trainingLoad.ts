// Cross-training load model. Fuses strength + BJJ + cardio into one weekly load
// so a grappler who lifts AND rolls can see total stress and ramp/deload trends
// no single-modality app can show.
//
// Session-RPE style: load ≈ duration(min) × intensity factor. Strength sessions
// don't store duration, so we use a flat moderate estimate per session — good
// enough for the week-over-week *trend*, which is what matters for readiness.

const IFACTOR: Record<string, number> = { low: 3, medium: 6, high: 9 }
const STRENGTH_SESSION_LOAD = 270 // ~45 min at a moderate factor

export type LoadInputs = {
  workouts: { performed_at: string }[]
  bjj: { performed_at: string; duration_min: number; intensity: string | null }[]
  cardio: { performed_at: string; duration_minutes: number | null; intensity: string | null }[]
}

export type WeekLoad = {
  weekStart: Date
  label: string
  strength: number
  bjj: number
  cardio: number
  total: number
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay()) // Sunday start
  return x
}

export function computeWeeklyLoads(inputs: LoadInputs, weeks = 8): WeekLoad[] {
  const thisWeek = startOfWeek(new Date())
  const buckets: WeekLoad[] = []
  const index = new Map<number, WeekLoad>()

  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(thisWeek)
    ws.setDate(ws.getDate() - i * 7)
    const w: WeekLoad = {
      weekStart: ws,
      label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      strength: 0, bjj: 0, cardio: 0, total: 0,
    }
    buckets.push(w)
    index.set(ws.getTime(), w)
  }

  const bucketFor = (iso: string): WeekLoad | undefined =>
    index.get(startOfWeek(new Date(iso)).getTime())

  for (const w of inputs.workouts) {
    const b = bucketFor(w.performed_at)
    if (b) b.strength += STRENGTH_SESSION_LOAD
  }
  for (const s of inputs.bjj) {
    const b = bucketFor(s.performed_at)
    if (b) b.bjj += (s.duration_min || 0) * (IFACTOR[s.intensity ?? 'medium'] ?? 6)
  }
  for (const c of inputs.cardio) {
    const b = bucketFor(c.performed_at)
    if (b) b.cardio += (c.duration_minutes || 0) * (IFACTOR[c.intensity ?? 'medium'] ?? 6)
  }

  for (const w of buckets) w.total = Math.round(w.strength + w.bjj + w.cardio)
  return buckets
}

export type Readiness = {
  status: 'ramping' | 'steady' | 'light' | 'building'
  label: string
  note: string
}

// Compare this week's load against the trailing average (acute:chronic-ish).
export function readiness(weeks: WeekLoad[]): Readiness {
  if (weeks.length < 2) return { status: 'building', label: 'Building baseline', note: 'Log a few weeks to see your load trend.' }
  const current = weeks[weeks.length - 1].total
  const prior = weeks.slice(-5, -1).map((w) => w.total).filter((t) => t > 0)
  if (prior.length === 0) return { status: 'building', label: 'Building baseline', note: 'Keep logging to establish your normal load.' }
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length
  const ratio = avg > 0 ? current / avg : 1

  if (ratio >= 1.5) return { status: 'ramping', label: 'Ramping hard', note: 'Load is well above your recent norm. Prioritize sleep and food, and watch for niggles.' }
  if (ratio <= 0.6) return { status: 'light', label: 'Light week', note: 'A step down from your norm. Good if it is a planned deload; otherwise there is room to push.' }
  return { status: 'steady', label: 'Steady', note: 'Load is in line with your recent weeks. Sustainable training.' }
}
