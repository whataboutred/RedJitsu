// IBJJF adult belt system + on-dark theming. The user's belt drives the BJJ
// accent color across the app. Black belt is special-cased: pure black is
// invisible on the dark UI, so its accent is a stark near-white (premium
// inversion), while its belt graphic keeps the traditional red bar.

export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black'
export const BELT_ORDER: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']

export type BeltStyle = {
  label: string
  hex: string // legible accent hex (used for charts/rings/inline styles)
  onAccent: string // legible TEXT color when placed on top of `hex` (for buttons/chips)
  beltHex: string // the actual belt fabric color (for the belt graphic)
  barHex: string // the rank-bar color on the belt graphic
  text: string // tailwind text class
  bg: string
  border: string
  leftBorder: string
}

// Literal tailwind classes so JIT picks them up. onAccent is dark for the light
// (white/black) belt accents so text stays legible on the fill.
export const BELTS: Record<Belt, BeltStyle> = {
  white: {
    label: 'White', hex: '#D4D4D8', onAccent: '#0A0A0A', beltHex: '#E5E7EB', barHex: '#18181B',
    text: 'text-zinc-200', bg: 'bg-zinc-400/15', border: 'border-zinc-400/30', leftBorder: 'border-l-zinc-300/70',
  },
  blue: {
    label: 'Blue', hex: '#3B82F6', onAccent: '#FFFFFF', beltHex: '#2563EB', barHex: '#18181B',
    text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', leftBorder: 'border-l-blue-500/70',
  },
  purple: {
    label: 'Purple', hex: '#8B5CF6', onAccent: '#FFFFFF', beltHex: '#7C3AED', barHex: '#18181B',
    text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', leftBorder: 'border-l-purple-500/70',
  },
  brown: {
    label: 'Brown', hex: '#C08457', onAccent: '#FFFFFF', beltHex: '#6B4423', barHex: '#18181B',
    text: 'text-[#C08457]', bg: 'bg-[#C08457]/15', border: 'border-[#C08457]/30', leftBorder: 'border-l-[#C08457]/70',
  },
  black: {
    label: 'Black', hex: '#F5F5F5', onAccent: '#0A0A0A', beltHex: '#0A0A0A', barHex: '#DC2626',
    text: 'text-zinc-100', bg: 'bg-white/10', border: 'border-white/25', leftBorder: 'border-l-white/70',
  },
}

// Fallback to purple keeps pre-belt UI looking like today's design.
export function beltStyle(belt?: string | null): BeltStyle {
  return BELTS[(belt as Belt)] ?? BELTS.purple
}

// CSS custom properties for belt theming. Set on a page wrapper; child elements
// use `text-[var(--belt)]`, `bg-[var(--belt-15)]`, `border-[var(--belt-40)]`, etc.
export function beltVars(belt?: string | null): Record<string, string> {
  const hex = beltStyle(belt).hex
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = (alpha: number) => `rgba(${r},${g},${b},${alpha})`
  return {
    '--belt': hex,
    '--belt-15': a(0.15),
    '--belt-20': a(0.2),
    '--belt-30': a(0.3),
    '--belt-40': a(0.4),
  }
}

export function beltLabel(belt: string, stripes: number): string {
  const s = Math.max(0, Math.min(4, stripes || 0))
  const label = BELTS[(belt as Belt)]?.label ?? BELTS.purple.label
  return `${label} Belt${s > 0 ? ` · ${s} stripe${s === 1 ? '' : 's'}` : ''}`
}
