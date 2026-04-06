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
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'
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

// Set Row Component - matches create page
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
              <div className={`rounded-xl p-3 ${
                exercise.lastWorkout && exercise.lastWorkout.sets.length > 0
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-zinc-800/50 border border-zinc-700/50'
              }`}>
                <div className={`flex items-center gap-2 text-sm font-medium mb-2 ${
                  exercise.lastWorkout && exercise.lastWorkout.sets.length > 0
                    ? 'text-blue-400'
                    : 'text-zinc-500'
                }`}>
                  <TrendingUp className="w-4 h-4" />
                  {exercise.lastWorkout && exercise.lastWorkout.sets.length > 0
                    ? 'Previous Workout'
                    : 'No Previous Data'}
                </div>
                {exercise.lastWorkout && exercise.lastWorkout.sets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {exercise.lastWorkout.sets.slice(0, 5).map((s, i) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-500/20 rounded-lg text-sm text-blue-300 font-medium">
                        {s.weight}{unit} × {s.reps}
                      </span>
                    ))}
                    {exercise.lastWorkout.sets.length > 5 && (
                      <span className="px-2 py-1 text-sm text-blue-400">
                        +{exercise.lastWorkout.sets.length - 5} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    This is your first time doing this exercise. Enter your sets below.
                  </p>
                )}
              </div>

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

  const searchHeader = (
    <div className="space-y-3">
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
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
          <div className="text-center py-6">
            <p className="text-zinc-400 mb-4">No exercises found</p>
            <button
              onClick={() => {
                onCreateCustom(search)
                onClose()
              }}
              className="btn"
            >
              Create &quot;{search}&quot;
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
          lastWorkoutMap = await getLastWorkoutSetsForExercises(userId, exerciseIds, workout.location)
        } catch (e) {
          console.error('Error fetching suggestions:', e)
        }
      }

      const loadedExercises: WorkoutExercise[] = workoutExercises.map(we => {
        const lastSets = lastWorkoutMap.get(we.exercise_id)
        return {
          id: Math.random().toString(36).substring(7),
          exerciseId: we.exercise_id || we.id,
          name: we.display_name,
          sets: (we.sets as any[])
            .sort((a, b) => a.set_index - b.set_index)
            .map(s => ({
              weight: s.weight || 0,
              reps: s.reps || 0,
              isWarmup: s.set_type === 'warmup',
              isCompleted: s.completed ?? false,
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
        id: item.id || Math.random().toString(36).substring(7),
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
    toast.success('Draft restored!')
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

      // Update workout
      const updateData: any = {
        performed_at: datetimeLocalToISO(performedAt),
        title: title || null,
        note: notes || null,
      }
      if (location) updateData.location = location

      const { error: workoutError } = await supabase
        .from('workouts')
        .update(updateData)
        .eq('id', workoutId)
        .eq('user_id', userId)

      if (workoutError) throw new Error(workoutError.message)

      // Get current exercises
      const { data: currentExercises } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id')
        .eq('workout_id', workoutId)

      // Delete removed exercises
      if (currentExercises) {
        const currentIds = exercises.map(e => e.exerciseId)
        const toDelete = currentExercises.filter(ce => !currentIds.includes(ce.exercise_id))

        for (const del of toDelete) {
          await supabase.from('sets').delete().eq('workout_exercise_id', del.id)
          await supabase.from('workout_exercises').delete().eq('id', del.id)
        }
      }

      // Update/insert exercises
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i]

        let workoutExercise = currentExercises?.find(ce => ce.exercise_id === ex.exerciseId)

        if (workoutExercise) {
          const { error: updateError } = await supabase
            .from('workout_exercises')
            .update({ display_name: ex.name, order_index: i })
            .eq('id', workoutExercise.id)
          if (updateError) {
            console.error('Failed to update exercise:', ex.name, updateError)
            throw new Error(`Failed to update ${ex.name}: ${updateError.message}`)
          }
        } else {
          const { data: newEx, error: insertError } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutId,
              exercise_id: ex.exerciseId,
              display_name: ex.name,
              order_index: i,
            })
            .select()
            .single()
          if (insertError || !newEx) {
            console.error('Failed to add exercise:', ex.name, insertError)
            throw new Error(`Failed to add ${ex.name}: ${insertError?.message || 'Unknown error'}`)
          }
          workoutExercise = newEx
        }

        if (workoutExercise?.id) {
          // Delete old sets
          await supabase.from('sets').delete().eq('workout_exercise_id', workoutExercise.id)

          // Insert all sets to preserve the workout template structure
          if (ex.sets.length > 0) {
            const rowsWithCompleted = ex.sets.map((s, idx) => ({
              workout_exercise_id: workoutExercise!.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.isWarmup ? 'warmup' : 'working',
              completed: s.isCompleted,
            }))

            let { error: setsError } = await supabase.from('sets').insert(rowsWithCompleted)

            // If the 'completed' column doesn't exist, retry without it
            if (setsError?.message?.includes('completed') && setsError?.message?.includes('schema')) {
              const rowsWithoutCompleted = ex.sets.map((s, idx) => ({
                workout_exercise_id: workoutExercise!.id,
                set_index: idx + 1,
                weight: s.weight,
                reps: s.reps,
                set_type: s.isWarmup ? 'warmup' : 'working',
              }))
              const result = await supabase.from('sets').insert(rowsWithoutCompleted)
              setsError = result.error
            }

            if (setsError) {
              console.error('Failed to save sets for:', ex.name, setsError)
              throw new Error(`Failed to save sets for ${ex.name}: ${setsError.message}`)
            }
          }
        }
      }

      clearDraft()
      toast.success('Workout updated!')
      router.push('/history')
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Delete workout
  const handleDelete = async () => {
    try {
      const userId = userIdRef.current
      if (!userId) return

      // Get workout exercises
      const { data: workoutExercises } = await supabase
        .from('workout_exercises')
        .select('id')
        .eq('workout_id', workoutId)

      // Delete sets
      if (workoutExercises) {
        for (const we of workoutExercises) {
          await supabase.from('sets').delete().eq('workout_exercise_id', we.id)
        }
      }

      // Delete exercises
      await supabase.from('workout_exercises').delete().eq('workout_id', workoutId)

      // Delete workout
      await supabase.from('workouts').delete().eq('id', workoutId).eq('user_id', userId)

      toast.success('Workout deleted')
      router.push('/history')
    } catch (error: any) {
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
      {/* Header - matches create page */}
      <div
        className="sticky top-0 z-40 bg-brand-dark/95 backdrop-blur-lg border-b border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link href="/history" className="p-2 -ml-2 rounded-xl hover:bg-white/5 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">{title || 'Edit Workout'}</h1>
              <p className="text-sm text-zinc-400">
                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                {lastSaved && (
                  <span className="text-green-500 ml-2">
                    Draft saved {getTimeAgo(lastSaved)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl hover:bg-white/5 text-red-400"
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

        {/* Add Exercise Button - matches create page */}
        <button
          onClick={() => setShowExerciseSelector(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-brand-red hover:text-brand-red transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>

        {/* Empty State - matches create page */}
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

      {/* Save Footer - matches create page */}
      {exercises.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-white/5 p-4 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <p className="font-medium">{summary.exercises} exercises</p>
              <p className="text-sm text-zinc-400">{summary.sets} sets</p>
            </div>
            <button
              onClick={handleSave}
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
