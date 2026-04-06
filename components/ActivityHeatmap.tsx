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

const TYPE_PRIORITY: Record<ActivityType, number> = {
  strength: 3,
  bjj: 2,
  cardio: 1,
}

function getColor(types: ActivityType[]): string {
  if (types.length === 0) return 'bg-zinc-800/50'

  const unique = [...new Set(types)]

  if (unique.length > 1) {
    // Mixed day — white-ish indicator
    return 'bg-white/70'
  }

  const type = unique[0]
  const count = types.length

  if (type === 'strength') return count >= 2 ? 'bg-red-500' : 'bg-red-900/40'
  if (type === 'bjj') return count >= 2 ? 'bg-purple-500' : 'bg-purple-900/40'
  return count >= 2 ? 'bg-emerald-500' : 'bg-emerald-900/40'
}

export default function ActivityHeatmap({ activities }: ActivityHeatmapProps) {
  const { grid, activeDays, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Build a map of date string -> activity types
    const activityMap = new Map<string, ActivityType[]>()
    for (const a of activities) {
      const key = a.date.slice(0, 10) // YYYY-MM-DD
      const list = activityMap.get(key) || []
      list.push(a.type)
      activityMap.set(key, list)
    }

    // Generate grid: 7 rows × 12 columns
    // Column 0 = oldest week, column 11 = most recent week
    // We start from (DAYS - 1) days ago and walk forward
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (DAYS - 1))
    // Adjust start to Sunday
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)

    const cells: { row: number; col: number; types: ActivityType[]; date: Date }[] = []
    const months: { col: number; label: string }[] = []
    const seenMonths = new Set<string>()
    let activeSet = new Set<string>()

    for (let col = 0; col < WEEKS; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(startDate)
        d.setDate(d.getDate() + col * 7 + row)
        const key = d.toISOString().slice(0, 10)
        const types = activityMap.get(key) || []

        if (types.length > 0) activeSet.add(key)

        cells.push({ row, col, types, date: d })

        // Track month labels (check row 0 for each column)
        if (row === 0) {
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`
          if (!seenMonths.has(monthKey)) {
            seenMonths.add(monthKey)
            months.push({
              col,
              label: d.toLocaleDateString('en-US', { month: 'narrow' }),
            })
          }
        }
      }
    }

    return {
      grid: cells,
      activeDays: activeSet.size,
      monthLabels: months,
    }
  }, [activities])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-4 h-4 text-zinc-400" />
        <h3 className="text-sm font-semibold text-white">Activity</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        {activeDays} day{activeDays !== 1 ? 's' : ''} active in last 12 weeks
      </p>

      {/* Heatmap */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div
          className="grid flex-shrink-0"
          style={{
            gridTemplateRows: 'repeat(7, 12px)',
            gap: '2px',
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="text-[9px] text-zinc-500 leading-[12px] pr-1 text-right"
              style={{ height: 12 }}
            >
              {DAY_LABELS[i] || ''}
            </div>
          ))}
        </div>

        {/* Grid area with month labels */}
        <div className="flex flex-col gap-1 overflow-hidden">
          {/* Month labels */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${WEEKS}, 12px)`,
              gap: '2px',
            }}
          >
            {Array.from({ length: WEEKS }, (_, col) => {
              const month = monthLabels.find((m) => m.col === col)
              return (
                <div
                  key={col}
                  className="text-[10px] text-zinc-500 leading-none text-center"
                  style={{ width: 12, overflow: 'visible' }}
                >
                  {month?.label || ''}
                </div>
              )
            })}
          </div>

          {/* Cells */}
          <div
            className="grid"
            style={{
              gridTemplateRows: 'repeat(7, 12px)',
              gridTemplateColumns: `repeat(${WEEKS}, 12px)`,
              gap: '2px',
              gridAutoFlow: 'column',
            }}
          >
            {grid.map((cell, i) => (
              <div
                key={i}
                className={`rounded-[2px] ${getColor(cell.types)}`}
                style={{ width: 12, height: 12 }}
                title={`${cell.date.toISOString().slice(0, 10)}: ${
                  cell.types.length > 0 ? cell.types.join(', ') : 'No activity'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-[1px] bg-red-500" /> Strength
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-[1px] bg-purple-500" /> BJJ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-[1px] bg-emerald-500" /> Cardio
        </span>
      </div>
    </motion.div>
  )
}
