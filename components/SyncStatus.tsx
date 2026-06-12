'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CloudOff, RefreshCw, Check } from 'lucide-react'
import { getPendingWorkouts, trySyncPending } from '@/lib/offline'
import { getActiveUserId } from '@/lib/activeUser'

type SyncState = 'offline' | 'pending' | 'syncing' | 'synced'

/**
 * Small pill that surfaces the offline queue: shows when you're offline or
 * have unsynced workouts, retries when the connection returns, and flashes
 * a checkmark once everything is uploaded.
 */
export default function SyncStatus() {
  const [state, setState] = useState<SyncState | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const refresh = useCallback(async () => {
    const pending = await getPendingWorkouts()
    setPendingCount(pending.length)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState('offline')
      return
    }

    if (pending.length === 0) {
      // Nothing queued and online — stay hidden
      setState((prev) => (prev === 'syncing' || prev === 'pending' ? 'synced' : null))
      return
    }

    setState('syncing')
    const userId = await getActiveUserId()
    if (!userId) {
      setState('pending')
      return
    }

    const { failed } = await trySyncPending(userId)
    setPendingCount(failed)
    setState(failed > 0 ? 'pending' : 'synced')
  }, [])

  useEffect(() => {
    refresh()

    const onOnline = () => refresh()
    const onOffline = () => refresh()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh])

  // Auto-hide the success state
  useEffect(() => {
    if (state !== 'synced') return
    const t = setTimeout(() => setState(null), 2500)
    return () => clearTimeout(t)
  }, [state])

  if (!state) return null

  const config = {
    offline: {
      icon: <CloudOff className="w-3.5 h-3.5" />,
      label: pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline',
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    },
    pending: {
      icon: <RefreshCw className="w-3.5 h-3.5" />,
      label: `${pendingCount} workout${pendingCount === 1 ? '' : 's'} to sync`,
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    },
    syncing: {
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
      label: 'Syncing…',
      className: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    },
    synced: {
      icon: <Check className="w-3.5 h-3.5" />,
      label: 'All synced',
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    },
  }[state]

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        onClick={state === 'pending' ? refresh : undefined}
        aria-live="polite"
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium backdrop-blur-sm ${config.className}`}
      >
        {config.icon}
        {config.label}
      </motion.button>
    </AnimatePresence>
  )
}
