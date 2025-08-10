'use client'
import { useState } from 'react'

export default function SetRow({
  initial,
  onChange,
  onRemove,
  unitLabel = 'lb',
}: {
  initial?: { weight: number; reps: number; set_type: 'warmup' | 'working' }
  onChange: (v: { weight: number; reps: number; set_type: 'warmup' | 'working' }) => void
  onRemove: () => void
  unitLabel?: 'lb' | 'kg' | string
}) {
  const [weight, setWeight] = useState<number | ''>(initial?.weight ?? '')
  const [reps, setReps] = useState<number | ''>(initial?.reps ?? '')
  const [type, setType] = useState<'warmup' | 'working'>(initial?.set_type ?? 'working')
  const step = unitLabel === 'kg' ? 2.5 : 5
  function emit(w = weight, r = reps, t = type) { 
    onChange({ 
      weight: w === '' ? 0 : Number(w), 
      reps: r === '' ? 0 : Number(r), 
      set_type: t 
    }) 
  }

  return (
    <div className="space-y-3 md:space-y-0">
      {/* Mobile layout: stacked vertically */}
      <div className="flex flex-col space-y-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">Weight ({unitLabel}):</span>
            <div className="flex items-center gap-1">
              <button className="toggle text-sm px-2 py-1" onClick={() => { const currentW = weight === '' ? 0 : Number(weight); const w = Math.max(0, +(currentW - step).toFixed(1)); setWeight(w === 0 ? '' : w); emit(w === 0 ? '' : w) }}>-{step}</button>
              <input className="input w-20 text-center text-sm" type="number" step="0.5" inputMode="decimal" value={weight} placeholder="" onChange={(e) => { const val = e.target.value; setWeight(val === '' ? '' : Number(val)); emit(val === '' ? '' : Number(val)) }} />
              <button className="toggle text-sm px-2 py-1" onClick={() => { const currentW = weight === '' ? 0 : Number(weight); const w = +(currentW + step).toFixed(1); setWeight(w); emit(w) }}>+{step}</button>
            </div>
          </div>
          <button className="toggle text-red-400 ml-2" onClick={onRemove}>✕</button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">Reps:</span>
            <div className="flex items-center gap-1">
              <button className="toggle text-sm px-2 py-1" onClick={() => { const currentR = reps === '' ? 0 : Number(reps); const r = Math.max(0, currentR - 1); setReps(r === 0 ? '' : r); emit(undefined as any, r === 0 ? '' : r) }}>-1</button>
              <input className="input w-16 text-center text-sm" type="number" inputMode="numeric" value={reps} placeholder="" onChange={(e) => { const val = e.target.value; setReps(val === '' ? '' : Number(val)); emit(undefined as any, val === '' ? '' : Number(val)) }} />
              <button className="toggle text-sm px-2 py-1" onClick={() => { const currentR = reps === '' ? 0 : Number(reps); const r = currentR + 1; setReps(r); emit(undefined as any, r) }}>+1</button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">Type:</span>
            <select className="input text-sm" value={type} onChange={(e) => { const t = e.target.value as 'warmup' | 'working'; setType(t); emit(undefined as any, undefined as any, t) }}>
              <option value="warmup">Warm-up</option>
              <option value="working">Working</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop layout: grid */}
      <div className="hidden md:grid grid-cols-12 gap-3 items-start">
        <div className="col-span-5">
          <div className="text-sm font-medium text-white/80 mb-1">Weight ({unitLabel})</div>
          <div className="flex items-center gap-2">
            <button className="toggle" onClick={() => { const currentW = weight === '' ? 0 : Number(weight); const w = Math.max(0, +(currentW - step).toFixed(1)); setWeight(w === 0 ? '' : w); emit(w === 0 ? '' : w) }}>-{step}</button>
            <input className="input w-full text-center" type="number" step="0.5" inputMode="decimal" value={weight} placeholder={unitLabel} onChange={(e) => { const val = e.target.value; setWeight(val === '' ? '' : Number(val)); emit(val === '' ? '' : Number(val)) }} />
            <button className="toggle" onClick={() => { const currentW = weight === '' ? 0 : Number(weight); const w = +(currentW + step).toFixed(1); setWeight(w); emit(w) }}>+{step}</button>
          </div>
        </div>

        <div className="col-span-3">
          <div className="text-sm font-medium text-white/80 mb-1">Reps</div>
          <div className="flex items-center gap-2">
            <button className="toggle" onClick={() => { const currentR = reps === '' ? 0 : Number(reps); const r = Math.max(0, currentR - 1); setReps(r === 0 ? '' : r); emit(undefined as any, r === 0 ? '' : r) }}>-1</button>
            <input className="input w-full text-center" type="number" inputMode="numeric" value={reps} placeholder="reps" onChange={(e) => { const val = e.target.value; setReps(val === '' ? '' : Number(val)); emit(undefined as any, val === '' ? '' : Number(val)) }} />
            <button className="toggle" onClick={() => { const currentR = reps === '' ? 0 : Number(reps); const r = currentR + 1; setReps(r); emit(undefined as any, r) }}>+1</button>
          </div>
        </div>

        <div className="col-span-3">
          <div className="text-sm font-medium text-white/80 mb-1">Set type</div>
          <select className="input w-full" value={type} onChange={(e) => { const t = e.target.value as 'warmup' | 'working'; setType(t); emit(undefined as any, undefined as any, t) }}>
            <option value="warmup">Warm-up</option>
            <option value="working">Working</option>
          </select>
        </div>

        <div className="col-span-1 text-right">
          <button className="toggle" onClick={onRemove}>✕</button>
        </div>
      </div>
    </div>
  )
}
