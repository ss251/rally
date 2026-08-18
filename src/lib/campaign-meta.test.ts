import { describe, expect, it } from 'vitest'
import { KNOWN_WALLETS, mergeCampaignMeta } from './campaign'

const MAGIC = '0x842d1acae94e06b1a8a1577124e1f3367de8cb2d'

describe('mergeCampaignMeta', () => {
  it('names the Magic wallet You on every pot, not only #6', () => {
    const untitled = mergeCampaignMeta(undefined, null)
    expect(untitled.knownBackers?.[MAGIC]).toBe('You')
    const nine = mergeCampaignMeta(
      { title: 'Chip in from any chain', organizer: 'The Rally crew' },
      null,
    )
    expect(nine.knownBackers?.[MAGIC]).toBe('You')
    expect(nine.knownBackers).toMatchObject(KNOWN_WALLETS)
  })

  it('lets a stored email win over a missing KNOWN name', () => {
    const meta = mergeCampaignMeta(
      { title: 'Chip in from any chain', organizer: 'The Rally crew' },
      { knownBackers: { '0xabc': 'you@email.com' } },
    )
    expect(meta.title).toBe('Chip in from any chain')
    expect(meta.knownBackers?.['0xabc']).toBe('you@email.com')
    expect(meta.knownBackers?.[MAGIC]).toBe('You')
  })

  it('lets a stored email replace a hardcoded pin for the same wallet', () => {
    const meta = mergeCampaignMeta(
      { title: 'Lisbon', organizer: 'Crew', knownBackers: { '0xabc': 'You' } },
      { knownBackers: { '0xabc': 'you@email.com' } },
    )
    expect(meta.knownBackers?.['0xabc']).toBe('you@email.com')
  })
})
