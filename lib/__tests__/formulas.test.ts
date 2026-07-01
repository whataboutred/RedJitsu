import { describe, it, expect } from 'vitest'
import { estimated1RM, detectPR, format1RM } from '@/lib/formulas'

describe('estimated1RM', () => {
  it('returns the weight itself for a single', () => {
    expect(estimated1RM(315, 1)).toBe(315)
  })

  it('applies the Epley formula for multiple reps', () => {
    // 100 * (1 + 10/30) = 133.33 → 133
    expect(estimated1RM(100, 10)).toBe(133)
    // 225 * (1 + 5/30) = 262.5 → 263
    expect(estimated1RM(225, 5)).toBe(263)
  })

  it('guards against invalid input', () => {
    expect(estimated1RM(0, 5)).toBe(0)
    expect(estimated1RM(100, 0)).toBe(0)
    expect(estimated1RM(-10, 5)).toBe(0)
  })
})

describe('detectPR', () => {
  const history = { weight: 200, reps: 5, estimated1rm: estimated1RM(200, 5) }

  it('treats the first lift of an exercise as a weight PR', () => {
    expect(detectPR(135, 5, null)).toBe('weight')
  })

  it('flags a heavier top weight at any rep range', () => {
    expect(detectPR(205, 1, history)).toBe('weight')
  })

  it('flags a higher estimated 1RM at the same weight', () => {
    // 200x8 has a higher e1RM than 200x5
    expect(detectPR(200, 8, history)).toBe('1rm')
  })

  it('returns null when nothing was beaten', () => {
    expect(detectPR(200, 5, history)).toBeNull()
    expect(detectPR(185, 3, history)).toBeNull()
  })

  it('ignores invalid sets', () => {
    expect(detectPR(0, 5, history)).toBeNull()
    expect(detectPR(200, 0, history)).toBeNull()
  })
})

describe('format1RM', () => {
  it('formats a display string with the unit', () => {
    expect(format1RM(100, 10, 'lb')).toBe('Est. 1RM: 133 lb')
  })

  it('returns empty for invalid input', () => {
    expect(format1RM(0, 0)).toBe('')
  })
})
