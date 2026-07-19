/** Stage the film's live circle: 3 seats · $1/round · creator = the Magic email
 *  wallet (seat 0 → payee of round 0). Also sends the wallet $1.50 Arbitrum USDC
 *  so its on-camera deposit is genuinely member-funded, then funds the two demo
 *  seats so the round sits at 2-of-3 — the user's chip-in completes it on camera.
 *    bunx tsx scripts/demo-stage-circle.ts
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { createCircleOnchain, depositForMember } from '#/lib/circle-relayer'

const MAGIC_WALLET = '0x842d1acaE94E06B1a8a1577124E1F3367dE8cB2d' as const
const RPC = process.env.ALCHEMY_API_KEY
  ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'
const arbUsdc = EVM_CHAINS.arbitrumSepolia.usdc
const ERC20 = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

async function main() {
  const deployer = privateKeyToAccount(
    JSON.parse(readFileSync(`${homedir()}/.rally-keys/deployer.json`, 'utf8'))[0].private_key as Hex,
  )
  const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) })
  const wallet = createWalletClient({ account: deployer, chain: arbitrumSepolia, transport: http(RPC) })

  // 1. $1.50 Arb USDC → the Magic wallet (its on-camera $1 deposit + headroom).
  const bal = (await pub.readContract({ address: arbUsdc, abi: ERC20, functionName: 'balanceOf', args: [MAGIC_WALLET] })) as bigint
  if (bal < 1_500_000n) {
    const th = await wallet.writeContract({ address: arbUsdc, abi: ERC20, functionName: 'transfer', args: [MAGIC_WALLET, 1_500_000n - bal], chain: arbitrumSepolia })
    await pub.waitForTransactionReceipt({ hash: th })
    console.log(`funded magic wallet: ${th}`)
  }

  // 2. The circle: 3 seats, $1/round, 2-day rounds, creator = Magic wallet (seat 0).
  const circle = await createCircleOnchain({
    depositUsd: 1,
    roundSeconds: 2 * 24 * 3600,
    seats: 3,
    creator: MAGIC_WALLET,
    demoFill: true,
  })
  console.log(JSON.stringify(circle, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))

  // 3. Fund round 0 for the two demo seats only (2-of-3 — the user's is the last).
  const demoSeats = circle.seats.filter((s: any) => s.demo && s.member)
  for (const s of demoSeats) {
    const r = await depositForMember({ circleId: BigInt(circle.circleId), member: s.member })
    console.log(`seat ${s.seat} funded: ${(r as any).tx ?? JSON.stringify(r)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
