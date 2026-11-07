import { describe, expect, it } from 'vitest'
import { endTimeFor, isoDate } from './time'

describe('endTimeFor', () => {
  it('returns null when no time was entered', () => {
    expect(endTimeFor('2026-11-01', '')).toBeNull()
  })

  it('keeps evening times on the night itself', () => {
    expect(endTimeFor('2026-11-01', '22:15')).toBe(new Date('2026-11-01T22:15').toISOString())
  })

  it('moves times before 6am to the next morning', () => {
    expect(endTimeFor('2026-11-01', '01:30')).toBe(new Date('2026-11-02T01:30').toISOString())
  })

  it('handles the end of a month', () => {
    expect(endTimeFor('2026-01-31', '02:00')).toBe(new Date('2026-02-01T02:00').toISOString())
  })
})

describe('isoDate', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
