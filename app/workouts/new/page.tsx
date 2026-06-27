'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  Clock,
  Save,
  Check,
  Flame,
  MapPin,
  FileText,
  Dumbbell,
  RotateCcw,
  Play,
  Pause,
  Timer,
  TrendingUp,
  Calendar,
  Minus,
  MoreHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'
import { savePendingWorkout, trySyncPending } from '@/lib/offline'
import { toDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
import { useDraftAutoSave, getTimeAgo } from '@/hooks/useDraftAutoSave'
import { hapticTap, hapticSuccess } from '@/lib/haptics'
import { detectAndSaveNewPRs, type NewPR } from '@/lib/api/personalRecords'
import { notifyDataChanged } from '@/lib/dataSync'
import PRCelebration from '@/components/PRCelebration'
import { getLastWorkoutSetsForExercises, WorkoutSet as LastWorkoutSet } from '@/lib/workoutSuggestions'
import { searchByName } from '@/lib/exerciseSearch'
import { Button, IconButton } from '@/components/ui/Button'
import { BottomSheet, Modal, ConfirmDialog } from '@/components/ui/BottomSheet'
import { NumberInput, Input, Textarea, Select } from '@/components/ui/Input'
import { AnimatedCard } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

type Exercise = { id: string; name: string; category: string }
type SetData = { weight: number; reps: number; isWarmup: boolean; isCompleted: boolean }
type WorkoutExercise = {
  id: string
  exerciseId: string
  name: string
  sets: SetData[]
  lastWorkout?: { date: string; sets: { weight: number; reps: number }[] }
}

// Rest Timer Component
function RestTimer({ onComplete }: { onComplete?: () => void }) {
  const [seconds, setSeconds] = useState(90)
  const [isRunning, setIsRunning] = useState(false)
  const [initialSeconds, setInitialSeconds] = useState(90)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setIsRunning(false)
            onComplete?.()
            // Vibrate if available
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200])
            }
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, seconds, onComplete])

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = ((initialSeconds - seconds) / initialSeconds) * 100

  if (!isRunning && seconds === initialSeconds) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rest-timer"
    >
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-zinc-700"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            className="text-brand-red"
            strokeDasharray={125.6}
            strokeDashoffset={125.6 * (1 - progress / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
          {formatTime(seconds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className="p-2 rounded-full bg-surface-elevated hover:bg-surface-pressed"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            setSeconds(initialSeconds)
            setIsRunning(false)
          }}
          className="p-2 rounded-full bg-surface-elevated hover:bg-surface-pressed"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setSeconds(initialSeconds)
            setIsRunning(false)
          }}
          className="p-2 rounded-full bg-surface-elevated hover:bg-surface-pressed text-red-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// Set Row Component — Mobile-first two-row layout
function SetRow({
  set,
  setIndex,
  unit,
  onUpdate,
  onRemove,
  onComplete,
  previousSet,
  suggestedSet,
}: {
  set: SetData
  setIndex: number
  unit: string
  onUpdate: (set: SetData) => void
  onRemove: () => void
  onComplete: () => void
  previousSet?: SetData
  suggestedSet?: { weight: number; reps: number }
}) {
  const weightStep = unit === 'kg' ? 2.5 : 5
  const [showActions, setShowActions] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`
        rounded-xl overflow-hidden transition-all duration-200
        ${set.isCompleted
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : set.isWarmup
            ? 'bg-amber-500/[0.07] border border-amber-500/15'
            : 'bg-surface-elevated/50 border border-white/[0.05]'
        }
      `}
    >
      {/* Top row: Set number, warmup toggle, actions, complete */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
            ${set.isWarmup
              ? 'bg-amber-500/20 text-amber-400'
              : set.isCompleted
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-brand-red/15 text-brand-red'
            }
          `}>
            {set.isWarmup ? 'W' : setIndex + 1}
          </div>
          <button
            onClick={() => onUpdate({ ...set, isWarmup: !set.isWarmup })}
            className={`
              px-2.5 py-1 rounded-lg text-xs font-medium transition-all
              ${set.isWarmup
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-transparent text-zinc-500 border border-transparent hover:text-zinc-400'
              }
            `}
          >
            Warmup
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onComplete}
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${set.isCompleted
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-surface-pressed text-zinc-400 hover:text-white'
              }
            `}
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Delete action row (toggleable) */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 overflow-hidden"
          >
            <button
              onClick={() => { onRemove(); setShowActions(false) }}
              className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove Set
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom row: Weight + Reps inputs side by side */}
      <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-1">
        {/* Weight */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 block">
            Weight ({unit})
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdate({ ...set, weight: Math.max(0, set.weight - weightStep) })}
              className="w-11 h-11 rounded-xl bg-surface-pressed text-white font-bold hover:bg-zinc-500/30 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              inputMode="decimal"
              value={set.weight || ''}
              onChange={(e) => onUpdate({ ...set, weight: parseFloat(e.target.value) || 0 })}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-11 bg-surface border border-white/10 rounded-xl text-center text-lg font-semibold focus:border-brand-red focus:ring-1 focus:ring-brand-red/25 focus:outline-none transition-all"
              placeholder="0"
            />
            <button
              onClick={() => onUpdate({ ...set, weight: set.weight + weightStep })}
              className="w-11 h-11 rounded-xl bg-surface-pressed text-white font-bold hover:bg-zinc-500/30 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reps */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1 block">
            Reps
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdate({ ...set, reps: Math.max(0, set.reps - 1) })}
              className="w-11 h-11 rounded-xl bg-surface-pressed text-white font-bold hover:bg-zinc-500/30 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={set.reps || ''}
              onChange={(e) => onUpdate({ ...set, reps: parseInt(e.target.value) || 0 })}
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-11 bg-surface border border-white/10 rounded-xl text-center text-lg font-semibold focus:border-brand-red focus:ring-1 focus:ring-brand-red/25 focus:outline-none transition-all"
              placeholder="0"
            />
            <button
              onClick={() => onUpdate({ ...set, reps: set.reps + 1 })}
              className="w-11 h-11 rounded-xl bg-surface-pressed text-white font-bold hover:bg-zinc-500/30 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Exercise Card Component
