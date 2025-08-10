'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import QuickStartSection from '@/components/QuickStartSection'
import ExerciseSelector from '@/components/ExerciseSelector'
import EnhancedSetRow from '@/components/EnhancedSetRow'
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
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [note, setNote] = useState('')
  const [presetTitle, setPresetTitle] = useState<PresetTitle>('Upper')
  const [customTitle, setCustomTitle] = useState('')

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

  // UI State
  const [isTemplateCollapsed, setIsTemplateCollapsed] = useState(true)
  const [isExerciseSelectorCollapsed, setIsExerciseSelectorCollapsed] = useState(false)
  const [workoutMode, setWorkoutMode] = useState<'quick' | 'template' | 'custom'>('quick')

  const [loadedTemplate, setLoadedTemplate] = useState<{ programName: string; dayName: string } | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [days, setDays] = useState<ProgramDay[]>([])
  const [selectedDayId, setSelectedDayId] = useState<string>('')

  const router = useRouter()
  const [demo, setDemo] = useState(false)

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

      // Auto-load today's template from active program
      const todayDow = new Date().getDay()
      const active = (progs||[]).find(p=>p.is_active)
      if (active?.id) {
        const { data: pdays } = await supabase.from('program_days')
          .select('id,name,dows,order_index').eq('program_id', active.id).order('order_index')
        const today = (pdays||[]).find(d => (d.dows||[]).includes(todayDow))
        if (today) {
          await loadTemplate(active, today)
          setWorkoutMode('template')
        }
      }
    })()
  }, [])

  function addExercise(id: string, avgWeight?: number, avgReps?: number) {
    const ex = allExercises.find(e => e.id === id)
    if (!ex) return
    
    // Smart defaults based on recent usage
    const smartSets = avgWeight && avgReps ? [{ 
      weight: avgWeight, 
      reps: avgReps, 
      set_type: 'working' as const 
    }] : []
    
    setItems(p => [...p, { id: ex.id, name: ex.name, sets: smartSets }])
    setIsExerciseSelectorCollapsed(true) // Collapse after adding
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
    setItems(prev => [...prev, { id: (ins as Exercise).id, name: (ins as Exercise).name, sets: [] }])
    setSearch('')
    setIsExerciseSelectorCollapsed(true)
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

    const built = tex.map(t => ({
      id: t.exercise_id,
      name: t.display_name,
      sets: Array.from({ length: Math.max(1, t.default_sets||1) }, () => ({
        weight: 0,
        reps: Math.max(0, t.default_reps||0),
        set_type: (t.set_type as 'warmup'|'working') || 'working'
      }))
    }))
    setItems(built)
    setPresetTitle('Other')
    setCustomTitle(day.name)
    setLoadedTemplate({ programName: program.name, dayName: day.name })
  }

  function resolveTitle(): string | null {
    const fromPreset = presetTitle !== 'Other' ? presetTitle : customTitle.trim()
    return fromPreset ? fromPreset : null
  }

  function toISO(dtLocal: string) {
    const d = new Date(dtLocal)
    return d.toISOString()
  }

  // Add same exercise as previous one
  function addSameExercise(exerciseIndex: number) {
    const exercise = items[exerciseIndex]
    if (!exercise) return
    
    // Find the same exercise to get recent data
    const lastSet = exercise.sets[exercise.sets.length - 1]
    const smartSets = lastSet ? [{ ...lastSet }] : []
    
    setItems(p => [...p, { 
      id: exercise.id, 
      name: exercise.name + ' (Copy)', 
      sets: smartSets 
    }])
  }

  // Enhanced save function with better UX
  async function saveOnline() {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = await getActiveUserId()
    if (!userId) { alert('Sign in again.'); return }

    const title = resolveTitle()
    const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

    const { data: w, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, performed_at: iso, title, note: note || null })
      .select('id')
      .single()
    if (error || !w) { alert('Save failed'); return }

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
    router.push('/history?highlight=' + w.id)
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

  return (
    <div className="relative min-h-screen bg-black pb-20">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">💪 New Workout</h1>
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
            onAddExercise={(ex) => addExercise(ex.id, ex.avgWeight, ex.avgReps)}
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

        {/* Workout Details - Collapsible */}
        <div className="card">
          <div className="font-medium mb-3">📝 Workout Details</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Title</div>
              <select
                className="input w-full"
                value={presetTitle}
                onChange={(e) => setPresetTitle(e.target.value as PresetTitle)}
              >
                <option>Upper</option>
                <option>Lower</option>
                <option>Push</option>
                <option>Pull</option>
                <option>Legs</option>
                <option>Other</option>
              </select>
            </label>
            
            {presetTitle === 'Other' && (
              <label className="block">
                <div className="mb-1 text-sm text-white/80">Custom title</div>
                <input
                  className="input w-full"
                  placeholder="e.g., Upper A, Full Body"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </label>
            )}

            <label className="block">
              <div className="mb-1 text-sm text-white/80">Date & Time</div>
              <input
                type="datetime-local"
                className="input w-full"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </label>
          </div>

          <label className="block mt-3">
            <div className="mb-1 text-sm text-white/80">Notes (optional)</div>
            <input
              className="input w-full"
              placeholder="How are you feeling? Any goals for today?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
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

        {/* Selected Exercises + Sets */}
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="font-medium text-lg">{it.name}</div>
                <div className="flex items-center gap-2">
                  <button 
                    className="toggle text-xs"
                    onClick={() => addSameExercise(idx)}
                    title="Add same exercise"
                  >
                    ➕ Same
                  </button>
                  <button 
                    className="toggle text-red-400" 
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {it.sets.map((s, si) => (
                  <EnhancedSetRow
                    key={si}
                    unitLabel={unit}
                    setIndex={si}
                    initial={s}
                    previousSet={si > 0 ? it.sets[si - 1] : undefined}
                    onChange={(v) =>
                      setItems(prev =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, sets: p.sets.map((ps, psi) => (psi === si ? v : ps)) } : p
                        )
                      )
                    }
                    onRemove={() =>
                      setItems(prev =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, sets: p.sets.filter((_, psi) => psi !== si) } : p
                        )
                      )
                    }
                    onCopyPrevious={si > 0 ? () => {
                      const prevSet = it.sets[si - 1]
                      setItems(prev =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, sets: p.sets.map((ps, psi) => (psi === si ? { ...prevSet } : ps)) } : p
                        )
                      )
                    } : undefined}
                  />
                ))}
              </div>

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
                {it.sets.length > 0 && (
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
          ))}
        </div>

        {items.length === 0 && (
          <div className="card text-center py-8">
            <div className="text-white/60 mb-4">
              💪 Ready to start your workout?
            </div>
            <div className="text-sm text-white/50">
              Add exercises above to begin tracking your sets!
            </div>
          </div>
        )}
      </main>

      {/* Sticky Save Button */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur border-t border-white/10 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <button 
              className="btn flex-1 py-4 text-lg font-medium disabled:opacity-50" 
              disabled={!canSave} 
              onClick={saveOnline}
            >
              💾 Save Workout ({items.reduce((acc, item) => acc + item.sets.length, 0)} sets)
            </button>
            <button 
              className="toggle px-6" 
              onClick={saveOffline}
              title="Save offline"
            >
              📱
            </button>
          </div>
        </div>
      )}
    </div>
  )
}