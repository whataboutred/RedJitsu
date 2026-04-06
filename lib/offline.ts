'use client'

import localforage from 'localforage'
import { supabase } from './supabaseClient'

localforage.config({ name: 'ironlog' })

export type PendingWorkout = {
  tempId: string
  performed_at: string
  title?: string | null
  note?: string | null
  exercises: Array<{
    exercise_id: string
    name: string
    sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>
  }>
}

export const pendingKey = 'pending_workouts'

export async function savePendingWorkout(w: PendingWorkout) {
  const items = (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
  items.push(w)
  await localforage.setItem(pendingKey, items)
}

export async function getPendingWorkouts() {
  return (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
}

export async function clearPendingWorkouts() {
  await localforage.setItem(pendingKey, [])
}

export async function trySyncPending(userId: string): Promise<{ synced: number; failed: number }> {
  const items = await getPendingWorkouts()
  if (!items.length) return { synced: 0, failed: 0 }

  const failedItems: PendingWorkout[] = []
  let synced = 0

  for (const w of items) {
    try {
      const { data: workout, error } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          performed_at: w.performed_at,
          title: w.title ?? null,
          note: w.note ?? null,
        })
        .select('id')
        .single()

      if (error || !workout) {
        failedItems.push(w)
        continue
      }

      let exerciseFailed = false
      for (const ex of w.exercises) {
        const { data: wex, error: wexErr } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: workout.id, exercise_id: ex.exercise_id, display_name: ex.name })
          .select('id')
          .single()
        if (wexErr || !wex) {
          exerciseFailed = true
          continue
        }

        const rows = ex.sets.map((s, idx) => ({
          workout_exercise_id: wex.id,
          set_index: idx + 1,
          weight: s.weight,
          reps: s.reps,
          set_type: s.set_type,
        }))
        await supabase.from('sets').insert(rows)
      }

      if (exerciseFailed) {
        // Workout record was created but some exercises failed.
        // Can't re-queue (would create duplicate workout), so count as partial sync.
        // The user will see "⚠️ No data" on the incomplete exercises in history.
      }
      synced++  // Workout was created — even if partial, don't re-queue
    } catch {
      failedItems.push(w)
    }
  }

  // Keep failed items for retry on next sync, clear only successful ones
  await localforage.setItem(pendingKey, failedItems)
  return { synced, failed: failedItems.length }
}
