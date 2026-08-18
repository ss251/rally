import { describe, expect, it } from 'vitest'
import { mergeCampaignMeta } from './campaign'

describe('mergeCampaignMeta', () => {
  it('lets a stored email win over a missing KNOWN name', () => {
    const meta = mergeCampaignMeta(
      { title: 'Chip in from any chain', organizer: 'The Rally crew' },
      { knownBackers: { '0xabc': 'you@email.com' } },
    )
    expect(meta.title).toBe('Chip in from any chain')
    expect(meta.knownBackers?.['0xabc']).toBe('you@email.com')
  })

  it('lets a stored email replace a hardcoded pin for the same wallet', () => {
    const meta = mergeCampaignMeta(
      { title: 'Lisbon', organizer: 'Crew', knownBackers: { '0xabc': 'You' } },
      { knownBackers: { '0xabc': 'you@email.com' } },
    )
    expect(meta.knownBackers?.['0xabc']).toBe('you@email.com')
  })
})
