/**
 * Rally · PROOF — run the server contribution path once, headlessly.
 * ---------------------------------------------------------------------------
 * Calls the SAME `fillContribution` the createServerFn handler calls, for a
 * real $1 CCTP fill into a still-open campaign. Campaign #1 is closed and
 * refused. No Magic OTP needed here — the CCTP leg is the relayer's job; the
 * backer address just gets recorded on-chain.
 *
 *   bun run scripts/prove-contribute.ts <campaignId> [backerAddress] [amountUsd]
 *
 * Env (.env.local, auto-loaded by bun): ALCHEMY_API_KEY / VITE_ALCHEMY_API_KEY.
 * Keys: RELAYER_KEY env or ~/.rally-keys/deployer.json.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fillContribution } from '#/lib/cctp/contribute-fill'

const campaignId = Number(process.argv[2])
const backer =
  (process.argv[3] as `0x${string}`) ??
  (JSON.parse(readFileSync(`${homedir()}/.rally-keys/backer.json`, 'utf8'))[0]
    .address as `0x${string}`)
const amountUsd = process.argv[4] ? Number(process.argv[4]) : 1

async function main() {
  if (!Number.isFinite(campaignId) || campaignId < 2) {
    throw new Error('pass a live campaign id (>= 2); campaign #1 is closed')
  }
  console.log('=== Rally server contribution proof ===')
  console.log(`campaign:                   #${campaignId}`)
  console.log(`backer (recorded on-chain): ${backer}`)
  console.log(`amount:                     $${amountUsd}`)
  const r = await fillContribution({ backer, amountUsd, campaignId })
  console.log('\n=== RESULT ===')
  console.log(`campaign #${r.campaignId} raised: ${r.raisedBeforeUsd} -> ${r.raisedAfterUsd} USDC`)
  console.log(`moved on-chain:  ${r.movedUsd} USDC  (source domain ${r.sourceDomain} = Base Sepolia)`)
  console.log(`attestation:     ${(r.attestationLatencyMs / 1000).toFixed(1)}s`)
  console.log(`burn:   ${r.explorers.burn}`)
  console.log(`mint:   ${r.explorers.mint}`)
  console.log(`record: ${r.explorers.record}`)
  console.log('\n' + JSON.stringify(r, null, 2))
}

main().catch((e) => {
  console.error('PROOF FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
