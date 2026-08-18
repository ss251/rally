import { describe, expect, it } from 'vitest'
import { CctpDomain } from '#/lib/cctp/addresses'
import { CHIP_IN_META, CHIP_IN_SOURCES, parseChipInSource } from './chip-in-source'

describe('parseChipInSource', () => {
  it('accepts the three live doors', () => {
    expect(parseChipInSource('base')).toBe('base')
    expect(parseChipInSource('optimism')).toBe('optimism')
    expect(parseChipInSource('arbitrum')).toBe('arbitrum')
  })

  it('falls back to Base for anything else', () => {
    expect(parseChipInSource('solana')).toBe('base')
    expect(parseChipInSource(undefined)).toBe('base')
  })
})

describe('CHIP_IN_META', () => {
  it('maps each door to the right CCTP domain', () => {
    expect(CHIP_IN_META.base.domain).toBe(CctpDomain.BASE_SEPOLIA)
    expect(CHIP_IN_META.optimism.domain).toBe(CctpDomain.OP_SEPOLIA)
    expect(CHIP_IN_META.arbitrum.domain).toBe(CctpDomain.ARBITRUM_SEPOLIA)
    expect(CHIP_IN_SOURCES).toEqual(['base', 'optimism', 'arbitrum'])
  })
})
