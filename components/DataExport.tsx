'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'
import { Download, FileText, FileJson, Loader2 } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'

interface WorkoutExercise {
  display_name: string
  sets: { weight: number; reps: number; set_type: string; set_index: number }[]
}

interface Workout {
  id: string
  performed_at: string
  title: string
  note: string
  workout_exercises: WorkoutExercise[]
}

interface BjjSession {
  performed_at: string
  kind: string
  duration_min: number
  intensity: string
  notes: string
}

interface CardioSession {
  performed_at: string
  activity: string
  duration_minutes: number
  distance: number
  distance_unit: string
  intensity: string
  notes: string
  calories: number
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildCsv(
  workouts: Workout[],
  bjjSessions: BjjSession[],
  cardioSessions: CardioSession[]
): string {
  const lines: string[] = []

  // Workouts section
  lines.push('=== WORKOUTS ===')
  lines.push('Date,Title,Exercise,Set#,Weight,Reps,Type')
  for (const w of workouts) {
    for (const ex of w.workout_exercises ?? []) {
      for (const s of ex.sets ?? []) {
        lines.push(
          [
            w.performed_at,
            `"${(w.title ?? '').replace(/"/g, '""')}"`,
            `"${(ex.display_name ?? '').replace(/"/g, '""')}"`,
            s.set_index,
            s.weight ?? '',
            s.reps ?? '',
            s.set_type ?? '',
          ].join(',')
        )
      }
    }
  }

  lines.push('')

  // BJJ section
  lines.push('=== BJJ SESSIONS ===')
  lines.push('Date,Type,Duration(min),Intensity,Notes')
  for (const b of bjjSessions) {
    lines.push(
      [
        b.performed_at,
        b.kind ?? '',
        b.duration_min ?? '',
        b.intensity ?? '',
        `"${(b.notes ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    )
  }

  lines.push('')

  // Cardio section
  lines.push('=== CARDIO SESSIONS ===')
  lines.push('Date,Activity,Duration(min),Distance,Unit,Intensity,Calories,Notes')
  for (const c of cardioSessions) {
    lines.push(
      [
        c.performed_at,
        c.activity ?? '',
        c.duration_minutes ?? '',
        c.distance ?? '',
        c.distance_unit ?? '',
        c.intensity ?? '',
        c.calories ?? '',
        `"${(c.notes ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    )
  }

  return lines.join('\n')
}

export default function DataExport() {
  const [loading, setLoading] = useState<'csv' | 'json' | null>(null)
  const toast = useToast()

  async function fetchAllData() {
    const userId = await getActiveUserId()
    if (!userId) throw new Error('Not signed in')

    const [workoutsRes, bjjRes, cardioRes] = await Promise.all([
      supabase
        .from('workouts')
        .select(
          'id, performed_at, title, note, workout_exercises(display_name, sets(weight, reps, set_type, set_index))'
        )
        .eq('user_id', userId)
        .order('performed_at', { ascending: false }),
      supabase
        .from('bjj_sessions')
        .select('performed_at, kind, duration_min, intensity, notes')
        .eq('user_id', userId)
        .order('performed_at', { ascending: false }),
      supabase
        .from('cardio_sessions')
        .select(
          'performed_at, activity, duration_minutes, distance, distance_unit, intensity, notes, calories'
        )
        .eq('user_id', userId)
        .order('performed_at', { ascending: false }),
    ])

    if (workoutsRes.error) throw workoutsRes.error
    if (bjjRes.error) throw bjjRes.error
    if (cardioRes.error) throw cardioRes.error

    return {
      workouts: (workoutsRes.data ?? []) as Workout[],
      bjjSessions: (bjjRes.data ?? []) as BjjSession[],
      cardioSessions: (cardioRes.data ?? []) as CardioSession[],
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    setLoading(format)
    try {
      const { workouts, bjjSessions, cardioSessions } = await fetchAllData()

      if (format === 'csv') {
        const csv = buildCsv(workouts, bjjSessions, cardioSessions)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        triggerDownload(blob, `red-jitsu-export-${new Date().toISOString().slice(0, 10)}.csv`)
      } else {
        const data = {
          workouts,
          bjj_sessions: bjjSessions,
          cardio_sessions: cardioSessions,
          exported_at: new Date().toISOString(),
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        })
        triggerDownload(blob, `red-jitsu-export-${new Date().toISOString().slice(0, 10)}.json`)
      }

      toast.success(`Data exported as ${format.toUpperCase()} successfully!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setLoading(null)
    }
  }

  return (
    <AnimatedCard variant="default" padding="lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-red-500/10">
          <Download className="w-5 h-5 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-white">Export Your Data</h3>
      </div>

      <p className="text-sm text-zinc-400 mb-5">
        Download all your workouts, BJJ sessions, and cardio sessions. Choose
        CSV for spreadsheet compatibility or JSON for a complete data backup.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => handleExport('csv')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            bg-zinc-800 border border-white/10 text-white text-sm font-medium
            hover:bg-zinc-700 hover:border-red-500/30 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'csv' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 text-red-500" />
          )}
          Export CSV
        </button>

        <button
          onClick={() => handleExport('json')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            bg-zinc-800 border border-white/10 text-white text-sm font-medium
            hover:bg-zinc-700 hover:border-red-500/30 transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'json' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileJson className="w-4 h-4 text-red-500" />
          )}
          Export JSON
        </button>
      </div>
    </AnimatedCard>
  )
}
