'use client'

/**
 * Tiny inline SVG trend line. Normalizes the series to the viewbox and
 * pads flat lines so they render mid-height instead of on an edge.
 */
export function Sparkline({
  data,
  width = 72,
  height = 24,
  stroke = '#10B981',
  strokeWidth = 1.5,
  className = '',
}: {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
  className?: string
}) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = strokeWidth

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2)
      const y = pad + (1 - (v - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const last = data[data.length - 1]
  const lastX = width - pad
  const lastY = pad + (1 - (last - min) / range) * (height - pad * 2)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  )
}

export default Sparkline
