/** One-shot: create demo campaign #5 (re-shoot stand-in for the funded #4).
 *  Title/organizer render from the KNOWN pin in lib/campaign.ts.
 *    bunx tsx scripts/demo-create-c5.ts
 */
import { createCampaignOnchain } from '../src/lib/campaign-relayer'

const res = await createCampaignOnchain({
  title: 'Coffee for the crew',
  organizer: 'Sailesh',
  goalUsd: 2.9,
  days: 3,
  beneficiary: '0x842d1acaE94E06B1a8a1577124E1F3367dE8cB2d',
})
console.log(JSON.stringify(res, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
