/** Print USDC + ETH for local demo keys. Never prints key material.
 *    bun --env-file=.env.local bunx tsx scripts/balances-demo-wallets.ts
 */
import { createPublicClient, http, formatUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
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

function load(name: string): { label: string; address: `0x${string}` } {
  const raw = JSON.parse(readFileSync(`${homedir()}/.rally-keys/${name}.json`, 'utf8'))
  const acct = privateKeyToAccount(raw[0].private_key as Hex)
  return { label: name, address: acct.address }
}

const wallets = ['deployer', 'backer', 'dispenser'].map(load)
if (process.env.RELAYER_KEY?.startsWith('0x')) {
  wallets.push({ label: 'relayer-env', address: privateKeyToAccount(process.env.RELAYER_KEY as Hex).address })
}

for (const w of wallets) {
  console.log(`\n${w.label}  ${w.address}`)
  for (const id of CHIP_IN_SOURCES) {
    const m = CHIP_IN_META[id]
    const pub = createPublicClient({ chain: m.chain, transport: http(m.rpc) })
    const [eth, usdc] = await Promise.all([
      pub.getBalance({ address: w.address }),
      pub.readContract({ address: m.usdc, abi: ERC20, functionName: 'balanceOf', args: [w.address] }) as Promise<bigint>,
    ])
    console.log(
      `  ${id.padEnd(9)}  USDC ${formatUnits(usdc, 6).padStart(10)}   ETH ${Number(formatUnits(eth, 18)).toFixed(5)}`,
    )
  }
}
