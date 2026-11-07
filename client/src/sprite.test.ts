import { describe, expect, it } from 'vitest'
import { CROWN_COLORS, SHIRTS, defaultLook, isLook, normalizeLook, render, type Look } from './sprite'

const look: Look = {
  avatar: 'character', body: 'neutral', skin: 0, hair: 'short', hairColor: 0, shirt: 0,
  facialHair: 'none', eyewear: 'none', headwear: 'cap', accent: 5,
}
const colors = (l: Look, place?: 1 | 2 | 3) => new Set(render(l, place).map(p => p.color))

describe('defaultLook', () => {
  it('gives the same valid character for the same name, ignoring case', () => {
    expect(defaultLook('Tyler')).toEqual(defaultLook('tyler'))
    expect(isLook(defaultLook('Tyler'))).toBe(true)
  })

  it('never guesses a body type from the name', () => {
    for (const n of ['Tyler', 'Dunja', 'Sam', 'Alex']) expect(defaultLook(n).body).toBe('neutral')
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
    expect(isLook({ ...look, eyewear: 'monocle' })).toBe(false)
    expect(isLook(null)).toBe(false)
  })
})

describe('normalizeLook', () => {
  it('upgrades characters saved with a single extra', () => {
    const old = { skin: 2, hair: 'curly', hairColor: 3, shirt: 5, extra: 'shades', accent: 1 }
    expect(normalizeLook(old)).toEqual({ ...look, skin: 2, hair: 'curly', hairColor: 3, shirt: 5, headwear: 'none', eyewear: 'shades', accent: 1 })
  })

  it('returns null for junk', () => {
    expect(normalizeLook('nope')).toBeNull()
    expect(normalizeLook({ skin: 'x' })).toBeNull()
  })
})

describe('render', () => {
  it('lets facial hair, eyewear and headwear be worn together', () => {
    const all = colors({ ...look, facialHair: 'beard', eyewear: 'glasses', headwear: 'cap', hairColor: 3 })
    expect(all.has('#d6ecff')).toBe(true) // glasses lenses
    expect(all.has(SHIRTS[5])).toBe(true)  // cap
  })

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
