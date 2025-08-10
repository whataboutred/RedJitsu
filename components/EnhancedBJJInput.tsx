'use client'
import { useState, useEffect } from 'react'

type Kind = 'Class' | 'Drilling' | 'Open Mat'
type Intensity = 'low' | 'medium' | 'high'

type EnhancedBJJInputProps = {
  initialKind?: Kind
  initialDuration?: number
  initialIntensity?: Intensity
  initialNotes?: string
  onKindChange: (kind: Kind) => void
  onDurationChange: (duration: number) => void
  onIntensityChange: (intensity: Intensity) => void
  onNotesChange: (notes: string) => void
}

const DURATION_PRESETS = [
  { label: '30 min', value: 30, emoji: '⚡' },
  { label: '45 min', value: 45, emoji: '🔥' },
  { label: '60 min', value: 60, emoji: '⭐' },
  { label: '75 min', value: 75, emoji: '💪' },
  { label: '90 min', value: 90, emoji: '🥋' },
  { label: '120 min', value: 120, emoji: '🏆' }
]

const INTENSITY_OPTIONS = [
  { 
    value: 'low' as const, 
    label: 'Light', 
    emoji: '🌱', 
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    activeColor: '!bg-green-500 !text-white !border-green-500',
    description: 'Easy flow, technique focus'
  },
  { 
    value: 'medium' as const, 
    label: 'Moderate', 
    emoji: '🔥', 
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    activeColor: '!bg-orange-500 !text-white !border-orange-500',
    description: 'Good pace, some intensity'
  },
  { 
    value: 'high' as const, 
    label: 'Intense', 
    emoji: '⚡', 
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    activeColor: '!bg-red-500 !text-white !border-red-500',
    description: 'Hard rolls, competition prep'
  }
]

const SESSION_TYPES = [
  {
    value: 'Class' as const,
    emoji: '🥋',
    label: 'Class',
    description: 'Structured class with instruction',
    suggestedDuration: 60,
    suggestedIntensity: 'medium' as const
  },
  {
    value: 'Drilling' as const,
    emoji: '🔥',
    label: 'Drilling',
    description: 'Focused technique practice',
    suggestedDuration: 45,
    suggestedIntensity: 'high' as const
  },
  {
    value: 'Open Mat' as const,
    emoji: '⚡',
    label: 'Open Mat',
    description: 'Free rolling and sparring',
    suggestedDuration: 90,
    suggestedIntensity: 'medium' as const
  }
]

const NOTE_TEMPLATES = [
  '🥋 Worked on guard passes and escapes',
  '🔥 Drilled triangles and armbars from guard',
  '⚡ Good rolls with higher belts',
  '💪 Focused on takedowns and wrestling',
  '🧠 Mental game and strategy focus',
  '🤝 Great training partners today',
]

