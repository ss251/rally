/**
 * One-shot: drive the mint leg for the demo $3 chip-in whose in-flight
 * completeContributionServerFn call outlived the HTTP request (attestation
 * took ~20 min on 2026-07-18). Idempotent at the CCTP layer — a second
 * receiveMessage for the same nonce reverts without minting.
 *
 *   bunx tsx scripts/demo-mint-now.ts
 */
import { completeContribution } from '../src/lib/cctp/complete-fill'

const res = await completeContribution({
  backer: '0x842d1acaE94E06B1a8a1577124E1F3367dE8cB2d',
  burnTxHash: '0x5430241f4e81bb383acfaad86f0cdf7d45ee8cc0896b78405572db2543259e0d',
  sourceDomain: 6,
  campaignId: 4,
})
console.log(JSON.stringify(res, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
