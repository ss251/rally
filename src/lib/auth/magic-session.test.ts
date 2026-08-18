import { describe, expect, it } from 'vitest'
import { sessionEmailMatches } from './magic'

describe('sessionEmailMatches', () => {
  it('reuses only when this browser session email equals the typed one', () => {
    expect(sessionEmailMatches('you@rally.test', 'you@rally.test')).toBe(true)
    expect(sessionEmailMatches('  You@Rally.TEST  ', 'you@rally.test')).toBe(true)
  })

  it('does not reuse an empty or missing session email', () => {
    expect(sessionEmailMatches(undefined, 'you@rally.test')).toBe(false)
    expect(sessionEmailMatches('', 'you@rally.test')).toBe(false)
    expect(sessionEmailMatches('   ', 'you@rally.test')).toBe(false)
  })

  it('does not reuse a different email — that inbox must get a new OTP', () => {
    expect(sessionEmailMatches('you@rally.test', 'other@rally.test')).toBe(false)
    expect(sessionEmailMatches('you@rally.test', '')).toBe(false)
  })
})
