'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { isoToDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useToast } from '@/components/Toast'
import { isUuid } from '@/lib/validation'

type CardioSession = {
  activity: string
  duration_minutes?: number
  distance?: number
  distance_unit: 'miles' | 'km'
  intensity: 'low' | 'moderate' | 'high'
  calories?: number
  notes?: string
}

const INTENSITY_COLORS = {
  'low': 'bg-green-500/20 text-green-400 border-green-500/30',
  'moderate': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'high': 'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function EditCardioPage() {
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const toast = useToast()
  const params = useParams()
  const cardioId = params.id as string

  const [performedAt, setPerformedAt] = useState<string>('')
  const [session, setSession] = useState<CardioSession>({
    activity: '',
    distance_unit: 'miles',
    intensity: 'moderate'
  })

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)

      if (isDemo || !isUuid(cardioId)) {
        setLoading(false)
        return
      }

      await loadCardioData()
      setLoading(false)
    })()
  }, [cardioId])

  async function loadCardioData() {
    const userId = await getActiveUserId()
    if (!userId) return

    try {
      const { data: cardioData } = await supabase
        .from('cardio_sessions')
        .select('*')
        .eq('id', cardioId)
        .eq('user_id', userId)
        .single()

      if (cardioData) {
        setSession({
          activity: cardioData.activity || '',
          duration_minutes: cardioData.duration_minutes || undefined,
          distance: cardioData.distance || undefined,
          distance_unit: cardioData.distance_unit || 'miles',
          intensity: cardioData.intensity || 'moderate',
          calories: cardioData.calories || undefined,
          notes: cardioData.notes || ''
        })
        
        setPerformedAt(isoToDatetimeLocal(cardioData.performed_at))
      }
    } catch (error) {
      console.error('Error loading cardio data:', error)
      toast.error('Failed to load cardio session')
    }
  }

  if (demo) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You&apos;re viewing the app in read-only demo mode. To edit cardio sessions,
            please <Link href="/login" className="underline">sign in</Link>.
          </p>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-4xl mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-32 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!isUuid(cardioId)) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Session not found</h1>
          <p className="text-white/70">
            This cardio session doesn&apos;t exist.{' '}
            <Link href="/cardio" className="underline">Back to cardio</Link>
          </p>
        </main>
      </div>
    )
  }

  const updateSession = (updates: Partial<CardioSession>) => {
    setSession(prev => ({ ...prev, ...updates }))
  }

  const handleSave = async () => {
    const userId = await getActiveUserId()
    if (!userId) {
      toast.warning('Please sign in to save cardio sessions')
      return
    }

    if (!session.activity.trim()) {
      toast.warning('Please enter an activity')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('cardio_sessions')
        .update({
          activity: session.activity,
          duration_minutes: session.duration_minutes || null,
          distance: session.distance || null,
          distance_unit: session.distance_unit,
          intensity: session.intensity,
          calories: session.calories || null,
          notes: session.notes?.trim() || null,
          performed_at: datetimeLocalToISO(performedAt)
        })
        .eq('id', cardioId)
        .eq('user_id', userId)

      if (error) {
        console.error('Save error:', error)
        toast.error(`Failed to update cardio session: ${error.message}`)
        return
      }

      toast.success('Cardio session updated!')
      router.push('/history')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to update cardio session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Cardio Session</h1>
          <Link href="/history" className="toggle">
            Back to History
          </Link>
        </div>

        {/* Activity */}
        <div className="card">
          <div className="font-medium mb-4">🏃‍♀️ Activity</div>
          <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
            <input
              type="text"
              className="input w-full"
              value={session.activity}
              onChange={e => updateSession({ activity: e.target.value })}
              placeholder="Enter activity name..."
            />
          </div>
        </div>

        {/* Session Details */}
        <div className="card">
          <div className="font-medium mb-4">📊 Session Details</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date & Time */}
            <div className="md:col-span-2">
              <label className="block text-sm text-white/80 font-medium mb-2">
                Date & Time
              </label>
              <input
                type="datetime-local"
                className="input w-full"
                value={performedAt}
                onChange={e => setPerformedAt(e.target.value)}
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                className="input w-full"
                value={session.duration_minutes || ''}
                onChange={e => updateSession({ 
                  duration_minutes: e.target.value ? Number(e.target.value) : undefined 
                })}
                placeholder="Optional"
              />
            </div>

            {/* Distance */}
            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Distance
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="input flex-1"
                  value={session.distance || ''}
                  onChange={e => updateSession({ 
                    distance: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  placeholder="Optional"
                />
                <select
                  className="input"
                  value={session.distance_unit}
                  onChange={e => updateSession({ distance_unit: e.target.value as 'miles' | 'km' })}
                >
                  <option value="miles">miles</option>
                  <option value="km">km</option>
                </select>
              </div>
            </div>

            {/* Calories */}
            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Calories Burned
              </label>
              <input
                type="number"
                min="1"
                className="input w-full"
                value={session.calories || ''}
                onChange={e => updateSession({ 
                  calories: e.target.value ? Number(e.target.value) : undefined 
                })}
                placeholder="Optional"
              />
            </div>

            {/* Intensity */}
            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Intensity Level
              </label>
              <div className="flex gap-2">
                {(['low', 'moderate', 'high'] as const).map(intensity => (
                  <button
                    key={intensity}
                    className={`px-4 py-2 rounded-xl text-sm font-medium capitalize flex-1 transition-all duration-200 ${
                      session.intensity === intensity
                        ? `border ${INTENSITY_COLORS[intensity]}`
                        : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50'
                    }`}
                    onClick={() => updateSession({ intensity })}
                  >
                    {intensity}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-sm text-white/80 font-medium mb-2">
              Notes (Optional)
            </label>
            <textarea
              className="input w-full h-20 resize-none"
              value={session.notes || ''}
              onChange={e => updateSession({ notes: e.target.value })}
              placeholder="How did the session feel? Any notable observations..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex gap-3">
            <Link href="/history" className="toggle flex-1 text-center py-3">
              Cancel
            </Link>
            <button 
              className="btn flex-1 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !session.activity.trim()}
            >
              {saving ? 'Saving...' : 'Update Cardio Session'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}