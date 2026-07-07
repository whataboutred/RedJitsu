'use client'

import localforage from 'localforage'
import { saveWorkout, type WorkoutSavePayload } from '@/lib/api/workouts'

localforage.config({ name: 'redjitsu' })

/**
 * Offline workout queue. Items are full save_workout payloads whose client_id
 * makes replays idempotent: if a save reached the server but the response was
 * lost, retrying returns the existing workout instead of duplicating it. An
 * item either syncs completely (the RPC is transactional) or stays queued.
 */
export type PendingWorkout = WorkoutSavePayload & {
  client_id: string
  queued_at: string
  // Who queued it. The RPC writes to auth.uid(), so items queued by a
  // different account on this device must not drain into the current one.
  user_id?: string
}

export const pendingKey = 'pending_workouts_v2'
export const failedKey = 'failed_workouts_v1'

/** A queue item that failed with a non-retryable error, parked so it stops
 *  burning retries but the data is never silently discarded. */
export type FailedWorkout = PendingWorkout & {
  failed_at: string
  error: string
}

// Retryable failures are network-shaped; permanent ones are the server
// rejecting the payload itself (constraint/validation) — retrying those
// forever just wedges the queue.
function isPermanentError(err: any): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  const code = String(err?.code ?? '')
  if (/^(23|22|42)\d{3}$/.test(code) || code === 'P0001') return true
  const msg = String(err?.message ?? err)
  return /violates|constraint|foreign key|invalid input|not allowed|permission denied|row-level security/i.test(msg)
}

export async function getFailedWorkouts(): Promise<FailedWorkout[]> {
  return (await localforage.getItem<FailedWorkout[]>(failedKey)) || []
}

export async function discardFailedWorkout(clientId: string): Promise<void> {
  const items = await getFailedWorkouts()
  await localforage.setItem(failedKey, items.filter((i) => i.client_id !== clientId))
}

/** Move a parked item back into the pending queue for another attempt. */
export async function retryFailedWorkout(clientId: string): Promise<void> {
  const items = await getFailedWorkouts()
  const item = items.find((i) => i.client_id === clientId)
  if (!item) return
  const { failed_at, error, ...pending } = item
  await enqueueWorkout(pending)
  await discardFailedWorkout(clientId)
}

/** Sign-out hygiene: this device should hold no other account's queue. */
export async function clearOfflineQueues(): Promise<void> {
  await localforage.removeItem(pendingKey)
  await localforage.removeItem(failedKey)
}

/** The pre-v2 queue key. Items there were never migrated when the key
 *  changed — convert any survivors so they finally sync. */
const legacyKey = 'pending_workouts'

type LegacyPendingWorkout = {
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

async function migrateLegacyQueue(): Promise<void> {
  const old = await localforage.getItem<LegacyPendingWorkout[]>(legacyKey)
  if (!old) return
  if (old.length > 0) {
    const converted: PendingWorkout[] = old.map((w) => ({
      client_id: w.tempId,
      performed_at: w.performed_at,
      title: w.title ?? null,
      note: w.note ?? null,
      exercises: w.exercises.map((e) => ({
        exercise_id: e.exercise_id,
        display_name: e.name,
        sets: e.sets.map((s) => ({ ...s, completed: true })),
      })),
      queued_at: new Date().toISOString(),
    }))
    const current = await getPendingWorkouts()
    const known = new Set(current.map((i) => i.client_id))
    await localforage.setItem(pendingKey, [
      ...current,
      ...converted.filter((c) => !known.has(c.client_id)),
    ])
  }
  await localforage.removeItem(legacyKey)
}

export async function enqueueWorkout(payload: PendingWorkout): Promise<void> {
  const items = (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
  // Re-queuing the same save (same client_id) replaces the older copy
  const rest = items.filter((i) => i.client_id !== payload.client_id)
  rest.push(payload)
  await localforage.setItem(pendingKey, rest)
}

export async function getPendingWorkouts(): Promise<PendingWorkout[]> {
  return (await localforage.getItem<PendingWorkout[]>(pendingKey)) || []
}

// Serialize drains: mount + 'online' can fire together, and two concurrent
// drains would race the final queue write.
let syncInFlight: Promise<{ synced: number; failed: number }> | null = null

export async function trySyncPending(): Promise<{ synced: number; failed: number }> {
  if (syncInFlight) return syncInFlight
  syncInFlight = (async () => {
    try {
      await migrateLegacyQueue().catch(() => {})
      const items = await getPendingWorkouts()
      if (!items.length) return { synced: 0, failed: 0 }

      const { getActiveUserId } = await import('@/lib/activeUser')
      const currentUser = await getActiveUserId()

      const syncedIds = new Set<string>()
      const parkedIds = new Set<string>()
      for (const item of items) {
        // Never drain another account's queued workout into this session.
        if (item.user_id && currentUser && item.user_id !== currentUser) continue
        try {
          const workoutId = await saveWorkout(item)
          syncedIds.add(item.client_id)
          // Offline saves earn PRs too — the direct-save path runs this same
          // detection; without it a queued PR never reaches records/achievements.
          if (currentUser) {
            try {
              const { detectAndSaveNewPRs } = await import('@/lib/api/personalRecords')
              await detectAndSaveNewPRs(
                currentUser,
                workoutId,
                item.exercises.map((e) => ({
                  exerciseId: e.exercise_id,
                  name: e.display_name,
                  sets: e.sets.map((s) => ({
                    weight: s.weight,
                    reps: s.reps,
                    isWarmup: s.set_type === 'warmup',
                    isCompleted: s.completed,
                  })),
                }))
              )
            } catch (e) {
              console.error('PR detection for synced workout failed:', e)
            }
          }
        } catch (err) {
          // Transient (network) errors: keep the item for the next attempt —
          // the transactional RPC guarantees nothing partial was written, and
          // client_id makes the retry duplicate-safe. Permanent rejections
          // (constraint/validation) get parked so they stop wedging the queue.
          if (isPermanentError(err)) {
            const failed = await getFailedWorkouts()
            if (!failed.some((f) => f.client_id === item.client_id)) {
              failed.push({
                ...item,
                failed_at: new Date().toISOString(),
                error: String((err as any)?.message ?? err).slice(0, 300),
              })
              await localforage.setItem(failedKey, failed)
            }
            parkedIds.add(item.client_id)
          }
        }
      }

      // Re-read before writing: anything enqueued while the network calls were
      // in flight must survive. Only remove what actually synced (or parked).
      const current = await getPendingWorkouts()
      const remaining = current.filter((i) => !syncedIds.has(i.client_id) && !parkedIds.has(i.client_id))
      await localforage.setItem(pendingKey, remaining)
      return { synced: syncedIds.size, failed: remaining.length + parkedIds.size }
    } finally {
      syncInFlight = null
    }
  })()
  return syncInFlight
}
