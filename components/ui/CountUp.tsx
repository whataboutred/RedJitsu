'use client'

import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

/**
 * Animates a number from 0 up to `value` on mount (and whenever value changes).
 * Renders a plain <span>, so it inherits the parent's font, size, and color.
 * Honors iOS "Reduce Motion" — shows the final value immediately when set.
 */
export default function CountUp({
  value,
  decimals = 0,
  duration = 0.8,
  className = '',
}: {
  value: number
  decimals?: number
  duration?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    setDisplay(0)
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  return <span className={className}>{display.toFixed(decimals)}</span>
}
