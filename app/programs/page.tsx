'use client'

import BackgroundLogo from '@/components/BackgroundLogo'
import ProgramTemplates from '@/components/ProgramTemplates'
import { useEffect, useMemo, useState } from 'react'
import { motion, Reorder, useDragControls } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { AnimatedCard } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/BottomSheet'
import { notifyDataChanged } from '@/lib/dataSync'
import { searchByName } from '@/lib/exerciseSearch'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import {
  Dumbbell,
  Calendar,
  ChevronDown,
  Plus,
  Zap,
  Target,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
  GripVertical,
  ArrowLeft,
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
  created_at: string | null
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

// Render-prop drag wrapper: provides per-item drag controls (handle-based, so
// it never fights page scroll) while the card JSX stays in the parent closure.
function DraggableItem<T>({
  value,
  className,
  children,
}: {
  value: T
  className?: string
  children: (controls: ReturnType<typeof useDragControls>) => React.ReactNode
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      layout
      whileDrag={{ scale: 1.02, zIndex: 50, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}
      className={className}
    >
      {children(controls)}
    </Reorder.Item>
  )
}

export default function ProgramsPage() {
  const router = useRouter()
  const toast = useToast()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [selected, setSelected] = useState<Program | null>(null)
  const [demo, setDemo] = useState(false)
  const [mode, setMode] = useState<'list' | 'quick' | 'manual'>('list')
  const [loading, setLoading] = useState(true)

  // Program creation state
  const [pName, setPName] = useState('')
  const [days, setDays] = useState<DayDraft[]>([{ id: crypto.randomUUID(), name: '', dows: [], items: [] }])

  // Enhanced search and filtering
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>('all')
  
  // Collapsible days state
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const [programToDelete, setProgramToDelete] = useState<string | null>(null)

  const filteredExercises = useMemo(() => {
    const byCategory = exercises.filter(
      e => selectedCategory === 'all' || e.category === selectedCategory
    )
    return searchByName(byCategory, search)
  }, [exercises, search, selectedCategory])

  useEffect(() => {
    ;(async () => {
      const isDemo = await isDemoVisitor()
      setDemo(isDemo)
      await loadData()
      setLoading(false)
    })()
  }, [])

  // Refetch when data changes anywhere or the tab regains focus
  useDataRefresh(() => {
    if (!demo && !loading) reloadPrograms()
  })

  if (loading) {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-surface-elevated rounded-lg w-48 animate-pulse"></div>
            <div className="flex gap-3">
              <div className="h-10 bg-surface-elevated rounded-full w-32 animate-pulse"></div>
              <div className="h-10 bg-surface-elevated rounded-xl w-36 animate-pulse"></div>
            </div>
          </div>
          <div className="bg-surface/80 rounded-2xl p-6 border border-white/[0.07]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-elevated rounded-2xl p-5 border border-white/10">
                  <div className="flex justify-between mb-4">
                    <div className="space-y-2">
                      <div className="h-5 bg-surface-elevated rounded w-32 animate-pulse"></div>
                      <div className="h-4 bg-surface-elevated/50 rounded w-20 animate-pulse"></div>
                    </div>
                    <div className="h-10 w-10 bg-surface-elevated rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-surface-elevated/50 rounded w-24 animate-pulse"></div>
                    <div className="h-4 bg-surface-elevated/50 rounded w-28 animate-pulse"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 bg-surface-elevated rounded-full flex-1 animate-pulse"></div>
                    <div className="h-9 bg-surface-elevated rounded-xl w-20 animate-pulse"></div>
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
    // getActiveUserId resolves the demo user id for demo visitors, so the
    // seeded program loads read-only instead of redirecting to login.
    const userId = await getActiveUserId()
    if (!userId) { router.push('/login'); return }

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
            id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
              exercise_id: newExercise.id,
              display_name: exercise.name,
              default_sets: exercise.sets,
              default_reps: typeof exercise.reps === 'string' ? 0 : exercise.reps
            })
          }
        }
      }
      
      templateDays.push({
        id: crypto.randomUUID(),
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
    setDays([{ id: crypto.randomUUID(), name: '', dows: [], items: [] }])
    setMode('quick')
  }

  function startManualMode() {
    setSelected(null)
    setPName('')
    setDays([{ id: crypto.randomUUID(), name: '', dows: [], items: [] }])
    setMode('manual')
  }

  function backToList() {
    setMode('list')
    setSelected(null)
  }

  async function setActive(id: string) {
    if (demo) { toast.warning('Sign in to use your own programs'); return }
    const userId = await getActiveUserId()
    if (!userId) return
    
    await supabase.from('programs').update({ is_active: false }).eq('user_id', userId)
    await supabase.from('programs').update({ is_active: true }).eq('id', id)
    await reloadPrograms()
  }

  async function deleteProgram(id: string) {
    if (demo) { toast.warning('Sign in to manage your own programs'); return }
    // If deleting the active program, deactivate it first to avoid broken dashboard state
    const programToDelete = programs.find(p => p.id === id)
    if (programToDelete?.is_active) {
      await supabase.from('programs').update({ is_active: false }).eq('id', id)
    }

    const { error } = await supabase.from('programs').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete program')
      return
    }
    notifyDataChanged()
    toast.success('Program deleted')
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
    
    setDays(out.length ? out : [{ id: crypto.randomUUID(), name: '', dows: [], items: [] }])
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
    setDays(prev => [...prev, { id: crypto.randomUUID(), name: '', dows: [], items: [] }])
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
              id: crypto.randomUUID(),
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

  // Drag-reorder the training days. Remaps the (index-based) expanded set by
  // object identity so the right days stay open after the move.
  function reorderDays(newOrder: DayDraft[]) {
    setExpandedDays(prev => {
      const next = new Set<number>()
      newOrder.forEach((day, newIdx) => {
        const oldIdx = days.indexOf(day)
        if (oldIdx !== -1 && prev.has(oldIdx)) next.add(newIdx)
      })
      return next
    })
    setDays(newOrder)
  }

  // Drag-reorder the exercises within a single day.
  function reorderDayItems(dayIndex: number, newItems: DayDraft['items']) {
    setDays(prev => prev.map((day, idx) =>
      idx === dayIndex ? { ...day, items: newItems } : day
    ))
  }

  async function addCustomExerciseToDay(dayIndex: number) {
    const exerciseName = search.trim()
    if (!exerciseName) {
      toast.warning('Enter an exercise name first')
      return
    }

    const newExercise = await createCustomExercise(exerciseName, selectedCategory === 'all' ? 'other' : selectedCategory)
    if (newExercise) {
      addExerciseToDay(dayIndex, newExercise)
    } else {
      toast.error('Failed to create exercise')
    }
  }

  async function saveProgram() {
    if (demo) { toast.warning('Sign in to save your own programs'); return }
    const userId = await getActiveUserId()
    if (!userId) return

    if (!pName.trim()) {
      toast.warning('Please enter a program name')
      return
    }

    if (days.length === 0) {
      toast.warning('Please add at least one training day')
      return
    }

    const validDays = days.filter(day => day.items.length > 0)
    if (validDays.length === 0) {
      toast.warning('Please add exercises to at least one training day')
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
            const { error: texError } = await supabase.from('template_exercises').insert({
              program_day_id: insDay.id,
              exercise_id: item.exercise_id,
              display_name: item.display_name,
              default_sets: item.default_sets,
              default_reps: item.default_reps,
              set_type: 'working',
              order_index: j
            })
            if (texError) {
              // Roll back everything we just created and abort BEFORE deleting old data
              await supabase.from('template_exercises').delete().in('program_day_id', newDayIds)
              await supabase.from('program_days').delete().in('id', newDayIds)
              throw new Error('Failed to save program exercises')
            }
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
        const { data: prog, error: progError } = await supabase.from('programs').insert({
          user_id: userId,
          name: pName,
          is_active: programs.length === 0
        }).select('id').single()

        if (progError || !prog) throw new Error('Failed to create program')

        const createdDayIds: string[] = []
        for (let i = 0; i < validDays.length; i++) {
          const day = validDays[i]
          const { data: insDay, error: dayError } = await supabase.from('program_days').insert({
            program_id: prog.id,
            name: day.name || `Day ${i + 1}`,
            dows: day.dows,
            order_index: i
          }).select('id').single()

          if (dayError || !insDay) {
            await supabase.from('template_exercises').delete().in('program_day_id', createdDayIds)
            await supabase.from('program_days').delete().in('id', createdDayIds)
            await supabase.from('programs').delete().eq('id', prog.id)
            throw new Error('Failed to save program days')
          }
          createdDayIds.push(insDay.id)

          for (let j = 0; j < day.items.length; j++) {
            const item = day.items[j]
            const { error: texError } = await supabase.from('template_exercises').insert({
              program_day_id: insDay.id,
              exercise_id: item.exercise_id,
              display_name: item.display_name,
              default_sets: item.default_sets,
              default_reps: item.default_reps,
              set_type: 'working',
              order_index: j
            })
            if (texError) {
              await supabase.from('template_exercises').delete().in('program_day_id', createdDayIds)
              await supabase.from('program_days').delete().in('id', createdDayIds)
              await supabase.from('programs').delete().eq('id', prog.id)
              throw new Error('Failed to save program exercises')
            }
          }
        }
      }

      notifyDataChanged()
      toast.success('Program saved successfully!')
      await reloadPrograms()
      backToList()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save program')
    }
  }

  // List Mode
  if (mode === 'list') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <h1 className="text-4xl font-display uppercase text-white">Workout Programs</h1>
              <p className="text-sm text-zinc-500 mt-1">Build and manage your training plans</p>
            </div>
            <button className="btn shrink-0" onClick={startManualMode}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create</span>
            </button>
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-zinc-500" />
                    <span className="text-lg font-display uppercase text-white whitespace-nowrap">Your Programs</span>
                    <span className="text-xs bg-surface-elevated text-zinc-500 px-2 py-0.5 rounded-full">
                      {programs.length}
                    </span>
                  </div>
                  <button className="toggle text-sm whitespace-nowrap" onClick={startQuickMode}>
                    <Sparkles className="w-4 h-4" />
                    Templates
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {programs.map((p, idx) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx }}
                      className={`relative rounded-2xl p-5 border transition-all duration-300 group hover:shadow-lg ${
                        p.is_active
                          ? 'bg-brand-red/[0.07] border-brand-red/30 hover:border-brand-red/50'
                          : 'bg-surface border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-display uppercase text-white truncate mb-1">{p.name}</div>
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
                            : 'bg-surface-elevated group-hover:bg-surface-pressed'
                        }`}>
                          <Dumbbell className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                            p.is_active ? 'text-brand-red' : 'text-zinc-500'
                          }`} />
                        </div>
                      </div>

                      <div className="text-sm text-zinc-500 mb-4 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          <span>{p.total_days} training day{p.total_days !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-zinc-500" />
                          <span>{p.total_exercises} exercises total</span>
                        </div>
                        {p.created_at && (
                          <div className="text-xs text-zinc-500">
                            Created {new Date(p.created_at).toLocaleDateString()}
                          </div>
                        )}
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
                          className="w-9 h-9 rounded-xl bg-surface-elevated/60 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors shrink-0"
                          onClick={() => setProgramToDelete(p.id)}
                          aria-label="Delete program"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
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
                <div className="w-20 h-20 rounded-2xl bg-brand-red/15 flex items-center justify-center mx-auto mb-6">
                  <Dumbbell className="w-10 h-10 text-brand-red" />
                </div>
                <h2 className="text-2xl font-display uppercase text-white mb-2">Start Your Training Journey</h2>
                <p className="text-zinc-500 mb-8 max-w-md mx-auto">
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

          <ConfirmDialog
            isOpen={programToDelete !== null}
            onClose={() => setProgramToDelete(null)}
            onConfirm={() => {
              if (programToDelete) deleteProgram(programToDelete)
            }}
            title="Delete program?"
            message="This program and all its days and templates will be permanently deleted. This cannot be undone."
            confirmText="Delete"
            variant="danger"
          />
        </main>
      </div>
    )
  }

  // Quick Start Mode
  if (mode === 'quick') {
    return (
      <div className="relative min-h-screen bg-black">
        <BackgroundLogo />
        <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <button
              onClick={backToList}
              className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/20 to-red-700/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <h1 className="text-4xl font-display uppercase text-white">Quick Start Templates</h1>
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-red/20 to-red-700/20 flex items-center justify-center mx-auto mb-4">
                <Target className="w-7 h-7 text-brand-red" />
              </div>
              <h3 className="font-display uppercase text-lg text-white mb-2">Need Something Different?</h3>
              <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
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
    <div className="relative min-h-screen bg-black pb-40">
      <BackgroundLogo />
      <main className="relative z-10 max-w-6xl mx-auto p-4 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={backToList}
            className="p-2.5 -ml-2 rounded-xl text-zinc-300 hover:bg-white/5 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selected
                ? 'bg-gradient-to-br from-brand-red/20 to-red-700/20'
                : 'bg-gradient-to-br from-brand-red/20 to-red-700/20'
            }`}>
              {selected ? (
                <Edit3 className="w-5 h-5 text-brand-red" />
              ) : (
                <Plus className="w-5 h-5 text-brand-red" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-display uppercase text-white">
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
              <Dumbbell className="w-5 h-5 text-brand-red" />
              <span className="font-display uppercase text-lg text-white">Program Details</span>
            </div>
            <label className="block">
              <div className="mb-2 text-sm text-zinc-500 font-medium">Program Name</div>
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
                <Calendar className="w-5 h-5 text-brand-red" />
                <span className="font-display uppercase text-lg text-white">Training Days</span>
                <span className="text-xs bg-surface-elevated text-zinc-500 px-2 py-0.5 rounded-full">
                  {days.length}
                </span>
              </div>
              <button className="btn text-sm" onClick={addDay}>
                <Plus className="w-4 h-4" />
                Add Day
              </button>
            </div>

            <Reorder.Group axis="y" values={days} onReorder={reorderDays} className="space-y-2">
              {days.map((day, dayIdx) => {
                const isExpanded = expandedDays.has(dayIdx)
                const dayName = day.name || `Day ${dayIdx + 1}`
                const dowsText = day.dows.length > 0 ? day.dows.map(d => DOWS[d]).join(', ') : 'No days assigned'

                return (
                  <DraggableItem
                    key={day.id}
                    value={day}
                    className={`rounded-2xl overflow-hidden border transition-colors ${
                      isExpanded
                        ? 'bg-surface-elevated/20 border-white/10'
                        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    {(controls) => (
                    <>
                    {/* Collapsible Header */}
                    <div
                      className="flex items-center justify-between p-3 pl-2 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => toggleDayExpanded(dayIdx)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          onPointerDown={(e) => controls.start(e)}
                          onClick={(e) => e.stopPropagation()}
                          className="touch-none cursor-grab active:cursor-grabbing p-1 text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                          aria-label="Drag to reorder day"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 shrink-0 ${
                          isExpanded ? 'bg-brand-red/20' : 'bg-surface-elevated'
                        }`}>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
                            isExpanded ? 'rotate-0 text-brand-red' : '-rotate-90 text-zinc-500'
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {dayName}
                            {day.items.length > 0 && (
                              <span className="text-xs bg-surface-elevated text-zinc-500 px-2 py-0.5 rounded-full">
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
                            className="w-9 h-9 rounded-xl bg-surface-elevated/60 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeDay(dayIdx)
                            }}
                            aria-label="Delete day"
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
                            <div className="mb-2 text-sm text-zinc-500 font-medium">Day Name</div>
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
                          <div className="mb-2 text-sm text-zinc-500 font-medium flex items-center gap-2">
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
                                    : 'bg-surface border border-white/10 text-zinc-500 hover:bg-surface-elevated hover:text-zinc-300'
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
                          <div className="mb-3 text-sm text-zinc-500 font-medium flex items-center gap-2">
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
                              <div className="max-h-52 overflow-y-auto bg-surface/50 rounded-xl p-2 space-y-1">
                                {filteredExercises.slice(0, 50).map(exercise => (
                                  <button
                                    key={exercise.id}
                                    className="w-full text-left bg-surface-elevated/50 hover:bg-surface-elevated rounded-lg p-3 text-sm transition-all duration-200 group border border-transparent hover:border-white/10"
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
                                      Create &quot;{search.trim()}&quot;
                                    </div>
                                    <div className="text-xs text-zinc-500 mt-1 ml-6">
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
                              <Reorder.Group axis="y" values={day.items} onReorder={(n) => reorderDayItems(dayIdx, n)} className="space-y-2">
                                {day.items.map((item, itemIdx) => (
                                  <DraggableItem
                                    key={item.id}
                                    value={item}
                                    className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06] hover:border-white/10 transition-colors"
                                  >
                                    {(controls) => (
                                    <>
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div
                                          onPointerDown={(e) => controls.start(e)}
                                          className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                                          aria-label="Drag to reorder exercise"
                                        >
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center text-xs font-medium text-brand-red shrink-0">
                                          {itemIdx + 1}
                                        </div>
                                        <div className="font-medium text-white truncate">{item.display_name}</div>
                                      </div>
                                      <button
                                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-red-500/20 flex items-center justify-center transition-colors shrink-0"
                                        onClick={() => removeExerciseFromDay(dayIdx, itemIdx)}
                                      >
                                        <X className="w-3 h-3 text-red-400" />
                                      </button>
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
                                    </>
                                    )}
                                  </DraggableItem>
                                ))}

                                {day.items.length === 0 && (
                                  <div className="text-zinc-500 text-center py-8 text-sm bg-surface/50 rounded-xl border border-dashed border-white/10">
                                    <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No exercises added yet
                                  </div>
                                )}
                              </Reorder.Group>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    </>
                    )}
                  </DraggableItem>
                )
              })}
            </Reorder.Group>
          </AnimatedCard>
        </motion.div>

        {/* Save Bar — floats clear above the bottom nav (which stays visible here) */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-brand-dark via-brand-dark/95 to-transparent px-4 pt-4"
          style={{ paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-2xl mx-auto flex gap-2">
            <button className="btn flex-1 justify-center" onClick={saveProgram}>
              <Check className="w-4 h-4" />
              {selected ? 'Update Program' : 'Create Program'}
            </button>
            <button
              className="w-14 rounded-2xl bg-surface-elevated text-zinc-300 hover:text-white hover:bg-surface-pressed flex items-center justify-center transition-colors shrink-0"
              onClick={backToList}
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  )
}