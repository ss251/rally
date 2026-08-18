/** Print DISPENSER_KEY USDC + gas on Base / OP / Arb Sepolia.
 *    bunx tsx scripts/check-dispenser-treasuries.ts
 */
import { createPublicClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { CHIP_IN_META, CHIP_IN_SOURCES } from '../src/lib/chip-in-source'

const ERC20 = [
  {
    type: 'function' as const,
    name: 'balanceOf',
    stateMutability: 'view' as const,
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
]

const pk = (process.env.DISPENSER_KEY ?? '') as Hex
if (!pk.startsWith('0x')) {
  console.error('DISPENSER_KEY is not set')
  process.exit(1)
}
const treasury = privateKeyToAccount(pk)
console.log(`dispenser ${treasury.address}`)
for (const id of CHIP_IN_SOURCES) {
  const m = CHIP_IN_META[id]
  const pub = createPublicClient({ chain: m.chain, transport: http(m.rpc) })
  const [eth, usdc] = await Promise.all([
    pub.getBalance({ address: treasury.address }),
    pub.readContract({ address: m.usdc, abi: ERC20, functionName: 'balanceOf', args: [treasury.address] }) as Promise<bigint>,
  ])
  console.log(
    `${id.padEnd(9)}  USDC ${formatUnits(usdc, 6).padStart(10)}   ETH ${formatUnits(eth, 18)}`,
  )
}
