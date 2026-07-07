'use client'

import { useEffect, useState } from 'react'
import { CloudOff, RotateCcw, Trash2 } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { useToast } from '@/components/Toast'
import {
  getFailedWorkouts,
  discardFailedWorkout,
  retryFailedWorkout,
  trySyncPending,
  type FailedWorkout,
} from '@/lib/offline'

// Workouts that couldn't sync for a non-retryable reason. Parked, never
// silently discarded — the user decides to retry or let go.
export default function FailedSyncs() {
  const toast = useToast()
  const [items, setItems] = useState<FailedWorkout[]>([])

  const refresh = () => getFailedWorkouts().then(setItems)
  useEffect(() => { refresh() }, [])

  if (items.length === 0) return null

  async function retry(clientId: string) {
    await retryFailedWorkout(clientId)
    const { synced } = await trySyncPending()
    await refresh()
    if (synced > 0) toast.success('Workout synced')
    else toast.warning('Still failing — kept in the queue')
  }

  async function discard(clientId: string) {
    await discardFailedWorkout(clientId)
    await refresh()
    toast.success('Discarded')
  }

  return (
    <AnimatedCard className="border border-amber-500/20">
      <div className="flex items-center gap-2 mb-1">
        <CloudOff className="w-5 h-5 text-amber-400" />
        <h3 className="font-display uppercase text-lg text-amber-400">Couldn&apos;t sync</h3>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        These workouts were saved on this phone but the server rejected them.
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.client_id} className="rounded-xl bg-surface-elevated border border-white/[0.06] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.title || 'Untitled workout'}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(item.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' · '}{item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => retry(item.client_id)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
                  aria-label="Retry sync"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => discard(item.client_id)}
                  className="p-2 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                  aria-label="Discard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-600 break-words">{item.error}</p>
          </div>
        ))}
      </div>
    </AnimatedCard>
  )
}
