'use client'

import { useEffect, useRef } from 'react'
import { DATA_UPDATED_KEY } from '@/lib/dataSync'

/**
 * Re-runs `refresh` whenever training data changes anywhere in the app
 * (notifyDataChanged), the tab regains focus/visibility, or another tab
 * writes data. Keeps pages current without manual reloads.
 */
export function useDataRefresh(refresh: () => void) {
  // Latest-callback ref so subscribers don't churn listeners every render
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const run = () => refreshRef.current()
    const onVisibility = () => {
      if (!document.hidden) run()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === DATA_UPDATED_KEY) run()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    window.addEventListener('storage', onStorage)
    window.addEventListener(DATA_UPDATED_KEY, run)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(DATA_UPDATED_KEY, run)
    }
  }, [])
}
