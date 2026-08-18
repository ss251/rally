import { describe, expect, it } from 'vitest'
import { fundStatusLabel } from './chains'

describe('fundStatusLabel', () => {
  it('never says Raising now after the pot missed', () => {
    expect(fundStatusLabel('missed')).toBe('Missed — refunds open')
    expect(fundStatusLabel('missed')).not.toMatch(/Raising/)
  })

  it('keeps live and funded copy', () => {
    expect(fundStatusLabel('live')).toBe('Raising now')
    expect(fundStatusLabel('funded')).toBe('Goal met')
    expect(fundStatusLabel('live', { live: false })).toBe('Preview — reconnecting')
    expect(fundStatusLabel('live', { potluck: true })).toBe('Collecting gifts')
    expect(fundStatusLabel('funded', { potluck: true })).toBe('Fully funded')
  })
})
