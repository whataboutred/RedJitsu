'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CardioSession = {
  activity: string
  duration_minutes?: number
  distance?: number
  distance_unit: 'miles' | 'km'
  intensity: 'low' | 'moderate' | 'high'
  calories?: number
  notes?: string
}

const ACTIVITY_CATEGORIES = {
  'Machine Cardio': [
    'Treadmill',
    'Elliptical',
    'Stationary Bike',
    'Rowing Machine',
    'StairMaster',
    'Arc Trainer'
  ],
  'Outdoor Activities': [
    'Running',
    'Walking',
    'Cycling',
    'Swimming',
    'Hiking',
    'Rock Climbing'
  ],
  'Sports & Recreation': [
    'Basketball',
    'Soccer',
    'Tennis',
    'Volleyball',
    'Pickup Sports',
    'Martial Arts'
  ],
  'Group Fitness': [
    'Spin Class',
    'Yoga',
    'Pilates',
    'Dance Class',
    'Aerobics',
    'CrossFit'
  ]
}

const INTENSITY_COLORS = {
  'low': 'bg-green-500/20 text-green-400 border-green-500/30',
  'moderate': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'high': 'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function CardioPage() {
  const [demo, setDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [customActivity, setCustomActivity] = useState('')
  const [session, setSession] = useState<CardioSession>({
    activity: '',
    distance_unit: 'miles',
    intensity: 'moderate'
  })

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (timerRunning) {
      const interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
      setTimerInterval(interval)
    } else {
      if (timerInterval) {
        clearInterval(timerInterval)
        setTimerInterval(null)
      }
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval)
      }
    }
  }, [timerRunning])

  if (demo) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You're viewing the app in read-only demo mode. To log cardio sessions,
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startTimer = () => {
    setTimerRunning(true)
  }

  const stopTimer = () => {
    setTimerRunning(false)
    // Auto-fill duration if timer was used
    if (elapsedSeconds > 0) {
      setSession(prev => ({ 
        ...prev, 
        duration_minutes: Math.round(elapsedSeconds / 60) 
      }))
    }
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setElapsedSeconds(0)
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
  }

  const handleActivitySelect = (activity: string) => {
    setSession(prev => ({ ...prev, activity }))
    setCustomActivity('')
    setSelectedCategory('')
  }

  const handleCustomActivitySubmit = () => {
    if (customActivity.trim()) {
      setSession(prev => ({ ...prev, activity: customActivity.trim() }))
      setCustomActivity('')
    }
  }

  const updateSession = (updates: Partial<CardioSession>) => {
    setSession(prev => ({ ...prev, ...updates }))
  }

  const handleSave = async () => {
    const userId = await getActiveUserId()
    if (!userId) {
      alert('Please sign in to save cardio sessions')
      return
    }

    if (!session.activity.trim()) {
      alert('Please select or enter an activity')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('cardio_sessions').insert({
        user_id: userId,
        activity: session.activity,
        duration_minutes: session.duration_minutes || null,
        distance: session.distance || null,
        distance_unit: session.distance_unit,
        intensity: session.intensity,
        calories: session.calories || null,
        notes: session.notes?.trim() || null,
        performed_at: new Date().toISOString()
      })

      if (error) {
        console.error('Save error:', error)
        alert('Failed to save cardio session')
        return
      }

      alert('Cardio session saved!')
      
      // Reset form
      setSession({
        activity: '',
        distance_unit: 'miles',
        intensity: 'moderate'
      })
      setElapsedSeconds(0)
      resetTimer()
      
      // Navigate to history or dashboard
      setTimeout(() => {
        router.push('/history')
      }, 500)
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save cardio session')
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
          <h1 className="text-2xl font-bold">Log Cardio Session</h1>
          <Link href="/history" className="toggle">
            View History
          </Link>
        </div>

        {/* Activity Selection */}
        <div className="card">
          <div className="font-medium mb-4">🏃‍♀️ Select Activity</div>
          
          {!session.activity ? (
            <>
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.keys(ACTIVITY_CATEGORIES).map(category => (
                  <button
                    key={category}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                      selectedCategory === category
                        ? 'bg-brand-red/20 border-brand-red text-white border'
                        : 'bg-black/30 border border-white/10 text-white/70 hover:bg-black/50'
                    }`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Activity Grid */}
              {selectedCategory && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {ACTIVITY_CATEGORIES[selectedCategory as keyof typeof ACTIVITY_CATEGORIES].map(activity => (
                    <button
                      key={activity}
                      className="bg-black/30 hover:bg-black/50 rounded-xl p-3 text-left border border-white/10 hover:border-brand-red/30 transition-all duration-200"
                      onClick={() => handleActivitySelect(activity)}
                    >
                      <div className="font-medium text-white/90">{activity}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Activity */}
              <div className="bg-black/20 rounded-xl p-4">
                <div className="font-medium mb-3">Custom Activity</div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="input flex-1"
                    value={customActivity}
                    onChange={e => setCustomActivity(e.target.value)}
                    placeholder="Enter activity name..."
                    onKeyPress={e => e.key === 'Enter' && handleCustomActivitySubmit()}
                  />
                  <button
                    className="btn"
                    onClick={handleCustomActivitySubmit}
                    disabled={!customActivity.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-brand-red/10 border border-brand-red/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-brand-red">{session.activity}</div>
                  <div className="text-sm text-white/70">Selected activity</div>
                </div>
                <button
                  className="toggle text-sm"
                  onClick={() => setSession(prev => ({ ...prev, activity: '' }))}
                >
                  Change
                </button>
              </div>
            </div>
          )}
        </div>

        {session.activity && (
          <>
            {/* Session Timer */}
            <div className="card">
              <div className="font-medium mb-4">⏱️ Session Timer</div>
              <div className="flex items-center justify-center mb-6">
                <div className="text-4xl font-mono font-bold text-brand-red">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                {!timerRunning ? (
                  <button className="btn" onClick={startTimer}>
                    Start Timer
                  </button>
                ) : (
                  <button className="btn bg-red-600 hover:bg-red-700" onClick={stopTimer}>
                    Stop Timer
                  </button>
                )}
                <button className="toggle" onClick={resetTimer}>
                  Reset
                </button>
              </div>
            </div>

            {/* Session Details */}
            <div className="card">
              <div className="font-medium mb-4">📊 Session Details</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <button 
                className="btn w-full disabled:opacity-50"
                onClick={handleSave}
                disabled={saving || !session.activity}
              >
                {saving ? 'Saving...' : 'Save Cardio Session'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}