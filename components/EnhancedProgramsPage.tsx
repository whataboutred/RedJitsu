'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import ProgramTemplates from '@/components/ProgramTemplates'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
}

type ProgramWithStats = Program & {
  total_days: number
  total_exercises: number
  last_used?: string
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

export default function EnhancedProgramsPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [programs, setPrograms] = useState<ProgramWithStats[]>([])
  const [selected, setSelected] = useState<Program | null>(null)
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'list' | 'create' | 'template'>('list')
  const [showTemplates, setShowTemplates] = useState(true)

  // Program creation state
  const [pName, setPName] = useState('')
  const [days, setDays] = useState<DayDraft[]>([{ name: '', dows: [], items: [] }])

  // Enhanced search with categories
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | Exercise['category']>('all')

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
      if (isDemo) return
    })()
  }, [])

  useEffect(() => {
    if (!demo) {
      loadData()
    }
  }, [demo])

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

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

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
        program_days!inner(
          id,
          template_exercises(id)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Get recent workout data for "last used" stats
    const { data: recentWorkouts } = await supabase
      .from('workouts')
      .select('program_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    const programsWithStats: ProgramWithStats[] = (progs || []).map(p => {
      const totalDays = p.program_days?.length || 0
      const totalExercises = p.program_days?.reduce((acc, day) => 
        acc + (day.template_exercises?.length || 0), 0) || 0
      
      const lastUsed = recentWorkouts?.find(w => w.program_id === p.id)?.created_at

      return {
        id: p.id,
        name: p.name,
        is_active: p.is_active,
        created_at: p.created_at,
        total_days: totalDays,
        total_exercises: totalExercises,
        last_used: lastUsed
      }
    })

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
    setMode('create')
    setShowTemplates(false)
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

  function startNewProgram() {
    setSelected(null)
    setPName('')
    setDays([{ name: '', dows: [], items: [] }])
    setMode('create')
  }

  function backToList() {
    setMode('list')
    setShowTemplates(true)
    setSelected(null)
  }

  async function saveProgram() {
    const userId = await getActiveUserId()
    if (!userId) return

    if (days.length === 0) setDays([{ name: '', dows: [], items: [] }])

    if (selected) {
      // Update existing program
      await supabase.from('programs').update({ name: pName }).eq('id', selected.id)

      const { data: pd } = await supabase.from('program_days').select('id').eq('program_id', selected.id)
      const oldDayIds = (pd || []).map(r => r.id)
      if (oldDayIds.length) { 
        await supabase.from('template_exercises').delete().in('program_day_id', oldDayIds)
      }
      await supabase.from('program_days').delete().eq('program_id', selected.id)

      for (let i = 0; i < days.length; i++) {
        const d = days[i]
        const { data: insDay } = await supabase.from('program_days').insert({
          program_id: selected.id, 
          name: d.name || 'Day', 
          dows: d.dows, 
          order_index: i
        }).select('id').single()
        
        if (!insDay) continue
        
        for (let j = 0; j < d.items.length; j++) {
          const it = d.items[j]
          await supabase.from('template_exercises').insert({
            program_day_id: insDay.id,
            exercise_id: it.exercise_id,
            display_name: it.display_name,
            default_sets: Math.max(1, it.default_sets || 1),
            default_reps: Math.max(0, it.default_reps || 0),
            set_type: 'working',
            order_index: j
          })
        }
      }
    } else {
      // Create new program
      const { data: prog } = await supabase.from('programs').insert({
        user_id: userId, 
        name: pName || 'Program', 
        is_active: programs.length === 0
      }).select('id').single()
      
      if (!prog) return

      for (let i = 0; i < days.length; i++) {
        const d = days[i]
        const { data: insDay } = await supabase.from('program_days').insert({
          program_id: prog.id, 
          name: d.name || 'Day', 
          dows: d.dows, 
          order_index: i
        }).select('id').single()
        
        if (!insDay) continue
        
        for (let j = 0; j < d.items.length; j++) {
          const it = d.items[j]
          await supabase.from('template_exercises').insert({
            program_day_id: insDay.id,
            exercise_id: it.exercise_id,
            display_name: it.display_name,
            default_sets: Math.max(1, it.default_sets || 1),
            default_reps: Math.max(0, it.default_reps || 0),
            set_type: 'working',
            order_index: j
          })
        }
      }
      
      await reloadPrograms()
    }

    alert('Program saved successfully!')
    backToList()
  }

  if (mode === 'list') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Workout Programs</h1>
            <button className="btn" onClick={startNewProgram}>
              + Create Program
            </button>
          </div>

          {/* Quick Start Templates */}
          {showTemplates && programs.length === 0 && (
            <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
          )}

          {/* Existing Programs */}
          {programs.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="font-medium">Your Programs</div>
                {!showTemplates && (
                  <button 
                    className="toggle text-sm" 
                    onClick={() => setShowTemplates(true)}
                  >
                    📋 Browse Templates
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs.map(p => (
                  <div 
                    key={p.id} 
                    className={`bg-black/30 rounded-2xl p-4 border transition-all duration-200 ${
                      p.is_active 
                        ? 'border-brand-red/50 bg-brand-red/5' 
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-white/90">{p.name}</div>
                        {p.is_active && (
                          <span className="text-xs text-brand-red font-medium">Active Program</span>
                        )}
                      </div>
                      <div className="text-2xl">💪</div>
                    </div>

                    <div className="text-sm text-white/70 mb-4 space-y-1">
                      <div>{p.total_days} training day{p.total_days !== 1 ? 's' : ''}</div>
                      <div>{p.total_exercises} exercises total</div>
                      {p.last_used && (
                        <div>Last used: {new Date(p.last_used).toLocaleDateString()}</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        className="toggle text-sm flex-1" 
                        onClick={() => console.log('Edit program', p.id)}
                      >
                        Edit
                      </button>
                      {!p.is_active && (
                        <button 
                          className="toggle text-sm" 
                          onClick={() => console.log('Set active', p.id)}
                        >
                          Set Active
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates Section (when requested) */}
          {showTemplates && programs.length > 0 && (
            <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
          )}

          {/* Empty State */}
          {programs.length === 0 && !showTemplates && (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">💪</div>
              <div className="font-medium mb-2">No programs yet</div>
              <div className="text-white/70 mb-6">
                Create your first workout program to get started with structured training
              </div>
              <div className="flex gap-3 justify-center">
                <button className="btn" onClick={startNewProgram}>
                  Create Custom Program
                </button>
                <button className="toggle" onClick={() => setShowTemplates(true)}>
                  Browse Templates
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  // Create/Edit mode would be implemented here with enhanced UI
  return (
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-6xl mx-auto p-4">
        <div className="flex items-center gap-4 mb-6">
          <button className="toggle" onClick={backToList}>
            ← Back to Programs
          </button>
          <h1 className="text-2xl font-bold">
            {selected ? 'Edit Program' : 'Create Program'}
          </h1>
        </div>
        
        <div className="card">
          <div className="font-medium mb-4">Program Creation Interface</div>
          <div className="text-white/70">
            Enhanced program creation UI would be implemented here with:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Improved exercise selection with categories</li>
              <li>Drag-and-drop reordering</li>
              <li>Visual day-of-week picker</li>
              <li>Smart exercise suggestions</li>
              <li>Real-time program validation</li>
            </ul>
          </div>
          
          <div className="mt-6 flex gap-3">
            <button className="btn" onClick={saveProgram}>
              Save Program
            </button>
            <button className="toggle" onClick={backToList}>
              Cancel
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}