'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId } from '@/lib/activeUser'
import { X, Edit3, Trash2, Save, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'

type WorkoutSet = {
  id: string
  exercise_id: string
  weight: number | null
  reps: number | null
  set_type: string
  set_index: number
  completed: boolean
}

type Exercise = {
  id: string
  name: string
}

type EditableSet = WorkoutSet & {
  isEditing?: boolean
  originalWeight?: number | null
  originalReps?: number | null
}

export default function EnhancedWorkoutDetail({ 
  workoutId, 
  onClose,
  onUpdate 
}: { 
  workoutId: string
  onClose: () => void
  onUpdate?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sets, setSets] = useState<EditableSet[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workout, setWorkout] = useState<{ performed_at: string; title: string | null } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadWorkoutData()
  }, [workoutId])

  async function loadWorkoutData() {
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      // Load workout details
      const { data: w } = await supabase
        .from('workouts')
        .select('performed_at,title')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single()
      setWorkout(w as any)

      // Load sets with exercise data
      const { data: s } = await supabase
        .from('sets')
        .select(`
          id,
          weight,
          reps,
          set_type,
          set_index,
          completed,
          exercises!inner(
            id,
            exercise_id,
            name
          )
        `)
        .eq('workout_id', workoutId)
        .order('created_at', { ascending: true })

      if (s) {
        const setsWithExerciseIds = s.map(set => ({
          id: set.id,
          exercise_id: (set.exercises as any).exercise_id,
          weight: set.weight,
          reps: set.reps,
          set_type: set.set_type,
          set_index: set.set_index,
          completed: set.completed,
          isEditing: false,
          originalWeight: set.weight,
          originalReps: set.reps
        }))
        
        setSets(setsWithExerciseIds)

        // Extract unique exercises
        const uniqueExercises = Array.from(
          new Map(s.map(set => [
            (set.exercises as any).exercise_id,
            { id: (set.exercises as any).exercise_id, name: (set.exercises as any).name }
          ])).values()
        )
        setExercises(uniqueExercises)
      }
    } catch (error) {
      console.error('Error loading workout:', error)
    } finally {
      setLoading(false)
    }
  }

  function getExerciseName(exerciseId: string) {
    return exercises.find(e => e.id === exerciseId)?.name || 'Unknown exercise'
  }

  // Group sets by exercise with proper ordering
  const groupedSets = sets
    .sort((a, b) => a.set_index - b.set_index)
    .reduce((acc, set) => {
      if (!acc[set.exercise_id]) {
        acc[set.exercise_id] = []
      }
      acc[set.exercise_id].push(set)
      return acc
    }, {} as Record<string, EditableSet[]>)

  function toggleEditSet(setId: string) {
    setSets(prev => prev.map(set => 
      set.id === setId 
        ? { ...set, isEditing: !set.isEditing }
        : set
    ))
  }

  function updateSetValue(setId: string, field: 'weight' | 'reps', value: number | null) {
    setSets(prev => prev.map(set => 
      set.id === setId 
        ? { ...set, [field]: value }
        : set
    ))
    setHasChanges(true)
  }

  function revertSetChanges(setId: string) {
    setSets(prev => prev.map(set => 
      set.id === setId 
        ? { 
            ...set, 
            weight: set.originalWeight,
            reps: set.originalReps,
            isEditing: false
          }
        : set
    ))
    // Check if we still have changes after revert
    setHasChanges(sets.some(s => 
      s.id !== setId && (s.weight !== s.originalWeight || s.reps !== s.originalReps)
    ))
  }

  async function saveSetChanges(setId: string) {
    const set = sets.find(s => s.id === setId)
    if (!set) return

    try {
      const { error } = await supabase
        .from('sets')
        .update({
          weight: set.weight,
          reps: set.reps
        })
        .eq('id', setId)

      if (error) {
        console.error('Save error:', error)
        alert('Failed to save changes')
        return
      }

      // Update original values and exit edit mode
      setSets(prev => prev.map(s => 
        s.id === setId 
          ? { 
              ...s, 
              isEditing: false,
              originalWeight: s.weight,
              originalReps: s.reps
            }
          : s
      ))
      
      // Check if we still have unsaved changes
      setHasChanges(sets.some(s => 
        s.id !== setId && (s.weight !== s.originalWeight || s.reps !== s.originalReps)
      ))

      // Trigger refresh of parent component if provided
      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save changes')
    }
  }

  async function saveAllChanges() {
    setSaving(true)
    try {
      const changedSets = sets.filter(s => 
        s.weight !== s.originalWeight || s.reps !== s.originalReps
      )

      for (const set of changedSets) {
        const { error } = await supabase
          .from('sets')
          .update({
            weight: set.weight,
            reps: set.reps
          })
          .eq('id', set.id)

        if (error) {
          throw error
        }
      }

      // Update all original values
      setSets(prev => prev.map(set => ({
        ...set,
        isEditing: false,
        originalWeight: set.weight,
        originalReps: set.reps
      })))

      setHasChanges(false)
      setEditMode(false)
      
      if (onUpdate) {
        onUpdate()
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const userId = await getActiveUserId()
      if (!userId) return

      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', userId)

      if (error) {
        alert('Failed to delete workout')
        console.error('Delete error:', error)
        return
      }

      if (onUpdate) {
        onUpdate()
      }
      onClose()
    } catch (error) {
      alert('Failed to delete workout')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  function handleEdit() {
    router.push(`/workouts/edit/${workoutId}`)
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center justify-between">
          <div>Loading workout details...</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!workout) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center justify-between">
          <div>Workout not found or access denied.</div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
          <div>
            <div className="font-medium">{workout.title || 'Untitled workout'}</div>
            <div className="text-sm text-white/70">{new Date(workout.performed_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                <button 
                  onClick={() => setEditMode(true)}
                  className="p-2 hover:bg-white/5 rounded-lg text-blue-400 hover:text-blue-300 transition-colors" 
                  title="Edit sets inline"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleEdit}
                  className="toggle text-sm px-3 py-1" 
                  title="Full workout editor"
                >
                  Full Edit
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={saveAllChanges}
                  disabled={!hasChanges || saving}
                  className="btn text-sm px-3 py-1 disabled:opacity-50"
                  title="Save all changes"
                >
                  {saving ? 'Saving...' : 'Save All'}
                </button>
                <button 
                  onClick={() => {
                    setEditMode(false)
                    loadWorkoutData() // Reload to reset changes
                  }}
                  className="toggle text-sm px-3 py-1"
                  title="Cancel editing"
                >
                  Cancel
                </button>
              </>
            )}
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors" 
              title="Delete workout"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {Object.entries(groupedSets).map(([exerciseId, exerciseSets]) => (
            <div key={exerciseId} className="bg-black/30 rounded-2xl p-4 space-y-3">
              <div className="font-medium text-white/90 text-lg">{getExerciseName(exerciseId)}</div>
              
              <div className="space-y-3">
                {exerciseSets.map((set, i) => (
                  <div key={set.id} className="bg-black/20 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-white/70">
                        Set {set.set_index}
                        {set.set_type === 'warmup' && (
                          <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                            Warmup
                          </span>
                        )}
                      </div>
                      {editMode && (
                        <div className="flex gap-1">
                          {set.isEditing ? (
                            <>
                              <button
                                onClick={() => saveSetChanges(set.id)}
                                className="p-1 hover:bg-green-500/20 rounded-lg text-green-400 hover:text-green-300"
                                title="Save set"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => revertSetChanges(set.id)}
                                className="p-1 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300"
                                title="Revert changes"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => toggleEditSet(set.id)}
                              className="p-1 hover:bg-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300"
                              title="Edit set"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {set.isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-white/60 mb-1">Weight (lb)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            className="input w-full text-center"
                            value={set.weight || ''}
                            onChange={e => updateSetValue(set.id, 'weight', e.target.value ? Number(e.target.value) : null)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-white/60 mb-1">Reps</label>
                          <input
                            type="number"
                            min="0"
                            className="input w-full text-center"
                            value={set.reps || ''}
                            onChange={e => updateSetValue(set.id, 'reps', e.target.value ? Number(e.target.value) : null)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-white/80 font-medium">
                        {set.weight && `${set.weight} lb`}
                        {set.weight && set.reps && ' × '}
                        {set.reps && `${set.reps} reps`}
                        {!set.weight && !set.reps && (
                          <span className="text-white/50">No details recorded</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!sets.length && (
            <div className="text-center py-8">
              <div className="text-white/60">No sets recorded for this workout.</div>
            </div>
          )}
        </div>

        {/* Footer with unsaved changes warning */}
        {hasChanges && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-center text-sm text-yellow-400">
              ⚠️ You have unsaved changes
            </div>
          </div>
        )}
      </div>
    </div>
  )
}