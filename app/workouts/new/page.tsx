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
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'
import { savePendingWorkout, trySyncPending } from '@/lib/offline'
import { useDraftAutoSave, getTimeAgo } from '@/hooks/useDraftAutoSave'
import { getLastWorkoutSetsForExercises, WorkoutSet as LastWorkoutSet } from '@/lib/workoutSuggestions'
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
          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() => {
            setSeconds(initialSeconds)
            setIsRunning(false)
          }}
          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setSeconds(initialSeconds)
            setIsRunning(false)
          }}
          className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-red-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// Set Row Component
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        flex items-center gap-2 p-3 rounded-xl
        ${set.isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-800/50'}
        ${set.isWarmup ? 'border-l-4 border-l-amber-500' : ''}
      `}
    >
      {/* Set Number */}
      <div className="w-8 text-center">
        <span className={`text-sm font-medium ${set.isWarmup ? 'text-amber-400' : 'text-zinc-400'}`}>
          {set.isWarmup ? 'W' : setIndex + 1}
        </span>
      </div>

      {/* Weight Input */}
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ ...set, weight: Math.max(0, set.weight - weightStep) })}
            className="w-8 h-10 rounded-lg bg-zinc-700 text-white font-bold hover:bg-zinc-600 active:scale-95 transition-all"
          >
            -
          </button>
          <input
            type="number"
            value={set.weight || ''}
            onChange={(e) => onUpdate({ ...set, weight: parseFloat(e.target.value) || 0 })}
            className="w-16 h-10 bg-zinc-900 border border-zinc-700 rounded-lg text-center font-semibold focus:border-brand-red focus:outline-none"
            placeholder="0"
          />
          <button
            onClick={() => onUpdate({ ...set, weight: set.weight + weightStep })}
            className="w-8 h-10 rounded-lg bg-zinc-700 text-white font-bold hover:bg-zinc-600 active:scale-95 transition-all"
          >
            +
          </button>
        </div>
        <span className="text-2xs text-zinc-500 block text-center mt-0.5">{unit}</span>
      </div>

      {/* Reps Input */}
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ ...set, reps: Math.max(0, set.reps - 1) })}
            className="w-8 h-10 rounded-lg bg-zinc-700 text-white font-bold hover:bg-zinc-600 active:scale-95 transition-all"
          >
            -
          </button>
          <input
            type="number"
            value={set.reps || ''}
            onChange={(e) => onUpdate({ ...set, reps: parseInt(e.target.value) || 0 })}
            className="w-12 h-10 bg-zinc-900 border border-zinc-700 rounded-lg text-center font-semibold focus:border-brand-red focus:outline-none"
            placeholder="0"
          />
          <button
            onClick={() => onUpdate({ ...set, reps: set.reps + 1 })}
            className="w-8 h-10 rounded-lg bg-zinc-700 text-white font-bold hover:bg-zinc-600 active:scale-95 transition-all"
          >
            +
          </button>
        </div>
        <span className="text-2xs text-zinc-500 block text-center mt-0.5">reps</span>
      </div>

      {/* Complete Button */}
      <button
        onClick={onComplete}
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-200
          ${set.isCompleted
            ? 'bg-emerald-500 text-white'
            : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          }
        `}
      >
        <Check className="w-5 h-5" />
      </button>

      {/* Actions */}
      <div className="flex items-center">
        <button
          onClick={onRemove}
          className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
    const newSets = [...exercise.sets]
    newSets[setIndex].isCompleted = !newSets[setIndex].isCompleted
    onUpdate({ ...exercise, sets: newSets })

    // Start rest timer if completing a set
    if (!newSets[setIndex].isCompleted === false) {
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
      className="bg-zinc-900 rounded-2xl overflow-hidden border border-white/5"
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 bg-zinc-800/50 cursor-pointer"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-red/20 flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{exercise.name}</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{completedSets}/{totalSets} sets</span>
              {exercise.lastWorkout && (
                <span className="text-zinc-500">
                  Last: {new Date(exercise.lastWorkout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
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
              {exercise.lastWorkout && exercise.lastWorkout.sets.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
                    <TrendingUp className="w-4 h-4" />
                    Last Workout
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exercise.lastWorkout.sets.slice(0, 5).map((s, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-500/20 rounded-lg text-sm text-blue-300">
                        {s.weight}{unit} x {s.reps}
                      </span>
                    ))}
                    {exercise.lastWorkout.sets.length > 5 && (
                      <span className="px-2 py-1 text-sm text-blue-400">
                        +{exercise.lastWorkout.sets.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Sets */}
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

              {/* Add Set Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => addSet(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Set
                </button>
                {exercise.sets.length > 0 && (
                  <button
                    onClick={() => addSet(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Last
                  </button>
                )}
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

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'barbell', label: 'Barbell' },
    { value: 'dumbbell', label: 'Dumbbell' },
    { value: 'machine', label: 'Machine' },
    { value: 'cable', label: 'Cable' },
    { value: 'other', label: 'Other' },
  ]

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = category === 'all' || ex.category === category
      return matchesSearch && matchesCategory
    })
  }, [exercises, search, category])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Exercise">
      <div className="space-y-4">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises..."
          className="input w-full"
          autoFocus
        />

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                transition-colors
                ${category === cat.value
                  ? 'bg-brand-red text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Exercise List */}
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => {
                onSelect(ex)
                onClose()
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-white">{ex.name}</p>
                <p className="text-sm text-zinc-500 capitalize">{ex.category}</p>
              </div>
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
                Create "{search}"
              </button>
            </div>
          )}
        </div>
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
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-1">{summary.title || 'Workout'}</h3>
          <p className="text-zinc-400">Great job! Here's your summary:</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{summary.duration}m</p>
            <p className="text-sm text-zinc-400">Duration</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{summary.exercises}</p>
            <p className="text-sm text-zinc-400">Exercises</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{summary.sets}</p>
            <p className="text-sm text-zinc-400">Sets</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{summary.volume.toLocaleString()}</p>
            <p className="text-sm text-zinc-400">Volume ({summary.unit})</p>
          </div>
        </div>

        <button onClick={onClose} className="btn w-full">
          View History
        </button>
      </div>
    </Modal>
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

  // Workout details
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [savedLocations, setSavedLocations] = useState<string[]>([])
  const [performedAt, setPerformedAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })

  // Programs
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])
  const [showTemplateSheet, setShowTemplateSheet] = useState(false)

  // Draft auto-save
  const { saveDraft, loadDraft, clearDraft } = useDraftAutoSave({
    draftKey: 'workout-draft-v2',
    autoSaveInterval: 30000,
    enabled: true,
  })

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
        if (!DEMO) window.location.href = '/login'
        return
      }

      userIdRef.current = userId
      startTimeRef.current = new Date()

      // Try to restore draft
      const draft = loadDraft()
      if (draft && draft.items && draft.items.length > 0) {
        const shouldRestore = confirm(
          `Found unsaved workout from ${getTimeAgo(draft.timestamp)}. Restore it?`
        )
        if (shouldRestore) {
          // Convert old draft format to new format
          const restoredExercises: WorkoutExercise[] = draft.items.map((item: any) => ({
            id: Math.random().toString(36).substring(7),
            exerciseId: item.id,
            name: item.name,
            sets: item.sets.map((s: any) => ({
              weight: s.weight,
              reps: s.reps,
              isWarmup: s.set_type === 'warmup',
              isCompleted: false,
            })),
          }))
          setExercises(restoredExercises)
          setTitle(draft.customTitle || '')
          setNotes(draft.note || '')
          setLocation(draft.location || '')
          if (restoredExercises.length > 0) {
            setExpandedId(restoredExercises[0].id)
          }
          toast.success('Draft restored!')
        } else {
          clearDraft()
        }
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
          sets: ex.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            set_type: s.isWarmup ? 'warmup' : 'working',
          })),
        })),
        note: notes,
        customTitle: title,
        location,
      })
    }
  }, [exercises, title, notes, location, saveDraft])

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
            date: new Date().toISOString(), // Shows as recent
            sets: lastSets.map((s) => ({ weight: s.weight, reps: s.reps })),
          }
          // Pre-fill first set from last workout
          newExercise.sets[0].weight = lastSets[0].weight
          newExercise.sets[0].reps = lastSets[0].reps
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

  // Save workout
  const saveWorkout = async () => {
    if (saving) return
    setSaving(true)

    try {
      const userId = await getActiveUserId()
      if (!userId) throw new Error('Not logged in')

      const iso = performedAt ? new Date(performedAt).toISOString() : new Date().toISOString()

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

      if (error || !w) throw new Error(error?.message || 'Failed to create workout')

      // Add exercises and sets
      for (const ex of exercises) {
        const { data: wex, error: wexError } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: w.id, exercise_id: ex.exerciseId, display_name: ex.name })
          .select('id')
          .single()

        if (wexError || !wex) throw new Error(`Failed to add ${ex.name}`)

        const workingSets = ex.sets.filter((s) => s.isCompleted || s.weight > 0 || s.reps > 0)
        if (workingSets.length > 0) {
          const rows = workingSets.map((s, idx) => ({
            workout_exercise_id: wex.id,
            set_index: idx + 1,
            weight: s.weight,
            reps: s.reps,
            set_type: s.isWarmup ? 'warmup' : 'working',
          }))
          await supabase.from('sets').insert(rows)
        }
      }

      clearDraft()
      setSavedWorkoutId(w.id)
      setShowSummary(true)
      toast.success('Workout saved!')
    } catch (error: any) {
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
      <div className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg">{title || 'New Workout'}</h1>
              <p className="text-sm text-zinc-400">
                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplateSheet(true)}
              className="p-2 rounded-xl hover:bg-white/5 text-zinc-400"
            >
              <FileText className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
        {/* Workout Details Card */}
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
          className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-brand-red hover:text-brand-red transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>

        {/* Empty State */}
        {exercises.length === 0 && (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">No exercises yet</h3>
            <p className="text-zinc-500 mb-6">Add exercises to start building your workout</p>
            <button onClick={() => setShowExerciseSelector(true)} className="btn">
              Add First Exercise
            </button>
          </div>
        )}
      </div>

      {/* Save Footer */}
      {exercises.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-white/5 p-4 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <p className="font-medium">{summary.exercises} exercises</p>
              <p className="text-sm text-zinc-400">{summary.sets} sets</p>
            </div>
            <button
              onClick={saveWorkout}
              disabled={!canSave || saving}
              className="btn flex items-center gap-2 disabled:opacity-50"
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

      {/* Summary Modal */}
      <WorkoutSummaryModal
        isOpen={showSummary}
        onClose={() => {
          setShowSummary(false)
          router.push(savedWorkoutId ? `/history?highlight=${savedWorkoutId}` : '/history')
        }}
        summary={summary}
      />

      {/* Template Sheet (simplified) */}
      <BottomSheet
        isOpen={showTemplateSheet}
        onClose={() => setShowTemplateSheet(false)}
        title="Load Template"
      >
        <div className="space-y-2">
          {programs.length > 0 ? (
            programs.map((prog) => (
              <button
                key={prog.id}
                onClick={async () => {
                  try {
                    // Fetch program days and their exercises
                    const { data: days } = await supabase
                      .from('program_days')
                      .select('id, name')
                      .eq('program_id', prog.id)
                      .order('order_index')

                    if (!days || days.length === 0) {
                      toast.error('No exercises found in this program')
                      return
                    }

                    // Fetch all template exercises for this program's days
                    const dayIds = days.map(d => d.id)
                    const { data: templateExercises } = await supabase
                      .from('template_exercises')
                      .select('exercise_id, display_name, default_sets, default_reps, program_day_id')
                      .in('program_day_id', dayIds)
                      .order('order_index')

                    if (!templateExercises || templateExercises.length === 0) {
                      toast.error('No exercises found in this program')
                      return
                    }

                    // Convert template exercises to workout exercises
                    const newExercises: WorkoutExercise[] = []

                    for (const te of templateExercises) {
                      // Skip if already in workout
                      if (exercises.some(e => e.exerciseId === te.exercise_id)) continue

                      const newExercise: WorkoutExercise = {
                        id: Math.random().toString(36).substring(7),
                        exerciseId: te.exercise_id,
                        name: te.display_name,
                        sets: Array.from({ length: te.default_sets || 3 }, () => ({
                          weight: 0,
                          reps: te.default_reps || 0,
                          isWarmup: false,
                          isCompleted: false,
                        })),
                      }

                      // Fetch last workout data for suggestions
                      if (userIdRef.current) {
                        try {
                          const suggestions = await getLastWorkoutSetsForExercises(
                            userIdRef.current,
                            [te.exercise_id],
                            location
                          )
                          const lastSets = suggestions.get(te.exercise_id)
                          if (lastSets && lastSets.length > 0) {
                            newExercise.lastWorkout = {
                              date: new Date().toISOString(),
                              sets: lastSets.map((s) => ({ weight: s.weight, reps: s.reps })),
                            }
                            // Pre-fill sets from last workout
                            newExercise.sets = newExercise.sets.map((set, idx) => ({
                              ...set,
                              weight: lastSets[idx]?.weight || lastSets[0]?.weight || 0,
                              reps: lastSets[idx]?.reps || te.default_reps || 0,
                            }))
                          }
                        } catch (e) {
                          console.error('Error fetching suggestions:', e)
                        }
                      }

                      newExercises.push(newExercise)
                    }

                    if (newExercises.length === 0) {
                      toast.error('All exercises from this program are already added')
                      return
                    }

                    setExercises(prev => [...prev, ...newExercises])
                    setTitle(prog.name)
                    if (newExercises.length > 0) {
                      setExpandedId(newExercises[0].id)
                    }
                    setShowTemplateSheet(false)
                    toast.success(`Loaded ${newExercises.length} exercises from ${prog.name}`)
                  } catch (error) {
                    console.error('Error loading template:', error)
                    toast.error('Failed to load template')
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800 transition-colors text-left"
              >
                <FileText className="w-5 h-5 text-zinc-400" />
                <span>{prog.name}</span>
              </button>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-zinc-400 mb-4">No programs yet</p>
              <Link href="/programs" className="btn btn-sm">
                Create Program
              </Link>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
