/** One-shot: create demo campaign #6 for the 2-min film — a $12 goal filled by
 *  three chains (Arbitrum native, Optimism + Base via CCTP). Title/organizer/
 *  backer names are pinned in lib/campaign.ts KNOWN['6'].
 *    bunx tsx scripts/demo-create-c6.ts
 */
import { createCampaignOnchain } from '../src/lib/campaign-relayer'

const res = await createCampaignOnchain({
  title: 'Send the crew to Lisbon',
  organizer: 'The Lisbon crew',
  goalUsd: 12,
  days: 3,
  beneficiary: '0x842d1acaE94E06B1a8a1577124E1F3367dE8cB2d', // the Magic email wallet
})
console.log(JSON.stringify(res, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
