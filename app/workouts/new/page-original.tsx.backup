'use client'

import Nav from '@/components/Nav'
import BackgroundLogo from '@/components/BackgroundLogo'
import SetRow from '@/components/SetRow'
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

export default function NewWorkoutPage() {
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb')
  const [note, setNote] = useState('')
  const [presetTitle, setPresetTitle] = useState<PresetTitle>('Upper')
  const [customTitle, setCustomTitle] = useState('')

  // NEW: local date/time for backdating (defaults to now in local time)
  const [performedAt, setPerformedAt] = useState<string>(() => {
    const d = new Date()
    // normalize to local for <input type="datetime-local">
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
  })

  const [allExercises, setAllExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<'all'|'barbell'|'dumbbell'|'machine'|'cable'|'other'>('all')

  const [items, setItems] = useState<
    Array<{ id: string; name: string; sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> }>
  >([])

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
        if (today) await loadTemplate(active, today)
      }
    })()
  }, [])

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase()
    return allExercises.filter(e=>{
      const matchCat = (cat==='all') || (e.category===cat)
      const matchText = !q || e.name.toLowerCase().includes(q)
      return matchCat && matchText
    })
  },[allExercises,search,cat])

  function addExercise(id:string){
    const ex = allExercises.find(e=>e.id===id); if(!ex) return
    setItems(p=>[...p, { id: ex.id, name: ex.name, sets: [] }])
  }

  async function addCustomExercise(){
    const name = search.trim()
    if(!name){ alert('Type a name first.'); return }
    const userId = await getActiveUserId()
    if(!userId){ window.location.href='/login'; return }
    const { data: ins, error } = await supabase
      .from('exercises')
      .insert({ name, category:'other', is_global:false, owner:userId })
      .select('id,name,category')
      .single()
    if(error || !ins){ alert('Could not create exercise.'); return }
    setAllExercises(prev => [...prev, ins as Exercise])
    setItems(prev => [...prev, { id: (ins as Exercise).id, name: (ins as Exercise).name, sets: [] }])
    setSearch('')
  }

  async function fetchDaysForProgram(programId: string){
    setDays([])
    setSelectedDayId('')
    if(!programId) return
    const { data } = await supabase.from('program_days')
      .select('id,name,dows,order_index').eq('program_id', programId).order('order_index')
    setDays((data||[]) as ProgramDay[])
  }

  async function loadTemplate(program: Program, day: ProgramDay){
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

  // Use the chosen local datetime, converted to ISO
  function toISO(dtLocal: string){
    // dtLocal is YYYY-MM-DDTHH:mm in local time
    const d = new Date(dtLocal)
    return d.toISOString()
  }

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
    <div className="relative min-h-screen bg-black">
      <BackgroundLogo />
      <Nav />
      <main className="relative z-10 max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl">New Workout</h1>

        {loadedTemplate && (
          <div className="card">
            <div className="text-sm">Loaded template: <span className="font-medium">{loadedTemplate.programName}</span> — <span className="font-medium">{loadedTemplate.dayName}</span></div>
            <div className="text-white/70 text-sm">You can still add/remove exercises and sets.</div>
          </div>
        )}

        {/* Manual template loader */}
        <div className="card">
          <div className="font-medium mb-2">Load from template (optional)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              className="input"
              value={selectedProgramId}
              onChange={async (e)=>{
                const id = e.target.value
                setSelectedProgramId(id)
                await fetchDaysForProgram(id)
              }}
            >
              <option value="">Select program…</option>
              {programs.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_active?' (active)':''}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={selectedDayId}
              onChange={(e)=>setSelectedDayId(e.target.value)}
              disabled={!selectedProgramId || days.length===0}
            >
              <option value="">{selectedProgramId ? 'Select day…' : 'Pick a program first'}</option>
              {days.map(d=>(
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <button
              className="btn disabled:opacity-50"
              disabled={!selectedProgramId || !selectedDayId}
              onClick={()=>{
                const prog = programs.find(p=>p.id===selectedProgramId)
                const day = days.find(d=>d.id===selectedDayId)
                if (prog && day) loadTemplate(prog, day)
              }}
            >
              Load template
            </button>
          </div>
        </div>

        {/* Title + Notes + Performed at */}
        <div className="card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block md:col-span-1">
              <div className="mb-1 text-sm text-white/80">Workout title</div>
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
            <label className="block md:col-span-2">
              <div className="mb-1 text-sm text-white/80">Custom title (if “Other”)</div>
              <input
                className="input w-full"
                placeholder="e.g., Upper A, Full Body, Arms, etc."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                disabled={presetTitle !== 'Other'}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block md:col-span-2">
              <div className="mb-1 text-sm text-white/80">Notes (optional)</div>
              <input
                className="input w-full"
                placeholder="Anything you want to remember"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {/* NEW: Performed at (backdate) */}
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Performed at</div>
              <input
                type="datetime-local"
                className="input w-full"
                value={performedAt}
                onChange={(e)=>setPerformedAt(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Exercise picker */}
        <div className="card space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all','barbell','dumbbell','machine','cable','other'] as const).map(k=>(
              <button key={k} className={`toggle ${cat===k?'border-brand-red bg-brand-red/20':''}`} onClick={()=>setCat(k)}>{k[0].toUpperCase()+k.slice(1)}</button>
            ))}
          </div>
          <input className="input w-full" placeholder="Type to filter exercises… or type a new name" value={search} onChange={e=>setSearch(e.target.value)} />

          <div className="grid sm:grid-cols-2 gap-2">
            <div className="max-h-64 overflow-auto border border-white/10 rounded-xl p-2">
              {filtered.map(ex=>(
                <button key={ex.id} className="toggle w-full mb-2 text-left" onClick={()=>addExercise(ex.id)}>
                  {ex.name} {ex.category!=='other'?`• ${ex.category}`:''}
                </button>
              ))}
              {search.trim() && (
                <button className="toggle w-full mt-2" onClick={addCustomExercise}>
                  + Add custom: “{search.trim()}”
                </button>
              )}
            </div>
            <div className="text-white/60 text-sm self-start">Click an item (or “Add custom”) to add →</div>
          </div>
        </div>

        {/* Selected exercises + sets */}
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{it.name}</div>
                <button className="toggle" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
              </div>
              <div className="hidden md:grid grid-cols-12 gap-3 px-1 text-sm font-medium text-white/70">
                <div className="col-span-5">Weight ({unit})</div>
                <div className="col-span-3">Reps</div>
                <div className="col-span-3">Set type</div>
                <div className="col-span-1"></div>
              </div>
              <div className="grid gap-2">
                {it.sets.map((s, si) => (
                  <SetRow
                    key={si}
                    unitLabel={unit}
                    initial={s}
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
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button className="toggle" onClick={() =>
                  setItems(prev =>
                    prev.map((p, i) => i === idx ? { ...p, sets: [...p.sets, { weight: 0, reps: 0, set_type: 'working' }] } : p)
                  )
                }>+ Add Set</button>
                {it.sets.length>0 && (
                  <button className="toggle" onClick={() =>
                    setItems(prev =>
                      prev.map((p, i) => i === idx ? { ...p, sets: [...p.sets, { ...p.sets[p.sets.length-1] }] } : p)
                    )
                  }>Copy Last</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="btn disabled:opacity-50" disabled={!canSave} onClick={saveOnline}>Save</button>
          <button className="toggle" onClick={saveOffline}>Save Offline</button>
        </div>
      </main>
    </div>
  )
}
