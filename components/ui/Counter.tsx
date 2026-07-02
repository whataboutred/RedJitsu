'use client'

// Small +/- number stepper used for BJJ roll/sub counters.
export function Counter({
  label,
  value,
  onChange,
  accent = 'text-white',
}: {
  label: string
  value: number
  onChange: (n: number) => void
  accent?: string
}) {
  return (
    <div className="rounded-xl bg-surface border border-white/[0.07] p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">{label}</p>
      <div className="flex items-center justify-between gap-1">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-lg bg-surface-elevated text-white hover:bg-surface-pressed">−</button>
        <span className={`font-display text-xl leading-none ${accent}`}>{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-surface-elevated text-white hover:bg-surface-pressed">+</button>
      </div>
    </div>
  )
}
