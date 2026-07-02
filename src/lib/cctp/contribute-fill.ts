/**
 * Rally · REAL CCTP v2 contribution fill (SERVER-ONLY)
 * ---------------------------------------------------------------------------
 * This is the money moment, for real. Given a backer address (a Magic email
 * wallet) and a small USD amount, it performs a genuine Circle CCTP v2
 * cross-chain USDC transfer that lands in the deployed GoalVault and raises the
 * live campaign bar on-chain:
 *
 *   Base Sepolia (domain 6)  --burn-->  Iris attestation  --mint-->  Arbitrum
 *   Sepolia (domain 3) GoalVault  -->  recordContribution(campaignId, backer,
 *   attestedAmount, sourceDomain=6)
 *
 * It is the SAME proven path as scripts/spike-cctp-fill.ts, refactored into a
 * reusable function that the TanStack Start server function calls.
 *
 * ── HONEST DEMO PATTERN ─────────────────────────────────────────────────────
 * A freshly-minted Magic email wallet holds ZERO testnet USDC, so it can't burn
 * anything itself. For the demo the FUNDED Rally relayer key (server-side, never
 * shipped to the client) performs the burn on Base Sepolia and the mint+record
 * on Arbitrum Sepolia, but the contribution is RECORDED on-chain under the real
 * backer's Magic address with sourceDomain=6. So the cross-chain USDC move is
 * 100% real and verifiable on-chain; the relayer just fronts the source funds.
 * In production each backer would burn their own USDC (gasless via ZeroDev 7702).
 *
 * SERVER-ONLY: reads the relayer private key from the environment / the local
 * ~/.rally-keys deployer file. Never import this from client code — it is only
 * ever reached through the createServerFn handler in ../contribute.server.ts.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  formatUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia, baseSepolia } from 'viem/chains'

import {
  burnOnSource,
  fetchAttestation,
  mintOnDestination,
  getBurnFee,
  usdc,
} from '#/lib/cctp/cctp'
import { EVM_CHAINS, CctpDomain } from '#/lib/cctp/addresses'

// The one deployed GoalVault + its live demo campaign (Arbitrum Sepolia).
// Mirrors deployments/arbitrum-sepolia.json + src/lib/campaign.ts.
export const GOAL_VAULT: Address = '0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4'
const DEFAULT_CAMPAIGN_ID = 1n

// Guardrail: this is TESTNET with a small, finite USDC treasury (~15 USDC on
// Base Sepolia). Every "Chip in" is a REAL burn — clamp hard so a fat-fingered
// tier or a hostile client can never drain the relayer. Default a $1 fill.
const DEFAULT_AMOUNT_USD = 1
const MAX_AMOUNT_USD = 5
const MIN_AMOUNT_USD = 0.1

export interface FillContributionInput {
  /** The backer's Magic email-wallet address — recorded on-chain as the funder. */
  backer: Address
  /** How much USDC to move. Clamped to [0.1, 5]; defaults to 1. */
  amountUsd?: number
  /** Override the target campaign (defaults to the live campaign #1). */
  campaignId?: number
}

export interface FillContributionResult {
  campaignId: string
  backer: Address
  /** Actual USDC minted into the vault (burn amount minus the CCTP fee). */
  movedUsd: number
  burnTx: Hex
  mintTx: Hex
  recordTx: Hex
  raisedBeforeUsd: number
  raisedAfterUsd: number
  attestationLatencyMs: number
  sourceDomain: number
  explorers: {
    burn: string
    mint: string
    record: string
  }
}

