'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import QuickStartSection from '@/components/QuickStartSection'
import ExerciseSelector from '@/components/ExerciseSelector'
import EnhancedSetRow from '@/components/EnhancedSetRow'
import LastWorkoutSuggestion from '@/components/LastWorkoutSuggestion'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useToast } from '@/components/Toast'
import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { savePendingWorkout, trySyncPending } from '@/lib/offline'
import { useRouter } from 'next/navigation'
import { useDraftAutoSave, getTimeAgo, WorkoutDraft } from '@/hooks/useDraftAutoSave'
import { getLastWorkoutSetsForExercises, WorkoutSet } from '@/lib/workoutSuggestions'
import { Save, Wifi, WifiOff, CheckCircle2, Clock } from 'lucide-react'

type Exercise = { id: string; name: string; category: 'barbell'|'dumbbell'|'machine'|'cable'|'other' }
type PresetTitle = 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Other'
type Program = { id: string; name: string; is_active: boolean }
type ProgramDay = { id: string; name: string; dows: number[]; order_index: number }

type WorkoutItem = {
  id: string
  name: string
  sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>
}

export default function EnhancedNewWorkoutPage() {
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [note, setNote] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [location, setLocation] = useState('')
  const [savedLocations, setSavedLocations] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced')

  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })

  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<WorkoutItem[]>([])

  const [lastWorkoutSuggestions, setLastWorkoutSuggestions] = useState<Map<string, WorkoutSet[]>>(new Map())

  // UI State
  const [isTemplateCollapsed, setIsTemplateCollapsed] = useState(true)
  const [isExerciseSelectorCollapsed, setIsExerciseSelectorCollapsed] = useState(false)
  const [workoutMode, setWorkoutMode] = useState<'quick' | 'template' | 'custom'>('quick')
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set())

  const [loadedTemplate, setLoadedTemplate] = useState<{ programName: string; dayName: string } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [days, setDays] = useState<ProgramDay[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string>('')

  const router = useRouter()
  const [demo, setDemo] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const toast = useToast()
  const userIdRef = useRef<string | null>(null)

  // Draft auto-save
  const {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    lastSaved,
    hasUnsavedChanges,
    markAsSaved,
  } = useDraftAutoSave({
    draftKey: 'workout-draft',
    autoSaveInterval: 30000, // 30 seconds
    enabled: !demo,
  })

  // Save draft whenever workout data changes
  useEffect(() => {
    if (items.length > 0 || note || customTitle || location) {
      saveDraft({ items, note, customTitle, location })
    }
  }, [items, note, customTitle, location, saveDraft])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('synced')
      toast.success('Back online!')
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
      toast.info('You are offline. Changes will be saved locally.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [toast])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0 && !isSaving) {
        e.preventDefault()
        e.returnValue = 'You have unsaved workout data. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [items, isSaving])

  // Draft recovery on mount
  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (isDemo) return

      const userId = await getActiveUserId()
      if (!userId) {
        if (!DEMO) {
          window.location.href = '/login'
        }
        return
      }

      userIdRef.current = userId

      // Check for draft and offer recovery
      const draft = loadDraft()
      if (draft && draft.items.length > 0) {
        const timeSince = getTimeAgo(draft.timestamp)
        const shouldRestore = confirm(
          `Found unsaved workout from ${timeSince}. Would you like to restore it?\n\n` +
          `${draft.items.length} exercise(s) • ${draft.items.reduce((acc, item) => acc + item.sets.length, 0)} sets`
        )

        if (shouldRestore) {
          setItems(draft.items)
          setNote(draft.note)
          setCustomTitle(draft.customTitle)
          setLocation(draft.location)
          toast.success('Draft restored successfully!')

          // Fetch suggestions for restored exercises
          const exerciseIds = draft.items.map(item => item.id)
          fetchSuggestionsForExercises(userId, exerciseIds, draft.location)
        } else {
          clearDraft()
        }
      }

      await trySyncPending(userId)

      // Load user profile
      try {
        const { data: profile } = await supabase.from('profiles').select('unit').eq('id', userId).maybeSingle()
        if (profile?.unit) setUnit(profile.unit as 'lb'|'kg')
      } catch (error) {
        console.error('Error loading profile:', error)
      }

      // Load exercises
      try {
        const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
        setAllExercises((ex||[]) as Exercise[])
      } catch (error) {
        console.error('Error loading exercises:', error)
        toast.error('Failed to load exercises')
      }

      // Load programs
      try {
        const { data: progs } = await supabase.from('programs')
          .select('id,name,is_active')
          .order('created_at', { ascending: false })
        setPrograms((progs||[]) as Program[])
      } catch (error) {
        console.error('Error loading programs:', error)
      }

      // Load previously used locations
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
        // Location column may not exist yet, ignore
      }
    })()
  }, [])

  // Fetch suggestions for multiple exercises (optimized)
  const fetchSuggestionsForExercises = useCallback(async (userId: string, exerciseIds: string[], loc?: string) => {
    if (exerciseIds.length === 0) return

    try {
      const suggestions = await getLastWorkoutSetsForExercises(userId, exerciseIds, loc || location)

      if (suggestions.size > 0) {
        setLastWorkoutSuggestions(prev => {
          const newMap = new Map(prev)
          suggestions.forEach((sets, exerciseId) => {
            newMap.set(exerciseId, sets)
          })
          return newMap
        })
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      // Don't show error toast - suggestions are optional
    }
  }, [location])

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises(prev => {
      const newSet = new Set(prev)
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId)
      } else {
        newSet.add(exerciseId)
      }
      return newSet
    })
  }

  const expandExerciseAndCollapseOthers = (exerciseId: string) => {
    setExpandedExercises(new Set([exerciseId]))
  }

  async function addExercise(id: string, avgWeight?: number, avgReps?: number) {
    const ex = allExercises.find(e => e.id === id)
    if (!ex) {
      toast.error('Exercise not found')
      return
    }

    // Check if exercise already exists
    const existing = items.find(item => item.id === ex.id)
    if (existing) {
      toast.error(`"${ex.name}" is already in this workout`)
      return
    }

    // Always start with zeroed out sets
    const initialSets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> = [
      { weight: 0, reps: 0, set_type: 'working' as const }
    ]

    // Add exercise first
    setItems(p => [...p, { id: ex.id, name: ex.name, sets: initialSets }])
    setIsExerciseSelectorCollapsed(true)
    expandExerciseAndCollapseOthers(ex.id)

    // Fetch suggestion in background
    if (userIdRef.current) {
      fetchSuggestionsForExercises(userIdRef.current, [ex.id])
    }
  }

  async function addCustomExercise() {
    const name = search.trim()
    if (!name) {
      toast.error('Type a name first')
      return
    }

    const userId = await getActiveUserId()
    if (!userId) {
      window.location.href='/login'
      return
    }

    try {
      const { data: ins, error } = await supabase
        .from('exercises')
        .insert({ name, category:'other', is_global:false, owner:userId })
        .select('id,name,category')
        .single()

      if (error || !ins) {
        toast.error('Could not create exercise')
        return
      }

      setAllExercises(prev => [...prev, ins as Exercise])
      setItems(prev => [...prev, {
        id: (ins as Exercise).id,
        name: (ins as Exercise).name,
        sets: [{ weight: 0, reps: 0, set_type: 'working' }]
      }])
      setSearch('')
      setIsExerciseSelectorCollapsed(true)
      expandExerciseAndCollapseOthers((ins as Exercise).id)

      toast.success(`Created "${name}"`)
    } catch (error) {
      toast.error('Failed to create exercise')
    }
  }

  async function fetchDaysForProgram(programId: string) {
    setDays([])
    setSelectedDayId('')
    if (!programId) return

    try {
      const { data } = await supabase.from('program_days')
        .select('id,name,dows,order_index')
        .eq('program_id', programId)
        .order('order_index')
      setDays((data||[]) as ProgramDay[])
    } catch (error) {
      toast.error('Failed to load program days')
    }
  }

  async function loadTemplate(program: Program, day: ProgramDay) {
    try {
      const { data: tex } = await supabase.from('template_exercises')
        .select('exercise_id,display_name,default_sets,default_reps,set_type,order_index')
        .eq('program_day_id', day.id)
        .order('order_index')

      if (!tex || tex.length === 0) {
        toast.error('This day has no exercises yet')
        return
      }

      if (items.length > 0) {
        const ok = confirm('Replace the current list with this template?')
        if (!ok) return
      }

      const built = tex.map((t) => ({
        id: t.exercise_id,
        name: t.display_name,
        sets: Array.from({ length: Math.max(1, t.default_sets||1) }, () => ({
          weight: 0,
          reps: 0,
          set_type: (t.set_type as 'warmup'|'working') || 'working'
        }))
      }))

      setItems(built)
      setCustomTitle(day.name)
      setLoadedTemplate({ programName: program.name, dayName: day.name })

      // Auto-expand first exercise
      if (built.length > 0) {
        setExpandedExercises(new Set([built[0].id]))
      }

      toast.success(`Loaded ${day.name} from ${program.name}`)

      // Fetch suggestions for all exercises (optimized single query)
      if (userIdRef.current) {
        const exerciseIds = built.map(ex => ex.id)
        fetchSuggestionsForExercises(userIdRef.current, exerciseIds)
      }
    } catch (error) {
      toast.error('Failed to load template')
    }
  }

  function resolveTitle(): string | null {
    return customTitle.trim() || null
  }

  function toISO(dtLocal: string) {
    const d = new Date(dtLocal)
    return d.toISOString()
  }

  // Save function with transaction-like behavior
  async function saveOnline() {
    if (isSaving) return

    setIsSaving(true)
    setSyncStatus('syncing')

    try {
      const userId = await getActiveUserId()
      if (!userId) {
        toast.error('Sign in again')
        return
      }

      const title = resolveTitle()
      const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

      const insertData: any = { user_id: userId, performed_at: iso, title, note: note || null }
      if (location) insertData.location = location

      // Insert workout
      const { data: w, error } = await supabase
        .from('workouts')
        .insert(insertData)
        .select('id')
        .single()

      if (error || !w) {
        throw new Error(error?.message || 'Failed to create workout')
      }

      const workoutId = w.id

      // Insert all exercises and sets
      // We'll collect all operations and run them, tracking for potential rollback
      const createdWorkoutExerciseIds: string[] = []

      try {
        for (const item of items) {
          const { data: wex, error: wexError } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: workoutId, exercise_id: item.id, display_name: item.name })
            .select('id')
            .single()

          if (wexError || !wex) {
            throw new Error(`Failed to add exercise: ${item.name}`)
          }

          createdWorkoutExerciseIds.push(wex.id)

          if (item.sets.length > 0) {
            const rows = item.sets.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
            }))

            const { error: setsError } = await supabase.from('sets').insert(rows)

            if (setsError) {
              throw new Error(`Failed to save sets for ${item.name}`)
            }
          }
        }

        // Success! Clear draft and navigate
        clearDraft()
        markAsSaved()
        toast.success('Workout saved successfully!')
        router.push('/history?highlight=' + workoutId)

      } catch (error: any) {
        // Attempt to rollback by deleting the workout (cascade will handle the rest)
        console.error('Error during save, attempting rollback:', error)
        await supabase.from('workouts').delete().eq('id', workoutId)
        throw error
      }

    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to save workout')
      setSyncStatus('offline')
    } finally {
      setIsSaving(false)
      if (isOnline) {
        setSyncStatus('synced')
      }
    }
  }

  async function saveOffline() {
    const title = resolveTitle()
    const temp = Math.random().toString(36).slice(2)
    const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

    try {
      await savePendingWorkout({
        tempId: temp,
        performed_at: iso,
        title,
        note,
        exercises: items.map(i => ({ exercise_id: i.id, name: i.name, sets: i.sets })),
      })

      clearDraft()
      toast.success('Saved offline. Will sync when online.')
      router.push('/dashboard')
    } catch (error) {
      toast.error('Failed to save offline')
    }
  }

  const canSave = useMemo(() => items.some(i => i.sets.length), [items])

  function removeExercise(exerciseId: string) {
    setItems(prev => prev.filter(item => item.id !== exerciseId))
    setExpandedExercises(prev => {
      const newSet = new Set(prev)
      newSet.delete(exerciseId)
      return newSet
    })
    setLastWorkoutSuggestions(prev => {
      const newMap = new Map(prev)
      newMap.delete(exerciseId)
      return newMap
    })
  }

  function updateSets(exerciseId: string, newSets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>) {
    setItems(prev => prev.map(item =>
      item.id === exerciseId ? { ...item, sets: newSets } : item
    ))
  }

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />

        {/* Sync Status Indicator */}
        <div className="fixed top-20 right-4 z-40">
          {syncStatus === 'syncing' && (
            <div className="bg-blue-500/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
          {syncStatus === 'synced' && lastSaved && (
            <div className="bg-green-500/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Saved {getTimeAgo(lastSaved)}
            </div>
          )}
          {syncStatus === 'offline' && (
            <div className="bg-yellow-500/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              Offline
            </div>
          )}
        </div>

        <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6 pb-32">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">💪 New Workout</h1>
            <div className="flex gap-2">
              <button
                className={`toggle text-xs ${workoutMode === 'quick' ? 'bg-brand-red/20 border-brand-red' : ''}`}
                onClick={() => setWorkoutMode('quick')}
              >
                🚀 Quick
              </button>
              <button
                className={`toggle text-xs ${workoutMode === 'template' ? 'bg-brand-red/20 border-brand-red' : ''}`}
                onClick={() => setWorkoutMode('template')}
              >
                📋 Template
              </button>
            </div>
          </div>

          {/* Quick Start Section */}
          {workoutMode === 'quick' && (
            <ErrorBoundary>
              <QuickStartSection
                onAddExercise={(ex) => addExercise(ex.id)}
                unit={unit}
              />
            </ErrorBoundary>
          )}

          {/* Template Loading */}
          {workoutMode === 'template' && (
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer mb-3"
                onClick={() => setIsTemplateCollapsed(!isTemplateCollapsed)}
              >
                <div className="font-medium">📋 Workout Templates</div>
                <div className="text-white/60">
                  {isTemplateCollapsed ? '▼' : '▲'}
                </div>
              </div>

              {loadedTemplate && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 mb-3">
                  <div className="text-sm">✅ Loaded: <span className="font-medium text-green-400">{loadedTemplate.programName}</span> — <span className="font-medium">{loadedTemplate.dayName}</span></div>
                  <div className="text-white/70 text-sm">You can still modify exercises and sets below.</div>
                </div>
              )}

              {!isTemplateCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select
                    className="input"
                    value={selectedProgramId}
                    onChange={async (e) => {
                      const id = e.target.value
                      setSelectedProgramId(id)
                      await fetchDaysForProgram(id)
                    }}
                  >
                    <option value="">Select program…</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.is_active ? ' (active)' : ''}
                      </option>
                    ))}
                  </select>

                  <select
                    className="input"
                    value={selectedDayId}
                    onChange={(e) => setSelectedDayId(e.target.value)}
                    disabled={!selectedProgramId || days.length === 0}
                  >
                    <option value="">{selectedProgramId ? 'Select day…' : 'Pick a program first'}</option>
                    {days.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>

                  <button
                    className="btn disabled:opacity-50"
                    disabled={!selectedProgramId || !selectedDayId}
                    onClick={() => {
                      const prog = programs.find(p => p.id === selectedProgramId)
                      const day = days.find(d => d.id === selectedDayId)
                      if (prog && day) loadTemplate(prog, day)
                    }}
                  >
                    Load Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Workout Details */}
          <div className="card">
            <div className="font-medium mb-4">📝 Workout Details</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-white/80 font-medium mb-2">
                  Workout Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={performedAt}
                  onChange={e => setPerformedAt(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 font-medium mb-2">
                  Custom Title
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder="e.g., Upper Body, Leg Day"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-white/80 font-medium mb-2">
                Location
              </label>
              <input
                type="text"
                list="location-options"
                className="input w-full"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g., Home Gym, LA Fitness, Office Gym"
              />
              <datalist id="location-options">
                {savedLocations.map((loc, idx) => (
                  <option key={idx} value={loc} />
                ))}
              </datalist>
              <div className="text-xs text-white/60 mt-1">
                {savedLocations.length > 0 ? 'Select from previous locations or type a new one' : 'Suggestions will be based on this location'}
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Notes (Optional)
              </label>
              <textarea
                className="input w-full h-20 resize-none"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="How did the workout feel? Any observations..."
              />
            </div>
          </div>

          {/* Exercise Selector */}
          <ErrorBoundary>
            <ExerciseSelector
              exercises={allExercises}
              search={search}
              onSearchChange={setSearch}
              onAddExercise={(id) => addExercise(id)}
              onAddCustomExercise={addCustomExercise}
              isCollapsed={isExerciseSelectorCollapsed}
              onToggleCollapse={() => setIsExerciseSelectorCollapsed(!isExerciseSelectorCollapsed)}
            />
          </ErrorBoundary>

          {/* Current Exercises */}
          <div className="card">
            <div className="font-medium mb-4">🏋️‍♀️ Current Exercises</div>

            <div className="space-y-4">
              {items.map((item, idx) => {
                const isExpanded = expandedExercises.has(item.id)
                return (
                  <ErrorBoundary key={item.id}>
                    <div className="bg-black/30 rounded-2xl p-4">
                      <div
                        className="flex items-center justify-between mb-4 cursor-pointer"
                        onClick={() => toggleExerciseExpanded(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                          <h3 className="font-semibold text-lg text-white/90">{item.name}</h3>
                          <span className="text-sm text-white/60">
                            {item.sets.length} set{item.sets.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="toggle text-sm px-3 py-1 text-red-400 hover:bg-red-500/20"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeExercise(item.id)
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3">
                          {lastWorkoutSuggestions.has(item.id) && (
                            <LastWorkoutSuggestion
                              sets={lastWorkoutSuggestions.get(item.id)!}
                              unit={unit}
                            />
                          )}

                          {item.sets.map((set, setIndex) => (
                            <EnhancedSetRow
                              key={setIndex}
                              initial={set}
                              setIndex={setIndex}
                              unitLabel={unit}
                              previousSet={setIndex > 0 ? item.sets[setIndex - 1] : undefined}
                              onChange={(updatedSet) => {
                                const newSets = [...item.sets]
                                newSets[setIndex] = updatedSet
                                updateSets(item.id, newSets)
                              }}
                              onRemove={() => {
                                const newSets = item.sets.filter((_, i) => i !== setIndex)
                                updateSets(item.id, newSets)
                              }}
                              onCopyPrevious={setIndex > 0 ? () => {
                                const newSets = [...item.sets]
                                newSets[setIndex] = { ...item.sets[setIndex - 1] }
                                updateSets(item.id, newSets)
                              } : undefined}
                            />
                          ))}

                          <div className="flex gap-2 mt-4">
                            <button
                              className="btn flex-1"
                              onClick={() => {
                                const newSets = [...item.sets, { weight: 0, reps: 0, set_type: 'working' as const }]
                                updateSets(item.id, newSets)
                              }}
                            >
                              + Add Set
                            </button>
                            {item.sets.length > 0 && (
                              <button
                                className="toggle flex-1"
                                onClick={() => {
                                  const lastSet = item.sets[item.sets.length - 1]
                                  const newSets = [...item.sets, { ...lastSet }]
                                  updateSets(item.id, newSets)
                                }}
                              >
                                📋 Copy Last
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </ErrorBoundary>
                )
              })}

              {items.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">💪</div>
                  <div className="font-medium mb-2">No exercises added yet</div>
                  <div className="text-white/70 mb-4">Add exercises to build your workout</div>
                  <button
                    className="btn"
                    onClick={() => setIsExerciseSelectorCollapsed(false)}
                  >
                    Add First Exercise
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Save Section - Fixed at bottom */}
        {items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-white/10 z-30">
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white/90">{resolveTitle() || 'Untitled Workout'}</div>
                  <div className="text-sm text-white/70">
                    {items.length} exercise{items.length !== 1 ? 's' : ''} • {items.reduce((acc, item) => acc + item.sets.length, 0)} sets
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    className="toggle px-6 disabled:opacity-50"
                    onClick={saveOffline}
                    disabled={isSaving}
                    title="Save offline"
                  >
                    📱 Offline
                  </button>
                  <button
                    className="btn disabled:opacity-50 flex items-center gap-2"
                    onClick={saveOnline}
                    disabled={!canSave || isSaving}
                  >
                    {isSaving ? (
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
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
