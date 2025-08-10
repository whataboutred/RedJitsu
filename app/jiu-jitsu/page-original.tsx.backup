'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

export default function JiuJitsuPage() {
  const router = useRouter()
  const [demo, setDemo] = useState(false)
  // default local datetime for backdating
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
  })

  // form state
  const [kind, setKind] = useState<Kind>('Class')
  const [duration, setDuration] = useState<number>(60)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (isDemo) return

      const userId = await getActiveUserId()
      if (!userId && !DEMO) {
        window.location.href = '/login'
      }
    })()
  }, [])

  // Demo mode will still allow creating sessions, they'll just be saved offline

  function toISO(dtLocal: string) {
    return new Date(dtLocal).toISOString()
  }

  async function saveOnline() {
    const userId = await getActiveUserId()
    if (!userId) { alert('Please sign in again.'); return }

    const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
    const { error } = await supabase
      .from('bjj_sessions')
      .insert({
        user_id: userId,
        performed_at: toISO(performedAt),
        kind: kind === 'Open Mat' ? 'open_mat' : (kind.toLowerCase()),
        duration_min: minutes,
        intensity,
        notes: notes || null
      })

    if (error) { alert('Save failed.'); return }
    alert('Saved Jiu Jitsu session.')
    router.push('/dashboard')
  }

  async function saveOffline() {
    const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
    const temp = Math.random().toString(36).slice(2)
    const session = {
      tempId: temp,
      performed_at: toISO(performedAt),
      kind: kind === 'Open Mat' ? 'open_mat' : (kind.toLowerCase()),
      duration_min: minutes,
      intensity,
      notes: notes || null
    }
    // Store in localStorage for now
    const key = `bjj_pending_${temp}`
    localStorage.setItem(key, JSON.stringify(session))
    alert('Saved offline. We will sync when you are online.')
    router.push('/dashboard')
  }

  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl">Jiu Jitsu</h1>

        <div className="card space-y-3">
          <label className="block">
            <div className="mb-1 text-sm text-white/80">Performed at</div>
            <input
              type="datetime-local"
              className="input w-full"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Type of training</div>
              <select className="input w-full" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option>Class</option>
                <option>Drilling</option>
                <option>Open Mat</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-sm text-white/80">Duration (minutes)</div>
              <input
                type="number"
                min={5}
                max={600}
                className="input w-full"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value || 60))}
              />
            </label>
          </div>

          <div>
            <div className="mb-1 text-sm text-white/80">Intensity</div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`toggle ${intensity==='low' ? '!bg-red-600 !text-white !border-red-600' : ''}`}
                onClick={() => setIntensity('low')}
                aria-pressed={intensity==='low'}
              >
                Low
              </button>
              <button
                type="button"
                className={`toggle ${intensity==='medium' ? '!bg-red-600 !text-white !border-red-600' : ''}`}
                onClick={() => setIntensity('medium')}
                aria-pressed={intensity==='medium'}
              >
                Medium
              </button>
              <button
                type="button"
                className={`toggle ${intensity==='high' ? '!bg-red-600 !text-white !border-red-600' : ''}`}
                onClick={() => setIntensity('high')}
                aria-pressed={intensity==='high'}
              >
                High
              </button>
            </div>
          </div>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">Notes</div>
            <textarea
              className="input w-full min-h-[120px]"
              placeholder="Key details from class, techniques drilled, rounds, partners, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button className="btn" onClick={demo ? saveOffline : saveOnline}>Save{demo ? ' Offline' : ''}</button>
          <button className="toggle" onClick={() => router.push('/dashboard')}>Cancel</button>
        </div>
      </main>
    </div>
  )
}
