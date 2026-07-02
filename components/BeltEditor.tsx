'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { AnimatedCard } from '@/components/ui/Card'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { BeltBar } from '@/components/BeltBar'
import { beltStyle, beltLabel, BELT_ORDER, BELTS } from '@/lib/belt'
import { supabase } from '@/lib/supabaseClient'
import { getActiveUserId, isDemoVisitor } from '@/lib/activeUser'
import { useToast } from '@/components/Toast'

// Self-contained BJJ belt card + editor. Loads and saves the profile's belt
// rank (and logs a promotion), so it can live anywhere — e.g. account settings.
export function BeltEditor({ delay = 0 }: { delay?: number }) {
  const toast = useToast()
  const [belt, setBelt] = useState('white')
  const [stripes, setStripes] = useState(0)
  const [demo, setDemo] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      setDemo(await isDemoVisitor())
      const userId = await getActiveUserId()
      if (!userId) return
      const { data } = await supabase.from('profiles').select('bjj_belt,bjj_stripes').eq('id', userId).maybeSingle()
      if (data?.bjj_belt) setBelt(data.bjj_belt)
      if (typeof data?.bjj_stripes === 'number') setStripes(data.bjj_stripes)
    })()
  }, [])

  const bs = beltStyle(belt)

  async function save(newBelt: string, newStripes: number) {
    if (demo) { toast.warning('Sign in to set your belt'); return }
    const userId = await getActiveUserId()
    if (!userId) return
    const changed = newBelt !== belt || newStripes !== stripes
    const prevBelt = belt, prevStripes = stripes
    setBelt(newBelt); setStripes(newStripes); setOpen(false)
    try {
      const { error } = await supabase.from('profiles').update({ bjj_belt: newBelt, bjj_stripes: newStripes }).eq('id', userId)
      if (error) throw error
      if (changed) {
        await supabase.from('bjj_promotions').insert({ user_id: userId, belt: newBelt, stripes: newStripes })
        toast.success(`Set to ${beltLabel(newBelt, newStripes)}`)
      }
    } catch {
      setBelt(prevBelt); setStripes(prevStripes)
      toast.error('Failed to save belt')
    }
  }

  return (
    <AnimatedCard delay={delay}>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">BJJ belt</span>
            <span className="font-display uppercase text-sm" style={{ color: bs.hex }}>{beltLabel(belt, stripes)}</span>
          </div>
          <BeltBar belt={belt} stripes={stripes} />
        </div>
        <button onClick={() => setOpen(true)} className="text-sm font-medium flex-shrink-0" style={{ color: bs.hex }}>Change</button>
      </div>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Your belt">
        <div className="space-y-5 py-2 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Belt</p>
            <div className="space-y-2">
              {BELT_ORDER.map((b) => {
                const st = BELTS[b]
                const active = belt === b
                return (
                  <button
                    key={b}
                    onClick={() => save(b, stripes)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${active ? 'border-white/20 bg-white/[0.04]' : 'border-white/[0.06] hover:border-white/15'}`}
                  >
                    <BeltBar belt={b} stripes={active ? stripes : 0} className="w-24" />
                    <span className="text-sm font-medium" style={{ color: st.hex }}>{st.label}</span>
                    {active && <Check className="w-4 h-4 text-white ml-auto" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Stripes</p>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => save(belt, s)}
                  aria-label={`${s} stripes`}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${stripes === s ? '' : 'bg-surface border border-white/[0.07] text-zinc-500 hover:text-white'}`}
                  style={stripes === s ? { backgroundColor: bs.hex, color: bs.onAccent } : undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    </AnimatedCard>
  )
}
