'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import ProgramTemplates from '@/components/ProgramTemplates'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatedCard } from '@/components/ui/Card'
import {
  Dumbbell,
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Zap,
  Target,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Sparkles,
  LayoutGrid,
} from 'lucide-react'

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
  const router = useRouter()
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
        <main className="relative z-10 p-4 max-w-xl mx-auto pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AnimatedCard className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-brand-red/20 flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-brand-red" />
              </div>
              <h1 className="text-xl font-semibold mb-2">Demo Mode</h1>
              <p className="text-zinc-400 mb-6">
                You're viewing the app in read-only demo mode. To create your own
                programs, please sign in.
              </p>
              <Link
                href="/login"
                className="btn inline-flex"
              >
                Sign In to Continue
              </Link>
            </AnimatedCard>
          </motion.div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <Nav />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-zinc-800 rounded-lg w-48 animate-pulse"></div>
            <div className="flex gap-3">
              <div className="h-10 bg-zinc-800 rounded-full w-32 animate-pulse"></div>
              <div className="h-10 bg-zinc-800 rounded-xl w-36 animate-pulse"></div>
            </div>
          </div>
          <div className="bg-zinc-900/80 rounded-2xl p-6 border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-black/30 rounded-2xl p-5 border border-white/10">
                  <div className="flex justify-between mb-4">
                    <div className="space-y-2">
                      <div className="h-5 bg-zinc-800 rounded w-32 animate-pulse"></div>
                      <div className="h-4 bg-zinc-800/50 rounded w-20 animate-pulse"></div>
                    </div>
                    <div className="h-10 w-10 bg-zinc-800 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-zinc-800/50 rounded w-24 animate-pulse"></div>
                    <div className="h-4 bg-zinc-800/50 rounded w-28 animate-pulse"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 bg-zinc-800 rounded-full flex-1 animate-pulse"></div>
                    <div className="h-9 bg-zinc-800 rounded-xl w-20 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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

    // If deleting the active program, deactivate it first to avoid broken dashboard state
    const programToDelete = programs.find(p => p.id === id)
    if (programToDelete?.is_active) {
      await supabase.from('programs').update({ is_active: false }).eq('id', id)
    }

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

        // Create new days first, then delete old ones (prevents data loss on failure)
        const newDayIds: string[] = []
        for (let i = 0; i < validDays.length; i++) {
          const day = validDays[i]
          const { data: insDay, error: dayError } = await supabase.from('program_days').insert({
            program_id: selected.id,
            name: day.name || `Day ${i + 1}`,
            dows: day.dows,
            order_index: i
          }).select('id').single()

          if (dayError || !insDay) {
            // Cleanup any newly created days on failure
            if (newDayIds.length) {
              await supabase.from('template_exercises').delete().in('program_day_id', newDayIds)
              await supabase.from('program_days').delete().in('id', newDayIds)
            }
            throw new Error('Failed to save program days')
          }

          newDayIds.push(insDay.id)
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

        // New data created successfully — now delete old days/exercises
        const { data: pd } = await supabase.from('program_days').select('id').eq('program_id', selected.id)
        const oldDayIds = (pd || []).map(r => r.id).filter(id => !newDayIds.includes(id))
        if (oldDayIds.length) {
          await supabase.from('template_exercises').delete().in('program_day_id', oldDayIds)
          await supabase.from('program_days').delete().in('id', oldDayIds)
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
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/20 to-orange-500/20 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Workout Programs</h1>
                <p className="text-sm text-zinc-500">Build and manage your training plans</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="toggle" onClick={startQuickMode}>
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Quick Start</span>
              </button>
              <button className="btn" onClick={startManualMode}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Custom</span>
              </button>
            </div>
          </motion.div>

          {/* Quick Start Templates */}
          {programs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
            </motion.div>
          )}

          {/* Existing Programs */}
          {programs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <AnimatedCard>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-zinc-400" />
                    <span className="font-semibold text-white">Your Programs</span>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                      {programs.length}
                    </span>
                  </div>
                  <button className="toggle text-sm" onClick={startQuickMode}>
                    <Sparkles className="w-4 h-4" />
                    Browse Templates
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {programs.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx }}
                      className={`relative bg-gradient-to-br rounded-2xl p-5 border transition-all duration-300 group hover:shadow-lg ${
                        p.is_active
                          ? 'from-brand-red/10 to-orange-500/5 border-brand-red/30 hover:border-brand-red/50'
                          : 'from-zinc-800/50 to-zinc-900/50 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {p.is_active && (
                        <div className="absolute -top-2 -right-2">
                          <span className="flex h-5 w-5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red/40"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-brand-red items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </span>
                          </span>
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate mb-1">{p.name}</div>
                          {p.is_active && (
                            <span className="inline-flex items-center gap-1 text-xs text-brand-red font-medium bg-brand-red/10 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 bg-brand-red rounded-full"></span>
                              Active
                            </span>
                          )}
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                          p.is_active
                            ? 'bg-brand-red/20 group-hover:bg-brand-red/30'
                            : 'bg-zinc-800 group-hover:bg-zinc-700'
                        }`}>
                          <Dumbbell className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                            p.is_active ? 'text-brand-red' : 'text-zinc-400'
                          }`} />
                        </div>
                      </div>

                      <div className="text-sm text-zinc-400 mb-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          <span>{p.total_days} training day{p.total_days !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-zinc-500" />
                          <span>{p.total_exercises} exercises total</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          Created {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          className="toggle text-sm flex-1 justify-center"
                          onClick={() => loadProgram(p)}
                        >
                          <Edit3 className="w-4 h-4" />
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
                          className="toggle text-sm px-3 py-2 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
                          onClick={() => deleteProgram(p.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatedCard>
            </motion.div>
          )}

          {/* Empty State */}
          {programs.length === 0 && mode === 'list' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <AnimatedCard className="text-center py-12">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-red/20 to-orange-500/20 flex items-center justify-center mx-auto mb-6">
                  <Dumbbell className="w-10 h-10 text-brand-red" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Start Your Training Journey</h2>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                  Choose from proven templates or create your own custom program to reach your fitness goals
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <button className="btn" onClick={startQuickMode}>
                    <Zap className="w-4 h-4" />
                    Quick Start Templates
                  </button>
                  <button className="toggle" onClick={startManualMode}>
                    <Target className="w-4 h-4" />
                    Create Custom Program
                  </button>
                </div>
              </AnimatedCard>
            </motion.div>
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
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <button className="toggle" onClick={backToList}>
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Quick Start Templates</h1>
                <p className="text-sm text-zinc-500">Choose a proven program to get started</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ProgramTemplates onSelectTemplate={handleTemplateSelect} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <AnimatedCard className="text-center py-10 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-red/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-brand-red" />
              </div>
              <h3 className="font-semibold text-white mb-2">Need Something Different?</h3>
              <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
                Create a fully custom program tailored to your specific goals
              </p>
              <button className="btn" onClick={startManualMode}>
                <Plus className="w-4 h-4" />
                Create Custom Program
              </button>
            </AnimatedCard>
          </motion.div>
        </main>
      </div>
    )
  }

  // Manual/Edit Mode - Full program creation interface
  return (
    <div className="relative min-h-screen bg-black pb-24">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button className="toggle" onClick={backToList}>
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selected
                ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20'
                : 'bg-gradient-to-br from-brand-red/20 to-orange-500/20'
            }`}>
              {selected ? (
                <Edit3 className="w-5 h-5 text-amber-400" />
              ) : (
                <Plus className="w-5 h-5 text-brand-red" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {selected ? 'Edit Program' : 'Create Program'}
              </h1>
              <p className="text-sm text-zinc-500">
                {selected ? 'Modify your existing program' : 'Build your custom training plan'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Program Name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AnimatedCard>
            <div className="flex items-center gap-2 mb-4">
              <Dumbbell className="w-5 h-5 text-zinc-400" />
              <span className="font-semibold text-white">Program Details</span>
            </div>
            <label className="block">
              <div className="mb-2 text-sm text-zinc-400 font-medium">Program Name</div>
              <input
                type="text"
                className="input w-full max-w-md"
                value={pName}
                onChange={e => setPName(e.target.value)}
                placeholder="e.g., Upper/Lower 4-Day Split"
              />
            </label>
          </AnimatedCard>
        </motion.div>

        {/* Training Days */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatedCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-zinc-400" />
                <span className="font-semibold text-white">Training Days</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                  {days.length}
                </span>
              </div>
              <button className="btn text-sm" onClick={addDay}>
                <Plus className="w-4 h-4" />
                Add Day
              </button>
            </div>

            <div className="space-y-4">
              {days.map((day, dayIdx) => {
                const isExpanded = expandedDays.has(dayIdx)
                const dayName = day.name || `Day ${dayIdx + 1}`
                const dowsText = day.dows.length > 0 ? day.dows.map(d => DOWS[d]).join(', ') : 'No days assigned'

                return (
                  <motion.div
                    key={dayIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * dayIdx }}
                    className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
                      isExpanded
                        ? 'bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border-white/10'
                        : 'bg-black/30 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Collapsible Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleDayExpanded(dayIdx)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                          isExpanded ? 'bg-brand-red/20' : 'bg-zinc-800'
                        }`}>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
                            isExpanded ? 'rotate-0 text-brand-red' : '-rotate-90 text-zinc-400'
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {dayName}
                            {day.items.length > 0 && (
                              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                                {day.items.length} exercise{day.items.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-zinc-500">
                            {dowsText}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {days.length > 1 && (
                          <button
                            className="toggle text-sm px-3 py-2 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeDay(dayIdx)
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-4 space-y-5 border-t border-white/10"
                      >
                        <div className="pt-4">
                          <label className="block">
                            <div className="mb-2 text-sm text-zinc-400 font-medium">Day Name</div>
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
                          <div className="mb-2 text-sm text-zinc-400 font-medium flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Schedule
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {DOWS.map((dowName, dowIdx) => (
                              <button
                                key={dowIdx}
                                type="button"
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                  day.dows.includes(dowIdx)
                                    ? 'bg-brand-red/20 border-brand-red/50 text-white border shadow-sm shadow-brand-red/10'
                                    : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
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
                          <div className="mb-3 text-sm text-zinc-400 font-medium flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Exercises
                          </div>

                          {/* Search and Category Filter */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                              <input
                                type="text"
                                className="input w-full pl-10"
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
                              <div className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
                                Available Exercises
                              </div>
                              <div className="max-h-52 overflow-y-auto bg-zinc-900/50 rounded-xl p-2 space-y-1">
                                {filteredExercises.slice(0, 50).map(exercise => (
                                  <button
                                    key={exercise.id}
                                    className="w-full text-left bg-zinc-800/50 hover:bg-zinc-800 rounded-lg p-3 text-sm transition-all duration-200 group border border-transparent hover:border-zinc-700"
                                    onClick={() => addExerciseToDay(dayIdx, exercise)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-medium text-white">{exercise.name}</div>
                                        <div className="text-xs text-zinc-500 capitalize">{exercise.category}</div>
                                      </div>
                                      <div className="w-6 h-6 rounded-full bg-brand-red/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-3 h-3 text-brand-red" />
                                      </div>
                                    </div>
                                  </button>
                                ))}

                                {search.trim() && (
                                  <button
                                    className="w-full bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/30 rounded-lg p-3 text-sm transition-all duration-200"
                                    onClick={() => addCustomExerciseToDay(dayIdx)}
                                  >
                                    <div className="flex items-center gap-2 text-brand-red font-medium">
                                      <Plus className="w-4 h-4" />
                                      Create "{search.trim()}"
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-1 ml-6">
                                      Add as new {selectedCategory === 'all' ? 'other' : selectedCategory} exercise
                                    </div>
                                  </button>
                                )}

                                {filteredExercises.length === 0 && !search.trim() && (
                                  <div className="text-zinc-500 text-center py-6 text-sm">
                                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No exercises found
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Current Day Exercises */}
                            <div>
                              <div className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
                                Day {dayIdx + 1} Exercises ({day.items.length})
                              </div>
                              <div className="space-y-2">
                                {day.items.map((item, itemIdx) => (
                                  <div
                                    key={itemIdx}
                                    className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800 hover:border-zinc-700 transition-all duration-200"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center text-xs font-medium text-brand-red">
                                          {itemIdx + 1}
                                        </div>
                                        <div className="font-medium text-white">{item.display_name}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors disabled:opacity-30"
                                          onClick={() => moveExercise(dayIdx, itemIdx, 'up')}
                                          disabled={itemIdx === 0}
                                        >
                                          <ArrowUp className="w-3 h-3 text-zinc-400" />
                                        </button>
                                        <button
                                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors disabled:opacity-30"
                                          onClick={() => moveExercise(dayIdx, itemIdx, 'down')}
                                          disabled={itemIdx === day.items.length - 1}
                                        >
                                          <ArrowDown className="w-3 h-3 text-zinc-400" />
                                        </button>
                                        <button
                                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                                          onClick={() => removeExerciseFromDay(dayIdx, itemIdx)}
                                        >
                                          <X className="w-3 h-3 text-red-400" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block">
                                          <div className="text-xs text-zinc-500 mb-1">Sets</div>
                                          <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            className="input w-full text-center text-sm"
                                            value={item.default_sets}
                                            onChange={e => updateExerciseSets(dayIdx, itemIdx, Number(e.target.value) || 1)}
                                          />
                                        </label>
                                      </div>
                                      <div>
                                        <label className="block">
                                          <div className="text-xs text-zinc-500 mb-1">Reps</div>
                                          <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            className="input w-full text-center text-sm"
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
                                  <div className="text-zinc-500 text-center py-8 text-sm bg-zinc-900/50 rounded-xl border border-dashed border-zinc-700">
                                    <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No exercises added yet
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </AnimatedCard>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-4 left-4 right-4 max-w-6xl mx-auto z-30"
        >
          <div className="bg-zinc-900/95 backdrop-blur-lg rounded-2xl p-4 border border-white/10 shadow-2xl shadow-black/50">
            <div className="flex gap-3">
              <button className="btn flex-1" onClick={saveProgram}>
                <Check className="w-4 h-4" />
                {selected ? 'Update Program' : 'Create Program'}
              </button>
              <button className="toggle px-6" onClick={backToList}>
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}