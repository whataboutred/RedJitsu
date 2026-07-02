// IBJJF adult belt system + on-dark theming. The user's belt drives the BJJ
// accent color across the app. Black belt is special-cased: pure black is
// invisible on the dark UI, so its accent is a stark near-white (premium
// inversion), while its belt graphic keeps the traditional red bar.

export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export const BELT_ORDER: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']

export type BeltStyle = {
  label: string
  hex: string // legible accent hex (used for charts/rings/inline styles)
  beltHex: string // the actual belt fabric color (for the belt graphic)
  barHex: string // the rank-bar color on the belt graphic
  text: string // tailwind text class
  bg: string
  border: string
  leftBorder: string
}

// Literal tailwind classes so JIT picks them up.
export const BELTS: Record<Belt, BeltStyle> = {
  white: {
    label: 'White', hex: '#D4D4D8', beltHex: '#E5E7EB', barHex: '#18181B',
    text: 'text-zinc-200', bg: 'bg-zinc-400/15', border: 'border-zinc-400/30', leftBorder: 'border-l-zinc-300/70',
  },
  blue: {
    label: 'Blue', hex: '#3B82F6', beltHex: '#2563EB', barHex: '#18181B',
    text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', leftBorder: 'border-l-blue-500/70',
  },
  purple: {
    label: 'Purple', hex: '#8B5CF6', beltHex: '#7C3AED', barHex: '#18181B',
    text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', leftBorder: 'border-l-purple-500/70',
  },
  brown: {
    label: 'Brown', hex: '#C08457', beltHex: '#6B4423', barHex: '#18181B',
    text: 'text-[#C08457]', bg: 'bg-[#C08457]/15', border: 'border-[#C08457]/30', leftBorder: 'border-l-[#C08457]/70',
  },
  black: {
    label: 'Black', hex: '#F5F5F5', beltHex: '#0A0A0A', barHex: '#DC2626',
    text: 'text-zinc-100', bg: 'bg-white/10', border: 'border-white/25', leftBorder: 'border-l-white/70',
  },
}

// Fallback to purple keeps pre-belt UI looking like today's design.
export function beltStyle(belt?: string | null): BeltStyle {
  return BELTS[(belt as Belt)] ?? BELTS.purple
}

export function beltLabel(belt: string, stripes: number): string {
  const s = Math.max(0, Math.min(4, stripes || 0))
  return `${BELTS[(belt as Belt)]?.label ?? 'White'} Belt${s > 0 ? ` · ${s} stripe${s === 1 ? '' : 's'}` : ''}`
}
