'use client'

import Nav from '@/components/Nav'
import DeleteAllData from '@/components/DeleteAllData'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'

type Profile = {
  unit: 'lb'|'kg'|null
  weekly_goal: number|null
  target_weeks: number|null
  goal_start: string|null
  bjj_weekly_goal: number|null
}

export default function SettingsPage(){
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<'lb'|'kg'>('lb')
  const router = useRouter()

  // Strength goal
  const [weeklyGoal, setWeeklyGoal] = useState<number>(4)
  const [targetWeeks, setTargetWeeks] = useState<number|''>('')
  const [goalStart, setGoalStart] = useState<string>('') // yyyy-mm-dd

  // BJJ goal
  const [bjjWeeklyGoal, setBjjWeeklyGoal] = useState<number>(2)

  useEffect(()=>{(async()=>{
    const userId = await getActiveUserId()
    if(!userId){ window.location.href='/login'; return }

    const { data: p } = await supabase
      .from('profiles')
      .select('unit,weekly_goal,target_weeks,goal_start,bjj_weekly_goal')
      .eq('id', userId)
      .maybeSingle()

    if (p) {
      setUnit(((p as Profile).unit ?? 'lb') as 'lb'|'kg')
      setWeeklyGoal((p as Profile).weekly_goal ?? 4)
      setTargetWeeks(((p as Profile).target_weeks ?? null) as number|null ?? '')
      setGoalStart(((p as Profile).goal_start ?? null) as string|null ?? '')
      setBjjWeeklyGoal((p as Profile).bjj_weekly_goal ?? 2)
    }
    setLoading(false)
  })()},[])

  async function save(){
    const userId = await getActiveUserId()
    if(!userId){ alert('Please sign in again'); return }
    
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        unit,
        weekly_goal: Math.min(14, Math.max(1, weeklyGoal||4)),
        target_weeks: targetWeeks === '' ? null : targetWeeks,
        goal_start: goalStart || null,
        bjj_weekly_goal: Math.min(14, Math.max(1, bjjWeeklyGoal||2))
      }, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      
      if (error) {
        console.error('Save error:', error)
        alert('Failed to save settings: ' + error.message)
        return
      }
      
      alert('Settings saved successfully!')
      router.push('/dashboard') // Redirect to dashboard to refresh goals
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save settings')
    }
  }

  if (loading) return (<div><Nav/><main className="max-w-3xl mx-auto p-4">Loading…</main></div>)

  return (
    <div>
      <Nav/>
      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl">Settings</h1>

        {/* Units */}
        <div className="card space-y-2">
          <div className="font-medium">Units</div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={unit==='lb'}
              onClick={()=>setUnit('lb')}
              className={`toggle ${unit==='lb' ? '!bg-red-600 !text-white !border-red-600' : ''}`}
            >
              Pounds (lb)
            </button>
            <button
              type="button"
              aria-pressed={unit==='kg'}
              onClick={()=>setUnit('kg')}
              className={`toggle ${unit==='kg' ? '!bg-red-600 !text-white !border-red-600' : ''}`}
            >
              Kilograms (kg)
            </button>
          </div>
          <div className="text-xs text-white/60">Tip: click <b>Save</b> below to apply to new workouts.</div>
        </div>

        {/* Strength weekly goal */}
        <div className="card space-y-3">
          <div className="font-medium">Strength — Weekly Consistency Goal</div>
          <label className="block">
            <div className="mb-1 text-sm text-white/80">Sessions per week (1–14)</div>
            <input
              type="number"
              min={1}
              max={14}
              className="input w-40"
              value={weeklyGoal}
              onChange={e=>setWeeklyGoal(Number(e.target.value||4))}
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Target length (weeks, optional)</div>
              <input
                type="number"
                min={1}
                max={52}
                className="input w-full"
                value={targetWeeks === '' ? '' : String(targetWeeks)}
                onChange={e=>{
                  const v = e.target.value.trim()
                  setTargetWeeks(v==='' ? '' : Math.min(52, Math.max(1, Number(v))))
                }}
                placeholder="e.g., 12"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Start date (optional)</div>
              <input
                type="date"
                className="input w-full"
                value={goalStart}
                onChange={e=>setGoalStart(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* BJJ weekly goal */}
        <div className="card space-y-3">
          <div className="font-medium">Jiu Jitsu — Weekly Consistency Goal</div>
          <label className="block">
            <div className="mb-1 text-sm text-white/80">Sessions per week (1–14)</div>
            <input
              type="number"
              min={1}
              max={14}
              className="input w-40"
              value={bjjWeeklyGoal}
              onChange={e=>setBjjWeeklyGoal(Number(e.target.value||2))}
            />
          </label>
          <div className="text-xs text-white/60">We’ll also track your total mat time each week.</div>
        </div>

        <button className="btn" onClick={save}>Save</button>

        {/* Delete all data section */}
        <DeleteAllData />
      </main>
    </div>
  )
}