export default function EnhancedBJJInput({
  initialKind = 'Class',
  initialDuration = 60,
  initialIntensity = 'medium',
  initialNotes = '',
  onKindChange,
  onDurationChange,
  onIntensityChange,
  onNotesChange
}: EnhancedBJJInputProps) {
  const [kind, setKind] = useState<Kind>(initialKind)
  const [duration, setDuration] = useState<number>(initialDuration)
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity)
  const [notes, setNotes] = useState<string>(initialNotes)
  const [showNoteTemplates, setShowNoteTemplates] = useState(false)
  const [sessionTimer, setSessionTimer] = useState<number>(0)
  const [timerRunning, setTimerRunning] = useState(false)

  // Session timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerRunning) {
      interval = setInterval(() => {
        setSessionTimer(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleKindChange = (newKind: Kind) => {
    setKind(newKind)
    onKindChange(newKind)
    
    // Auto-suggest duration and intensity based on session type
    const sessionType = SESSION_TYPES.find(s => s.value === newKind)
    if (sessionType) {
      setDuration(sessionType.suggestedDuration)
      onDurationChange(sessionType.suggestedDuration)
      setIntensity(sessionType.suggestedIntensity)
      onIntensityChange(sessionType.suggestedIntensity)
    }
  }

  const handleDurationChange = (newDuration: number) => {
    setDuration(newDuration)
    onDurationChange(newDuration)
  }

  const handleIntensityChange = (newIntensity: Intensity) => {
    setIntensity(newIntensity)
    onIntensityChange(newIntensity)
  }

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes)
    onNotesChange(newNotes)
  }

  const addNoteTemplate = (template: string) => {
    const currentNotes = notes.trim()
    const separator = currentNotes ? '\n' : ''
    handleNotesChange(currentNotes + separator + template)
    setShowNoteTemplates(false)
  }

  const stopTimerAndSetDuration = () => {
    const timerMinutes = Math.round(sessionTimer / 60)
    handleDurationChange(timerMinutes)
    setTimerRunning(false)
    setSessionTimer(0)
  }

  return (
    <div className="space-y-6">
      {/* Session Timer */}
      {(timerRunning || sessionTimer > 0) && (
        <div className="card bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">
              {formatTimer(sessionTimer)}
            </div>
            <div className="text-sm text-white/70 mb-3">Session Timer</div>
            <div className="flex gap-2 justify-center">
              <button
                className="toggle"
                onClick={() => setTimerRunning(!timerRunning)}
              >
                {timerRunning ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button
                className="btn"
                onClick={stopTimerAndSetDuration}
              >
                ✅ Use Time ({Math.round(sessionTimer / 60)} min)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Type Selection - Enhanced */}
      <div className="card">
        <div className="font-medium mb-4">🥋 Training Type</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SESSION_TYPES.map((sessionType) => (
            <button
              key={sessionType.value}
              className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                kind === sessionType.value
                  ? 'bg-brand-red/20 border-brand-red text-white'
                  : 'bg-black/30 border-white/10 hover:border-brand-red/30 hover:bg-black/50'
              }`}
              onClick={() => handleKindChange(sessionType.value)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{sessionType.emoji}</span>
                <span className="font-semibold">{sessionType.label}</span>
              </div>
              <div className="text-sm text-white/70 mb-2">
                {sessionType.description}
              </div>
              <div className="text-xs text-white/60">
                Suggests: {sessionType.suggestedDuration} min • {sessionType.suggestedIntensity}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration - Enhanced with presets */}
      <div className="card">
        <div className="font-medium mb-4">⏱️ Duration</div>
        
        {/* Duration Presets */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`p-3 rounded-xl text-center transition-all duration-200 ${
                duration === preset.value
                  ? 'bg-brand-red/20 border-brand-red text-white border-2'
                  : 'bg-black/30 border border-white/10 hover:border-brand-red/30'
              }`}
              onClick={() => handleDurationChange(preset.value)}
            >
              <div className="text-lg mb-1">{preset.emoji}</div>
              <div className="text-sm font-medium">{preset.label}</div>
            </button>
          ))}
        </div>

        {/* Custom Duration Input */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <button
              className="toggle px-4 py-2"
              onClick={() => handleDurationChange(Math.max(5, duration - 15))}
            >
              -15
            </button>
            <div className="flex-1 text-center">
              <input
                type="number"
                min="5"
                max="600"
                className="input text-center text-lg font-semibold w-full"
                value={duration}
                onChange={(e) => handleDurationChange(Number(e.target.value || 60))}
              />
              <div className="text-xs text-white/60 mt-1">minutes</div>
            </div>
            <button
              className="toggle px-4 py-2"
              onClick={() => handleDurationChange(Math.min(600, duration + 15))}
            >
              +15
            </button>
          </div>
          
          {!timerRunning && sessionTimer === 0 && (
            <button
              className="toggle"
              onClick={() => setTimerRunning(true)}
              title="Start session timer"
            >
              ⏱️ Timer
            </button>
          )}
        </div>
      </div>

      {/* Intensity - Enhanced with descriptions */}
      <div className="card">
        <div className="font-medium mb-4">🔥 Training Intensity</div>
        <div className="space-y-3">
          {INTENSITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                intensity === option.value
                  ? option.activeColor
                  : `${option.color} border-transparent hover:border-opacity-50`
              }`}
              onClick={() => handleIntensityChange(option.value)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.emoji}</span>
                  <div>
                    <div className="font-semibold">{option.label}</div>
                    <div className="text-sm opacity-80">{option.description}</div>
                  </div>
                </div>
                {intensity === option.value && (
                  <div className="text-xl">✓</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Notes - Enhanced with templates */}
      <div className="card">
        <div className="font-medium mb-4">📝 Session Notes</div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white/80">What did you work on?</label>
            <button
              className="toggle text-xs"
              onClick={() => setShowNoteTemplates(!showNoteTemplates)}
            >
              {showNoteTemplates ? 'Hide' : 'Show'} Templates
            </button>
          </div>

          {showNoteTemplates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-black/20 rounded-xl">
              {NOTE_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  className="text-left text-sm p-2 rounded bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-all duration-200"
                  onClick={() => addNoteTemplate(template)}
                >
                  {template}
                </button>
              ))}
            </div>
          )}

          <textarea
            className="input w-full min-h-[120px] resize-none"
            placeholder="Techniques practiced, partners, key insights, how you felt..."
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
          />
          
          <div className="text-xs text-white/60">
            💡 Pro tip: Note specific techniques, training partners, and key learnings for better progress tracking
          </div>
        </div>
      </div>
    </div>
  )
}