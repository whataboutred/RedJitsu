'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import ProgramTemplates from '@/components/ProgramTemplates'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'

type Exercise = {
  id: string
  name: string
  category: 'barbell'|'dumbbell'|'machine'|'cable'|'other'
}

type Program = { 
  id: string
  name: string 
  is_active: boolean
  created_at: string
  total_days?: number
  total_exercises?: number
}

type DayDraft = {
  id?: string
  name: string
  dows: number[] // 0..6 (Sun..Sat)
  items: Array<{
    id?: string
    exercise_id: string
    display_name: string
    default_sets: number
    default_reps: number
  }>
}

type ProgramTemplate = {
  id: string
  name: string
  description: string
  duration: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  focus: string[]
  emoji: string
  days: Array<{
    name: string
    dows: number[]
    exercises: Array<{
      name: string
      sets: number
      reps: number | string
      category: string
    }>
  }>
}

const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const
const CATEGORIES = ['all', 'barbell', 'dumbbell', 'machine', 'cable', 'other'] as const

export default function ProgramsPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selected, setSelected] = useState<Program | null>(null)
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'list' | 'quick' | 'manual'>('list')
  const [loading, setLoading] = useState(true)

  // Program creation state
  const [pName, setPName] = useState('')
  const [days, setDays] = useState<DayDraft[]>([{ name: '', dows: [], items: [] }])

  // Enhanced search and filtering
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('all')
  
  // Collapsible days state
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      const matchesSearch = !q || e.name.toLowerCase().includes(q)
      const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [exercises, search, selectedCategory])

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      if (!isDemo) {
        await loadData()
      }
      setLoading(false)
    })()
  }, [])

  if (demo) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 p-4 max-w-xl mx-auto">
          <h1 className="text-xl font-semibold mb-2">Demo mode</h1>
          <p className="text-white/70">
            You're viewing the app in read-only demo mode. To create your own
            programs, please <Link href="/login" className="underline">sign in</Link>.
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
        <main className="relative z-10 max-w-6xl mx-auto p-4">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-white/10 rounded w-1/3"></div>
            <div className="h-32 bg-white/10 rounded"></div>
            <div className="h-48 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
    setExercises((ex || []) as Exercise[])

    await reloadPrograms()
  }

  async function reloadPrograms() {
    const userId = await getActiveUserId()
    if (!userId) return

    // Get programs with stats
    const { data: progs } = await supabase
      .from('programs')
      .select(`
        id,
        name,
        is_active,
        created_at,
        program_days(
          id,
          template_exercises(id)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    const programsWithStats = (progs || []).map(p => ({
      id: p.id,
      name: p.name,
      is_active: p.is_active,
      created_at: p.created_at,
      total_days: p.program_days?.length || 0,
      total_exercises: p.program_days?.reduce((acc: number, day: any) => 
        acc + (day.template_exercises?.length || 0), 0) || 0
    }))

    setPrograms(programsWithStats)
  }

  async function handleTemplateSelect(template: ProgramTemplate) {
    // Convert template to days format
    const templateDays: DayDraft[] = []
    
    for (const templateDay of template.days) {
      const items: DayDraft['items'] = []
      
      for (const exercise of templateDay.exercises) {
        // Find matching exercise or create placeholder
        const existingExercise = exercises.find(e => 
          e.name.toLowerCase() === exercise.name.toLowerCase()
        )
        
        if (existingExercise) {
          items.push({
            exercise_id: existingExercise.id,
            display_name: exercise.name,
            default_sets: exercise.sets,
            default_reps: typeof exercise.reps === 'string' ? 0 : exercise.reps
          })
        } else {
          // Create a new exercise if it doesn't exist
          const newExercise = await createCustomExercise(exercise.name, exercise.category as Exercise['category'])
          if (newExercise) {
            items.push({
              exercise_id: newExercise.id,
              display_name: exercise.name,
              default_sets: exercise.sets,
              default_reps: typeof exercise.reps === 'string' ? 0 : exercise.reps
            })
          }
        }
      }
      
      templateDays.push({
        name: templateDay.name,
        dows: templateDay.dows,
        items
      })
    }
    
    setPName(template.name)
    setDays(templateDays)
    setMode('manual')
  }

  async function createCustomExercise(exerciseName: string, category: Exercise['category'] = 'other') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name: exerciseName, category, is_global: false, owner: user.id })
      .select('id,name,category')
      .single()

    if (error || !ins) return null

    const newExercise = ins as Exercise
    setExercises(prev => [...prev, newExercise])
    return newExercise
  }

  function startQuickMode() {
    setSelected(null)
    setPName('')
    setDays([{ name: '', dows: [], items: [] }])
    setMode('quick')
  }

  function startManualMode() {
    setSelected(null)
    setPName('')
    setDays([{ name: '', dows: [], items: [] }])
    setMode('manual')
  }

  function backToList() {
    setMode('list')
    setSelected(null)
  }

  async function setActive(id: string) {
    const userId = await getActiveUserId()
    if (!userId) return
    
    await supabase.from('programs').update({ is_active: false }).eq('user_id', userId)
    await supabase.from('programs').update({ is_active: true }).eq('id', id)
    await reloadPrograms()
  }

  async function deleteProgram(id: string) {
    const ok = confirm('Delete this program and all its days/templates? This cannot be undone.')
    if (!ok) return
    
    await supabase.from('programs').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    await reloadPrograms()
  }

  async function loadProgram(prog: Program) {
    setSelected(prog)
    setPName(prog.name)

    const { data: daysRows } = await supabase
      .from('program_days')
      .select('id,name,dows,order_index')
      .eq('program_id', prog.id)
      .order('order_index')

    const out: DayDraft[] = []
    for (const d of (daysRows || [])) {
      const { data: tx } = await supabase
        .from('template_exercises')
        .select('id,exercise_id,display_name,default_sets,default_reps,order_index')
        .eq('program_day_id', d.id)
        .order('order_index')
        
      out.push({
        id: d.id,
        name: d.name,
        dows: d.dows || [],
        items: (tx || []).map(x => ({
          id: x.id,
          exercise_id: x.exercise_id,
          display_name: x.display_name,
          default_sets: x.default_sets ?? 3,
          default_reps: (x.default_reps ?? 0),
        })),
      })
    }
    
    setDays(out.length ? out : [{ name: '', dows: [], items: [] }])
    setMode('manual')
  }

  // Collapsible day helper functions
  function toggleDayExpanded(dayIndex: number) {
    setExpandedDays(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayIndex)) {
        newSet.delete(dayIndex)
      } else {
        newSet.add(dayIndex)
      }
      return newSet
    })
  }

  // Program creation helper functions
  function addDay() {
    const newDayIndex = days.length
    setDays(prev => [...prev, { name: '', dows: [], items: [] }])
    // Auto-expand the new day
    setExpandedDays(prev => new Set([...prev, newDayIndex]))
  }

  function removeDay(dayIndex: number) {
    setDays(prev => prev.filter((_, idx) => idx !== dayIndex))
    // Update expanded state after removal
    setExpandedDays(prev => {
      const newSet = new Set<number>()
      prev.forEach(index => {
        if (index < dayIndex) {
          newSet.add(index)
        } else if (index > dayIndex) {
          newSet.add(index - 1) // Shift indices down
        }
        // Skip the removed index
      })
      return newSet
    })
  }

  function updateDayName(dayIndex: number, name: string) {
    setDays(prev => prev.map((day, idx) => 
      idx === dayIndex ? { ...day, name } : day
    ))
  }

  function toggleDayOfWeek(dayIndex: number, dow: number) {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day
      const has = day.dows.includes(dow)
      return { 
        ...day, 
        dows: has ? day.dows.filter(d => d !== dow) : [...day.dows, dow]
      }
    }))
  }

  function addExerciseToDay(dayIndex: number, exercise: Exercise) {
    setDays(prev => prev.map((day, idx) => 
      idx === dayIndex 
        ? { 
            ...day, 
            items: [...day.items, {
              exercise_id: exercise.id,
              display_name: exercise.name,
              default_sets: 3,
              default_reps: 0
            }]
          }
        : day
    ))
    setSearch('')
  }

  function removeExerciseFromDay(dayIndex: number, exerciseIndex: number) {
    setDays(prev => prev.map((day, idx) => 
      idx === dayIndex 
        ? { ...day, items: day.items.filter((_, eIdx) => eIdx !== exerciseIndex) }
        : day
    ))
  }

  function updateExerciseSets(dayIndex: number, exerciseIndex: number, sets: number) {
    setDays(prev => prev.map((day, idx) => 
      idx === dayIndex 
        ? {
            ...day,
            items: day.items.map((item, eIdx) => 
              eIdx === exerciseIndex ? { ...item, default_sets: Math.max(1, sets) } : item
            )
          }
        : day
    ))
  }

  function updateExerciseReps(dayIndex: number, exerciseIndex: number, reps: number) {
    setDays(prev => prev.map((day, idx) => 
      idx === dayIndex 
        ? {
            ...day,
            items: day.items.map((item, eIdx) => 
              eIdx === exerciseIndex ? { ...item, default_reps: Math.max(0, reps) } : item
            )
          }
        : day
    ))
  }

  function moveExercise(dayIndex: number, exerciseIndex: number, direction: 'up' | 'down') {
    setDays(prev => prev.map((day, idx) => {
      if (idx !== dayIndex) return day
      
      const items = [...day.items]
      const newIndex = direction === 'up' ? exerciseIndex - 1 : exerciseIndex + 1
      
      if (newIndex < 0 || newIndex >= items.length) return day
      
      const [movedItem] = items.splice(exerciseIndex, 1)
      items.splice(newIndex, 0, movedItem)
      
      return { ...day, items }
    }))
  }

  async function addCustomExerciseToDay(dayIndex: number) {
    const exerciseName = search.trim()
    if (!exerciseName) {
      alert('Enter an exercise name first')
      return
    }

    const newExercise = await createCustomExercise(exerciseName, selectedCategory === 'all' ? 'other' : selectedCategory)
    if (newExercise) {
      addExerciseToDay(dayIndex, newExercise)
    } else {
      alert('Failed to create exercise')
    }
  }

  async function saveProgram() {
    const userId = await getActiveUserId()
    if (!userId) return

    if (!pName.trim()) {
      alert('Please enter a program name')
      return
    }

    if (days.length === 0) {
      alert('Please add at least one training day')
      return
    }

    const validDays = days.filter(day => day.items.length > 0)
    if (validDays.length === 0) {
      alert('Please add exercises to at least one training day')
      return
    }

    try {
      if (selected) {
        // Update existing program
        await supabase.from('programs').update({ name: pName }).eq('id', selected.id)

        // Delete existing days and exercises
        const { data: pd } = await supabase.from('program_days').select('id').eq('program_id', selected.id)
        const oldDayIds = (pd || []).map(r => r.id)
        if (oldDayIds.length) {
          await supabase.from('template_exercises').delete().in('program_day_id', oldDayIds)
        }
        await supabase.from('program_days').delete().eq('program_id', selected.id)

        // Create new days and exercises
        for (let i = 0; i < validDays.length; i++) {
          const day = validDays[i]
          const { data: insDay } = await supabase.from('program_days').insert({
            program_id: selected.id,
            name: day.name || `Day ${i + 1}`,
            dows: day.dows,
            order_index: i
          }).select('id').single()

          if (insDay) {
            for (let j = 0; j < day.items.length; j++) {
              const item = day.items[j]
              await supabase.from('template_exercises').insert({
                program_day_id: insDay.id,
                exercise_id: item.exercise_id,
                display_name: item.display_name,
                default_sets: item.default_sets,
                default_reps: item.default_reps,
                set_type: 'working',
                order_index: j
              })
            }
          }
        }
      } else {
        // Create new program
        const { data: prog } = await supabase.from('programs').insert({
          user_id: userId,
          name: pName,
          is_active: programs.length === 0
        }).select('id').single()

        if (prog) {
          for (let i = 0; i < validDays.length; i++) {
            const day = validDays[i]
            const { data: insDay } = await supabase.from('program_days').insert({
              program_id: prog.id,
              name: day.name || `Day ${i + 1}`,
              dows: day.dows,
              order_index: i
            }).select('id').single()

            if (insDay) {
              for (let j = 0; j < day.items.length; j++) {
                const item = day.items[j]
                await supabase.from('template_exercises').insert({
                  program_day_id: insDay.id,
                  exercise_id: item.exercise_id,
                  display_name: item.display_name,
                  default_sets: item.default_sets,
                  default_reps: item.default_reps,
                  set_type: 'working',
                  order_index: j
                })
              }
            }
          }
        }
      }

      alert('Program saved successfully!')
      await reloadPrograms()
      backToList()
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save program')
    }
  }

  // List Mode
  if (mode === 'list') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Workout Programs</h1>
            <div className="flex gap-3">
              <button className="toggle" onClick={startQuickMode}>
                ⚡ Quick Start
              </button>
              <button className="btn" onClick={startManualMode}>
                + Create Custom
              </button>
            </div>
          </div>

          {/* Quick Start Templates */}
          {programs.length === 0 && (
            <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
          )}

          {/* Existing Programs */}
          {programs.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="font-medium">Your Programs</div>
                <button className="toggle" onClick={startQuickMode}>
                  📋 Browse Templates
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs.map(p => (
                  <div 
                    key={p.id} 
                    className={`bg-black/30 rounded-2xl p-5 border transition-all duration-200 group ${
                      p.is_active 
                        ? 'border-brand-red/50 bg-brand-red/5' 
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-semibold text-white/90 mb-1">{p.name}</div>
                        {p.is_active && (
                          <span className="text-xs text-brand-red font-medium bg-brand-red/10 px-2 py-1 rounded-full">
                            Active Program
                          </span>
                        )}
                      </div>
                      <div className="text-2xl group-hover:scale-110 transition-transform duration-200">💪</div>
                    </div>

                    <div className="text-sm text-white/70 mb-4 space-y-1">
                      <div>{p.total_days} training day{p.total_days !== 1 ? 's' : ''}</div>
                      <div>{p.total_exercises} exercises total</div>
                      <div className="text-xs text-white/60">
                        Created {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        className="toggle text-sm flex-1" 
                        onClick={() => loadProgram(p)}
                      >
                        Edit
                      </button>
                      {!p.is_active && (
                        <button 
                          className="btn text-sm px-3 py-2" 
                          onClick={() => setActive(p.id)}
                        >
                          Activate
                        </button>
                      )}
                      <button 
                        className="toggle text-sm px-3 py-2 text-red-400 hover:bg-red-500/20" 
                        onClick={() => deleteProgram(p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {programs.length === 0 && mode === 'list' && (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">💪</div>
              <div className="font-medium mb-2">Start Your Training Journey</div>
              <div className="text-white/70 mb-6 max-w-md mx-auto">
                Choose from proven templates or create your own custom program to reach your fitness goals
              </div>
              <div className="flex gap-3 justify-center">
                <button className="btn" onClick={startQuickMode}>
                  ⚡ Quick Start Templates
                </button>
                <button className="toggle" onClick={startManualMode}>
                  🎯 Create Custom Program
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // Quick Start Mode
  if (mode === 'quick') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <button className="toggle" onClick={backToList}>
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Quick Start Templates</h1>
          </div>

          <ProgramTemplates onSelectTemplate={handleTemplateSelect} />

          <div className="card text-center py-8">
            <div className="font-medium mb-2">Need Something Different?</div>
            <div className="text-white/70 mb-4">Create a fully custom program from scratch</div>
            <button className="btn" onClick={startManualMode}>
              🎯 Create Custom Program
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Manual/Edit Mode - Full program creation interface
  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button className="toggle" onClick={backToList}>
            ← Back to Programs
          </button>
          <h1 className="text-2xl font-bold">
            {selected ? 'Edit Program' : 'Create Program'}
          </h1>
        </div>

        {/* Program Name */}
        <div className="card">
          <div className="font-medium mb-4">📋 Program Details</div>
          <label className="block">
            <div className="mb-2 text-sm text-white/80 font-medium">Program Name</div>
            <input
              type="text"
              className="input w-full"
              value={pName}
              onChange={e => setPName(e.target.value)}
              placeholder="e.g., Upper/Lower 4-Day Split"
            />
          </label>
        </div>

        {/* Training Days */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="font-medium">🗓️ Training Days</div>
            <button className="btn" onClick={addDay}>
              + Add Day
            </button>
          </div>

          <div className="space-y-6">
            {days.map((day, dayIdx) => {
              const isExpanded = expandedDays.has(dayIdx)
              const dayName = day.name || `Day ${dayIdx + 1}`
              const dowsText = day.dows.length > 0 ? day.dows.map(d => DOWS[d]).join(', ') : 'No days assigned'
              
              return (
                <div key={dayIdx} className="bg-black/30 rounded-2xl overflow-hidden">
                  {/* Collapsible Header */}
                  <div 
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-black/40 transition-colors"
                    onClick={() => toggleDayExpanded(dayIdx)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                      <div>
                        <div className="font-semibold text-white/90">
                          {dayName}
                        </div>
                        <div className="text-sm text-white/60">
                          {dowsText} • {day.items.length} exercise{day.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {days.length > 1 && (
                        <button
                          className="toggle text-sm px-3 py-2 text-red-400 hover:bg-red-500/20"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeDay(dayIdx)
                          }}
                        >
                          Remove Day
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-white/10">
                      <div className="pt-4">
                        <label className="block">
                          <div className="mb-1 text-sm text-white/80 font-medium">Day Name</div>
                          <input
                            type="text"
                            className="input w-full max-w-xs"
                            value={day.name}
                            onChange={e => updateDayName(dayIdx, e.target.value)}
                            placeholder={`Day ${dayIdx + 1}`}
                          />
                        </label>
                      </div>

                      {/* Days of Week Selector */}
                      <div>
                        <div className="mb-2 text-sm text-white/80 font-medium">Training Days</div>
                        <div className="flex flex-wrap gap-2">
                          {DOWS.map((dowName, dowIdx) => (
                            <button
                              key={dowIdx}
                              type="button"
                              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                day.dows.includes(dowIdx)
                                  ? 'bg-brand-red/20 border-brand-red text-white border'
                                  : 'bg-black/40 border border-white/10 text-white/70 hover:bg-black/60'
                              }`}
                              onClick={() => toggleDayOfWeek(dayIdx, dowIdx)}
                            >
                              {dowName}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Exercise Selection */}
                      <div>
                        <div className="mb-3 text-sm text-white/80 font-medium">Add Exercises</div>
                        
                        {/* Search and Category Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <input
                              type="text"
                              className="input w-full"
                              placeholder="Search exercises..."
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                            />
                          </div>
                          <div>
                            <select
                              className="input w-full"
                              value={selectedCategory}
                              onChange={e => setSelectedCategory(e.target.value as typeof CATEGORIES[number])}
                            >
                              <option value="all">All Categories</option>
                              <option value="barbell">Barbell</option>
                              <option value="dumbbell">Dumbbell</option>
                              <option value="machine">Machine</option>
                              <option value="cable">Cable</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Exercise List and Current Exercises */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Available Exercises */}
                          <div>
                            <div className="text-xs text-white/60 mb-2 font-medium">Available Exercises</div>
                            <div className="max-h-48 overflow-y-auto bg-black/20 rounded-xl p-3 space-y-2">
                              {filteredExercises.slice(0, 50).map(exercise => (
                                <button
                                  key={exercise.id}
                                  className="w-full text-left bg-black/30 hover:bg-black/50 rounded-lg p-3 text-sm transition-all duration-200 group"
                                  onClick={() => addExerciseToDay(dayIdx, exercise)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-white/90">{exercise.name}</div>
                                      <div className="text-xs text-white/60 capitalize">{exercise.category}</div>
                                    </div>
                                    <span className="text-brand-red/70 group-hover:text-brand-red opacity-0 group-hover:opacity-100 transition-opacity">
                                      +
                                    </span>
                                  </div>
                                </button>
                              ))}
                              
                              {search.trim() && (
                                <button
                                  className="w-full bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/30 rounded-lg p-3 text-sm transition-all duration-200"
                                  onClick={() => addCustomExerciseToDay(dayIdx)}
                                >
                                  <div className="text-brand-red font-medium">
                                    + Create "{search.trim()}"
                                  </div>
                                  <div className="text-xs text-white/60 mt-1">
                                    Add as new {selectedCategory === 'all' ? 'other' : selectedCategory} exercise
                                  </div>
                                </button>
                              )}
                              
                              {filteredExercises.length === 0 && !search.trim() && (
                                <div className="text-white/60 text-center py-4 text-sm">
                                  No exercises found
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Current Day Exercises */}
                          <div>
                            <div className="text-xs text-white/60 mb-2 font-medium">Day {dayIdx + 1} Exercises ({day.items.length})</div>
                            <div className="space-y-3">
                              {day.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="bg-black/20 rounded-xl p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="font-medium text-white/90">{item.display_name}</div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        className="toggle text-xs p-1"
                                        onClick={() => moveExercise(dayIdx, itemIdx, 'up')}
                                        disabled={itemIdx === 0}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        className="toggle text-xs p-1"
                                        onClick={() => moveExercise(dayIdx, itemIdx, 'down')}
                                        disabled={itemIdx === day.items.length - 1}
                                      >
                                        ↓
                                      </button>
                                      <button
                                        className="toggle text-xs p-1 text-red-400 hover:bg-red-500/20"
                                        onClick={() => removeExerciseFromDay(dayIdx, itemIdx)}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block">
                                        <div className="text-xs text-white/70 mb-1">Sets</div>
                                        <input
                                          type="number"
                                          min={1}
                                          max={20}
                                          className="input w-full text-center"
                                          value={item.default_sets}
                                          onChange={e => updateExerciseSets(dayIdx, itemIdx, Number(e.target.value) || 1)}
                                        />
                                      </label>
                                    </div>
                                    <div>
                                      <label className="block">
                                        <div className="text-xs text-white/70 mb-1">Reps (optional)</div>
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          className="input w-full text-center"
                                          value={item.default_reps === 0 ? '' : item.default_reps}
                                          onChange={e => updateExerciseReps(dayIdx, itemIdx, Number(e.target.value) || 0)}
                                          placeholder="varies"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              
                              {day.items.length === 0 && (
                                <div className="text-white/60 text-center py-8 text-sm bg-black/20 rounded-xl">
                                  No exercises added yet
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex gap-3">
            <button className="btn flex-1" onClick={saveProgram}>
              {selected ? 'Update Program' : 'Create Program'}
            </button>
            <button className="toggle px-6" onClick={backToList}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}