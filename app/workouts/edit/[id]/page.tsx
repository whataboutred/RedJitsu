'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isoToDatetimeLocal, datetimeLocalToISO } from '@/lib/dateUtils'
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
import { isUuid } from '@/lib/validation'
import { useToast } from '@/components/Toast'
import { useDraftAutoSave, getTimeAgo } from '@/hooks/useDraftAutoSave'
import { saveWorkout as saveWorkoutApi, deleteWorkout } from '@/lib/api/workouts'
import { hapticTap, hapticSuccess } from '@/lib/haptics'
import { getLastWorkoutSetsForExercises, WorkoutSet as LastWorkoutSet } from '@/lib/workoutSuggestions'
import { searchByName } from '@/lib/exerciseSearch'
import { Button, IconButton } from '@/components/ui/Button'
import { BottomSheet, Modal, ConfirmDialog } from '@/components/ui/BottomSheet'
import { NumberInput, Input, Textarea, Select } from '@/components/ui/Input'
import { AnimatedCard } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

type Exercise = { id: string; name: string; category: string }
// isBodyweight is a UI-level flag: the set saves as weight 0 (the app's
// bodyweight convention) but the editor hides the weight input.
type SetData = { weight: number; reps: number; isWarmup: boolean; isCompleted: boolean; isBodyweight?: boolean }
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

// Set Row Component — Mobile-first two-row layout (matches create page)
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
          <button
            onClick={() => onUpdate({ ...set, isBodyweight: !set.isBodyweight, weight: 0 })}
            className={`
              px-2.5 py-1 rounded-lg text-xs font-medium transition-all
              ${set.isBodyweight
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'bg-transparent text-zinc-500 border border-transparent hover:text-zinc-400'
              }
            `}
          >
            BW
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Set options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onComplete}
            aria-label={set.isCompleted ? 'Mark set incomplete' : 'Mark set complete'}
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
          {set.isBodyweight ? (
            <div className="h-11 rounded-xl bg-surface border border-sky-500/20 flex items-center justify-center text-sm font-semibold text-sky-400/90">
              Bodyweight
            </div>
          ) : (
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
          )}
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

