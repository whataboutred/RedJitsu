'use client'

import Nav from '@/components/Nav'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

export default function EditJiuJitsuPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Form state
  const [performedAt, setPerformedAt] = useState<string>('')
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
        return
      }

      // Load existing session data
      const { data: session } = await supabase
        .from('bjj_sessions')
        .select('performed_at,kind,duration_min,intensity,notes')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single()

      if (!session) {
        alert('Session not found')
        router.push('/history')
        return
      }

      // Set form values from session data
      const d = new Date(session.performed_at)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      setPerformedAt(d.toISOString().slice(0, 16))

      // Convert database kind back to display format
      if (session.kind === 'open_mat') {
        setKind('Open Mat')
      } else if (session.kind === 'class') {
        setKind('Class')
      } else if (session.kind === 'drilling') {
        setKind('Drilling')
      }

      setDuration(session.duration_min)
      setIntensity(session.intensity || 'medium')
      setNotes(session.notes || '')
      
      setLoading(false)
    })()
  }, [sessionId, router])

  function toISO(dtLocal: string) {
    return new Date(dtLocal).toISOString()
  }

  async function saveSession() {
    const userId = await getActiveUserId()
    if (!userId) { alert('Please sign in again.'); return }

    try {
      const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
      const { error } = await supabase
        .from('bjj_sessions')
        .update({
          performed_at: toISO(performedAt),
          kind: kind === 'Open Mat' ? 'open_mat' : (kind.toLowerCase()),
          duration_min: minutes,
          intensity,
          notes: notes || null
        })
        .eq('id', sessionId)
        .eq('user_id', userId)

      if (error) {
        console.error('Update error:', error)
        alert('Failed to update session: ' + error.message)
        return
      }

      alert('Session updated successfully!')
      router.push(`/history?highlight=${sessionId}&type=bjj`)
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to update session')
    }
  }

  if (loading) {
    return (
      <div>
        <Nav />
        <main className="max-w-3xl mx-auto p-4">
          <div className="text-center">Loading session...</div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Edit Jiu Jitsu Session</h1>
          <Link href="/history" className="toggle">
            ← Back to History
          </Link>
        </div>

        {/* Session Details Form */}
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Session Type */}
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Session type</div>
              <select
                className="input w-full"
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
              >
                <option value="Class">Class</option>
                <option value="Drilling">Drilling</option>
                <option value="Open Mat">Open Mat</option>
              </select>
            </label>

            {/* Duration */}
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Duration (minutes)</div>
              <input
                type="number"
                min="5"
                max="600"
                className="input w-full"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Intensity */}
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Intensity</div>
              <select
                className="input w-full"
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as Intensity)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            {/* Performed At */}
            <label className="block">
              <div className="mb-2 text-sm text-white/80">Performed at</div>
              <input
                type="datetime-local"
                className="input w-full"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </label>
          </div>

          {/* Notes */}
          <label className="block">
            <div className="mb-2 text-sm text-white/80">Notes (optional)</div>
            <textarea
              className="input w-full h-24 resize-none"
              placeholder="How did it go? What did you work on?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button className="btn" onClick={saveSession}>
            Save Changes
          </button>
          <Link href="/history" className="toggle">
            Cancel
          </Link>
        </div>
      </main>
    </div>
  )
}