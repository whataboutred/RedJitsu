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
  const [weight, setWeight] = useState<number>(initial?.weight ?? 0)
  const [reps, setReps] = useState<number>(initial?.reps ?? 0)
  const [type, setType] = useState<'warmup' | 'working'>(initial?.set_type ?? 'working')
  const step = unitLabel === 'kg' ? 2.5 : 5
  function emit(w = weight, r = reps, t = type) { onChange({ weight: w, reps: r, set_type: t }) }

  return (
    <div className="space-y-3 md:space-y-0">
      {/* Mobile layout: stacked vertically */}
      <div className="flex flex-col space-y-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">Weight ({unitLabel}):</span>
            <div className="flex items-center gap-1">
              <button className="toggle text-sm px-2 py-1" onClick={() => { const w = Math.max(0, +(weight - step).toFixed(1)); setWeight(w); emit(w) }}>-{step}</button>
              <input className="input w-20 text-center text-sm" type="number" step="0.5" inputMode="decimal" value={weight} placeholder="0" onChange={(e) => { const w = Number(e.target.value || 0); setWeight(w); emit(w) }} />
              <button className="toggle text-sm px-2 py-1" onClick={() => { const w = +(weight + step).toFixed(1); setWeight(w); emit(w) }}>+{step}</button>
            </div>
          </div>
          <button className="toggle text-red-400 ml-2" onClick={onRemove}>✕</button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/80">Reps:</span>
            <div className="flex items-center gap-1">
              <button className="toggle text-sm px-2 py-1" onClick={() => { const r = Math.max(0, reps - 1); setReps(r); emit(undefined as any, r) }}>-1</button>
              <input className="input w-16 text-center text-sm" type="number" inputMode="numeric" value={reps} placeholder="0" onChange={(e) => { const r = Number(e.target.value || 0); setReps(r); emit(undefined as any, r) }} />
              <button className="toggle text-sm px-2 py-1" onClick={() => { const r = reps + 1; setReps(r); emit(undefined as any, r) }}>+1</button>
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
            <button className="toggle" onClick={() => { const w = Math.max(0, +(weight - step).toFixed(1)); setWeight(w); emit(w) }}>-{step}</button>
            <input className="input w-full text-center" type="number" step="0.5" inputMode="decimal" value={weight} placeholder={`0 ${unitLabel}`} onChange={(e) => { const w = Number(e.target.value || 0); setWeight(w); emit(w) }} />
            <button className="toggle" onClick={() => { const w = +(weight + step).toFixed(1); setWeight(w); emit(w) }}>+{step}</button>
          </div>
        </div>

        <div className="col-span-3">
          <div className="text-sm font-medium text-white/80 mb-1">Reps</div>
          <div className="flex items-center gap-2">
            <button className="toggle" onClick={() => { const r = Math.max(0, reps - 1); setReps(r); emit(undefined as any, r) }}>-1</button>
            <input className="input w-full text-center" type="number" inputMode="numeric" value={reps} placeholder="0 reps" onChange={(e) => { const r = Number(e.target.value || 0); setReps(r); emit(undefined as any, r) }} />
            <button className="toggle" onClick={() => { const r = reps + 1; setReps(r); emit(undefined as any, r) }}>+1</button>
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
