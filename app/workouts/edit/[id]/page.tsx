'use client'

import Nav from '@/components/Nav'
import SetRow from '@/components/SetRow'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'

type Exercise = { id: string; name: string; category: 'barbell'|'dumbbell'|'machine'|'cable'|'other' }
type PresetTitle = 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Other'

export default function EditWorkoutPage() {
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
  const [cat, setCat] = useState<'all'|'barbell'|'dumbbell'|'machine'|'cable'|'other'>('all')

  const [items, setItems] = useState<
    Array<{ id: string; name: string; sets: Array<{ weight: number; reps: number; set_type: 'warmup' | 'working' }> }>
  >([])

  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState(false)

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

      // Load existing workout data
      const { data: workout } = await supabase
        .from('workouts')
        .select('performed_at,title,note')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single()

      if (!workout) {
        alert('Workout not found')
        router.push('/history')
        return
      }

      // Set workout details
      if (workout.title) {
        if (['Upper', 'Lower', 'Push', 'Pull', 'Legs'].includes(workout.title)) {
          setPresetTitle(workout.title as PresetTitle)
        } else {
          setPresetTitle('Other')
          setCustomTitle(workout.title)
        }
      }
      setNote(workout.note || '')
      
      // Convert performed_at to local datetime format
      const d = new Date(workout.performed_at)
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
      setPerformedAt(d.toISOString().slice(0, 16))

      // Load existing sets and exercises
      const { data: existingSets } = await supabase
        .from('sets')
        .select(`
          id,
          weight,
          reps,
          set_type,
          set_index,
          workout_exercises!inner(
            exercise_id,
            display_name
          )
        `)
        .eq('workout_exercises.workout_id', workoutId)
        .order('set_index', { ascending: true })

      // Group sets by exercise and build items array
      const exerciseGroups: Record<string, any> = {}
      
      for (const set of existingSets || []) {
        const exerciseId = (set as any).workout_exercises.exercise_id
        const displayName = (set as any).workout_exercises.display_name
        
        if (!exerciseGroups[exerciseId]) {
          exerciseGroups[exerciseId] = {
            id: exerciseId,
            name: displayName,
            sets: []
          }
        }
        
        exerciseGroups[exerciseId].sets.push({
          weight: Number(set.weight),
          reps: set.reps,
          set_type: set.set_type as 'warmup' | 'working'
        })
      }
      
      setItems(Object.values(exerciseGroups))

      // Load user profile and exercises
      const { data: profile } = await supabase.from('profiles').select('unit').eq('id', userId).maybeSingle()
      if (profile?.unit) setUnit(profile.unit as 'lb'|'kg')

      const { data: ex } = await supabase.from('exercises').select('id,name,category').order('name')
      setAllExercises((ex||[]) as Exercise[])

      setLoading(false)
    })()
  }, [workoutId, router])

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

  function resolveTitle(): string | null {
    const fromPreset = presetTitle !== 'Other' ? presetTitle : customTitle.trim()
    return fromPreset ? fromPreset : null
  }

  function toISO(dtLocal: string){
    const d = new Date(dtLocal)
    return d.toISOString()
  }

  async function saveWorkout() {
    const userId = await getActiveUserId()
    if (!userId) { alert('Sign in again.'); return }

    const title = resolveTitle()
    const iso = performedAt ? toISO(performedAt) : new Date().toISOString()

    try {
      // Update workout details
      const { error: workoutError } = await supabase
        .from('workouts')
        .update({ 
          performed_at: iso, 
          title, 
          note: note || null 
        })
        .eq('id', workoutId)
        .eq('user_id', userId)

      if (workoutError) {
        alert('Failed to update workout')
        console.error('Update error:', workoutError)
        return
      }

      // Delete existing workout_exercises and sets (CASCADE will handle sets)
      await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId)

      // Re-insert all exercises and sets
      for (const it of items) {
        const { data: wex } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: workoutId, exercise_id: it.id, display_name: it.name })
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

      router.push('/history?highlight=' + workoutId)
    } catch (error) {
      alert('Failed to save workout')
      console.error('Save error:', error)
    }
  }

  const canSave = useMemo(() => items.some(i => i.sets.length), [items])

  if (loading) {
    return (
      <div>
        <Nav />
        <main className="max-w-3xl mx-auto p-4">
          <div className="text-center">Loading workout...</div>
        </main>
      </div>
    )
  }

  return (
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Edit Workout</h1>
          <Link href="/history" className="toggle">
            ← Back to History
          </Link>
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
              <div className="mb-1 text-sm text-white/80">Custom title (if "Other")</div>
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
                  + Add custom: "{search.trim()}"
                </button>
              )}
            </div>
            <div className="text-white/60 text-sm self-start">Click an item (or "Add custom") to add →</div>
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
              <div className="grid grid-cols-12 gap-3 px-1 text-sm font-medium text-white/70">
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
          <button className="btn disabled:opacity-50" disabled={!canSave} onClick={saveWorkout}>Save Changes</button>
          <Link href="/history" className="toggle">Cancel</Link>
        </div>
      </main>
    </div>
  )
}