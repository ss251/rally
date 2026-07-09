/**
 * Rally · Circles — seed the first LIVE circle on the deployed RotatingVault
 * ---------------------------------------------------------------------------
 * Creates circle #1 on Arbitrum Sepolia so /circle/1 renders real on-chain
 * state (mirrors how GoalVault campaign #1 backs /c/1):
 *
 *   4 seats · $1 each round · 21-day rounds
 *   seat 0 = the relayer ("Sam" in the UI's KNOWN labels)
 *   seats 1–3 = derived demo members (Maya, Tom, Emma)
 *   round 0 funded 3-of-4 (the demo members are in; Sam's chip-in is the
 *   live moment left for the demo) — the round bar renders mid-fill.
 *
 * Spend: 3 × $1 testnet USDC (recoverable — pots rotate back to relayer-known
 * addresses) + faucet ETH gas. Reuses lib/circle-relayer end to end, so this
 * doubles as an integration test of the exact code the server fns run.
 *
 * Run: bun scripts/seed-circle.ts   (.env.local auto-loaded by bun;
 *      RELAYER_KEY env or ~/.rally-keys/deployer.json)
 */
import { createPublicClient, formatUnits, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { loadRelayerKey } from '#/lib/cctp/contribute-fill'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { ROTATING_VAULT, ROTATING_VAULT_ABI } from '#/lib/circle'
import { createCircleOnchain, fillRound } from '#/lib/circle-relayer'

const DEPOSIT_USD = 1
const ROUND_SECONDS = 21 * 24 * 60 * 60 // 21 days — healthy through judging
const SEATS = 4

async function main() {
  const pk = await loadRelayerKey()
  const relayer = privateKeyToAccount(pk)
  const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
  const rpc = alchemy
    ? `https://arb-sepolia.g.alchemy.com/v2/${alchemy}`
    : 'https://sepolia-rollup.arbitrum.io/rpc'
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc) })

  const [eth, usdc, nextId] = await Promise.all([
    publicClient.getBalance({ address: relayer.address }),
    publicClient.readContract({
      address: EVM_CHAINS.arbitrumSepolia.usdc,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [relayer.address],
    }),
    publicClient.readContract({
      address: ROTATING_VAULT,
      abi: ROTATING_VAULT_ABI,
      functionName: 'nextCircleId',
    }),
  ])
  console.log(`relayer ${relayer.address}`)
  console.log(`  ETH  ${formatUnits(eth, 18)}  USDC ${formatUnits(usdc, 6)}  nextCircleId ${nextId}`)

  // 1. Create + fill seats (seat 0 = relayer, rest = demo members) + start.
  const created = await createCircleOnchain({
    depositUsd: DEPOSIT_USD,
    roundSeconds: ROUND_SECONDS,
    seats: SEATS,
    creator: relayer.address,
    demoFill: true,
  })
  console.log(`\ncircle #${created.circleId} created  tx ${created.createTx}`)
  for (const s of created.seats) {
    console.log(`  seat ${s.seat}: ${s.member}${s.demo ? ' (demo)' : ''}`)
  }
  console.log(`  started: ${created.started}`)

  // 2. The demo members chip into round 0; the relayer's seat stays open so
  //    the live screen shows a round mid-fill (3 of 4).
  const filled = await fillRound({
    circleId: BigInt(created.circleId),
    except: relayer.address,
  })
  console.log(`\nround ${filled.round}: +${filled.deposited.length} deposits ($${filled.amountUsdEach} each)`)
  for (const d of filled.deposited) console.log(`  ${d.member}  tx ${d.tx}`)
  console.log(`  roundFunded: ${filled.roundFunded}`)

  console.log(`\nlive at /circle/${created.circleId}`)
  console.log(`vault  https://sepolia.arbiscan.io/address/${ROTATING_VAULT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
