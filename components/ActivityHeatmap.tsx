'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'

type ActivityType = 'strength' | 'bjj' | 'cardio'

interface ActivityHeatmapProps {
  activities: Array<{ date: string; type: ActivityType }>
}

const WEEKS = 12
const DAYS = WEEKS * 7

const DAY_LABELS: Record<number, string> = { 1: 'M', 3: 'W', 5: 'F' }

function getColor(types: ActivityType[]): string {
  if (types.length === 0) return 'bg-surface-elevated/50'

  const unique = [...new Set(types)]

  if (unique.length > 1) return 'bg-white/70'

  const type = unique[0]
  const count = types.length

  if (type === 'strength') return count >= 2 ? 'bg-red-500' : 'bg-red-500/40'
  if (type === 'bjj') return count >= 2 ? 'bg-purple-500' : 'bg-purple-500/40'
  return count >= 2 ? 'bg-emerald-500' : 'bg-emerald-500/40'
}

export default function ActivityHeatmap({ activities }: ActivityHeatmapProps) {
  const { grid, activeDays, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activityMap = new Map<string, ActivityType[]>()
    for (const a of activities) {
      const key = a.date.slice(0, 10)
      const list = activityMap.get(key) || []
      list.push(a.type)
      activityMap.set(key, list)
    }

    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (DAYS - 1))
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)

    const cells: { row: number; col: number; types: ActivityType[]; date: Date }[] = []
    const months: { col: number; label: string }[] = []
    const seenMonths = new Set<string>()
    const activeSet = new Set<string>()

    for (let col = 0; col < WEEKS; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(startDate)
        d.setDate(d.getDate() + col * 7 + row)
        const key = d.toISOString().slice(0, 10)
        const types = activityMap.get(key) || []

        if (types.length > 0) activeSet.add(key)
        cells.push({ row, col, types, date: d })

        if (row === 0) {
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`
          if (!seenMonths.has(monthKey)) {
            seenMonths.add(monthKey)
            months.push({
              col,
              label: d.toLocaleDateString('en-US', { month: 'short' }),
            })
          }
        }
      }
    }

    return { grid: cells, activeDays: activeSet.size, monthLabels: months }
  }, [activities])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-surface/80 border border-white/[0.07] rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-white">Activity</h3>
        </div>
        <p className="text-xs text-zinc-500">
          {activeDays} day{activeDays !== 1 ? 's' : ''} active
        </p>
      </div>

      {/* Month labels row */}
      <div className="flex pl-6 mb-1">
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '3px' }}
        >
          {Array.from({ length: WEEKS }, (_, col) => {
            const month = monthLabels.find((m) => m.col === col)
            return (
              <div key={col} className="text-[10px] text-zinc-500 leading-none">
                {month?.label || ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col flex-shrink-0 w-5" style={{ gap: '3px' }}>
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="text-[10px] text-zinc-500 leading-none flex items-center justify-end"
              style={{ aspectRatio: '1' }}
            >
              {DAY_LABELS[i] || ''}
            </div>
          ))}
        </div>

        {/* Cells — fluid grid that fills available width */}
        <div
          className="flex-1 grid"
          style={{
            gridTemplateRows: 'repeat(7, 1fr)',
            gridTemplateColumns: `repeat(${WEEKS}, 1fr)`,
            gap: '3px',
            gridAutoFlow: 'column',
          }}
        >
          {grid.map((cell, i) => (
            <div
              key={i}
              className={`rounded-sm aspect-square ${getColor(cell.types)}`}
              title={`${cell.date.toLocaleDateString()}: ${
                cell.types.length > 0 ? cell.types.join(', ') : 'No activity'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" /> Strength
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-purple-500" /> BJJ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Cardio
        </span>
      </div>
    </motion.div>
  )
}
