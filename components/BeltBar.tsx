'use client'

import { beltStyle } from '@/lib/belt'

// A small BJJ belt graphic: fabric-colored bar with a rank bar holding stripes.
// Black belt keeps its traditional red rank bar.
export function BeltBar({
  belt,
  stripes = 0,
  className = '',
  height = 28,
}: {
  belt: string
  stripes?: number
  className?: string
  height?: number
}) {
  const s = beltStyle(belt)
  const n = Math.max(0, Math.min(4, stripes || 0))
  return (
    <div
      className={`relative rounded-md overflow-hidden border border-white/[0.12] ${className}`}
      style={{ backgroundColor: s.beltHex, height }}
      aria-label={`${s.label} belt, ${n} stripes`}
    >
      <div
        className="absolute top-0 bottom-0 flex items-center justify-center gap-1"
        style={{ right: '14%', width: '26%', backgroundColor: s.barHex }}
      >
        {Array.from({ length: n }).map((_, i) => (
          <span key={i} className="rounded-sm bg-white/90" style={{ width: 3, height: height * 0.5 }} />
        ))}
      </div>
    </div>
  )
}
