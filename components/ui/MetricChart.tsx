'use client'

import { useId } from 'react'

// Lightweight SVG line+area chart for a single metric over time. No deps, matches
// the app's minimal style. Renders responsively via viewBox.
export function MetricChart({
  data,
  stroke = '#DC2626',
  height = 140,
}: {
  data: number[]
  stroke?: string
  height?: number
}) {
  const gid = useId()
  if (!data || data.length < 2) {
    return <div className="py-8 text-center text-xs text-zinc-500">Not enough sessions yet to chart.</div>
  }

  const W = 320
  const H = height
  const pad = 10
  const min = Math.min(...data)
  const max = Math.max(...data)
  const flat = max === min
  const range = max - min || 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
    // A flat series (steady weight) sits centered, not pinned to the baseline.
    const y = flat ? H / 2 : pad + (1 - (v - min) / range) * (H - 2 * pad)
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`
  const [lastX, lastY] = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <path d={area} fill={`url(#fill-${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="4" fill={stroke} />
      <circle cx={lastX} cy={lastY} r="7" fill={stroke} fillOpacity="0.25" />
    </svg>
  )
}
