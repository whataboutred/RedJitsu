'use client'

import BackgroundLogo from '@/components/BackgroundLogo'
import { useEffect, useState } from 'react'
import { getBjjSession, updateBjjSession } from '@/lib/api'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { isoToDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useToast } from '@/components/Toast'
import { isUuid } from '@/lib/validation'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

export default function EditJiuJitsuPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string
  const toast = useToast()

  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
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

      if (!isUuid(sessionId)) {
        toast.error('Session not found')
        router.push('/history')
        return
      }

      const userId = await getActiveUserId()
      if (!userId) {
        if (!DEMO) router.push('/login')
        return
      }

      // Load existing session data
      const session = await getBjjSession(sessionId, userId).catch(() => null)

      if (!session) {
        toast.error('Session not found')
        router.push('/history')
        return
      }

      // Set form values from session data
      setPerformedAt(isoToDatetimeLocal(session.performed_at))

      // Convert database kind back to display format
      if (session.kind === 'open_mat') {
        setKind('Open Mat')
      } else if (session.kind === 'class') {
        setKind('Class')
      } else if (session.kind === 'drilling') {
        setKind('Drilling')
      }

      setDuration(session.duration_min)
      setIntensity((session.intensity as Intensity) || 'medium')
      setNotes(session.notes || '')
      
      setLoading(false)
    })()
  }, [sessionId, router])

  // Use datetimeLocalToISO from lib/dateUtils for timezone-safe conversion

  async function saveSession() {
    if (saving) return
    const userId = await getActiveUserId()
    if (!userId) { toast.warning('Please sign in again.'); return }

    setSaving(true)
    try {
      const minutes = Math.min(600, Math.max(5, Number(duration || 60)))
      await updateBjjSession(sessionId, userId, {
        performed_at: datetimeLocalToISO(performedAt),
        kind: kind === 'Open Mat' ? ('open_mat' as const) : (kind.toLowerCase() as 'class' | 'drilling'),
        duration_min: minutes,
        intensity,
        notes: notes || null
      })

      toast.success('Session updated successfully!')
      router.push(`/history?highlight=${sessionId}&type=bjj`)
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to update session')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <main className="relative z-10 max-w-3xl mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-32 bg-white/10 rounded"></div>
            <div className="h-32 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <main className="relative z-10 max-w-3xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Edit Jiu Jitsu Session</h1>
          <Link href="/history" className="toggle">
            ← Back to History
          </Link>
        </div>

        {/* Session Details Form */}
        <div className="card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Session type"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              options={[
                { value: 'Class', label: 'Class' },
                { value: 'Drilling', label: 'Drilling' },
                { value: 'Open Mat', label: 'Open Mat' },
              ]}
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min={5}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Intensity"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as Intensity)}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
            <Input
              label="Performed at"
              type="datetime-local"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
          </div>

          <Textarea
            label="Notes (optional)"
            className="h-24"
            placeholder="How did it go? What did you work on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={saveSession} loading={saving}>
            Save Changes
          </Button>
          <Link href="/history" className="toggle">
            Cancel
          </Link>
        </div>
      </main>
    </div>
  )
}