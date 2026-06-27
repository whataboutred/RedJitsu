'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// If the app is reopened within this window with a workout still in progress,
// jump straight back into it instead of landing on the dashboard. Past the
// window we fall back to the dashboard (the workout can still be resumed from
// the New Workout screen).
const RESUME_WINDOW_MS = 10 * 60 * 1000

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let destination = '/dashboard'
    try {
      const raw = localStorage.getItem('workout-draft-v2')
      if (raw) {
        const draft = JSON.parse(raw)
        const isFresh =
          typeof draft?.timestamp === 'number' &&
          Date.now() - draft.timestamp < RESUME_WINDOW_MS
        if (isFresh && draft?.items?.length > 0) {
          destination = '/workouts/new'
        }
      }
    } catch {
      /* malformed draft — just go to the dashboard */
    }
    router.replace(destination)
  }, [router])

  // Brand-colored splash so there's no white flash while we decide where to go.
  return <div className="min-h-screen bg-brand-dark" />
}
