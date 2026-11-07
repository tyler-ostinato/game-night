import { describe, expect, it } from 'vitest'
import { CROWN_COLORS, SHIRTS, defaultLook, isLook, render, type Look } from './sprite'

const look: Look = { skin: 0, hair: 'short', hairColor: 0, shirt: 0, extra: 'cap', accent: 5 }
const colors = (l: Look, place?: 1 | 2 | 3) => new Set(render(l, place).map(p => p.color))

describe('defaultLook', () => {
  it('gives the same valid character for the same name, ignoring case', () => {
    expect(defaultLook('Tyler')).toEqual(defaultLook('tyler'))
    expect(isLook(defaultLook('Tyler'))).toBe(true)
  })

  it('gives different people different characters', () => {
    const names = ['Tyler', 'Dunja', 'Sam', 'Alex', 'Jordan', 'Priya']
    expect(new Set(names.map(n => JSON.stringify(defaultLook(n)))).size).toBe(names.length)
  })
})

describe('isLook', () => {
  it('rejects unknown options and out-of-range colours', () => {
    expect(isLook({ ...look, hair: 'mullet' })).toBe(false)
    expect(isLook({ ...look, skin: 99 })).toBe(false)
    expect(isLook({ ...look, shirt: 1.5 })).toBe(false)
    expect(isLook(null)).toBe(false)
  })
})

describe('render', () => {
  it('fits the 16×20 grid', () => {
    for (const p of render(look, 1)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w).toBeLessThanOrEqual(16)
      expect(p.y).toBeLessThan(20)
    }
  })

  it('adds a crown in the colour for each place', () => {
    for (const place of [1, 2, 3] as const) expect(colors(look, place).has(CROWN_COLORS[place][0])).toBe(true)
    expect(colors(look).has(CROWN_COLORS[1][0])).toBe(false)
  })

  it('swaps a cap for the crown', () => {
    expect(colors(look).has(SHIRTS[5])).toBe(true)
    expect(colors(look, 1).has(SHIRTS[5])).toBe(false)
  })
})
