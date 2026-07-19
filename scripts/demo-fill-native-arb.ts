/** Seed a GoalVault campaign's Arbitrum-native band: approve + contribute() from
 *  the deployer's Arbitrum USDC. Honest — the money is already on Arbitrum, so no
 *  CCTP hop is needed; the vault credits LOCAL_DOMAIN (3 = arbitrum → the light-blue
 *  band). The demo's Sam is this wallet.
 *    CAMPAIGN_ID=6 AMOUNT_USDC=4 bunx tsx scripts/demo-fill-native-arb.ts
 */
import { createPublicClient, createWalletClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { GOAL_VAULT } from '#/lib/campaign'
import { usdc } from '#/lib/cctp/cctp'

const CAMPAIGN_ID = BigInt(process.env.CAMPAIGN_ID ?? '6')
const AMOUNT = usdc(process.env.AMOUNT_USDC ?? '4')
const RPC = process.env.ALCHEMY_API_KEY
  ? `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : 'https://sepolia-rollup.arbitrum.io/rpc'
const arbUsdc = EVM_CHAINS.arbitrumSepolia.usdc

const deployer = privateKeyToAccount(
  JSON.parse(readFileSync(`${homedir()}/.rally-keys/deployer.json`, 'utf8'))[0].private_key as Hex,
)
const pub = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC) })
const wallet = createWalletClient({ account: deployer, chain: arbitrumSepolia, transport: http(RPC) })

const ERC20 = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const
const VAULT = [
  { type: 'function', name: 'contribute', stateMutability: 'nonpayable', inputs: [{ name: 'campaignId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'getCampaign', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [
    { type: 'address' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint64' }, { type: 'uint256' }, { type: 'bool' }, { type: 'uint32' }] },
] as const

async function main() {
  const bal = (await pub.readContract({ address: arbUsdc, abi: ERC20, functionName: 'balanceOf', args: [deployer.address] })) as bigint
  console.log(`deployer ${deployer.address}  Arb USDC ${formatUnits(bal, 6)}  → contribute ${formatUnits(AMOUNT, 6)} to campaign #${CAMPAIGN_ID}`)
  if (bal < AMOUNT) throw new Error('insufficient Arbitrum USDC')

  const allowance = (await pub.readContract({ address: arbUsdc, abi: ERC20, functionName: 'allowance', args: [deployer.address, GOAL_VAULT] })) as bigint
  if (allowance < AMOUNT) {
    const ah = await wallet.writeContract({ address: arbUsdc, abi: ERC20, functionName: 'approve', args: [GOAL_VAULT, AMOUNT * 1_000_000n], chain: arbitrumSepolia })
    await pub.waitForTransactionReceipt({ hash: ah })
    console.log(`approved: ${ah}`)
  }
  const ch = await wallet.writeContract({ address: GOAL_VAULT, abi: VAULT, functionName: 'contribute', args: [CAMPAIGN_ID, AMOUNT], chain: arbitrumSepolia })
  const rc = await pub.waitForTransactionReceipt({ hash: ch })
  const c = (await pub.readContract({ address: GOAL_VAULT, abi: VAULT, functionName: 'getCampaign', args: [CAMPAIGN_ID] })) as any[]
  console.log(`contribute: https://sepolia.arbiscan.io/tx/${ch}  status ${rc.status}`)
  console.log(`raised now: ${formatUnits(c[4] as bigint, 6)} / ${formatUnits(c[2] as bigint, 6)} USDC`)
}
main().catch((e) => { console.error(e); process.exit(1) })
