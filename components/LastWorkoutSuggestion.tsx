'use client'

type Set = {
  weight: number
  reps: number
  set_type: 'warmup' | 'working'
}

type LastWorkoutSuggestionProps = {
  sets: Set[]
  unit: 'lb' | 'kg'
}

export default function LastWorkoutSuggestion({ sets, unit }: LastWorkoutSuggestionProps) {
  if (!sets || sets.length === 0) {
    return null
  }

  // Group sets by weight and reps to create a concise summary
  const setGroups = new Map<string, number>()
  sets.forEach(set => {
    const key = `${set.weight}x${set.reps}`
    setGroups.set(key, (setGroups.get(key) || 0) + 1)
  })

  // Create the suggestion text
  const setSummary = Array.from(setGroups.entries())
    .map(([key, count]) => {
      const [weight, reps] = key.split('x')
      return count > 1 ? `${count} sets of ${weight}x${reps}` : `${weight}x${reps}`
    })
    .join(', ')

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-3">
      <div className="flex items-start gap-2">
        <span className="text-blue-400 text-sm">💡</span>
        <div className="flex-1">
          <div className="text-sm text-blue-400 font-medium mb-1">Last Workout Suggestion</div>
          <div className="text-sm text-white/80">
            Last workout you did {setSummary} ({unit})
          </div>
        </div>
      </div>
    </div>
  )
}
