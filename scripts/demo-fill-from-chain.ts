/**
 * Real CCTP v2 fill into a GoalVault campaign FROM ANY SUPPORTED SOURCE CHAIN.
 * Generalises spike-cctp-fill.ts (which was Base-only) so the demo bar can show
 * genuine multi-chain bands. The backer wallet (~/.rally-keys/backer.json) must
 * hold testnet USDC + a little gas on the SOURCE chain.
 *
 *   SOURCE=opSepolia CAMPAIGN_ID=6 AMOUNT_USDC=4 bunx tsx scripts/demo-fill-from-chain.ts
 *
 * SOURCE ∈ { baseSepolia | opSepolia | ethereumSepolia }. Dest is always
 * Arbitrum Sepolia (the GoalVault home chain, domain 3). The mint + on-chain
 * attribution reuse completeContribution() so the recorded sourceDomain — and
 * therefore the bar's colour band — is the real source chain.
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia, optimismSepolia, sepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { burnOnSource, getBurnFee, usdc } from '#/lib/cctp/cctp'
import { GOAL_VAULT } from '#/lib/campaign'
import { completeContribution } from '#/lib/cctp/complete-fill'

type SourceKey = 'baseSepolia' | 'opSepolia' | 'ethereumSepolia'
const VIEM_CHAIN = { baseSepolia, opSepolia: optimismSepolia, ethereumSepolia: sepolia } as const
const PUBLIC_RPC: Record<SourceKey, string> = {
  baseSepolia: 'https://sepolia.base.org',
  opSepolia: 'https://sepolia.optimism.io',
  ethereumSepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
}

const SOURCE = (process.env.SOURCE ?? 'opSepolia') as SourceKey
if (!EVM_CHAINS[SOURCE]) throw new Error(`unknown SOURCE ${SOURCE}`)
if (!process.env.CAMPAIGN_ID) throw new Error('CAMPAIGN_ID required')
const CAMPAIGN_ID = BigInt(process.env.CAMPAIGN_ID)
const AMOUNT = usdc(process.env.AMOUNT_USDC ?? '4')

const src = EVM_CHAINS[SOURCE]
const backer = privateKeyToAccount(
  JSON.parse(readFileSync(`${homedir()}/.rally-keys/backer.json`, 'utf8'))[0].private_key as Hex,
)
const pub = createPublicClient({ chain: VIEM_CHAIN[SOURCE], transport: http(PUBLIC_RPC[SOURCE]) })
const wallet = createWalletClient({ account: backer, chain: VIEM_CHAIN[SOURCE], transport: http(PUBLIC_RPC[SOURCE]) })

const ERC20_BAL = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const

async function main() {
  console.log(`=== demo fill: ${src.name} (domain ${src.domain}) → Arbitrum Sepolia ===`)
  console.log(`backer:    ${backer.address}`)
  console.log(`vault:     ${GOAL_VAULT}   campaign #${CAMPAIGN_ID}   amount ${formatUnits(AMOUNT, 6)} USDC`)

  const [gas, bal] = await Promise.all([
    pub.getBalance({ address: backer.address }),
    pub.readContract({ address: src.usdc, abi: ERC20_BAL, functionName: 'balanceOf', args: [backer.address] }) as Promise<bigint>,
  ])
  console.log(`backer on ${SOURCE}: gas ${formatUnits(gas, 18)} ETH  USDC ${formatUnits(bal, 6)}`)
  if (bal < AMOUNT) throw new Error(`insufficient USDC on ${SOURCE}: have ${formatUnits(bal, 6)}, need ${formatUnits(AMOUNT, 6)}`)
  if (gas === 0n) throw new Error(`no gas ETH on ${SOURCE}`)

  // Fast-transfer maxFee: Circle's fast tier now has a real fee floor; query + pad 2x (fallback 3 bps).
  let feeBps = 3
  try {
    const tiers = (await getBurnFee(src.domain, EVM_CHAINS.arbitrumSepolia.domain)) as Array<{ finalityThreshold: number; minimumFee: number }>
    const fast = tiers.find((t) => t.finalityThreshold === 1000)
    if (fast && Number.isFinite(fast.minimumFee)) feeBps = Math.max(Math.ceil(fast.minimumFee * 2), 1)
  } catch { /* keep fallback */ }
  let maxFee = (AMOUNT * BigInt(feeBps) + 9_999n) / 10_000n
  if (maxFee === 0n) maxFee = 1n

  console.log(`\n[1] burnOnSource (maxFee ${formatUnits(maxFee, 6)} USDC, ${feeBps} bps)…`)
  const { transactionHash: burnTx } = await burnOnSource({
    walletClient: wallet as any,
    publicClient: pub as any,
    account: backer,
    sourceChain: src,
    amount: AMOUNT,
    destinationDomain: EVM_CHAINS.arbitrumSepolia.domain, // 3
    mintRecipient: GOAL_VAULT,
    transferType: 'fast',
    maxFee,
    chain: VIEM_CHAIN[SOURCE] as any,
  })
  console.log(`    burn tx: ${src.explorer}/tx/${burnTx}`)

  console.log(`\n[2] completeContribution (attest → mint on Arbitrum → record domain ${src.domain})…`)
  const res = await completeContribution({
    backer: backer.address,
    burnTxHash: burnTx,
    sourceDomain: src.domain,
    campaignId: Number(CAMPAIGN_ID),
  })
  console.log(JSON.stringify(res, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
