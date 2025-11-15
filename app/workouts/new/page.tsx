'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import QuickStartSection from '@/components/QuickStartSection'
import ExerciseSelector from '@/components/ExerciseSelector'
import EnhancedSetRow from '@/components/EnhancedSetRow'
import LastWorkoutSuggestion from '@/components/LastWorkoutSuggestion'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { savePendingWorkout, trySyncPending } from '@/lib/offline'
import { useRouter } from 'next/navigation'

type Exercise = { id: string; name: string; category: 'barbell'|'dumbbell'|'machine'|'cable'|'other' }
type PresetTitle = 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Other'
type Program = { id: string; name: string; is_active: boolean }
type ProgramDay = { id: string; name: string; dows: number[]; order_index: number }

export default function EnhancedNewWorkoutPage() {
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb') // Will be loaded from user profile
  const [note, setNote] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [location, setLocation] = useState('')
  const [savedLocations, setSavedLocations] = useState<string[]>([])

  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })

  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<
    Array<{ id: string; name: string; sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> }>
  >([])

  // Track last workout suggestions for each exercise
  const [lastWorkoutSuggestions, setLastWorkoutSuggestions] = useState<
    Map<string, Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>>
  >(new Map())

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

  // Auto-save state
  const [autosaveWorkoutId, setAutosaveWorkoutId] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Auto-collapse helper functions
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

  // Fetch all sets from the last workout for an exercise at the same location
  async function getLastWorkoutSets(exerciseId: string): Promise<Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> | null> {
    const userId = await getActiveUserId()

    if (!userId) {
      throw new Error('No user ID found - authentication may have failed')
    }

    try {
      // Get recent workouts at the same location
      let query = supabase
        .from('workouts')
        .select('id, performed_at')
        .eq('user_id', userId)

      // Filter by location if set (only if location column exists)
      if (location) {
        try {
          query = query.eq('location', location)
        } catch (e) {
          // Location column doesn't exist yet, skip filtering
        }
      }

      const { data: workouts, error: workoutsError } = await query
        .order('performed_at', { ascending: false })
        .limit(20)

      if (workoutsError) {
        throw new Error(`Failed to fetch workouts: ${workoutsError.message}`)
      }

      if (!workouts || workouts.length === 0) {
        return null // No workouts found
      }

      // Look for this exercise in recent workouts
      for (const workout of workouts) {
        const { data: workoutExercise, error: exerciseError } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', workout.id)
          .eq('exercise_id', exerciseId)
          .maybeSingle()

        if (exerciseError || !workoutExercise) {
          continue
        }

        // Get all sets for this exercise
        const { data: sets, error: setsError } = await supabase
          .from('sets')
          .select('weight, reps, set_type, set_index')
          .eq('workout_exercise_id', workoutExercise.id)
          .order('set_index', { ascending: true })

        if (setsError || !sets || sets.length === 0) {
          continue
        }

        // Return all sets from the last workout
        const allSets = sets.map(set => ({
          weight: Number(set.weight),
          reps: Number(set.reps),
          set_type: set.set_type as 'warmup' | 'working'
        }))

        return allSets
      }

      return null // Exercise not found in any recent workout
    } catch (error) {
      console.error('Error fetching workout suggestions:', error)
      throw error
    }
  }

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

      await trySyncPending(userId)

      const { data: profile } = await supabase.from('profiles').select('unit').eq('id', userId).maybeSingle()
      if (profile?.unit) setUnit(profile.unit as 'lb'|'kg')

      const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
      setAllExercises((ex||[]) as Exercise[])

      const { data: progs } = await supabase.from('programs')
        .select('id,name,is_active')
        .order('created_at', { ascending: false })
      setPrograms((progs||[]) as Program[])

      // Load previously used locations (if location column exists)
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
        // Location column doesn't exist yet, ignore
        console.log('Location column not available yet')
      }

      // Don't auto-load templates - keep it blank by default
    })()
  }, [])

  async function addExercise(id: string, avgWeight?: number, avgReps?: number) {
    const ex = allExercises.find(e => e.id === id)
    if (!ex) {
      alert('❌ Exercise not found')
      return
    }

    // Check if exercise already exists (prevent duplicates)
    const existing = items.find(item => item.id === ex.id)
    if (existing) {
      alert(`"${ex.name}" is already in this workout`)
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

    // Fetch last workout data for suggestion (in background, silently)
    try {
      const lastWorkoutSets = await getLastWorkoutSets(ex.id)

      if (lastWorkoutSets && lastWorkoutSets.length > 0) {
        setLastWorkoutSuggestions(prev => {
          const newMap = new Map(prev)
          newMap.set(ex.id, lastWorkoutSets)
          return newMap
        })
      }
    } catch (error) {
      console.error('Error fetching workout suggestions:', error)
    }
  }

  async function addCustomExercise() {
    const name = search.trim()
    if (!name) { alert('Type a name first.'); return }
    const userId = await getActiveUserId()
    if (!userId) { window.location.href='/login'; return }
    
    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name, category:'other', is_global:false, owner:userId })
      .select('id,name,category')
      .single()
    if (error || !ins) { alert('Could not create exercise.'); return }
    
    setAllExercises(prev => [...prev, ins as Exercise])
    setItems(prev => [...prev, { id: (ins as Exercise).id, name: (ins as Exercise).name, sets: [{ weight: 0, reps: 0, set_type: 'working' }] }])
    setSearch('')
    setIsExerciseSelectorCollapsed(true)
    // Auto-expand the new exercise and collapse others
    expandExerciseAndCollapseOthers((ins as Exercise).id)
  }

  async function fetchDaysForProgram(programId: string) {
    setDays([])
    setSelectedDayId('')
    if (!programId) return
    const { data } = await supabase.from('program_days')
      .select('id,name,dows,order_index').eq('program_id', programId).order('order_index')
    setDays((data||[]) as ProgramDay[])
  }

  async function loadTemplate(program: Program, day: ProgramDay) {
    const { data: tex } = await supabase.from('template_exercises')
      .select('exercise_id,display_name,default_sets,default_reps,set_type,order_index')
      .eq('program_day_id', day.id).order('order_index')

    if (!tex || tex.length === 0) { alert('This day has no exercises yet.'); return }

    if (items.length > 0) {
      const ok = confirm('Replace the current list with this template?')
      if (!ok) return
    }

    const built = tex.map((t) => ({
      id: t.exercise_id,
      name: t.display_name,
      sets: Array.from({ length: Math.max(1, t.default_sets||1) }, () => ({
        weight: 0,
        reps: 0,  // Always zero out - suggestions will show previous data
        set_type: (t.set_type as 'warmup'|'working') || 'working'
      }))
    }))
    setItems(built)
    setCustomTitle(day.name)
    setLoadedTemplate({ programName: program.name, dayName: day.name })
    // Auto-expand first exercise only
    if (built.length > 0) {
      setExpandedExercises(new Set([built[0].id]))
    }

    // Fetch suggestions for all exercises in parallel (faster!)
    Promise.all(
      built.map(async (exercise) => {
        try {
          const lastWorkoutSets = await getLastWorkoutSets(exercise.id)
          if (lastWorkoutSets && lastWorkoutSets.length > 0) {
            return { id: exercise.id, sets: lastWorkoutSets }
          }
        } catch (error) {
          console.error('Error fetching suggestion for', exercise.name, ':', error)
        }
        return null
      })
    ).then((results) => {
      // Update all suggestions at once
      setLastWorkoutSuggestions(prev => {
        const newMap = new Map(prev)
        results.forEach(result => {
          if (result) {
            newMap.set(result.id, result.sets)
          }
        })
        return newMap
      })
    })
  }

  function resolveTitle(): string | null {
    return customTitle.trim() || null
  }

  function toISO(dtLocal: string) {
    const d = new Date(dtLocal)
    return d.toISOString()
  }

  // Auto-save function (silent, no alerts or redirects)
  async function autoSave() {
    if (items.length === 0 || isSaving) return // Don't auto-save if no exercises or already saving

    const userId = await getActiveUserId()
    if (!userId) return

    setIsSaving(true)
    try {
      const title = resolveTitle()
      const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

      if (autosaveWorkoutId) {
        // Update existing draft
        const updateData: any = {
          performed_at: iso,
          title: title,
          note: note || null
        }
        if (location) updateData.location = location

        const { error: workoutError } = await supabase
          .from('workouts')
          .update(updateData)
          .eq('id', autosaveWorkoutId)
          .eq('user_id', userId)

        if (workoutError) throw workoutError

        // Delete existing exercises and sets
        const { data: existingExercises } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', autosaveWorkoutId)

        if (existingExercises) {
          for (const ex of existingExercises) {
            await supabase.from('sets').delete().eq('workout_exercise_id', ex.id)
          }
          await supabase.from('workout_exercises').delete().eq('workout_id', autosaveWorkoutId)
        }

        // Insert new exercises and sets
        for (const it of items) {
          const { data: wex } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: autosaveWorkoutId, exercise_id: it.id, display_name: it.name })
            .select('id')
            .single()
          if (!wex) continue

          if (it.sets.length) {
            const rows = it.sets.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
            }))
            await supabase.from('sets').insert(rows)
          }
        }
      } else {
        // Create new draft
        const insertData: any = { user_id: userId, performed_at: iso, title, note: note || null }
        if (location) insertData.location = location

        const { data: w, error } = await supabase
          .from('workouts')
          .insert(insertData)
          .select('id')
          .single()
        if (error || !w) throw error

        setAutosaveWorkoutId(w.id)

        for (const it of items) {
          const { data: wex } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: w.id, exercise_id: it.id, display_name: it.name })
            .select('id')
            .single()
          if (!wex) continue

          if (it.sets.length) {
            const rows = it.sets.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
            }))
            await supabase.from('sets').insert(rows)
          }
        }
      }

      setLastSaved(new Date())
    } catch (error) {
      console.error('Auto-save error:', error)
      // Silently fail - don't show error to user
    } finally {
      setIsSaving(false)
    }
  }

  // Auto-save every 30 seconds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const interval = setInterval(() => {
      autoSave()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, []) // Empty deps - only create interval once on mount

  // Enhanced save function with better UX
  async function saveOnline() {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = await getActiveUserId()
    if (!userId) { alert('Sign in again.'); return }

    setIsSaving(true)
    try {
      const title = resolveTitle()
      const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

      let workoutId: string

      if (autosaveWorkoutId) {
        // Update the auto-saved draft manually (don't use autoSave which fails silently)
        const updateData: any = {
          performed_at: iso,
          title: title,
          note: note || null
        }
        if (location) updateData.location = location

        const { error: workoutError } = await supabase
          .from('workouts')
          .update(updateData)
          .eq('id', autosaveWorkoutId)
          .eq('user_id', userId)

        if (workoutError) {
          alert('Failed to update workout: ' + workoutError.message)
          return
        }

        // Delete existing exercises and sets, then re-insert
        const { data: existingExercises } = await supabase
          .from('workout_exercises')
          .select('id')
          .eq('workout_id', autosaveWorkoutId)

        if (existingExercises) {
          for (const ex of existingExercises) {
            await supabase.from('sets').delete().eq('workout_exercise_id', ex.id)
          }
          await supabase.from('workout_exercises').delete().eq('workout_id', autosaveWorkoutId)
        }

        // Insert current exercises and sets
        for (const it of items) {
          const { data: wex, error: wexError } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: autosaveWorkoutId, exercise_id: it.id, display_name: it.name })
            .select('id')
            .single()

          if (wexError || !wex) {
            alert('Failed to save exercise: ' + (wexError?.message || 'Unknown error'))
            return
          }

          if (it.sets.length) {
            const rows = it.sets.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
            }))
            const { error: setsError } = await supabase.from('sets').insert(rows)
            if (setsError) {
              alert('Failed to save sets: ' + setsError.message)
              return
            }
          }
        }

        workoutId = autosaveWorkoutId
      } else {
        // Create new workout
        const insertData: any = { user_id: userId, performed_at: iso, title, note: note || null }
        if (location) insertData.location = location

        const { data: w, error } = await supabase
          .from('workouts')
          .insert(insertData)
          .select('id')
          .single()
        if (error || !w) {
          alert('Save failed: ' + (error?.message || 'Unknown error'))
          return
        }
        workoutId = w.id

        for (const it of items) {
          const { data: wex } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: workoutId, exercise_id: it.id, display_name: it.name })
            .select('id')
            .single()
          if (!wex) continue

          if (it.sets.length) {
            const rows = it.sets.map((s, idx) => ({
              workout_exercise_id: wex.id,
              set_index: idx + 1,
              weight: s.weight,
              reps: s.reps,
              set_type: s.set_type,
            }))
            await supabase.from('sets').insert(rows)
          }
        }
      }

      router.push('/history?highlight=' + workoutId)
    } catch (error) {
      console.error('Save error:', error)
      alert('Unexpected error while saving: ' + (error as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveOffline() {
    const title = resolveTitle()
    const temp = Math.random().toString(36).slice(2)
    const iso = performedAt ? toISO(performedAt) : new Date().toISOString()
    await savePendingWorkout({
      tempId: temp,
      performed_at: iso,
      title,
      note,
      exercises: items.map(i => ({ exercise_id: i.id, name: i.name, sets: i.sets })),
    })
    alert('Saved offline. We will sync when you are online.')
    router.push('/dashboard')
  }

  const canSave = useMemo(() => items.some(i => i.sets.length), [items])

  function removeExercise(exerciseId: string) {
    setItems(prev => prev.filter(item => item.id !== exerciseId))
    setExpandedExercises(prev => {
      const newSet = new Set(prev)
      newSet.delete(exerciseId)
      return newSet
    })
    // Also remove the suggestion for this exercise
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
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6">
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
          <QuickStartSection
            onAddExercise={(ex) => addExercise(ex.id)}
            unit={unit}
          />
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
        <ExerciseSelector
          exercises={allExercises}
          search={search}
          onSearchChange={setSearch}
          onAddExercise={(id) => addExercise(id)}
          onAddCustomExercise={addCustomExercise}
          isCollapsed={isExerciseSelectorCollapsed}
          onToggleCollapse={() => setIsExerciseSelectorCollapsed(!isExerciseSelectorCollapsed)}
        />

        {/* Current Exercises */}
        <div className="card">
          <div className="font-medium mb-4">🏋️‍♀️ Current Exercises</div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const isExpanded = expandedExercises.has(item.id)
              return (
                <div key={item.id} className="bg-black/30 rounded-2xl p-4">
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
                      {/* Show last workout suggestion if available */}
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

        {/* Save Section */}
        {items.length > 0 && (
          <div className="sticky bottom-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-white/90">{resolveTitle() || 'Untitled Workout'}</div>
                <div className="text-sm text-white/70">
                  {items.length} exercise{items.length !== 1 ? 's' : ''} • {items.reduce((acc, item) => acc + item.sets.length, 0)} sets
                </div>
                {lastSaved && (
                  <div className="text-xs text-green-400/80 mt-1">
                    ✓ Auto-saved {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  className="toggle px-6"
                  onClick={saveOffline}
                  title="Save offline"
                >
                  📱 Offline
                </button>
                <button
                  className="btn disabled:opacity-50"
                  onClick={saveOnline}
                  disabled={!canSave || isSaving}
                >
                  {isSaving ? 'Saving...' : '💾 Save Workout'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}