// Exercise Card Component - matches create page
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
    // Immutable update — mutating the spread-copied objects shares references
    // with the previous state and can drop React updates.
    const nowCompleted = !exercise.sets[setIndex].isCompleted
    const newSets = exercise.sets.map((s, i) =>
      i === setIndex ? { ...s, isCompleted: nowCompleted } : s
    )
    onUpdate({ ...exercise, sets: newSets })

    // Start rest timer only when completing (not un-completing) a set
    if (nowCompleted) {
      hapticTap()
      setShowRestTimer(true)
    }
  }

  const addSet = (copyLast = false) => {
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const newSet: SetData = copyLast && lastSet
      ? { ...lastSet, isCompleted: false }
      : { weight: 0, reps: 0, isWarmup: false, isCompleted: false }
    onUpdate({ ...exercise, sets: [...exercise.sets, newSet] })
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
      className="bg-surface rounded-2xl overflow-hidden border border-white/[0.07] border-l-2 border-l-brand-red/40"
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
                  <div className="flex items-center gap-2 text-xs font-medium mb-2 text-zinc-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Previous Workout
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {exercise.lastWorkout.sets.slice(0, 5).map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-surface-elevated rounded-lg text-xs text-zinc-200 font-medium">
                        {s.weight > 0 ? `${s.weight}${unit}` : 'BW'} x {s.reps}
                      </span>
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
                {exercise.sets.length > 0 && (
                  <button
                    onClick={() => addSet(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-red/10 text-brand-red font-medium hover:bg-brand-red/15 active:scale-[0.99] transition-all border border-brand-red/20"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Last Set
                  </button>
                )}
                <button
                  onClick={() => addSet(false)}
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

// Exercise Selector Bottom Sheet - matches create page
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
              px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
              transition-all active:scale-95
              ${category === cat.value
                ? 'bg-brand-red text-white shadow-sm shadow-red-500/20'
                : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white'
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

export default function EditWorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const workoutId = params.id as string
  const toast = useToast()

  // State
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [savedLocations, setSavedLocations] = useState<string[]>([])
  const [performedAt, setPerformedAt] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [allExercises, setAllExercises] = useState<Exercise[]>([])

  // Sheets
  const [showExerciseSelector, setShowExerciseSelector] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)

  const userIdRef = useRef<string | null>(null)
  const initialLoadRef = useRef(true)
  const pendingDraftRef = useRef<any>(null)

  // Draft auto-save for edit page
  const draftKey = `workout-edit-draft-${workoutId}`
  const {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    lastSaved,
  } = useDraftAutoSave({
    draftKey,
    autoSaveInterval: 15000,
    enabled: !loading,
  })

  // Load workout data
  useEffect(() => {
    loadData()
  }, [workoutId])

  async function loadData() {
    if (!isUuid(workoutId)) {
      toast.error('Workout not found')
      router.push('/history')
      return
    }

    const isDemo = await isDemoVisitor()
    if (isDemo) {
      router.push('/login')
      return
    }

    const userId = await getActiveUserId()
    if (!userId) {
      router.push('/login')
      return
    }
    userIdRef.current = userId

    // Load user preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('unit')
      .eq('id', userId)
      .single()
    if (profile?.unit) setUnit(profile.unit as 'lb' | 'kg')

    // Load all exercises
    const { data: exs } = await supabase.from('exercises').select('id, name, category').order('name')
    if (exs) setAllExercises(exs as Exercise[])

    // Load saved locations
    try {
      const { data: locations } = await supabase
        .from('workouts')
        .select('location')
        .eq('user_id', userId)
        .not('location', 'is', null)
        .order('performed_at', { ascending: false })
        .limit(100)

      if (locations) {
        const uniqueLocations = [...new Set(locations.map(l => l.location).filter(Boolean))]
        setSavedLocations(uniqueLocations)
      }
    } catch (e) {
      // Location column not available
    }

    // Load workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', userId)
      .single()

    if (workoutError || !workout) {
      toast.error('Workout not found')
      router.push('/history')
      return
    }

    setPerformedAt(isoToDatetimeLocal(workout.performed_at))
    setNotes(workout.note || '')
    setTitle(workout.title || '')
    if (workout.location) setLocation(workout.location)

    // Load workout exercises
    const { data: workoutExercises } = await supabase
      .from('workout_exercises')
      .select(`
        id,
        display_name,
        exercise_id,
        sets (weight, reps, set_type, set_index, completed)
      `)
      .eq('workout_id', workoutId)
      .order('order_index')

    if (workoutExercises) {
      const exerciseIds = workoutExercises.map(we => we.exercise_id).filter(Boolean)

      // Batch fetch last workout data
      let lastWorkoutMap = new Map<string, { weight: number; reps: number }[]>()
      if (exerciseIds.length > 0) {
        try {
          lastWorkoutMap = await getLastWorkoutSetsForExercises(userId, exerciseIds, workout.location ?? undefined)
        } catch (e) {
          console.error('Error fetching suggestions:', e)
        }
      }

      const loadedExercises: WorkoutExercise[] = workoutExercises.map(we => {
        const lastSets = lastWorkoutMap.get(we.exercise_id)
        return {
          id: crypto.randomUUID(),
          exerciseId: we.exercise_id || we.id,
          name: we.display_name,
          sets: (we.sets as any[])
            .sort((a, b) => a.set_index - b.set_index)
            .map(s => ({
              weight: s.weight || 0,
              reps: s.reps || 0,
              isWarmup: s.set_type === 'warmup',
              isCompleted: s.completed ?? false,
              // Weight 0 with reps recorded is the bodyweight convention
              isBodyweight: (s.weight || 0) === 0 && (s.reps || 0) > 0,
            })),
          lastWorkout: lastSets && lastSets.length > 0 ? {
            date: new Date().toISOString(),
            sets: lastSets.map(s => ({ weight: s.weight, reps: s.reps })),
          } : undefined,
        }
      })

      setExercises(loadedExercises)
      if (loadedExercises.length > 0) {
        setExpandedId(loadedExercises[0].id)
      }
    }

    setLoading(false)

    // Check for saved draft after loading
    const existingDraft = loadDraft()
    if (existingDraft && existingDraft.items.length > 0) {
      pendingDraftRef.current = existingDraft
      setShowRestoreConfirm(true)
    }

    initialLoadRef.current = false
  }

  // Restore draft data
  const restoreDraft = useCallback(() => {
    const draft = pendingDraftRef.current
    if (!draft) return

    // Restore exercises
    if (draft.items && draft.items.length > 0) {
      const restoredExercises: WorkoutExercise[] = draft.items.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        exerciseId: item.exerciseId,
        name: item.name,
        sets: item.sets.map((s: any) => ({
          weight: s.weight || 0,
          reps: s.reps || 0,
          isWarmup: s.isWarmup || false,
          isCompleted: s.isCompleted || false,
        })),
        lastWorkout: item.lastWorkout,
      }))
      setExercises(restoredExercises)
      if (restoredExercises.length > 0) {
        setExpandedId(restoredExercises[0].id)
      }
    }

    // Restore metadata
    if (draft.customTitle !== undefined) setTitle(draft.customTitle)
    if (draft.note !== undefined) setNotes(draft.note)
    if (draft.location !== undefined) setLocation(draft.location)

    pendingDraftRef.current = null
    setShowRestoreConfirm(false)
    toast.success('Draft restored')
  }, [toast])

  // Discard draft
  const discardDraft = useCallback(() => {
    clearDraft()
    pendingDraftRef.current = null
    setShowRestoreConfirm(false)
  }, [clearDraft])

  // Auto-save draft when data changes
  useEffect(() => {
    if (loading || initialLoadRef.current) return

    const draftData = {
      items: exercises.map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets,
        lastWorkout: ex.lastWorkout,
      })),
      note: notes,
      customTitle: title,
      location: location,
    }

    saveDraft(draftData)
  }, [exercises, notes, title, location, loading, saveDraft])

  // Add exercise
  const addExercise = useCallback(async (ex: Exercise) => {
    if (exercises.some((e) => e.exerciseId === ex.id)) {
      toast.error(`${ex.name} is already in this workout`)
      return
    }

    const newExercise: WorkoutExercise = {
      id: crypto.randomUUID(),
      exerciseId: ex.id,
      name: ex.name,
      sets: [{ weight: 0, reps: 0, isWarmup: false, isCompleted: false }],
    }

    // Fetch last workout data
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
        }
      } catch (e) {
        console.error('Error fetching suggestions:', e)
      }
    }

    setExercises((prev) => [...prev, newExercise])
    setExpandedId(newExercise.id)
    setShowExerciseSelector(false)
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

  // Calculate summary
  const summary = useMemo(() => {
    let totalSets = 0

    exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (!s.isWarmup && (s.isCompleted || s.weight > 0)) {
          totalSets++
        }
      })
    })

    return {
      exercises: exercises.length,
      sets: totalSets,
    }
  }, [exercises])

  // Save workout
  const handleSave = async () => {
    if (saving) return
    setSaving(true)

    try {
      const userId = userIdRef.current
      if (!userId) throw new Error('Not logged in')

      if (exercises.length === 0) {
        throw new Error('Add at least one exercise')
      }

      // Check for duplicate exercise IDs
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

      // Atomic full replace via the save_workout RPC: header, exercises, and
      // sets all commit or none do — no more delete-then-fail data loss.
      await saveWorkoutApi({
        workout_id: workoutId,
        performed_at: datetimeLocalToISO(performedAt),
        title: title || null,
        note: notes || null,
        location: location || null,
        exercises: exercises.map((ex) => ({
          exercise_id: ex.exerciseId,
          display_name: ex.name,
          sets: ex.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            set_type: s.isWarmup ? ('warmup' as const) : ('working' as const),
            completed: s.isCompleted,
          })),
        })),
      })

      clearDraft()
      hapticSuccess()
      toast.success('Workout updated')
      router.push('/history')
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Delete workout — children cascade in the database
  const handleDelete = async () => {
    try {
      const userId = userIdRef.current
      if (!userId) return

      await deleteWorkout(workoutId, userId)

      toast.success('Workout deleted')
      router.push('/history')
    } catch (error: any) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete workout')
    }
  }

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
            <Link href="/history" className="p-2.5 -ml-2 rounded-xl hover:bg-white/5 flex-shrink-0 active:scale-95 transition-all" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display uppercase text-lg text-white truncate">{title || 'Edit Workout'}</h1>
              <p className="text-sm text-zinc-500">
                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                {lastSaved && (
                  <span className="text-emerald-400 ml-2">
                    Draft saved {getTimeAgo(lastSaved)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 active:scale-95 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
        {/* Workout Details Card - matches create page */}
        <AnimatedCard className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Workout name (optional)"
            className="w-full bg-transparent text-xl font-semibold placeholder-zinc-600 focus:outline-none"
          />

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Calendar className="w-4 h-4" />
              <input
                type="datetime-local"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                className="bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <MapPin className="w-4 h-4" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                list="locations"
                className="bg-transparent focus:outline-none w-32"
              />
              <datalist id="locations">
                {savedLocations.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            className="w-full bg-transparent text-sm text-zinc-400 placeholder-zinc-600 focus:outline-none resize-none"
            rows={2}
          />
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

        {/* Add Exercise Button */}
        <button
          onClick={() => setShowExerciseSelector(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-red-500/20 text-zinc-400 hover:border-brand-red/40 hover:text-brand-red active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>

        {/* Empty State */}
        {exercises.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto mb-5">
              <Dumbbell className="w-10 h-10 text-brand-red/50" />
            </div>
            <h3 className="text-2xl font-display uppercase text-white mb-2">No exercises yet</h3>
            <p className="text-zinc-500 mb-6 text-sm">Tap below to start building your workout</p>
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
              <p className="text-xs text-zinc-500">{summary.sets} sets</p>
            </div>
            <button
              onClick={handleSave}
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
                  Update Workout
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Exercise Selector - matches create page */}
      <ExerciseSelectorSheet
        isOpen={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        exercises={allExercises}
        onSelect={addExercise}
        onCreateCustom={createCustomExercise}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Workout?"
        message="This will permanently delete this workout and all its data. This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      {/* Restore Draft Confirmation */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={discardDraft}
        onConfirm={restoreDraft}
        title="Restore Draft?"
        message={`You have unsaved changes from ${pendingDraftRef.current ? getTimeAgo(pendingDraftRef.current.timestamp) : 'earlier'}. Would you like to restore them?`}
        confirmText="Restore"
        cancelText="Discard"
      />
    </div>
  )
}
