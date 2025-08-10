'use client'

import Nav from '@/components/Nav'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { DEMO, getActiveUserId } from '@/lib/activeUser'
import { useSearchParams, useRouter } from 'next/navigation'
import WorkoutDetail from '@/components/WorkoutDetail'
import BJJDetail from '@/components/BJJDetail'

type Workout = { id:string; performed_at:string; title:string|null }
type BJJ = { id:string; performed_at:string; duration_min:number; kind:'class'|'drilling'|'open_mat'; intensity:string|null; notes:string|null }

export const dynamic = 'force-dynamic' // don’t prerender this page

export default function HistoryPage() {
  return (
    <div>
      <Nav />
      <Suspense fallback={<main className="max-w-4xl mx-auto p-4">Loading…</main>}>
        <HistoryClient />
      </Suspense>
    </div>
  )
}

function HistoryClient(){
  const [loading, setLoading] = useState(true)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [bjj, setBjj] = useState<BJJ[]>([])
  const params = useSearchParams()
  const router = useRouter()
  const highlightId = params.get('highlight')
  const highlightType = params.get('type') || 'workout' // default to workout for backward compatibility

  const closeModal = () => {
    router.push('/history')
  }

  useEffect(()=>{(async()=>{
    const { data:{ user } } = await supabase.auth.getUser()
    if(!user && !DEMO){ window.location.href='/login'; return }

    const { data: w } = await supabase
      .from('workouts')
      .select('id,performed_at,title')
      .order('performed_at',{ascending:false})
      .limit(500)
    setWorkouts((w||[]) as Workout[])

    const { data: bj } = await supabase
      .from('bjj_sessions')
      .select('id,performed_at,duration_min,kind,intensity,notes')
      .order('performed_at',{ascending:false})
      .limit(500)
    setBjj((bj||[]) as BJJ[])

    setLoading(false)
  })()},[])

  if (loading) return (<main className="max-w-4xl mx-auto p-4">Loading…</main>)

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl">History</h1>
      
      {highlightId && highlightType === 'workout' && (
        <WorkoutDetail workoutId={highlightId} onClose={closeModal} />
      )}
      {highlightId && highlightType === 'bjj' && (
        <BJJDetail sessionId={highlightId} onClose={closeModal} />
      )}

      {/* Strength Training */}
      <div className="card">
        <div className="font-medium mb-2">Strength Training</div>
        <div className="grid gap-2">
          {workouts.map(w=>(
            <div
              key={w.id}
              className={`flex items-start justify-between rounded-xl p-3 ${highlightId===w.id ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}
            >
              <div>
                <div className="text-white/90">{new Date(w.performed_at).toLocaleString()}</div>
                <div className="text-white/70 text-sm">{w.title ?? 'Untitled'}</div>
              </div>
              <button onClick={() => router.push(`/history?highlight=${w.id}`)} className="toggle self-center">Open</button>
            </div>
          ))}
          {!workouts.length && <div className="text-white/60">No workouts yet.</div>}
        </div>
      </div>

      {/* Jiu Jitsu */}
      <div className="card">
        <div className="font-medium mb-2">Jiu Jitsu</div>
        <div className="grid gap-2">
          {bjj.map(s=>(
            <div key={s.id} className={`flex items-start justify-between rounded-xl p-3 ${highlightId===s.id && highlightType==='bjj' ? 'border border-brand-red bg-brand-red/10' : 'bg-black/30'}`}>
              <div>
                <div className="text-white/90">{new Date(s.performed_at).toLocaleString()}</div>
                <div className="text-white/80">{s.kind.replace('_',' ')} • {s.duration_min} min {s.intensity ? `• ${s.intensity}` : ''}</div>
                {s.notes && <div className="text-white/70 text-sm mt-1 line-clamp-2">{s.notes}</div>}
              </div>
              <button onClick={() => router.push(`/history?highlight=${s.id}&type=bjj`)} className="toggle self-center">Open</button>
            </div>
          ))}
          {!bjj.length && <div className="text-white/60">No Jiu Jitsu sessions yet.</div>}
        </div>
      </div>
    </main>
  )
}
