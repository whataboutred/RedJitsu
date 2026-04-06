'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'

export const ProgressRing = memo(function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 4,
  color = '#ef4444',
  showLabel = false,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  showLabel?: boolean
}) {
  const clampedProgress = Math.max(0, Math.min(progress, 100))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (clampedProgress / 100) * circumference
  const isSmall = size <= 60

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${isSmall ? 'text-xs' : 'text-lg'}`}>
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  )
})