function ExerciseCard({
  exercise,
  unit,
  onUpdate,
  onRemove,
  isExpanded,
  onToggle,
}: {
  exercise: WorkoutExercise
  unit: string
  onUpdate: (exercise: WorkoutExercise) => void
  onRemove: () => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const [showRestTimer, setShowRestTimer] = useState(false)
  const completedSets = exercise.sets.filter((s) => s.isCompleted && !s.isWarmup).length
  const totalSets = exercise.sets.filter((s) => !s.isWarmup).length

  const handleSetComplete = (setIndex: number) => {
    const nowCompleted = !exercise.sets[setIndex].isCompleted
    const newSets = exercise.sets.map((s, i) =>
      i === setIndex ? { ...s, isCompleted: nowCompleted } : s
    )
    onUpdate({ ...exercise, sets: newSets })

    // Start the rest timer only when a set is being completed (not un-completed)
    if (nowCompleted) {
      hapticTap()
      setShowRestTimer(true)
    }
  }

  const addSet = () => {
    const newSet: SetData = { weight: 0, reps: 0, isWarmup: false, isCompleted: false }
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] })
  }

  const isEmpty = (s: SetData) => s.weight === 0 && s.reps === 0

  // Tap a previous-workout chip to drop those numbers into the first empty
  // working set (or append a new set if every set is already filled).
  const fillFromHistory = (weight: number, reps: number) => {
    hapticTap()
    const idx = exercise.sets.findIndex((s) => !s.isWarmup && isEmpty(s))
    if (idx >= 0) {
      const newSets = exercise.sets.map((s, i) =>
        i === idx ? { ...s, weight, reps } : s
      )
      onUpdate({ ...exercise, sets: newSets })
    } else {
      onUpdate({
        ...exercise,
        sets: [...exercise.sets, { weight, reps, isWarmup: false, isCompleted: false }],
      })
    }
  }

  // Fill all empty working sets. First empty set falls back to last-workout history,
  // subsequent empty sets copy the most recently filled set in this session.
  // If there are no empty sets, append a new set copying the last one.
  const copyLast = () => {
    const newSets = [...exercise.sets]
    const historySets = exercise.lastWorkout?.sets || []
    const historyFallback = historySets[historySets.length - 1]
    let lastFilled: { weight: number; reps: number } | undefined

    // Seed lastFilled from any non-empty working set that already exists
    for (const s of newSets) {
      if (!s.isWarmup && !isEmpty(s)) lastFilled = { weight: s.weight, reps: s.reps }
    }

    let changed = false
    for (let i = 0; i < newSets.length; i++) {
      const s = newSets[i]
      if (s.isWarmup) continue
      if (!isEmpty(s)) {
        lastFilled = { weight: s.weight, reps: s.reps }
        continue
      }
      const source = lastFilled || (historyFallback
        ? { weight: historyFallback.weight, reps: historyFallback.reps }
        : undefined)
      if (!source) continue
      newSets[i] = { ...s, weight: source.weight, reps: source.reps }
      lastFilled = source
      changed = true
    }

    if (changed) {
      onUpdate({ ...exercise, sets: newSets })
      return
    }

    // No empty sets — fall back to appending a new set copied from the last
    const lastSet = newSets[newSets.length - 1]
    const appended: SetData = lastSet
      ? { ...lastSet, isCompleted: false }
      : historyFallback
        ? { weight: historyFallback.weight, reps: historyFallback.reps, isWarmup: false, isCompleted: false }
        : { weight: 0, reps: 0, isWarmup: false, isCompleted: false }
    onUpdate({ ...exercise, sets: [...newSets, appended] })
  }

  const updateSet = (index: number, set: SetData) => {
    const newSets = [...exercise.sets]
    newSets[index] = set
    onUpdate({ ...exercise, sets: newSets })
  }

  const removeSet = (index: number) => {
    const newSets = exercise.sets.filter((_, i) => i !== index)
    onUpdate({ ...exercise, sets: newSets })
  }

  return (
    <motion.div
      layout
      className="bg-surface-elevated/30 rounded-2xl overflow-hidden border border-white/[0.06]"
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 bg-surface-elevated/50 cursor-pointer active:bg-surface-elevated/70 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-brand-red/15 flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate text-base">{exercise.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-md bg-brand-red/10 text-brand-red text-xs font-medium">
                {completedSets}/{totalSets} sets
              </span>
              {exercise.lastWorkout && (
                <span className="text-zinc-500 text-xs">
                  Last: {new Date(exercise.lastWorkout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-2.5 text-zinc-500 hover:text-red-400 transition-colors rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="p-1">
            <ChevronDown className="w-5 h-5 text-zinc-400" />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 space-y-3">
              {/* Last Workout Reference */}
              {exercise.lastWorkout && exercise.lastWorkout.sets.length > 0 ? (
                <div className="rounded-xl p-3 bg-surface-elevated/40 border border-white/5">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium mb-2 text-zinc-400">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Previous Workout
                    </span>
                    <span className="text-[10px] text-zinc-600 font-normal">tap to fill</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.lastWorkout.sets.slice(0, 5).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => fillFromHistory(s.weight, s.reps)}
                        className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-pressed active:scale-95 rounded-lg text-xs text-zinc-200 font-medium transition-all"
                      >
                        {s.weight}{unit} x {s.reps}
                      </button>
                    ))}
                    {exercise.lastWorkout.sets.length > 5 && (
                      <span className="px-2 py-1 text-xs text-zinc-500">
                        +{exercise.lastWorkout.sets.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3 bg-surface-elevated/50 border border-white/[0.05]">
                  <p className="text-xs text-zinc-500">
                    First time — enter your sets below.
                  </p>
                </div>
              )}

              {/* Sets */}
              <div className="space-y-2">
                <AnimatePresence>
                  {exercise.sets.map((set, index) => (
                    <SetRow
                      key={index}
                      set={set}
                      setIndex={exercise.sets.filter((s, i) => i < index && !s.isWarmup).length}
                      unit={unit}
                      onUpdate={(s) => updateSet(index, s)}
                      onRemove={() => removeSet(index)}
                      onComplete={() => handleSetComplete(index)}
                      previousSet={index > 0 ? exercise.sets[index - 1] : undefined}
                      suggestedSet={exercise.lastWorkout?.sets[index]}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Add Set Buttons — stacked for mobile */}
              <div className="space-y-2 pt-1">
                {(exercise.sets.some((s) => !s.isWarmup && isEmpty(s)) ||
                  (exercise.lastWorkout && exercise.lastWorkout.sets.length > 0) ||
                  exercise.sets.some((s) => !s.isWarmup && !isEmpty(s))) && (
                  <button
                    onClick={copyLast}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-red/10 text-brand-red font-medium hover:bg-brand-red/15 active:scale-[0.99] transition-all border border-brand-red/20"
                  >
                    <Copy className="w-4 h-4" />
                    {exercise.sets.some((s) => !s.isWarmup && isEmpty(s))
                      ? 'Fill Empty Sets'
                      : 'Copy Last Set'}
                  </button>
                )}
                <button
                  onClick={addSet}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-elevated/50 text-zinc-400 hover:text-zinc-300 hover:bg-surface-elevated transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Empty Set
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rest Timer */}
      <AnimatePresence>
        {showRestTimer && <RestTimer onComplete={() => setShowRestTimer(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

// Exercise Selector Bottom Sheet
function ExerciseSelectorSheet({
  isOpen,
  onClose,
  exercises,
  onSelect,
  onCreateCustom,
}: {
  isOpen: boolean
  onClose: () => void
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
  onCreateCustom: (name: string) => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  // Reset search and category when sheet opens
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setCategory('all')
    }
  }, [isOpen])

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'machine', label: 'Machine' },
    { value: 'cable', label: 'Cable' },
    { value: 'other', label: 'Other' },
  ]

  const filtered = useMemo(() => {
    const byCategory = exercises.filter(
      (ex) => category === 'all' || ex.category === category
    )
    return searchByName(byCategory, search)
  }, [exercises, search, category])

  const searchHeader = (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="input w-full pl-4 pr-10"
          autoFocus
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
              transition-all active:scale-95
              ${category === cat.value
                ? 'bg-brand-red text-white shadow-sm shadow-red-500/20'
                : 'bg-surface-elevated text-zinc-400 hover:text-white'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Exercise"
      header={searchHeader}
      snapPoints={[0.5, 0.95]}
      initialSnap={0}
    >
      <div className="space-y-1">
        {filtered.map((ex) => (
          <button
            key={ex.id}
            onClick={() => {
              onSelect(ex)
              onClose()
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-surface-elevated active:bg-surface-pressed transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-red/10 flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-5 h-5 text-brand-red/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white truncate">{ex.name}</p>
              <p className="text-xs text-zinc-500 capitalize">{ex.category}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-600 -rotate-90 flex-shrink-0" />
          </button>
        ))}

        {filtered.length === 0 && search && (
          <div className="text-center py-8">
            <p className="text-zinc-400 mb-4">No exercises found</p>
            <button
              onClick={() => {
                onCreateCustom(search)
                onClose()
              }}
              className="btn"
            >
              Create &ldquo;{search}&rdquo;
            </button>
          </div>
        )}

        {filtered.length === 0 && !search && (
          <p className="text-center text-zinc-500 py-4">No exercises available</p>
        )}
      </div>
    </BottomSheet>
  )
}

// Workout Summary Modal
function WorkoutSummaryModal({
  isOpen,
  onClose,
  summary,
}: {
  isOpen: boolean
  onClose: () => void
  summary: {
    title: string
    duration: number
    exercises: number
    sets: number
    volume: number
    unit: string
  }
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Workout Complete!">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>

        <div className="max-w-full overflow-hidden">
          <h3 className="text-xl font-bold text-white mb-1 break-words">{summary.title || 'Workout'}</h3>
          <p className="text-zinc-400 text-sm">Great job! Here&apos;s your summary:</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-elevated rounded-xl p-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{summary.duration}m</p>
            <p className="text-xs sm:text-sm text-zinc-500">Duration</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{summary.exercises}</p>
            <p className="text-xs sm:text-sm text-zinc-500">Exercises</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{summary.sets}</p>
            <p className="text-xs sm:text-sm text-zinc-500">Sets</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-white truncate">{summary.volume.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-zinc-500">Volume ({summary.unit})</p>
          </div>
        </div>

        <button onClick={onClose} className="btn w-full">
          View History
        </button>
      </div>
    </Modal>
  )
}

// Workout Setup Modal - First step when starting a new workout
function WorkoutSetupModal({
  isOpen,
  onConfirm,
  savedLocations,
  initialDateTime,
  initialLocation,
}: {
  isOpen: boolean
  onConfirm: (dateTime: string, location: string) => void
  savedLocations: string[]
  initialDateTime: string
  initialLocation: string
}) {
  const [dateTime, setDateTime] = useState(initialDateTime)
  const [location, setLocation] = useState(initialLocation)

  // Update state when props change
  useEffect(() => {
    setDateTime(initialDateTime)
  }, [initialDateTime])

  useEffect(() => {
    setLocation(initialLocation)
  }, [initialLocation])

  const handleConfirm = () => {
    onConfirm(dateTime, location)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-surface rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-xl"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-brand-red/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Dumbbell className="w-8 h-8 text-brand-red" />
          </div>
          <h2 className="text-2xl font-display uppercase text-white">Start Workout</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Set the date, time, and location for your workout
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Date & Time */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-brand-red" />
              <h3 className="font-display uppercase text-lg text-white">When</h3>
            </div>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white focus:border-brand-red focus:outline-none transition-colors appearance-none min-w-0 max-w-full"
            />
          </div>

          {/* Location */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-brand-red" />
              <h3 className="font-display uppercase text-lg text-white">Where</h3>
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Home Gym, Planet Fitness"
              list="setup-locations"
              className="w-full px-4 py-3 bg-surface border border-white/[0.07] rounded-xl text-white placeholder-zinc-600 focus:border-brand-red focus:outline-none transition-colors"
            />
            <datalist id="setup-locations">
              {savedLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
            <p className="text-xs text-zinc-500 mt-2">
              Location helps load previous workout data from the same gym
            </p>
          </div>

          {/* Quick Location Buttons */}
          {savedLocations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {savedLocations.slice(0, 4).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`
                    px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95
                    ${location === loc
                      ? 'bg-brand-red text-white shadow-sm shadow-red-500/20'
                      : 'bg-surface-elevated text-zinc-400 hover:text-white'
                    }
                  `}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleConfirm}
            className="btn w-full flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start Workout
          </button>
          <Link
            href="/dashboard"
            className="block text-center text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

// Main Page
export default function NewWorkoutPage() {
  const router = useRouter()
  const toast = useToast()
  const userIdRef = useRef<string | null>(null)
  const startTimeRef = useRef<Date>(new Date())

  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showExerciseSelector, setShowExerciseSelector] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null)
  const [newPRs, setNewPRs] = useState<NewPR[]>([])
  const [showPRCelebration, setShowPRCelebration] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  // Workout details
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [savedLocations, setSavedLocations] = useState<string[]>([])
  const [performedAt, setPerformedAt] = useState(() => toDatetimeLocal())

  // Setup modal - shown first to capture date/time and location
  const [showSetupModal, setShowSetupModal] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)

  // Programs
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [showTemplateSheet, setShowTemplateSheet] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<{ id: string; name: string } | null>(null)
  const [programDays, setProgramDays] = useState<{ id: string; name: string }[]>([])

  // Draft auto-save
  const { saveDraft, loadDraft, clearDraft } = useDraftAutoSave({
    draftKey: 'workout-draft-v2',
    autoSaveInterval: 30000,
    enabled: true,
  })

  // When an in-progress workout is auto-resumed, this holds its save time so
  // we can show a dismissible "resumed" banner instead of a blocking dialog.
  const [resumedDraftAt, setResumedDraftAt] = useState<number | null>(null)

  function restoreDraft(draft: any) {
    // Convert old draft format to new format
    const restoredExercises: WorkoutExercise[] = draft.items.map((item: any) => ({
      id: crypto.randomUUID(),
      exerciseId: item.id,
      name: item.name,
      lastWorkout: item.lastWorkout,
      sets: item.sets.map((s: any) => ({
        weight: s.weight,
        reps: s.reps,
        isWarmup: s.set_type === 'warmup',
        isCompleted: !!s.completed,
      })),
    }))
    setExercises(restoredExercises)
    setTitle(draft.customTitle || '')
    setNotes(draft.note || '')
    setLocation(draft.location || '')
    // Restore original workout timestamp if available
    if (draft.performedAt) {
      setPerformedAt(draft.performedAt)
    }
    if (restoredExercises.length > 0) {
      setExpandedId(restoredExercises[0].id)
    }
    // Skip setup modal since we're resuming an in-progress workout
    setShowSetupModal(false)
    setSetupComplete(true)
    setResumedDraftAt(draft.timestamp || Date.now())
  }

  // Discard the auto-resumed workout and start fresh.
  function discardResumedDraft() {
    clearDraft()
    setExercises([])
    setTitle('')
    setNotes('')
    setExpandedId(null)
    setResumedDraftAt(null)
    setSetupComplete(false)
    setShowSetupModal(true)
  }

  // Load initial data
  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      if (isDemo) {
        setLoading(false)
        return
      }

      const userId = await getActiveUserId()
      if (!userId) {
        if (!DEMO) router.push('/login')
        return
      }

      userIdRef.current = userId
      startTimeRef.current = new Date()

      // Auto-resume an in-progress workout instead of prompting — the user can
      // discard it from the banner if they meant to start fresh. Skip when
      // arriving via the "Repeat workout" flow, which loads its own exercises.
      const isRepeatFlow = new URLSearchParams(window.location.search).get('repeat') === 'true'
      const draft = loadDraft()
      if (!isRepeatFlow && draft && draft.items && draft.items.length > 0) {
        restoreDraft(draft)
      }

      // Check for repeat workout (from WorkoutDetail "Repeat" button)
      const repeatParam = new URLSearchParams(window.location.search).get('repeat')
      if (repeatParam !== 'true') {
        // Clean up any stale repeat data if not coming from repeat flow
        sessionStorage.removeItem('repeat-workout')
      }
      if (repeatParam === 'true') {
        try {
          const repeatData = sessionStorage.getItem('repeat-workout')
          if (repeatData) {
            const parsed = JSON.parse(repeatData)
            sessionStorage.removeItem('repeat-workout')
            const repeatedExercises: WorkoutExercise[] = parsed.exercises.map((ex: any) => ({
              id: crypto.randomUUID(),
              exerciseId: ex.exerciseId,
              name: ex.exerciseName,
              sets: ex.sets.map((s: any) => ({
                weight: s.weight,
                reps: s.reps,
                isWarmup: false,
                isCompleted: false,
              })),
            }))
            setExercises(repeatedExercises)
            setTitle(parsed.title || '')
            if (repeatedExercises.length > 0) setExpandedId(repeatedExercises[0].id)
            setShowSetupModal(false)
            setSetupComplete(true)
            toast.success('Workout loaded — adjust weights as needed!')
          }
        } catch { /* ignore parse errors */ }
      }

      // Load user profile
      const { data: profile } = await supabase.from('profiles').select('unit').eq('id', userId).maybeSingle()
      if (profile?.unit) setUnit(profile.unit as 'lb' | 'kg')

      // Load exercises
      const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
      setAllExercises((ex || []) as Exercise[])

      // Load programs
      const { data: progs } = await supabase.from('programs').select('id,name').order('created_at', { ascending: false })
      setPrograms((progs || []) as { id: string; name: string }[])

      // Load saved locations
      try {
        const { data: locs } = await supabase
          .from('workouts')
          .select('location')
          .eq('user_id', userId)
          .not('location', 'is', null)
          .order('performed_at', { ascending: false })
          .limit(50)
        if (locs) {
          const unique = [...new Set(locs.map((l) => l.location).filter(Boolean))]
          setSavedLocations(unique)
        }
      } catch (e) {
        // Location column might not exist
      }

      await trySyncPending(userId)
      setLoading(false)
    })()
  }, [])

  // Auto-save draft
  useEffect(() => {
    if (exercises.length > 0 || title || notes || location) {
      saveDraft({
        items: exercises.map((ex) => ({
          id: ex.exerciseId,
          name: ex.name,
          lastWorkout: ex.lastWorkout,
          sets: ex.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            set_type: s.isWarmup ? ('warmup' as const) : ('working' as const),
            completed: s.isCompleted,
          })),
        })),
        note: notes,
        customTitle: title,
        location,
        performedAt,
      })
    }
  }, [exercises, title, notes, location, performedAt, saveDraft])

  // Add exercise handler
  const addExercise = useCallback(async (ex: Exercise) => {
    // Check if already added
    if (exercises.some((e) => e.exerciseId === ex.id)) {
      toast.error(`${ex.name} is already in this workout`)
      return
    }

    const newExercise: WorkoutExercise = {
      id: Math.random().toString(36).substring(7),
      exerciseId: ex.id,
      name: ex.name,
      sets: [{ weight: 0, reps: 0, isWarmup: false, isCompleted: false }],
    }

    // Fetch last workout data for recommendation display (don't pre-fill)
    if (userIdRef.current) {
      try {
        const suggestions = await getLastWorkoutSetsForExercises(
          userIdRef.current,
          [ex.id],
          location
        )
        const lastSets = suggestions.get(ex.id)
        if (lastSets && lastSets.length > 0) {
          newExercise.lastWorkout = {
            date: new Date().toISOString(),
            sets: lastSets.map((s) => ({ weight: s.weight, reps: s.reps })),
          }
          // Don't pre-fill - let user see recommendation and enter manually
        }
      } catch (e) {
        console.error('Error fetching suggestions:', e)
      }
    }

    setExercises((prev) => [...prev, newExercise])
    setExpandedId(newExercise.id)
  }, [exercises, location, toast])

  // Create custom exercise
  const createCustomExercise = useCallback(async (name: string) => {
    const userId = await getActiveUserId()
    if (!userId) return

    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name, category: 'other', is_global: false, owner: userId })
      .select('id,name,category')
      .single()

    if (error || !ins) {
      toast.error('Could not create exercise')
      return
    }

    setAllExercises((prev) => [...prev, ins as Exercise])
    addExercise(ins as Exercise)
    toast.success(`Created "${name}"`)
  }, [addExercise, toast])

  // Update exercise
  const updateExercise = useCallback((updated: WorkoutExercise) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === updated.id ? updated : ex))
    )
  }, [])

  // Remove exercise
  const removeExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id))
    if (expandedId === id) {
      setExpandedId(null)
    }
  }, [expandedId])

  // Handle setup modal confirmation
  const handleSetupConfirm = useCallback((dateTime: string, loc: string) => {
    setPerformedAt(dateTime)
    setLocation(loc)
    setShowSetupModal(false)
    setSetupComplete(true)
    // Start the timer when setup is confirmed
    startTimeRef.current = new Date()
  }, [])

  // Save workout
  const saveWorkout = async () => {
    if (saving) return
    setSaving(true)

    try {
      const userId = await getActiveUserId()
      if (!userId) throw new Error('Not logged in')

      // Validate exercises before saving
      if (exercises.length === 0) {
        throw new Error('Add at least one exercise')
      }

      // Filter out exercises with no sets
      const validExercises = exercises.filter(e => e.sets.length > 0)
      if (validExercises.length === 0) {
        throw new Error('Add at least one set to an exercise')
      }

      // Check for duplicate exercise IDs (shouldn't happen but can prevent DB errors)
      const exerciseIds = exercises.map(e => e.exerciseId)
      const uniqueIds = new Set(exerciseIds)
      if (uniqueIds.size !== exerciseIds.length) {
        const duplicates = exerciseIds.filter((id, idx) => exerciseIds.indexOf(id) !== idx)
        const dupExercise = exercises.find(e => e.exerciseId === duplicates[0])
        throw new Error(`Duplicate exercise: ${dupExercise?.name || 'Unknown'}. Please remove one.`)
      }

      // Check for invalid exercise IDs
      for (const ex of exercises) {
        if (!ex.exerciseId) {
          throw new Error(`Invalid exercise data for ${ex.name}. Please remove and re-add it.`)
        }
      }

      const iso = performedAt ? datetimeLocalToISO(performedAt) : new Date().toISOString()

      // Create workout
      const insertData: any = {
        user_id: userId,
        performed_at: iso,
        title: title || null,
        note: notes || null,
      }
      if (location) insertData.location = location

      const { data: w, error } = await supabase
        .from('workouts')
        .insert(insertData)
        .select('id')
        .single()

      if (error || !w) {
        console.error('[saveWorkout] Failed to create workout:', error)
        throw new Error(error?.message || 'Failed to create workout')
      }

      // Add exercises and sets (skip exercises with no sets)
      for (const ex of validExercises) {
        const { data: wex, error: wexError } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: w.id, exercise_id: ex.exerciseId, display_name: ex.name })
          .select('id')
          .single()

        if (wexError || !wex) {
          console.error('[saveWorkout] Failed to add exercise:', ex.name, wexError)
          throw new Error(`Failed to add ${ex.name}: ${wexError?.message || 'Unknown error'}`)
        }

        // Save ALL sets to preserve the workout template structure
        // This ensures incomplete workouts show correct X/Y sets (e.g., 1/3 not 1/1)
        const setsToSave = ex.sets

        if (setsToSave.length > 0) {
          // Try with completed field first, fall back without it if column doesn't exist
          const rowsWithCompleted = setsToSave.map((s, idx) => ({
            workout_exercise_id: wex.id,
            set_index: idx + 1,
            weight: s.weight,
            reps: s.reps,
            set_type: s.isWarmup ? ('warmup' as const) : ('working' as const),
            completed: s.isCompleted,
          }))

          let { error: setsError } = await supabase.from('sets').insert(rowsWithCompleted)

          // If the 'completed' column doesn't exist, retry without it
          if (setsError?.message?.includes('completed') && setsError?.message?.includes('schema')) {
            const rowsWithoutCompleted = setsToSave.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.isWarmup ? ('warmup' as const) : ('working' as const),
            }))
            const result = await supabase.from('sets').insert(rowsWithoutCompleted)
            setsError = result.error
          }

          if (setsError) {
            console.error('[saveWorkout] Failed to save sets:', setsError)
            throw new Error(`Failed to save sets for ${ex.name}: ${setsError.message || 'Unknown error'}`)
          }

        }
      }

      // Verify the data was actually saved by reading it back
      const { data: verifyWex } = await supabase
        .from('workout_exercises')
        .select('id')
        .eq('workout_id', w.id)

      const { data: verifySets } = await supabase
        .from('sets')
        .select('id')
        .in('workout_exercise_id', verifyWex?.map(we => we.id) || [])

      if (!verifyWex?.length) {
        console.error('[saveWorkout] WARNING: No workout_exercises found after save!')
        toast.error('Warning: Workout saved but exercise data may be missing. Please check history.')
      } else if (!verifySets?.length) {
        console.error('[saveWorkout] WARNING: No sets found after save!')
        toast.error('Warning: Workout saved but set data may be missing. Please check history.')
      }

      clearDraft()
      setSavedWorkoutId(w.id)
      hapticSuccess()

      // Detect personal records — celebrate before showing the summary
      let prs: NewPR[] = []
      try {
        prs = await detectAndSaveNewPRs(
          userId,
          w.id,
          exercises.map((ex) => ({ exerciseId: ex.exerciseId, name: ex.name, sets: ex.sets }))
        )
      } catch (e) {
        console.error('PR detection failed:', e)
      }
      if (prs.length > 0) {
        setNewPRs(prs)
        setShowPRCelebration(true)
      } else {
        setShowSummary(true)
      }

      // Notify other pages that workout data changed so they refetch
      notifyDataChanged()

      toast.success(`Workout saved! (${verifyWex?.length || 0} exercises, ${verifySets?.length || 0} sets)`)
    } catch (error: any) {
      console.error('[saveWorkout] Error:', error)
      toast.error(error.message || 'Failed to save workout')
    } finally {
      setSaving(false)
    }
  }

  // Calculate summary
  const summary = useMemo(() => {
    const duration = Math.round((Date.now() - startTimeRef.current.getTime()) / 60000)
    let volume = 0
    let totalSets = 0

    exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (!s.isWarmup && (s.isCompleted || s.weight > 0)) {
          volume += s.weight * s.reps
          totalSets++
        }
      })
    })

    return {
      title: title || 'Workout',
      duration,
      exercises: exercises.length,
      sets: totalSets,
      volume,
      unit,
    }
  }, [exercises, title, unit])

  // Can save check
  const canSave = exercises.some((ex) =>
    ex.sets.some((s) => s.weight > 0 || s.reps > 0)
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark p-4 space-y-4">
        <Skeleton width={200} height={32} />
        <Skeleton height={100} className="rounded-2xl" />
        <Skeleton height={200} className="rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Header */}
      <div
        className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-lg border-b border-red-500/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href="/dashboard" className="p-2.5 -ml-2 rounded-xl hover:bg-white/5 flex-shrink-0 active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">{title || 'New Workout'}</h1>
              <p className="text-sm text-zinc-500">
                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowTemplateSheet(true)}
              className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-400 active:scale-95 transition-all"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
        {/* Resumed-workout banner — shown when an in-progress draft was auto-restored */}
        <AnimatePresence>
          {resumedDraftAt !== null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-100/90 flex-1 min-w-0">
                Resumed your workout from {getTimeAgo(resumedDraftAt)}.
              </p>
              <button
                onClick={discardResumedDraft}
                className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
              >
                Discard
              </button>
              <button
                onClick={() => setResumedDraftAt(null)}
                className="p-1 text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Workout Details Card */}
        <AnimatedCard className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this session"
            className="w-full bg-transparent text-2xl font-semibold text-white placeholder-zinc-700 focus:outline-none"
          />

          {/* Meta rows */}
          <div className="rounded-xl bg-surface-elevated/40 border border-white/5 divide-y divide-white/5">
            <label className="flex items-center gap-3 px-4 py-3">
              <Calendar className="w-4 h-4 text-brand-red/80 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 w-14">Date</span>
              <input
                type="datetime-local"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none text-right"
              />
            </label>
            <label className="flex items-center gap-3 px-4 py-3">
              <MapPin className="w-4 h-4 text-brand-red/80 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 w-14">Where</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add gym"
                list="locations"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none text-right"
              />
              <datalist id="locations">
                {savedLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </label>
          </div>

          {/* Notes */}
          <div className="flex items-start gap-3 px-1">
            <FileText className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none resize-none"
              rows={2}
            />
          </div>
        </AnimatedCard>

        {/* Exercises */}
        <div className="space-y-3">
          <AnimatePresence>
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                unit={unit}
                onUpdate={updateExercise}
                onRemove={() => removeExercise(ex.id)}
                isExpanded={expandedId === ex.id}
                onToggle={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Add Exercise Button — hidden when empty (the empty state has its own CTA) */}
        {exercises.length > 0 && (
          <button
            onClick={() => setShowExerciseSelector(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-red-500/20 text-zinc-400 hover:border-brand-red/40 hover:text-brand-red active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Exercise
          </button>
        )}

        {/* Empty State */}
        {exercises.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto mb-5">
              <Dumbbell className="w-10 h-10 text-brand-red/50" />
            </div>
            <h3 className="text-2xl font-display uppercase text-white mb-2">Let&apos;s build it</h3>
            <p className="text-zinc-500 mb-6 text-sm">Add your first exercise and start logging.</p>
            <button onClick={() => setShowExerciseSelector(true)} className="btn px-8">
              Add First Exercise
            </button>
          </div>
        )}
      </div>

      {/* Save Footer */}
      {exercises.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg border-t border-red-500/10 p-4 z-30" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{summary.exercises} exercises</p>
              <p className="text-xs text-zinc-500">{summary.sets} sets &middot; {summary.volume.toLocaleString()} {summary.unit}</p>
            </div>
            <button
              onClick={() => setShowSaveConfirm(true)}
              disabled={!canSave || saving}
              className="btn flex items-center gap-2 disabled:opacity-50 shadow-glow-red"
            >
              {saving ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Workout
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Exercise Selector */}
      <ExerciseSelectorSheet
        isOpen={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        exercises={allExercises}
        onSelect={addExercise}
        onCreateCustom={createCustomExercise}
      />

      {/* Save Confirmation */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={() => { saveWorkout() }}
        title="Save Workout?"
        message={`Save ${summary.exercises} exercise${summary.exercises !== 1 ? 's' : ''} · ${summary.sets} set${summary.sets !== 1 ? 's' : ''} · ${summary.volume.toLocaleString()} ${summary.unit}?`}
        confirmText="Save"
      />

      {/* PR Celebration — shown before the summary when records were hit */}
      <PRCelebration
        prs={newPRs}
        unit={unit}
        isOpen={showPRCelebration}
        onClose={() => {
          setShowPRCelebration(false)
          setShowSummary(true)
        }}
      />

      {/* Summary Modal */}
      <WorkoutSummaryModal
        isOpen={showSummary}
        onClose={() => {
          setShowSummary(false)
          router.push(savedWorkoutId ? `/history?highlight=${savedWorkoutId}` : '/history')
        }}
        summary={summary}
      />

      {/* Template Sheet - Two step: Program -> Day */}
      <BottomSheet
        isOpen={showTemplateSheet}
        onClose={() => {
          setShowTemplateSheet(false)
          setSelectedProgram(null)
          setProgramDays([])
        }}
        title={selectedProgram ? `${selectedProgram.name} - Select Day` : "Load Template"}
      >
        <div className="space-y-2">
          {/* Back button when viewing days */}
          {selectedProgram && (
            <button
              onClick={() => {
                setSelectedProgram(null)
                setProgramDays([])
              }}
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to programs</span>
            </button>
          )}

          {/* Show program days if a program is selected */}
          {selectedProgram ? (
            loadingTemplate ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : programDays.length > 0 ? (
              programDays.map((day) => (
                <button
                  key={day.id}
                  onClick={async () => {
                    setLoadingTemplate(true)
                    try {
                      // Fetch exercises for this specific day
                      const { data: templateExercises, error: exercisesError } = await supabase
                        .from('template_exercises')
                        .select('exercise_id, display_name, default_sets, default_reps')
                        .eq('program_day_id', day.id)
                        .order('order_index')

                      if (exercisesError) {
                        console.error('Exercises error:', exercisesError)
                        toast.error('Failed to load exercises')
                        return
                      }

                      if (!templateExercises || templateExercises.length === 0) {
                        toast.error('No exercises found in this day')
                        return
                      }

                      // Get all exercise IDs for batch fetching last workout data
                      const exerciseIds = templateExercises.map(te => te.exercise_id)

                      // Batch fetch last workout data for all exercises at once
                      let lastWorkoutMap = new Map<string, { weight: number; reps: number }[]>()
                      if (userIdRef.current && exerciseIds.length > 0) {
                        try {
                          lastWorkoutMap = await getLastWorkoutSetsForExercises(
                            userIdRef.current,
                            exerciseIds,
                            location
                          )
                        } catch (e) {
                          console.error('Error fetching suggestions:', e)
                        }
                      }

                      // Convert template exercises to workout exercises (fast - no async in loop)
                      const newExercises: WorkoutExercise[] = []

                      for (const te of templateExercises) {
                        // Skip if already in workout
                        if (exercises.some(e => e.exerciseId === te.exercise_id)) continue

                        const lastSets = lastWorkoutMap.get(te.exercise_id)

                        const newExercise: WorkoutExercise = {
                          id: crypto.randomUUID(),
                          exerciseId: te.exercise_id,
                          name: te.display_name,
                          // Create empty sets - don't pre-fill weight/reps
                          sets: Array.from({ length: te.default_sets || 3 }, () => ({
                            weight: 0,
                            reps: 0,
                            isWarmup: false,
                            isCompleted: false,
                          })),
                          // Store last workout data for recommendation display
                          lastWorkout: lastSets && lastSets.length > 0 ? {
                            date: new Date().toISOString(),
                            sets: lastSets.map((s) => ({ weight: s.weight, reps: s.reps })),
                          } : undefined,
                        }

                        newExercises.push(newExercise)
                      }

                      if (newExercises.length === 0) {
                        toast.error('All exercises from this day are already added')
                        return
                      }

                      setExercises(prev => [...prev, ...newExercises])
                      setTitle(`${selectedProgram.name} - ${day.name}`)
                      if (newExercises.length > 0) {
                        setExpandedId(newExercises[0].id)
                      }
                      setShowTemplateSheet(false)
                      setSelectedProgram(null)
                      setProgramDays([])
                      toast.success(`Loaded ${newExercises.length} exercises from ${day.name}`)
                    } catch (error) {
                      console.error('Error loading template:', error)
                      toast.error('Failed to load template')
                    } finally {
                      setLoadingTemplate(false)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-elevated/50 hover:bg-surface-elevated transition-colors text-left"
                >
                  <Calendar className="w-5 h-5 text-brand-red" />
                  <span className="font-medium">{day.name}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400 ml-auto -rotate-90" />
                </button>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-zinc-400">No training days found in this program</p>
              </div>
            )
          ) : (
            /* Show programs list */
            programs.length > 0 ? (
              programs.map((prog) => (
                <button
                  key={prog.id}
                  disabled={loadingTemplate}
                  onClick={async () => {
                    setLoadingTemplate(true)
                    setSelectedProgram(prog)
                    try {
                      // Fetch program days
                      const { data: days, error: daysError } = await supabase
                        .from('program_days')
                        .select('id, name')
                        .eq('program_id', prog.id)
                        .order('order_index')

                      if (daysError) {
                        console.error('Days error:', daysError)
                        toast.error('Failed to load program days')
                        setSelectedProgram(null)
                        return
                      }

                      if (!days || days.length === 0) {
                        toast.error('No training days found in this program')
                        setSelectedProgram(null)
                        return
                      }

                      setProgramDays(days)
                    } catch (error) {
                      console.error('Error loading program:', error)
                      toast.error('Failed to load program')
                      setSelectedProgram(null)
                    } finally {
                      setLoadingTemplate(false)
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-elevated/50 hover:bg-surface-elevated transition-colors text-left disabled:opacity-50"
                >
                  <FileText className={`w-5 h-5 text-zinc-400 ${loadingTemplate ? 'animate-pulse' : ''}`} />
                  <span className="font-medium">{prog.name}</span>
                  {loadingTemplate ? (
                    <Clock className="w-4 h-4 animate-spin ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400 ml-auto -rotate-90" />
                  )}
                </button>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-zinc-400 mb-4">No programs yet</p>
                <Link href="/programs" className="btn btn-sm">
                  Create Program
                </Link>
              </div>
            )
          )}
        </div>
      </BottomSheet>

      {/* Setup Modal - Shown first to set date/time and location */}
      <WorkoutSetupModal
        isOpen={showSetupModal && !loading}
        onConfirm={handleSetupConfirm}
        savedLocations={savedLocations}
        initialDateTime={performedAt}
        initialLocation={location}
      />
    </div>
  )
}