const GOAL_VAULT_ABI = [
  {
    type: 'function',
    name: 'recordContribution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'campaignId', type: 'uint256' },
      { name: 'backer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'sourceDomain', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCampaign',
    stateMutability: 'view',
    inputs: [{ name: 'campaignId', type: 'uint256' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'beneficiary', type: 'address' },
      { name: 'goal', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'raised', type: 'uint256' },
      { name: 'withdrawn', type: 'bool' },
      { name: 'contributionCount', type: 'uint32' },
    ],
  },
] as const

const ERC20 = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

/** Read the funded relayer key from env, else the local ~/.rally-keys deployer file. */
async function loadRelayerKey(): Promise<Hex> {
  const fromEnv = (process.env.RELAYER_KEY ?? process.env.BACKER_KEY) as Hex | undefined
  if (fromEnv) return fromEnv
  const { readFileSync } = await import('node:fs')
  const { homedir } = await import('node:os')
  const raw = readFileSync(`${homedir()}/.rally-keys/deployer.json`, 'utf8')
  return JSON.parse(raw)[0].private_key as Hex
}

const isHexAddress = (a: string): a is Address => /^0x[0-9a-fA-F]{40}$/.test(a)

/**
 * Perform ONE real CCTP v2 contribution into the GoalVault. Throws on any
 * failure (the caller surfaces a friendly message). Safe-by-construction: it
 * refuses to burn if the campaign is already withdrawn or past deadline, so an
 * irreversible burn can never strand funds.
 */
export async function fillContribution(
  input: FillContributionInput,
): Promise<FillContributionResult> {
  if (!isHexAddress(input.backer)) {
    throw new Error('invalid backer address')
  }
  const backerAddr = input.backer as Address

  const amountUsd = Math.min(
    MAX_AMOUNT_USD,
    Math.max(MIN_AMOUNT_USD, input.amountUsd ?? DEFAULT_AMOUNT_USD),
  )
  const AMOUNT = usdc(amountUsd.toString())
  const campaignId = BigInt(input.campaignId ?? Number(DEFAULT_CAMPAIGN_ID))

  const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
  const rpc = (sub: string, fallback: string) =>
    alchemy ? `https://${sub}.g.alchemy.com/v2/${alchemy}` : fallback

  const relayerPk = await loadRelayerKey()
  const relayer = privateKeyToAccount(relayerPk)

  const base = EVM_CHAINS.baseSepolia // source (domain 6)
  const arb = EVM_CHAINS.arbitrumSepolia // dest   (domain 3)

  const basePublic = createPublicClient({
    chain: baseSepolia,
    transport: http(rpc('base-sepolia', 'https://sepolia.base.org')),
  })
  const baseWallet = createWalletClient({
    account: relayer,
    chain: baseSepolia,
    transport: http(rpc('base-sepolia', 'https://sepolia.base.org')),
  })
  const arbPublic = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')),
  })
  const arbWallet = createWalletClient({
    account: relayer,
    chain: arbitrumSepolia,
    transport: http(rpc('arb-sepolia', 'https://sepolia-rollup.arbitrum.io/rpc')),
  })

  const readCampaign = () =>
    arbPublic.readContract({
      address: GOAL_VAULT,
      abi: GOAL_VAULT_ABI,
      functionName: 'getCampaign',
      args: [campaignId],
    }) as Promise<readonly [Address, Address, bigint, bigint, bigint, boolean, number]>

  // SAFETY — verify the campaign can still be credited BEFORE the irreversible
  // burn. If it's withdrawn or past deadline, bail out now while bailing is free.
  const before = await readCampaign()
  const raisedBefore = before[4]
  const deadline = before[3]
  const withdrawn = before[5]
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  if (before[2] === 0n) throw new Error(`campaign #${campaignId} does not exist`)
  if (withdrawn) throw new Error(`campaign #${campaignId} already withdrawn — refusing to burn`)
  if (nowSec >= deadline) throw new Error(`campaign #${campaignId} past deadline — refusing to burn`)

  // Fast-transfer maxFee: pick the FAST fee row (finalityThreshold 1000).
  let maxFee = 0n
  try {
    const fees = (await getBurnFee(CctpDomain.BASE_SEPOLIA, CctpDomain.ARBITRUM_SEPOLIA)) as any
    const rows: any[] = Array.isArray(fees) ? fees : [fees]
    const fastRow = rows.find((r) => Number(r?.finalityThreshold) === 1000)
    const bps = Number(fastRow?.minimumFee ?? 1)
    maxFee = (AMOUNT * BigInt(Math.ceil(bps)) + 9_999n) / 10_000n
    if (maxFee === 0n) maxFee = 1n
  } catch {
    maxFee = AMOUNT / 100n // 1% safety cap
  }

  // 1. BURN on Base Sepolia (relayer fronts the source USDC — see file header).
  const burn = await burnOnSource({
    walletClient: baseWallet as any,
    publicClient: basePublic as any,
    account: relayer,
    sourceChain: base,
    amount: AMOUNT,
    destinationDomain: CctpDomain.ARBITRUM_SEPOLIA,
    mintRecipient: GOAL_VAULT,
    transferType: 'fast',
    maxFee,
    chain: baseSepolia,
  })

  // 2. Poll Circle Iris for the attestation (measure latency).
  const tAtt = Date.now()
  const att = await fetchAttestation({
    sourceDomain: CctpDomain.BASE_SEPOLIA,
    transactionHash: burn.transactionHash,
  })
  const attestationLatencyMs = Date.now() - tAtt

  // 3. MINT on Arbitrum Sepolia (relayer submits receiveMessage → USDC to vault).
  const vaultBefore = (await arbPublic.readContract({
    address: arb.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [GOAL_VAULT],
  })) as bigint
  const mintTx = await mintOnDestination({
    walletClient: arbWallet as any,
    publicClient: arbPublic as any,
    account: relayer,
    message: att.message,
    attestation: att.attestation,
    chain: arbitrumSepolia,
  })

  // Attribute the EXACT minted amount from the USDC Transfer(->vault) event in
  // the mint receipt (source of truth), not a balance delta.
  const mintRcpt = await arbPublic.getTransactionReceipt({ hash: mintTx })
  let attributed = 0n
  for (const log of mintRcpt.logs) {
    if (log.address.toLowerCase() !== arb.usdc.toLowerCase()) continue
    try {
      const p = decodeEventLog({ abi: ERC20, data: log.data, topics: log.topics })
      if (
        p.eventName === 'Transfer' &&
        ((p.args as any).to as string).toLowerCase() === GOAL_VAULT.toLowerCase()
      ) {
        attributed += (p.args as any).value as bigint
      }
    } catch {
      /* not the mint transfer — ignore */
    }
  }
  if (attributed === 0n) {
    throw new Error('could not determine minted amount: no USDC Transfer(->vault) in mint tx')
  }
  const vaultAfter = (await arbPublic.readContract({
    address: arb.usdc,
    abi: ERC20,
    functionName: 'balanceOf',
    args: [GOAL_VAULT],
  })) as bigint
  if (vaultAfter - vaultBefore < attributed) {
    throw new Error('vault balance rose less than the mint event credited — aborting attribution')
  }

  // 4. RECORD the contribution under the REAL backer address (raises the bar).
  const recordTx = await arbWallet.writeContract({
    address: GOAL_VAULT,
    abi: GOAL_VAULT_ABI,
    functionName: 'recordContribution',
    args: [campaignId, backerAddr, attributed, CctpDomain.BASE_SEPOLIA],
    account: relayer,
    chain: arbitrumSepolia,
  })
  await arbPublic.waitForTransactionReceipt({ hash: recordTx })

  const after = await readCampaign()
  const raisedAfter = after[4]

  return {
    campaignId: campaignId.toString(),
    backer: backerAddr,
    movedUsd: Number(formatUnits(attributed, 6)),
    burnTx: burn.transactionHash,
    mintTx,
    recordTx,
    raisedBeforeUsd: Number(formatUnits(raisedBefore, 6)),
    raisedAfterUsd: Number(formatUnits(raisedAfter, 6)),
    attestationLatencyMs,
    sourceDomain: CctpDomain.BASE_SEPOLIA,
    explorers: {
      burn: `${base.explorer}/tx/${burn.transactionHash}`,
      mint: `${arb.explorer}/tx/${mintTx}`,
      record: `${arb.explorer}/tx/${recordTx}`,
    },
  }
}
