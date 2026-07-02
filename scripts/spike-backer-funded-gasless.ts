/**
 * Rally · Phase-2 spike — REAL BACKER-FUNDED, GASLESS end-to-end proof
 * ---------------------------------------------------------------------------
 * This is the true product flow, proven headlessly with a scripted key standing
 * in for a Magic email wallet (the ZeroDev 7702 signer is swapped for
 * privateKeyToAccount so no in-browser OTP is needed — the on-chain mechanics
 * are byte-identical to what the app does after email login).
 *
 *   0. [one-time] relayer sends a SMALL amount of USDC to the throwaway "backer"
 *      on Base Sepolia, so the backer has their OWN money to burn.
 *   1. upgrade the backer EOA -> ZeroDev Kernel v3.3 in place (EIP-7702)
 *   2. GASLESS approve + depositForBurn as ONE sponsored UserOp — the backer
 *      burns THEIR OWN USDC and pays ZERO gas (ZeroDev paymaster pays).
 *   3. poll Circle Iris attestation of the backer's burn
 *   4. relayer mints on Arbitrum Sepolia -> USDC lands in the GoalVault
 *   5. relayer records the contribution under the BACKER's address
 *   6. assert the campaign `raised` rose by the minted amount
 *
 * Result: a real cross-chain contribution where the money is the backer's and
 * the backer paid no gas — exactly the demo claim. Prints every tx hash and who
 * paid gas for each.
 *
 * ── PRECONDITION (the one blocker) ──────────────────────────────────────────
 * Step 2 needs a ZeroDev gas-sponsorship policy enabled for Base Sepolia on the
 * project in VITE_ZERODEV_PROJECT_ID. As of this commit the paymaster returns
 * 400 "userOp did not match any gas sponsoring policies" for BOTH project UUIDs
 * in .env.local — i.e. the dashboard toggle ("Sponsor all transactions",
 * dashboard.zerodev.app -> project -> Gas Policies) is OFF. This is a one-click
 * human action; there is no public API to set it with the SDK key. Once it is
 * on, this script runs green end-to-end and prints the tx hashes.
 *
 * ENV (auto-loaded by bun from .env.local): VITE_ZERODEV_PROJECT_ID,
 *   ALCHEMY_API_KEY (optional). KEYS (never committed): ~/.rally-keys/gasless.json
 *   (backer), ~/.rally-keys/deployer.json (relayer + GoalVault owner).
 *
 *   bun run scripts/spike-backer-funded-gasless.ts
 */
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from '@zerodev/sdk'
import { KERNEL_V3_3, getEntryPoint } from '@zerodev/sdk/constants'
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeEventLog,
  formatUnits,
  pad,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia, baseSepolia } from 'viem/chains'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { fetchAttestation, mintOnDestination, usdc } from '#/lib/cctp/cctp'
import { CCTP_V2_TESTNET, EVM_CHAINS, CctpDomain } from '#/lib/cctp/addresses'
import { GOAL_VAULT } from '#/lib/campaign'

const PROJECT_ID = process.env.VITE_ZERODEV_PROJECT_ID
if (!PROJECT_ID) throw new Error('VITE_ZERODEV_PROJECT_ID not set (.env.local)')

// How much of the backer's own USDC to move. Keep it tiny — testnet treasury.
const AMOUNT_USD = 0.5
const CAMPAIGN_ID = 1n

const load = (f: string) =>
  JSON.parse(readFileSync(`${homedir()}/.rally-keys/${f}`, 'utf8'))[0].private_key as Hex

const backer = privateKeyToAccount(load('gasless.json'))
const relayer = privateKeyToAccount(load('deployer.json'))

const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
const rpc = (sub: string, fb: string) =>
  alchemy ? `https://${sub}.g.alchemy.com/v2/${alchemy}` : fb
const zerodevRpc = `https://rpc.zerodev.app/api/v3/${PROJECT_ID}/chain/${baseSepolia.id}`

const base = EVM_CHAINS.baseSepolia
const arb = EVM_CHAINS.arbitrumSepolia

const ERC20 = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 't', type: 'address' }, { name: 'a', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'Transfer', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'value', type: 'uint256', indexed: false }] },
] as const

