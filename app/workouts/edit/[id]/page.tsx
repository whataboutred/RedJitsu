'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import ExerciseSelector from '@/components/ExerciseSelector'
import EnhancedSetRow from '@/components/EnhancedSetRow'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { logger, EventType } from '@/lib/splunkLogger'

type Exercise = { id: string; name: string; category: 'barbell'|'dumbbell'|'machine'|'cable'|'other' }
type PresetTitle = 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Other'

export default function EnhancedEditWorkoutPage() {
  const router = useRouter()
  const params = useParams()
  const workoutId = params.id as string

  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [note, setNote] = useState('')
  const [presetTitle, setPresetTitle] = useState<PresetTitle>('Upper')
  const [customTitle, setCustomTitle] = useState('')
  const [performedAt, setPerformedAt] = useState<string>('')
  
  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<
    Array<{ id: string; name: string; sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> }>
  >([])

  // UI State for enhanced experience
  const [isExerciseSelectorCollapsed, setIsExerciseSelectorCollapsed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(false)

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

  useEffect(() => {
    (async () => {
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

      // Load user's unit preference
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit')
        .eq('id', userId)
        .single()
      if (profile?.unit) setUnit(profile.unit as 'lb' | 'kg')

      // Load exercises
      const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
      if (ex) setAllExercises(ex as Exercise[])

      // Load existing workout data
      await loadWorkoutData()
      setLoading(false)
    })()
  }, [workoutId])

  async function loadWorkoutData() {
    const userId = await getActiveUserId()
    if (!userId) return

    try {
      // Load workout details
      const { data: workout } = await supabase
        .from('workouts')
        .select('performed_at, title, note')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single()

      if (workout) {
        setPerformedAt(new Date(workout.performed_at).toISOString().slice(0, 16))
        setNote(workout.note || '')
        
        if (workout.title) {
          const presets: PresetTitle[] = ['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Other']
          if (presets.includes(workout.title as PresetTitle)) {
            setPresetTitle(workout.title as PresetTitle)
            setCustomTitle('')
          } else {
            setPresetTitle('Other')
            setCustomTitle(workout.title)
          }
        }
      }

      // Load workout exercises and sets
      const { data: workoutExercises } = await supabase
        .from('workout_exercises')
        .select(`
          id,
          display_name,
          exercise_id,
          sets (
            weight,
            reps,
            set_type,
            set_index
          )
        `)
        .eq('workout_id', workoutId)
        .order('order_index')

      if (workoutExercises) {
        const loadedItems = workoutExercises.map(we => ({
          id: we.exercise_id || we.id,
          name: we.display_name,
          sets: (we.sets as any[])
            .sort((a, b) => a.set_index - b.set_index)
            .map(s => ({
              weight: s.weight || 0,
              reps: s.reps || 0,
              set_type: s.set_type as 'warmup' | 'working'
            }))
        }))
        setItems(loadedItems)
      }
    } catch (error) {
      console.error('Error loading workout:', error)
      alert('Failed to load workout data')
    }
  }

  if (demo) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You're viewing the app in read-only demo mode. To edit workouts,
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
            <div className="h-48 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  // ExerciseSelector component handles filtering internally

  const title = customTitle.trim() || presetTitle

  function addExercise(exerciseId: string) {
    const ex = allExercises.find(e => e.id === exerciseId)
    if (!ex) return
    
    setItems(prev => {
      const existing = prev.find(item => item.id === ex.id)
      if (existing) return prev
      return [...prev, { id: ex.id, name: ex.name, sets: [{ weight: 0, reps: 0, set_type: 'working' }] }]
    })
    setSearch('')
    setIsExerciseSelectorCollapsed(true)
    // Auto-expand the new exercise and collapse others
    expandExerciseAndCollapseOthers(ex.id)
  }

  async function addCustomExercise() {
    const name = search.trim()
    if (!name) { alert('Type a name first.'); return }
    
    const userId = await getActiveUserId()
    if (!userId) return

    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name, category: 'other', is_global: false, owner: userId })
      .select('id,name,category')
      .single()
    
    if (error || !ins) { alert('Could not create exercise.'); return }
    
    const newExercise = ins as Exercise
    setAllExercises(prev => [...prev, newExercise])
    setItems(prev => [...prev, { id: newExercise.id, name: newExercise.name, sets: [{ weight: 0, reps: 0, set_type: 'working' }] }])
    setSearch('')
    setIsExerciseSelectorCollapsed(true)
    // Auto-expand the new exercise and collapse others
    expandExerciseAndCollapseOthers(newExercise.id)
  }

  function removeExercise(exerciseId: string) {
    setItems(prev => prev.filter(item => item.id !== exerciseId))
  }

  function updateSets(exerciseId: string, newSets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }>) {
    setItems(prev => prev.map(item =>
      item.id === exerciseId ? { ...item, sets: newSets } : item
    ))
  }

  async function handleSave() {
    const userId = await getActiveUserId()
    if (!userId) return

    if (items.length === 0) {
      alert('Add at least one exercise to save the workout.')
      return
    }

    setSaving(true)
    try {
      console.log('Starting workout save process...')
      
      // Log workout update attempt
      logger.info(
        EventType.WORKOUT_UPDATED,
        `User attempting to update workout ${workoutId}`,
        {
          workout_id: workoutId,
          title: title,
          performed_at: performedAt,
          has_note: !!note.trim()
        },
        userId
      )
      
      // Step 1: Update workout basic info only (safest operation first)
      const { error: workoutError } = await supabase
        .from('workouts')
        .update({
          performed_at: new Date(performedAt).toISOString(),
          title: title,
          note: note.trim() || null
        })
        .eq('id', workoutId)
        .eq('user_id', userId)

      if (workoutError) {
        console.error('Workout update error:', workoutError)
        logger.error(
          EventType.DATABASE_ERROR,
          `Failed to update workout ${workoutId}`,
          workoutError,
          userId
        )
        throw new Error(`Failed to update workout info: ${workoutError.message}`)
      }

      console.log('Workout basic info updated successfully')
      
      // Step 2: Update exercises and sets
      console.log('Updating exercises and sets...')
      
      // Get current workout exercises to compare
      const { data: currentWorkoutExercises } = await supabase
        .from('workout_exercises')
        .select('id, exercise_id, display_name, order_index')
        .eq('workout_id', workoutId)
        .order('order_index')

      // Delete exercises that are no longer in the items array
      if (currentWorkoutExercises) {
        const currentExerciseIds = items.map(item => item.id)
        const exercisesToDelete = currentWorkoutExercises.filter(we => 
          !currentExerciseIds.includes(we.exercise_id || we.id)
        )

        for (const exerciseToDelete of exercisesToDelete) {
          // Delete sets first (foreign key constraint)
          await supabase
            .from('sets')
            .delete()
            .eq('workout_exercise_id', exerciseToDelete.id)
          
          // Delete workout exercise
          await supabase
            .from('workout_exercises')
            .delete()
            .eq('id', exerciseToDelete.id)
        }
      }

      // Update/insert exercises and sets
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        
        // Find existing workout exercise or create new one
        let workoutExercise = currentWorkoutExercises?.find(we => 
          (we.exercise_id || we.id) === item.id
        )
        
        if (workoutExercise) {
          // Update existing workout exercise
          const { error: updateExerciseError } = await supabase
            .from('workout_exercises')
            .update({
              display_name: item.name,
              order_index: i
            })
            .eq('id', workoutExercise.id)
          
          if (updateExerciseError) {
            throw new Error(`Failed to update exercise: ${updateExerciseError.message}`)
          }
        } else {
          // Insert new workout exercise
          const { data: newWorkoutExercise, error: insertExerciseError } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutId,
              exercise_id: item.id,
              display_name: item.name,
              order_index: i
            })
            .select()
            .single()
          
          if (insertExerciseError) {
            throw new Error(`Failed to insert exercise: ${insertExerciseError.message}`)
          }
          
          workoutExercise = newWorkoutExercise
        }

        // Delete all existing sets for this exercise
        if (workoutExercise?.id) {
          await supabase
            .from('sets')
            .delete()
            .eq('workout_exercise_id', workoutExercise.id)
        }

        // Insert all sets for this exercise
        if (item.sets.length > 0 && workoutExercise?.id) {
          const setsToInsert = item.sets.map((set, setIndex) => ({
            workout_exercise_id: workoutExercise.id,
            weight: set.weight,
            reps: set.reps,
            set_type: set.set_type,
            set_index: setIndex
          }))

          const { error: setsError } = await supabase
            .from('sets')
            .insert(setsToInsert)

          if (setsError) {
            throw new Error(`Failed to save sets: ${setsError.message}`)
          }
        }
      }
      
      console.log('All exercises and sets updated successfully')
      
      // Log successful update
      logger.info(
        EventType.WORKOUT_UPDATED,
        `Successfully updated workout ${workoutId}`,
        {
          workout_id: workoutId,
          title: title,
          exercises_count: items.length,
          sets_count: items.reduce((acc, item) => acc + item.sets.length, 0),
          updated_fields: ['performed_at', 'title', 'note', 'exercises', 'sets']
        },
        userId
      )
      
      alert('Workout updated successfully!')
      
      // Reload to show updated data
      await loadWorkoutData()
      
    } catch (error) {
      console.error('Save error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Log the error
      logger.error(
        EventType.APP_ERROR,
        `Workout update failed for ${workoutId}`,
        error,
        userId
      )
      
      alert(`Failed to update workout: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/history" className="toggle">
            ← Back to History
          </Link>
          <h1 className="text-2xl font-bold">Edit Workout</h1>
        </div>

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
                Units
              </label>
              <div className="flex gap-2">
                <button
                  className={`toggle flex-1 ${unit === 'lb' ? 'bg-brand-red/20 border-brand-red text-white' : ''}`}
                  onClick={() => setUnit('lb')}
                >
                  Pounds
                </button>
                <button
                  className={`toggle flex-1 ${unit === 'kg' ? 'bg-brand-red/20 border-brand-red text-white' : ''}`}
                  onClick={() => setUnit('kg')}
                >
                  Kilograms
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/80 font-medium mb-2">
                Workout Type
              </label>
              <select
                className="input w-full"
                value={presetTitle}
                onChange={e => setPresetTitle(e.target.value as PresetTitle)}
              >
                <option value="Upper">Upper Body</option>
                <option value="Lower">Lower Body</option>
                <option value="Push">Push Day</option>
                <option value="Pull">Pull Day</option>
                <option value="Legs">Leg Day</option>
                <option value="Other">Custom</option>
              </select>
            </div>
            {presetTitle === 'Other' && (
              <div>
                <label className="block text-sm text-white/80 font-medium mb-2">
                  Custom Title
                </label>
                <input
                  type="text"
                  className="input w-full"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  placeholder="Enter custom workout name"
                />
              </div>
            )}
          </div>

          <div className="mt-4">
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

        {/* Exercise Selection */}
        <ExerciseSelector
          exercises={allExercises}
          search={search}
          onSearchChange={setSearch}
          onAddExercise={addExercise}
          onAddCustomExercise={addCustomExercise}
          isCollapsed={isExerciseSelectorCollapsed}
          onToggleCollapse={() => setIsExerciseSelectorCollapsed(!isExerciseSelectorCollapsed)}
        />

        {/* Current Exercises */}
        <div className="card">
          <div className="font-medium mb-4">🏋️‍♀️ Current Exercises</div>

          {/* Current Exercises */}
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
                  
                  {isExpanded && (
                    <div className="space-y-3">
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
                          onClick={() =>
                            setItems(prev =>
                              prev.map((p, i) => i === idx ? { ...p, sets: [...p.sets, { weight: 0, reps: 0, set_type: 'working' }] } : p)
                            )
                          }
                        >
                          + Add Set
                        </button>
                        {item.sets.length > 0 && (
                          <button 
                            className="toggle flex-1" 
                            onClick={() =>
                              setItems(prev =>
                                prev.map((p, i) => i === idx ? { ...p, sets: [...p.sets, { ...p.sets[p.sets.length-1] }] } : p)
                              )
                            }
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

        {/* Save Section */}
        {items.length > 0 && (
          <div className="sticky bottom-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-white/90">{title}</div>
                <div className="text-sm text-white/70">
                  {items.length} exercise{items.length !== 1 ? 's' : ''} • {items.reduce((acc, item) => acc + item.sets.length, 0)} sets
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/history" className="toggle px-6">
                  Cancel
                </Link>
                <button
                  className="btn disabled:opacity-50"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Update Workout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}