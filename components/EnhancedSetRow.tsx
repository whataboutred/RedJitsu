'use client'
import { useState, useEffect } from 'react'

type SetData = { weight: number; reps: number; set_type: 'warmup' | 'working' }

export default function EnhancedSetRow({
  initial,
  onChange,
  onRemove,
  unitLabel = 'lb',
  setIndex,
  previousSet,
  onCopyPrevious,
  showRestTimer = false
}: {
  initial?: SetData
  onChange: (v: SetData) => void
  onRemove: () => void
  unitLabel?: 'lb' | 'kg' | string
  setIndex: number
  previousSet?: SetData
  onCopyPrevious?: () => void
  showRestTimer?: boolean
}) {
  const [weight, setWeight] = useState<number | ''>(initial?.weight ?? '')
  const [reps, setReps] = useState<number | ''>(initial?.reps ?? '')
  const [type, setType] = useState<'warmup' | 'working'>(initial?.set_type ?? 'working')
  const [restTime, setRestTime] = useState(0)
  const [isResting, setIsResting] = useState(false)

  const step = unitLabel === 'kg' ? 2.5 : 5

  // Rest timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isResting && restTime > 0) {
      interval = setInterval(() => {
        setRestTime(prev => {
          if (prev <= 1) {
            setIsResting(false)
            // Optional: show notification or vibrate
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isResting, restTime])

  function emit(w = weight, r = reps, t = type) { 
    onChange({ 
      weight: w === '' ? 0 : Number(w), 
      reps: r === '' ? 0 : Number(r), 
      set_type: t 
    }) 
  }

  function startRestTimer(seconds: number = 90) {
    setRestTime(seconds)
    setIsResting(true)
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Smart suggestions based on previous set
  const suggestedWeight = previousSet ? previousSet.weight + step : 0
  const suggestedReps = previousSet?.reps || 0

  return (
    <div className="space-y-3">
      {/* Rest Timer */}
      {isResting && (
        <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl p-3 text-center">
          <div className="text-orange-400 font-bold text-lg">{formatTime(restTime)}</div>
          <div className="text-sm text-white/70">Rest time remaining</div>
          <button 
            className="toggle mt-2 text-xs"
            onClick={() => setIsResting(false)}
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* Mobile layout: optimized for one-handed use */}
      <div className="flex flex-col space-y-3 md:hidden">
        <div className="flex items-center justify-between bg-black/20 rounded-xl p-3">
          <span className="text-brand-red font-medium">Set {setIndex + 1}</span>
          <div className="flex items-center gap-2">
            <select 
              className="input text-sm px-2 py-1" 
              value={type} 
              onChange={(e) => { 
                const t = e.target.value as 'warmup' | 'working'
                setType(t)
                emit(undefined as any, undefined as any, t) 
              }}
            >
              <option value="working">💪 Working</option>
              <option value="warmup">🔥 Warm-up</option>
            </select>
            <button className="toggle text-red-400" onClick={onRemove}>✕</button>
          </div>
        </div>

        {/* Weight Input - Large buttons for easy tapping */}
        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-center mb-3">
            <span className="text-sm text-white/80">Weight ({unitLabel})</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="toggle flex-1 py-4 text-lg font-bold text-red-400" 
              onClick={() => { 
                const currentW = weight === '' ? 0 : Number(weight)
                const w = Math.max(0, +(currentW - step).toFixed(1))
                setWeight(w === 0 ? '' : w)
                emit(w === 0 ? '' : w) 
              }}
            >
              -{step}
            </button>
            <div className="flex-2 text-center">
              <input 
                className="input text-2xl font-bold text-center w-full py-3" 
                type="number" 
                step="0.5" 
                inputMode="decimal" 
                value={weight} 
                placeholder="0"
                onChange={(e) => { 
                  const val = e.target.value
                  setWeight(val === '' ? '' : Number(val))
                  emit(val === '' ? '' : Number(val)) 
                }}
              />
            </div>
            <button 
              className="toggle flex-1 py-4 text-lg font-bold text-green-400" 
              onClick={() => { 
                const currentW = weight === '' ? 0 : Number(weight)
                const w = +(currentW + step).toFixed(1)
                setWeight(w)
                emit(w) 
              }}
            >
              +{step}
            </button>
          </div>
        </div>

        {/* Reps Input - Large buttons */}
        <div className="bg-black/20 rounded-xl p-4">
          <div className="text-center mb-3">
            <span className="text-sm text-white/80">Reps</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="toggle flex-1 py-4 text-lg font-bold text-red-400" 
              onClick={() => { 
                const currentR = reps === '' ? 0 : Number(reps)
                const r = Math.max(0, currentR - 1)
                setReps(r === 0 ? '' : r)
                emit(undefined as any, r === 0 ? '' : r) 
              }}
            >
              -1
            </button>
            <div className="flex-2 text-center">
              <input 
                className="input text-2xl font-bold text-center w-full py-3" 
                type="number" 
                inputMode="numeric" 
                value={reps} 
                placeholder="0"
                onChange={(e) => { 
                  const val = e.target.value
                  setReps(val === '' ? '' : Number(val))
                  emit(undefined as any, val === '' ? '' : Number(val)) 
                }}
              />
            </div>
            <button 
              className="toggle flex-1 py-4 text-lg font-bold text-green-400" 
              onClick={() => { 
                const currentR = reps === '' ? 0 : Number(reps)
                const r = currentR + 1
                setReps(r)
                emit(undefined as any, r) 
              }}
            >
              +1
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {previousSet && onCopyPrevious && (
            <button 
              className="toggle flex-1 text-sm py-2"
              onClick={onCopyPrevious}
            >
              📋 Copy Last ({previousSet.weight} × {previousSet.reps})
            </button>
          )}
          <button 
            className="toggle flex-1 text-sm py-2"
            onClick={() => startRestTimer(90)}
          >
            ⏱️ Rest 90s
          </button>
        </div>

        {/* Smart Suggestions */}
        {suggestedWeight > 0 && weight !== suggestedWeight && (
          <button 
            className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-2 text-sm text-blue-400 w-full"
            onClick={() => {
              setWeight(suggestedWeight)
              emit(suggestedWeight)
            }}
          >
            💡 Try {suggestedWeight} {unitLabel} (+{step} from last set)
          </button>
        )}
      </div>

      {/* Desktop layout: compact grid */}
      <div className="hidden md:grid grid-cols-12 gap-3 items-center bg-black/20 rounded-xl p-3">
        <div className="col-span-1 text-brand-red font-medium">#{setIndex + 1}</div>
        
        <div className="col-span-4">
          <div className="flex items-center gap-2">
            <button 
              className="toggle px-2 py-1" 
              onClick={() => { 
                const currentW = weight === '' ? 0 : Number(weight)
                const w = Math.max(0, +(currentW - step).toFixed(1))
                setWeight(w === 0 ? '' : w)
                emit(w === 0 ? '' : w) 
              }}
            >
              -{step}
            </button>
            <input 
              className="input w-full text-center" 
              type="number" 
              step="0.5" 
              inputMode="decimal" 
              value={weight} 
              placeholder={unitLabel}
              onChange={(e) => { 
                const val = e.target.value
                setWeight(val === '' ? '' : Number(val))
                emit(val === '' ? '' : Number(val)) 
              }}
            />
            <button 
              className="toggle px-2 py-1" 
              onClick={() => { 
                const currentW = weight === '' ? 0 : Number(weight)
                const w = +(currentW + step).toFixed(1)
                setWeight(w)
                emit(w) 
              }}
            >
              +{step}
            </button>
          </div>
        </div>

        <div className="col-span-3">
          <div className="flex items-center gap-2">
            <button 
              className="toggle px-2 py-1" 
              onClick={() => { 
                const currentR = reps === '' ? 0 : Number(reps)
                const r = Math.max(0, currentR - 1)
                setReps(r === 0 ? '' : r)
                emit(undefined as any, r === 0 ? '' : r) 
              }}
            >
              -1
            </button>
            <input 
              className="input w-full text-center" 
              type="number" 
              inputMode="numeric" 
              value={reps} 
              placeholder="reps"
              onChange={(e) => { 
                const val = e.target.value
                setReps(val === '' ? '' : Number(val))
                emit(undefined as any, val === '' ? '' : Number(val)) 
              }}
            />
            <button 
              className="toggle px-2 py-1" 
              onClick={() => { 
                const currentR = reps === '' ? 0 : Number(reps)
                const r = currentR + 1
                setReps(r)
                emit(undefined as any, r) 
              }}
            >
              +1
            </button>
          </div>
        </div>

        <div className="col-span-2">
          <select 
            className="input w-full" 
            value={type} 
            onChange={(e) => { 
              const t = e.target.value as 'warmup' | 'working'
              setType(t)
              emit(undefined as any, undefined as any, t) 
            }}
          >
            <option value="working">Working</option>
            <option value="warmup">Warm-up</option>
          </select>
        </div>

        <div className="col-span-2 flex gap-1">
          {previousSet && onCopyPrevious && (
            <button className="toggle text-xs px-2 py-1" onClick={onCopyPrevious} title="Copy previous set">
              📋
            </button>
          )}
          <button className="toggle text-xs px-2 py-1" onClick={() => startRestTimer(90)} title="Start rest timer">
            ⏱️
          </button>
          <button className="toggle text-red-400 px-2 py-1" onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}