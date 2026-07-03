/**
 * Rally · Pools — relayer-side GoalVault actions (SERVER-ONLY)
 * ---------------------------------------------------------------------------
 * The Pools twin of lib/circle-relayer.ts. The funded Rally relayer key
 * (server-side, never shipped to the client) opens REAL campaigns on the
 * deployed GoalVault so "Start the rally" mints a real on-chain fund:
 *
 *   createCampaign(goal, deadline, beneficiary) → CampaignCreated(campaignId)
 *
 * The beneficiary is the creator's own Magic email wallet — the money is
 * theirs on success; the relayer only pays the (testnet) gas to open it.
 *
 * Titles/organizers are not stored on-chain (the contract holds only money +
 * math), so this module also owns the tiny off-chain metadata store that maps
 * campaignId → { title, organizer }. Same honesty rule as the KNOWN table in
 * lib/campaign.ts: the numbers are live; the label is ours.
 *
 * SERVER-ONLY: loads the relayer private key. Only ever reached through the
 * createServerFn handlers in ./campaign-actions.ts (dynamic import).
 */
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arbitrumSepolia } from 'viem/chains'

import { loadRelayerKey } from '#/lib/cctp/contribute-fill'
import { EVM_CHAINS } from '#/lib/cctp/addresses'
import { GOAL_VAULT } from '#/lib/campaign'

const EXPLORER = EVM_CHAINS.arbitrumSepolia.explorer
const USDC_DECIMALS = 6

// Guardrails — opening a campaign only costs gas, but keep the shapes sane.
const MIN_GOAL_USD = 1
const MAX_GOAL_USD = 100_000
const MIN_RUN_SECONDS = 60 * 60 // 1 hour
const MAX_RUN_SECONDS = 60 * 24 * 60 * 60 // 60 days

const GOAL_VAULT_WRITE_ABI = [
  {
    type: 'function',
    name: 'createCampaign',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'goal', type: 'uint256' },
      { name: 'deadline', type: 'uint64' },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [{ name: 'campaignId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'CampaignCreated',
    inputs: [
      { name: 'campaignId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'goal', type: 'uint256', indexed: false },
      { name: 'deadline', type: 'uint64', indexed: false },
    ],
  },
] as const

async function clients() {
  const pk = await loadRelayerKey()
  const relayer = privateKeyToAccount(pk)
  const alchemy = process.env.ALCHEMY_API_KEY ?? process.env.VITE_ALCHEMY_API_KEY
  const rpcUrl = alchemy
    ? `https://arb-sepolia.g.alchemy.com/v2/${alchemy}`
    : 'https://sepolia-rollup.arbitrum.io/rpc'
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({
    account: relayer,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  })
  return { relayer, publicClient, walletClient }
}

// ── Off-chain campaign metadata (title/organizer live nowhere on-chain) ──────

export interface CampaignMeta {
  title: string
  organizer: string
  createTx?: Hex
  createdAt?: number
}

function metaFilePath(): string {
  return process.env.RALLY_META_FILE ?? ''
}

async function metaFile(): Promise<{ dir: string; file: string }> {
  const override = metaFilePath()
  if (override) {
    const { dirname } = await import('node:path')
    return { dir: dirname(override), file: override }
  }
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = join(homedir(), '.rally')
  return { dir, file: join(dir, 'campaign-meta.json') }
}

async function readMetaStore(): Promise<Record<string, CampaignMeta>> {
  try {
    const { readFileSync } = await import('node:fs')
    const { file } = await metaFile()
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, CampaignMeta>) : {}
  } catch {
    return {}
  }
}

/** Look up the human title for an on-chain campaign (null when unlabeled). */
export async function getCampaignMeta(id: string): Promise<CampaignMeta | null> {
  const store = await readMetaStore()
  const meta = store[id]
  if (!meta || typeof meta.title !== 'string' || !meta.title.trim()) return null
  return meta
}

async function writeCampaignMeta(id: string, meta: CampaignMeta): Promise<void> {
  const { mkdirSync, writeFileSync, renameSync } = await import('node:fs')
  const { dir, file } = await metaFile()
  const store = await readMetaStore()
  store[id] = meta
  mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, file)
}

// ── createCampaign ───────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  /** Human title shown on the campaign page ("Send the crew to Tokyo"). */
  title: string
  /** Warm organizer label for "{organizer} is rallying for". */
  organizer: string
  /** USDC goal. Clamped to [1, 100k]. */
  goalUsd: number
  /** Days the campaign runs. Clamped to [1h, 60d]. */
  days: number
  /** The creator's email-wallet address — paid out on success. */
  beneficiary: Address
}

export interface CreateCampaignResult {
  campaignId: string
  createTx: Hex
  goalUsd: number
  /** Epoch ms. */
  deadline: number
  beneficiary: Address
  explorer: string
}

export async function createCampaignOnchain(
  input: CreateCampaignInput,
): Promise<CreateCampaignResult> {
  const clean = (s: string) => s.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim()
  const title = clean(input.title).slice(0, 80)
  if (title.length < 2) throw new Error('give your rally a name first')
  const organizer = clean(input.organizer).slice(0, 40) || 'The crew'

  const goalUsd = Math.min(MAX_GOAL_USD, Math.max(MIN_GOAL_USD, input.goalUsd))
  const runSeconds = Math.min(
    MAX_RUN_SECONDS,
    Math.max(MIN_RUN_SECONDS, Math.floor(input.days * 24 * 60 * 60)),
  )
  const deadlineSec = Math.floor(Date.now() / 1000) + runSeconds
  const goalUnits = BigInt(Math.round(goalUsd * 10 ** USDC_DECIMALS))

  const { publicClient, walletClient } = await clients()

  const createTx = await walletClient.writeContract({
    address: GOAL_VAULT,
    abi: GOAL_VAULT_WRITE_ABI,
    functionName: 'createCampaign',
    args: [goalUnits, BigInt(deadlineSec), input.beneficiary],
  })
  const rcpt = await publicClient.waitForTransactionReceipt({ hash: createTx })

  let campaignId: bigint | null = null
  for (const log of rcpt.logs) {
    if (log.address.toLowerCase() !== GOAL_VAULT.toLowerCase()) continue
    try {
      const parsed = decodeEventLog({
        abi: GOAL_VAULT_WRITE_ABI,
        data: log.data,
        topics: log.topics,
      })
      if (parsed.eventName === 'CampaignCreated') {
        campaignId = (parsed.args as { campaignId: bigint }).campaignId
        break
      }
    } catch {
      /* other event — ignore */
    }
  }
  if (campaignId == null) throw new Error('campaign created but CampaignCreated event not found')

  const id = campaignId.toString()
  // Attach the human label. Best-effort: the campaign is real either way — an
  // unlabeled fund renders as "A live Rally fund", never a broken screen.
  try {
    await writeCampaignMeta(id, { title, organizer, createTx, createdAt: Date.now() })
  } catch {
    /* label write failed — the on-chain fund still exists */
  }

  return {
    campaignId: id,
    createTx,
    goalUsd,
    deadline: deadlineSec * 1000,
    beneficiary: input.beneficiary,
    explorer: `${EXPLORER}/tx/${createTx}`,
  }
}
