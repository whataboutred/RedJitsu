'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import BJJQuickStart from '@/components/BJJQuickStart'
import EnhancedBJJInput from '@/components/EnhancedBJJInput'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

export default function EnhancedJiuJitsuPage() {
  const router = useRouter()
  const [demo, setDemo] = useState(false)
  
  // Form state
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [kind, setKind] = useState<Kind>('Class')
  const [duration, setDuration] = useState<number>(60)
  const [intensity, setIntensity] = useState<Intensity>('medium')
  const [notes, setNotes] = useState<string>('')

  // UI state
  const [mode, setMode] = useState<'quick' | 'manual'>('quick')
  const [isLoading, setIsLoading] = useState(false)

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

  function toISO(dtLocal: string) {
    return new Date(dtLocal).toISOString()
  }

  // Handle quick start selection
  function handleQuickStart(pattern: {
    kind: Kind
    duration: number
    intensity: Intensity
  }) {
    setKind(pattern.kind)
    setDuration(pattern.duration)
    setIntensity(pattern.intensity)
    setMode('manual') // Switch to manual mode after quick start
    
    // Smart note suggestions based on session type and time
    const hour = new Date().getHours()
    let smartNote = ''
    
    if (pattern.kind === 'Class') {
      if (hour < 12) smartNote = '🌅 Morning class - focused on fundamentals'
      else if (hour < 18) smartNote = '☀️ Afternoon class - good energy and focus'
      else smartNote = '🌙 Evening class - great way to end the day'
    } else if (pattern.kind === 'Drilling') {
      smartNote = '🔥 Drilling session - repetition builds muscle memory'
    } else {
      smartNote = '⚡ Open mat - free flowing practice and sparring'
    }
    
    setNotes(smartNote)
  }

  async function saveSession() {
    setIsLoading(true)
    
    try {
      if (demo) {
        await saveOffline()
      } else {
        await saveOnline()
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveOnline() {
    const userId = await getActiveUserId()
    if (!userId) { 
      alert('Please sign in again.')
      return 
    }

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

    if (error) { 
      throw new Error('Save failed: ' + error.message)
    }
    
    // Success feedback
    const sessionEmoji = kind === 'Class' ? '🥋' : kind === 'Drilling' ? '🔥' : '⚡'
    alert(`${sessionEmoji} ${kind} session saved! (${minutes} min)`)
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
    
    // Store in localStorage
    const key = `bjj_pending_${temp}`
    localStorage.setItem(key, JSON.stringify(session))
    alert('Session saved offline. Will sync when online.')
    router.push('/dashboard')
  }

  const canSave = duration > 0 && kind

  return (
    <div className="relative min-h-screen bg-black pb-20">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-3xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">🥋 Jiu Jitsu Training</h1>
          <div className="flex gap-2">
            <button 
              className={`toggle text-xs ${mode === 'quick' ? 'bg-brand-red/20 border-brand-red' : ''}`}
              onClick={() => setMode('quick')}
            >
              🚀 Quick
            </button>
            <button 
              className={`toggle text-xs ${mode === 'manual' ? 'bg-brand-red/20 border-brand-red' : ''}`}
              onClick={() => setMode('manual')}
            >
              ⚙️ Manual
            </button>
          </div>
        </div>

        {/* Quick Start Mode */}
        {mode === 'quick' && (
          <BJJQuickStart onQuickStart={handleQuickStart} />
        )}

        {/* Manual Mode or after Quick Start selection */}
        {mode === 'manual' && (
          <div className="space-y-6">
            {/* Session Date/Time */}
            <div className="card">
              <div className="font-medium mb-3">📅 When did you train?</div>
              <label className="block">
                <div className="mb-1 text-sm text-white/80">Date & Time</div>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                />
              </label>
            </div>

            {/* Enhanced BJJ Input */}
            <EnhancedBJJInput
              initialKind={kind}
              initialDuration={duration}
              initialIntensity={intensity}
              initialNotes={notes}
              onKindChange={setKind}
              onDurationChange={setDuration}
              onIntensityChange={setIntensity}
              onNotesChange={setNotes}
            />
          </div>
        )}

        {/* Show current selection when in quick mode */}
        {mode === 'quick' && (kind !== 'Class' || duration !== 60 || intensity !== 'medium' || notes !== '') && (
          <div className="card bg-green-500/20 border-green-500/30">
            <div className="font-medium mb-2">✅ Current Session Setup</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-white/70">Type</div>
                <div className="font-medium">{kind === 'Class' ? '🥋' : kind === 'Drilling' ? '🔥' : '⚡'} {kind}</div>
              </div>
              <div>
                <div className="text-white/70">Duration</div>
                <div className="font-medium">⏱️ {duration} minutes</div>
              </div>
              <div>
                <div className="text-white/70">Intensity</div>
                <div className="font-medium">
                  {intensity === 'low' ? '🌱' : intensity === 'medium' ? '🔥' : '⚡'} {intensity}
                </div>
              </div>
            </div>
            {notes && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-white/70 text-sm">Notes</div>
                <div className="font-medium text-sm">{notes}</div>
              </div>
            )}
            <button
              className="toggle mt-3 text-xs"
              onClick={() => setMode('manual')}
            >
              ✏️ Customize Session
            </button>
          </div>
        )}

        {/* Session Summary - Show when there's content */}
        {(mode === 'manual' || (kind && duration > 0)) && (
          <div className="card border-l-4 border-blue-500">
            <div className="font-medium mb-3">📊 Session Summary</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl mb-1">
                  {kind === 'Class' ? '🥋' : kind === 'Drilling' ? '🔥' : '⚡'}
                </div>
                <div className="text-sm text-white/70">{kind}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400 mb-1">{duration}</div>
                <div className="text-sm text-white/70">Minutes</div>
              </div>
              <div>
                <div className="text-2xl mb-1">
                  {intensity === 'low' ? '🌱' : intensity === 'medium' ? '🔥' : '⚡'}
                </div>
                <div className="text-sm text-white/70">{intensity}</div>
              </div>
              <div>
                <div className="text-2xl mb-1">
                  {notes.length > 0 ? '📝' : '⭕'}
                </div>
                <div className="text-sm text-white/70">
                  {notes.length > 0 ? 'Notes' : 'No notes'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sticky Save Button */}
      {canSave && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur border-t border-white/10 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <button 
              className="btn flex-1 py-4 text-lg font-medium disabled:opacity-50" 
              disabled={!canSave || isLoading} 
              onClick={saveSession}
            >
              {isLoading ? (
                '💾 Saving...'
              ) : (
                <>
                  💾 Save {kind} Session ({duration} min{demo ? ' • Offline' : ''})
                </>
              )}
            </button>
            <Link href="/dashboard" className="toggle px-6 flex items-center justify-center">
              ✕
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}