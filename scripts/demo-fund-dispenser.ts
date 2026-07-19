/** Stock the dispenser treasury on Base Sepolia via a real CCTP hop:
 *  burn from the backer key on OP Sepolia → mint directly to the treasury
 *  address on Base (deployer submits receiveMessage; it has Base ETH).
 *    AMOUNT_USDC=12 bunx tsx scripts/demo-fund-dispenser.ts
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { optimismSepolia, baseSepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { burnOnSource, fetchAttestation, mintOnDestination, getBurnFee, usdc } from '#/lib/cctp/cctp'

const TREASURY = '0x4F2C6bFfD77bbe3B122096753E6E22A95f1EF593' as const
const AMOUNT = usdc(process.env.AMOUNT_USDC ?? '12')

const key = (f: string) =>
  JSON.parse(readFileSync(`${homedir()}/.rally-keys/${f}`, 'utf8'))[0].private_key as Hex
const backer = privateKeyToAccount(key('backer.json'))     // holds OP USDC
const deployer = privateKeyToAccount(key('deployer.json')) // holds Base ETH

const op = EVM_CHAINS.opSepolia
const base = EVM_CHAINS.baseSepolia
const opPub = createPublicClient({ chain: optimismSepolia, transport: http('https://sepolia.optimism.io') })
const opWallet = createWalletClient({ account: backer, chain: optimismSepolia, transport: http('https://sepolia.optimism.io') })
const basePub = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') })
const baseWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http('https://sepolia.base.org') })

async function main() {
  let feeBps = 3
  try {
    const tiers = (await getBurnFee(op.domain, base.domain)) as Array<{ finalityThreshold: number; minimumFee: number }>
    const fast = tiers.find((t) => t.finalityThreshold === 1000)
    if (fast && Number.isFinite(fast.minimumFee)) feeBps = Math.max(Math.ceil(fast.minimumFee * 2), 1)
  } catch { /* fallback */ }
  let maxFee = (AMOUNT * BigInt(feeBps) + 9_999n) / 10_000n
  if (maxFee === 0n) maxFee = 1n

  console.log(`burn ${formatUnits(AMOUNT, 6)} USDC on OP → treasury ${TREASURY} on Base (fee ≤ ${formatUnits(maxFee, 6)})`)
  const { transactionHash: burnTx } = await burnOnSource({
    walletClient: opWallet as any, publicClient: opPub as any, account: backer,
    sourceChain: op, amount: AMOUNT, destinationDomain: base.domain,
    mintRecipient: TREASURY, transferType: 'fast', maxFee, chain: optimismSepolia as any,
  })
  console.log(`burn: ${op.explorer}/tx/${burnTx}`)

  const att = await fetchAttestation({ sourceDomain: op.domain as any, transactionHash: burnTx })
  console.log('attestation complete')

  const mintTx = await mintOnDestination({
    walletClient: baseWallet as any, publicClient: basePub as any, account: deployer,
    message: att.message, attestation: att.attestation, chain: baseSepolia as any,
  })
  console.log(`mint: ${base.explorer}/tx/${mintTx}`)

  const bal = (await basePub.readContract({
    address: base.usdc,
    abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf', args: [TREASURY],
  })) as bigint
  console.log(`treasury Base USDC: ${formatUnits(bal, 6)}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