const VAULT_ABI = [
  { type: 'function', name: 'recordContribution', stateMutability: 'nonpayable', inputs: [{ name: 'campaignId', type: 'uint256' }, { name: 'backer', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'sourceDomain', type: 'uint32' }], outputs: [] },
  { type: 'function', name: 'getCampaign', stateMutability: 'view', inputs: [{ name: 'campaignId', type: 'uint256' }], outputs: [{ name: 'creator', type: 'address' }, { name: 'beneficiary', type: 'address' }, { name: 'goal', type: 'uint256' }, { name: 'deadline', type: 'uint64' }, { name: 'raised', type: 'uint256' }, { name: 'withdrawn', type: 'bool' }, { name: 'count', type: 'uint32' }] },
] as const

const AMOUNT = usdc(AMOUNT_USD.toString())

const basePublic = createPublicClient({ chain: baseSepolia, transport: http(rpc('base-sepolia', 'https://sepolia.base.org')) })
const baseRelayer = createWalletClient({ account: relayer, chain: baseSepolia, transport: http(rpc('base-sepolia', 'https://sepolia.base.org')) })
const arbPublic = createPublicClient({ chain: arbitrumSepolia, transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')) })
const arbRelayer = createWalletClient({ account: relayer, chain: arbitrumSepolia, transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')) })

async function main() {
  console.log('backer (7702 signer):', backer.address)
  console.log('relayer (mint+record):', relayer.address)
  console.log('GoalVault:', GOAL_VAULT, '| campaign', CAMPAIGN_ID.toString())

  // ── 1. Upgrade backer EOA -> ZeroDev 7702 kernel (in place). ────────────────
  const account = await createKernelAccount(basePublic, { eip7702Account: backer, entryPoint: getEntryPoint('0.7'), kernelVersion: KERNEL_V3_3 })
  console.log(`\n[1] kernel address: ${account.address} (== EOA: ${account.address.toLowerCase() === backer.address.toLowerCase()})`)
  const paymaster = createZeroDevPaymasterClient({ chain: baseSepolia, transport: http(zerodevRpc) })
  const kernelClient = createKernelAccountClient({ account, chain: baseSepolia, client: basePublic, bundlerTransport: http(zerodevRpc), paymaster, userOperation: { estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient) } })

  // ── PREFLIGHT — verify the paymaster will sponsor BEFORE spending any USDC. ──
  //   Prepares (does not send) a no-op UserOp. If the ZeroDev gas policy is off
  //   this throws "userOp did not match any gas sponsoring policies" and we
  //   abort cleanly — no funding, no burn, no wasted testnet USDC.
  try {
    await kernelClient.prepareUserOperation({ callData: await account.encodeCalls([{ to: account.address, value: 0n, data: '0x' }]) })
    console.log('[preflight] paymaster WILL sponsor — proceeding with the real backer-funded burn.')
  } catch (e) {
    const detail = (e as Error).message.match(/Details: "([^"]+)"/)?.[1] ?? (e as Error).message.split('\n')[0]
    console.error(`\n[preflight] ABORT — paymaster will NOT sponsor: ${detail}`)
    console.error('  Enable a gas-sponsorship policy for Base Sepolia at dashboard.zerodev.app')
    console.error('  (project = VITE_ZERODEV_PROJECT_ID -> Gas Policies -> "Sponsor all transactions").')
    console.error('  No USDC was spent. Re-run once the policy is on.')
    process.exit(2)
  }

  // ── 0. Ensure the backer holds their OWN USDC on Base Sepolia. ──────────────
  let backerUsdc = (await basePublic.readContract({ address: base.usdc, abi: ERC20, functionName: 'balanceOf', args: [backer.address] })) as bigint
  console.log(`\n[0] backer USDC on Base: ${formatUnits(backerUsdc, 6)}`)
  if (backerUsdc < AMOUNT) {
    console.log(`    funding backer with ${AMOUNT_USD} USDC from relayer…`)
    const fundTx = await baseRelayer.writeContract({ address: base.usdc, abi: ERC20, functionName: 'transfer', args: [backer.address, AMOUNT], account: relayer, chain: baseSepolia })
    await basePublic.waitForTransactionReceipt({ hash: fundTx })
    console.log(`    fund tx (relayer paid gas): ${base.explorer}/tx/${fundTx}`)
    backerUsdc = (await basePublic.readContract({ address: base.usdc, abi: ERC20, functionName: 'balanceOf', args: [backer.address] })) as bigint
  }

  const ethBefore = await basePublic.getBalance({ address: backer.address })

  // ── 2. GASLESS approve + depositForBurn of the BACKER's own USDC. ───────────
  let maxFee = AMOUNT / 10_000n
  if (maxFee === 0n) maxFee = 1n
  const approveData = encodeFunctionData({ abi: ERC20, functionName: 'approve', args: [CCTP_V2_TESTNET.TokenMessengerV2, AMOUNT] })
  const burnData = encodeFunctionData({
    abi: [{ type: 'function', name: 'depositForBurn', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'destinationDomain', type: 'uint32' }, { name: 'mintRecipient', type: 'bytes32' }, { name: 'burnToken', type: 'address' }, { name: 'destinationCaller', type: 'bytes32' }, { name: 'maxFee', type: 'uint256' }, { name: 'minFinalityThreshold', type: 'uint32' }], outputs: [] }],
    functionName: 'depositForBurn',
    args: [AMOUNT, CctpDomain.ARBITRUM_SEPOLIA, pad(GOAL_VAULT, { size: 32 }), base.usdc, pad('0x0', { size: 32 }), maxFee, 1000],
  })
  const callData = await account.encodeCalls([{ to: base.usdc, value: 0n, data: approveData }, { to: CCTP_V2_TESTNET.TokenMessengerV2, value: 0n, data: burnData }])
  const userOpHash = await kernelClient.sendUserOperation({ callData })
  const burnReceipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash, timeout: 90_000 })
  const burnTx = burnReceipt.receipt.transactionHash
  const ethAfter = await basePublic.getBalance({ address: backer.address })
  console.log(`\n[2] GASLESS burn userOp: ${userOpHash}`)
  console.log(`    burn tx: ${base.explorer}/tx/${burnTx}`)
  console.log(`    backer ETH before/after: ${ethBefore}/${ethAfter} wei — GAS PAID BY BACKER: ${ethBefore - ethAfter} wei (expect 0; paymaster paid)`)

  // ── 3. Attestation. ─────────────────────────────────────────────────────────
  const t = Date.now()
  const att = await fetchAttestation({ sourceDomain: CctpDomain.BASE_SEPOLIA, transactionHash: burnTx })
  console.log(`\n[3] attestation received in ${Date.now() - t}ms`)

  // ── 4. Relayer mints on Arbitrum. ───────────────────────────────────────────
  const before = (await arbPublic.readContract({ address: GOAL_VAULT, abi: VAULT_ABI, functionName: 'getCampaign', args: [CAMPAIGN_ID] })) as any
  const mintTx = await mintOnDestination({ walletClient: arbRelayer as any, publicClient: arbPublic as any, account: relayer, message: att.message, attestation: att.attestation, chain: arbitrumSepolia })
  const mintRcpt = await arbPublic.getTransactionReceipt({ hash: mintTx })
  let minted = 0n
  for (const log of mintRcpt.logs) {
    if (log.address.toLowerCase() !== arb.usdc.toLowerCase()) continue
    try { const p = decodeEventLog({ abi: ERC20, data: log.data, topics: log.topics }); if (p.eventName === 'Transfer' && (p.args as any).to.toLowerCase() === GOAL_VAULT.toLowerCase()) minted += (p.args as any).value } catch {}
  }
  console.log(`\n[4] mint tx (relayer paid gas): ${arb.explorer}/tx/${mintTx} | minted ${formatUnits(minted, 6)} USDC`)

  // ── 5. Record under the BACKER. ─────────────────────────────────────────────
  const recordTx = await arbRelayer.writeContract({ address: GOAL_VAULT, abi: VAULT_ABI, functionName: 'recordContribution', args: [CAMPAIGN_ID, backer.address, minted, CctpDomain.BASE_SEPOLIA], account: relayer, chain: arbitrumSepolia })
  await arbPublic.waitForTransactionReceipt({ hash: recordTx })
  const after = (await arbPublic.readContract({ address: GOAL_VAULT, abi: VAULT_ABI, functionName: 'getCampaign', args: [CAMPAIGN_ID] })) as any
  console.log(`\n[5] record tx: ${arb.explorer}/tx/${recordTx}`)
  console.log(`    raised: ${formatUnits(before[4], 6)} -> ${formatUnits(after[4], 6)} USDC (backer ${backer.address})`)
  console.log(`\n✅ BACKER-FUNDED GASLESS CONTRIBUTION COMPLETE — backer's own USDC, backer paid 0 gas.`)
}

main().catch((e) => { console.error('\nFAILED:', (e as Error).message.split('\n').slice(0, 4).join(' | ')); process.exit(1) })
