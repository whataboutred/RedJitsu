'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Dumbbell, X, ChevronDown, Check, Copy,
  Trash2, Clock, Search, TrendingUp, Calendar, MapPin, FileText,
  Save, MoreHorizontal
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { getLastWorkoutSetsForExercises } from '@/lib/workoutSuggestions'
import { AnimatedCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BottomSheet, ConfirmDialog } from '@/components/ui/BottomSheet'
import { useToast } from '@/components/Toast'

// Types
interface SetData {
  weight: number
  reps: number
  isWarmup: boolean
  isCompleted: boolean
}

interface WorkoutExercise {
  id: string
  exerciseId: string
  name: string
  sets: SetData[]
  lastWorkout?: {
    date: string
    sets: { weight: number; reps: number }[]
  }
}

interface Exercise {
  id: string
  name: string
  category: string
}

// Set Row Component
function SetRow({
  set,
  setIndex,
  unit,
  onUpdate,
  onRemove,
  onComplete,
  suggestedSet,
}: {
  set: SetData
  setIndex: number
  unit: string
  onUpdate: (set: SetData) => void
  onRemove: () => void
  onComplete: () => void
  suggestedSet?: { weight: number; reps: number }
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
        set.isCompleted
          ? 'bg-green-500/20 border border-green-500/30'
          : set.isWarmup
          ? 'bg-amber-500/10 border border-amber-500/20'
          : 'bg-zinc-800/50 border border-zinc-700/50'
      }`}
    >
      {/* Set Number / Warmup Badge */}
      <div className="w-8 text-center">
        {set.isWarmup ? (
          <span className="text-xs text-amber-400 font-medium">W</span>
        ) : (
          <span className="text-sm text-zinc-400 font-medium">{setIndex + 1}</span>
        )}
      </div>

      {/* Weight Input */}
      <div className="flex-1">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={set.weight || ''}
            onChange={(e) => onUpdate({ ...set, weight: parseFloat(e.target.value) || 0 })}
            placeholder={suggestedSet ? String(suggestedSet.weight) : '0'}
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-center text-white placeholder-zinc-600 focus:border-brand-red focus:outline-none"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">{unit}</span>
        </div>
      </div>

      {/* Reps Input */}
      <div className="flex-1">
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            value={set.reps || ''}
            onChange={(e) => onUpdate({ ...set, reps: parseInt(e.target.value) || 0 })}
            placeholder={suggestedSet ? String(suggestedSet.reps) : '0'}
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg px-3 py-2 text-center text-white placeholder-zinc-600 focus:border-brand-red focus:outline-none"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">reps</span>
        </div>
      </div>

      {/* Complete Button */}
      <button
        onClick={onComplete}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          set.isCompleted
            ? 'bg-green-500 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
      >
        <Check className="w-5 h-5" />
      </button>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all"
      >
        <X className="w-4 h-4" />
      </button>
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
  const completedSets = exercise.sets.filter((s) => s.isCompleted && !s.isWarmup).length
  const totalSets = exercise.sets.filter((s) => !s.isWarmup).length

  const handleSetComplete = (setIndex: number) => {
    const newSets = [...exercise.sets]
    newSets[setIndex].isCompleted = !newSets[setIndex].isCompleted
    onUpdate({ ...exercise, sets: newSets })
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
                    No previous data for this exercise.
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
    </motion.div>
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
  const [showExerciseSheet, setShowExerciseSheet] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')

  const userIdRef = useRef<string | null>(null)

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
      console.log('Location column not available')
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

    setPerformedAt(new Date(workout.performed_at).toISOString().slice(0, 16))
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
        sets (weight, reps, set_type, set_index)
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
              isCompleted: true, // Already saved sets are considered complete
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
  }

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
    setShowExerciseSheet(false)
    setExerciseSearch('')
  }, [exercises, location, toast])

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
  const handleSave = async () => {
    if (saving) return
    setSaving(true)

    try {
      const userId = userIdRef.current
      if (!userId) throw new Error('Not logged in')

      if (exercises.length === 0) {
        toast.error('Add at least one exercise')
        return
      }

      // Update workout
      const updateData: any = {
        performed_at: new Date(performedAt).toISOString(),
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
          await supabase
            .from('workout_exercises')
            .update({ display_name: ex.name, order_index: i })
            .eq('id', workoutExercise.id)
        } else {
          const { data: newEx } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutId,
              exercise_id: ex.exerciseId,
              display_name: ex.name,
              order_index: i,
            })
            .select()
            .single()
          workoutExercise = newEx
        }

        if (workoutExercise?.id) {
          // Delete old sets
          await supabase.from('sets').delete().eq('workout_exercise_id', workoutExercise.id)

          // Insert new sets
          const setsToSave = ex.sets.filter(s => s.weight > 0 || s.reps > 0 || s.isCompleted)
          if (setsToSave.length > 0) {
            const rows = setsToSave.map((s, idx) => ({
              workout_exercise_id: workoutExercise!.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.isWarmup ? 'warmup' : 'working',
            }))
            await supabase.from('sets').insert(rows)
          }
        }
      }

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

  // Filter exercises
  const filteredExercises = useMemo(() => {
    if (!exerciseSearch) return allExercises.slice(0, 20)
    const search = exerciseSearch.toLowerCase()
    return allExercises.filter(ex => ex.name.toLowerCase().includes(search)).slice(0, 20)
  }, [allExercises, exerciseSearch])

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-12 bg-zinc-800/50 rounded-xl animate-pulse" />
          <div className="h-40 bg-zinc-800/50 rounded-2xl animate-pulse" />
          <div className="h-64 bg-zinc-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/history"
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <h1 className="text-lg font-semibold">Edit Workout</h1>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Workout Details */}
        <AnimatedCard>
          <div className="p-4 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-red" />
              Workout Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white focus:border-brand-red focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Workout title"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-500 focus:border-brand-red focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  list="location-list"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where did you work out?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-zinc-500 focus:border-brand-red focus:outline-none"
                />
                <datalist id="location-list">
                  {savedLocations.map((loc, i) => (
                    <option key={i} value={loc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did the workout feel?"
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white placeholder-zinc-500 focus:border-brand-red focus:outline-none resize-none"
              />
            </div>
          </div>
        </AnimatedCard>

        {/* Exercises */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-white">Exercises ({exercises.length})</h2>
            <button
              onClick={() => setShowExerciseSheet(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red rounded-lg text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {exercises.length === 0 ? (
            <AnimatedCard>
              <div className="p-8 text-center">
                <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 mb-4">No exercises yet</p>
                <Button onClick={() => setShowExerciseSheet(true)}>
                  Add Exercise
                </Button>
              </div>
            </AnimatedCard>
          ) : (
            exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                unit={unit}
                onUpdate={updateExercise}
                onRemove={() => removeExercise(exercise.id)}
                isExpanded={expandedId === exercise.id}
                onToggle={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Save Button */}
      {exercises.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 text-lg"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Save className="w-5 h-5" />
                  Update Workout
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Exercise Selector Sheet */}
      <BottomSheet
        isOpen={showExerciseSheet}
        onClose={() => {
          setShowExerciseSheet(false)
          setExerciseSearch('')
        }}
        title="Add Exercise"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Search exercises..."
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:border-brand-red focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredExercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => addExercise(ex)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-red/20 flex items-center justify-center">
                  <Dumbbell className="w-5 h-5 text-brand-red" />
                </div>
                <div>
                  <div className="font-medium text-white">{ex.name}</div>
                  <div className="text-sm text-zinc-500 capitalize">{ex.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

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
    </div>
  )
}
