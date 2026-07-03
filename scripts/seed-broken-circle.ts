/**
 * Rally · Circles — seed the BROKEN showcase circle (#2) on Arbitrum Sepolia
 * ---------------------------------------------------------------------------
 * Circles' promise is "the pot pays in full, or everyone's made whole" — this
 * makes the second half demonstrable live. A tiny 2-seat circle with 5-minute
 * rounds funds round 0 and then deliberately misses round 1, so ~10 minutes
 * after start it is derivedly Broken and refunds open.
 *
 *   phase 1 (create): 2 demo seats · $1 each · 5-min rounds · round 0 funded
 *   phase 2 (refund <id>): after the break, pull seat 0's refund on-chain
 *   (leaves seat 1 unrefunded so /circle/2 renders "gets back $1" live).
 *
 * Spend: 2 × $1 testnet USDC (refunds return to derived demo addresses).
 *
 * Run: bun scripts/seed-broken-circle.ts create
 *      bun scripts/seed-broken-circle.ts refund <circleId>
 */
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'

import { ROTATING_VAULT, ROTATING_VAULT_ABI } from '#/lib/circle'
import { createCircleOnchain, fillRound, refundMember } from '#/lib/circle-relayer'

const [phase = 'create', idArg] = process.argv.slice(2)

async function main() {
  if (phase === 'create') {
    const created = await createCircleOnchain({
      depositUsd: 1,
      roundSeconds: 300,
      seats: 2,
      demoFill: true,
    })
    console.log(`circle #${created.circleId} created  tx ${created.createTx}`)
    for (const s of created.seats) console.log(`  seat ${s.seat}: ${s.member}${s.demo ? ' (demo)' : ''}`)
    console.log(`  started: ${created.started}`)

    const filled = await fillRound({ circleId: BigInt(created.circleId) })
    console.log(`round 0 funded: ${filled.roundFunded} (${filled.deposited.length} deposits)`)
    console.log(`\nround 1 will be missed on purpose — broken after ~10 min.`)
    console.log(`then: bun scripts/seed-broken-circle.ts refund ${created.circleId}`)
    return
  }

  if (phase === 'refund') {
    if (!idArg) throw new Error('usage: refund <circleId>')
    const circleId = BigInt(idArg)
    const rpc = 'https://sepolia-rollup.arbitrum.io/rpc'
    const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) })
    const members = await publicClient.readContract({
      address: ROTATING_VAULT,
      abi: ROTATING_VAULT_ABI,
      functionName: 'getMembers',
      args: [circleId],
    })
    const res = await refundMember({ circleId, member: members[0] })
    console.log(`refunded ${res.member}: $${res.amountUsd}  tx ${res.tx}`)
    console.log(`(seat 1 left unrefunded so /circle/${circleId} shows a live refundable)`)
    return
  }

  throw new Error(`unknown phase ${phase}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
