/**
 * Rally · PROOF — run the server contribution path once, headlessly.
 * ---------------------------------------------------------------------------
 * Calls the SAME `fillContribution` the createServerFn handler calls, for a
 * real $1 CCTP fill into live campaign #1. No Magic OTP needed here — the CCTP
 * leg is the relayer's job; the backer address just gets recorded on-chain.
 *
 *   bun run scripts/prove-contribute.ts [backerAddress] [amountUsd]
 *
 * Env (.env.local, auto-loaded by bun): ALCHEMY_API_KEY / VITE_ALCHEMY_API_KEY.
 * Keys: RELAYER_KEY env or ~/.rally-keys/deployer.json.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fillContribution } from '#/lib/cctp/contribute-fill'

const backer =
  (process.argv[2] as `0x${string}`) ??
  (JSON.parse(readFileSync(`${homedir()}/.rally-keys/backer.json`, 'utf8'))[0]
    .address as `0x${string}`)
const amountUsd = process.argv[3] ? Number(process.argv[3]) : 1

async function main() {
  console.log('=== Rally server contribution proof ===')
  console.log(`backer (recorded on-chain): ${backer}`)
  console.log(`amount:                     $${amountUsd}`)
  const r = await fillContribution({ backer, amountUsd })
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
