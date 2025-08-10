'use client'
import { useState, useMemo } from 'react'

type Exercise = { 
  id: string
  name: string
  category: 'barbell'|'dumbbell'|'machine'|'cable'|'other'
}

type BodyPartCategory = 'all' | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other'

type ExerciseSelectorProps = {
  exercises: Exercise[]
  search: string
  onSearchChange: (search: string) => void
  onAddExercise: (id: string) => void
  onAddCustomExercise: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

// Map exercise names to body parts for better organization
function getBodyPart(exerciseName: string): BodyPartCategory {
  const name = exerciseName.toLowerCase()
  
  // Chest
  if (name.includes('bench') || name.includes('chest') || name.includes('press') && (name.includes('chest') || name.includes('incline') || name.includes('decline')) || name.includes('fly') || name.includes('dip')) {
    return 'chest'
  }
  
  // Back
  if (name.includes('row') || name.includes('pull') || name.includes('lat') || name.includes('back') || name.includes('deadlift') || name.includes('chin')) {
    return 'back'
  }
  
  // Shoulders
  if (name.includes('shoulder') || name.includes('lateral') || name.includes('overhead') || name.includes('military') || name.includes('arnold') || name.includes('raise')) {
    return 'shoulders'
  }
  
  // Arms
  if (name.includes('curl') || name.includes('tricep') || name.includes('bicep') || name.includes('extension') || name.includes('arm')) {
    return 'arms'
  }
  
  // Legs
  if (name.includes('squat') || name.includes('leg') || name.includes('calf') || name.includes('lunge') || name.includes('quad') || name.includes('hamstring') || name.includes('thigh')) {
    return 'legs'
  }
  
  // Core
  if (name.includes('crunch') || name.includes('plank') || name.includes('abs') || name.includes('core') || name.includes('sit')) {
    return 'core'
  }
  
  return 'other'
}

const BODY_PART_ICONS = {
  all: '🏋️',
  chest: '💪',
  back: '🦵', 
  shoulders: '🫱',
  arms: '💪',
  legs: '🦵',
  core: '🔥',
  other: '⚡'
} as const

const BODY_PART_LABELS = {
  all: 'All',
  chest: 'Chest',
  back: 'Back', 
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  other: 'Other'
} as const

export default function ExerciseSelector({ 
  exercises, 
  search, 
  onSearchChange, 
  onAddExercise, 
  onAddCustomExercise, 
  isCollapsed,
  onToggleCollapse 
}: ExerciseSelectorProps) {
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPartCategory>('all')

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      const matchText = !q || e.name.toLowerCase().includes(q)
      const exerciseBodyPart = getBodyPart(e.name)
      const matchBodyPart = selectedBodyPart === 'all' || exerciseBodyPart === selectedBodyPart
      return matchText && matchBodyPart
    })
  }, [exercises, search, selectedBodyPart])

  return (
    <div className="card">
      <div 
        className="flex items-center justify-between cursor-pointer mb-3"
        onClick={onToggleCollapse}
      >
        <div className="font-medium">💪 Add Exercises</div>
        <div className="text-white/60">
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* Body Part Categories */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BODY_PART_LABELS) as BodyPartCategory[]).map(bodyPart => (
              <button
                key={bodyPart}
                className={`toggle text-sm ${
                  selectedBodyPart === bodyPart 
                    ? 'border-brand-red bg-brand-red/20 text-white' 
                    : ''
                }`}
                onClick={() => setSelectedBodyPart(bodyPart)}
              >
                {BODY_PART_ICONS[bodyPart]} {BODY_PART_LABELS[bodyPart]}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <input 
              className="input w-full pl-10" 
              placeholder="Search exercises or create custom..."
              value={search} 
              onChange={e => onSearchChange(e.target.value)}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40">
              🔍
            </div>
          </div>

          {/* Exercise List */}
          <div className="space-y-2">
            {/* Exercise Grid - Mobile: 1 col, Desktop: 2 cols */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto">
              {filteredExercises.slice(0, 50).map(ex => (
                <button 
                  key={ex.id} 
                  className="toggle w-full text-left p-3 hover:bg-brand-red/10 hover:border-brand-red/30 transition-all duration-200"
                  onClick={() => onAddExercise(ex.id)}
                >
                  <div className="font-medium text-white/90">{ex.name}</div>
                  <div className="text-xs text-white/60 mt-1">
                    {BODY_PART_ICONS[getBodyPart(ex.name)]} {BODY_PART_LABELS[getBodyPart(ex.name)]} • {ex.category}
                  </div>
                </button>
              ))}
              
              {/* Custom Exercise Option */}
              {search.trim() && (
                <button 
                  className="toggle w-full text-left p-3 border-dashed border-brand-red/50 hover:bg-brand-red/10"
                  onClick={onAddCustomExercise}
                >
                  <div className="font-medium text-brand-red">+ Create "{search.trim()}"</div>
                  <div className="text-xs text-white/60 mt-1">
                    ⭐ Custom exercise
                  </div>
                </button>
              )}
            </div>

            {filteredExercises.length === 0 && !search.trim() && (
              <div className="text-center text-white/60 py-4">
                Select a body part to see exercises
              </div>
            )}

            {filteredExercises.length === 0 && search.trim() && (
              <div className="text-center text-white/60 py-4">
                No exercises found. Try creating a custom one above!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}