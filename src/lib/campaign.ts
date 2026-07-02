// Live campaign reads from the deployed GoalVault on Arbitrum Sepolia.
// ---------------------------------------------------------------------------
// This is the ONLY place the app talks to the chain for the detail screen. It
// reads getCampaign(id) + the ContributionRecorded event log over a public RPC
// (no key), normalizes the on-chain shape into the presentational `CampaignView`
// the components already speak, and — critically — NEVER throws at the callsite.
// If the read fails or the campaign is empty it returns `null`, and the route
// falls back to representative mock data so the screen never looks broken.

import { createPublicClient, http, parseAbiItem, type Address } from 'viem'
import {
  CHAIN_ORDER,
  type Chain,
  type ChainSegment,
  type CampaignStatus,
} from '#/design/chains'
import type { Contributor } from '#/components/ContributorFeed'

// ── Deployment (mirrors deployments/arbitrum-sepolia.json) ──────────────────
export const GOAL_VAULT: Address = '0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4'
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc'
const DEPLOY_BLOCK = 283235364n
const USDC_DECIMALS = 6

// CCTP v2 testnet domain → chain identity (matches CHAIN_META[*].domain).
const DOMAIN_TO_CHAIN: Record<number, Chain> = {
  6: 'base',
  3: 'arbitrum',
  2: 'optimism',
  5: 'solana',
}

const GET_CAMPAIGN_ABI = [
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

const CONTRIBUTION_EVENT = parseAbiItem(
  'event ContributionRecorded(uint256 indexed campaignId, address indexed backer, uint256 amount, uint32 indexed sourceDomain, uint256 newRaised, uint256 contributionIndex)',
)

/** The normalized campaign the detail screen renders (live OR mock). */
export interface CampaignView {
  id: string
  title: string
  organizer: string
  /** Whole USDC units (may be fractional). */
  raised: number
  goal: number
  /** Epoch ms. */
  deadline: number
  backerCount: number
  segments: ChainSegment[]
  contributors: Contributor[]
  status: CampaignStatus
  /** True when the numbers came off-chain; false when this is fallback mock. */
  live: boolean
  /** Short creator address for the "on-chain" provenance line (live only). */
  creator?: string
}

// Friendly, human metadata for known on-chain campaigns (title/organizer are
// not stored on-chain). Honest: the numbers are live; the label is ours.
const KNOWN: Record<string, { title: string; organizer: string }> = {
  '1': { title: 'Rally’s first live fund', organizer: 'The Rally crew' },
}

const toUsd = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

function deriveStatus(raised: number, goal: number, deadlineMs: number): CampaignStatus {
  if (goal > 0 && raised >= goal) return 'funded'
  if (Date.now() >= deadlineMs) return 'missed'
  return 'live'
}

/**
 * Read a live campaign off Arbitrum Sepolia. Resolves to a `CampaignView` on
 * success, or `null` on any failure / non-existent campaign (caller falls back
 * to mock). Bounded + defensive: the event query is best-effort — if it fails
 * we still return the core numbers with a single derived source band.
 */
export async function fetchLiveCampaign(id: string): Promise<CampaignView | null> {
  const campaignId = (() => {
    try {
      return BigInt(id)
    } catch {
      return null
    }
  })()
  if (campaignId == null || campaignId <= 0n) return null

  const client = createPublicClient({ transport: http(ARBITRUM_SEPOLIA_RPC) })

  let creator: string
  let goalRaw: bigint
  let deadlineRaw: bigint
  let raisedRaw: bigint
  let contributionCount: number
  try {
    const [c, , goal, deadline, raised, , count] = await client.readContract({
      address: GOAL_VAULT,
      abi: GET_CAMPAIGN_ABI,
      functionName: 'getCampaign',
      args: [campaignId],
    })
    creator = c
    goalRaw = goal
    deadlineRaw = deadline
    raisedRaw = raised
    contributionCount = Number(count)
  } catch {
    return null
  }

  // A non-existent campaign returns the zero-struct (creator == 0x0, goal == 0).
  if (creator === '0x0000000000000000000000000000000000000000' || goalRaw === 0n) {
    return null
  }

  const raised = toUsd(raisedRaw)
  const goal = toUsd(goalRaw)
  const deadline = Number(deadlineRaw) * 1000

  // Best-effort: pull the contribution log for per-chain bands + a named feed.
  const contributors: Contributor[] = []
  const segMap = new Map<Chain, number>()
  const backerSet = new Set<string>()
  try {
    const logs = await client.getLogs({
      address: GOAL_VAULT,
      event: CONTRIBUTION_EVENT,
      args: { campaignId },
      fromBlock: DEPLOY_BLOCK,
      toBlock: 'latest',
    })
    for (const log of logs) {
      const backer = log.args.backer as string
      const amount = toUsd(log.args.amount as bigint)
      const domain = Number(log.args.sourceDomain)
      const chain = DOMAIN_TO_CHAIN[domain] ?? 'arbitrum'
      backerSet.add(backer.toLowerCase())
      segMap.set(chain, (segMap.get(chain) ?? 0) + amount)
      contributors.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        name: shortAddr(backer),
        amount,
        chain,
        timestamp: Date.now(), // block time not fetched to keep RPC calls minimal
      })
    }
  } catch {
    // Log query failed (RPC range limit, etc.) — degrade to a single band.
  }

  // If we couldn't read events, still show the money as a Base-sourced band
  // (campaign #1's live fill originated on Base). Keeps the thermometer legible.
  const segments: ChainSegment[] =
    segMap.size > 0
      ? CHAIN_ORDER.filter((ch) => segMap.has(ch)).map((ch) => ({
          chain: ch,
          amount: segMap.get(ch)!,
        }))
      : raised > 0
        ? [{ chain: 'base', amount: raised }]
        : []

  const backerCount = backerSet.size > 0 ? backerSet.size : contributionCount
  const meta = KNOWN[id] ?? { title: 'A live Rally fund', organizer: 'On-chain' }

  return {
    id,
    title: meta.title,
    organizer: meta.organizer,
    raised,
    goal,
    deadline,
    backerCount,
    segments,
    contributors: contributors
      .sort((a, b) => b.amount - a.amount)
      .map((c, i) => ({ ...c, timestamp: Date.now() - i * 90_000 })),
    status: deriveStatus(raised, goal, deadline),
    live: true,
    creator: shortAddr(creator),
  }
}

// ── Representative fallback (never let the screen look broken) ───────────────
// Rich, human demo data in Rally's voice — used only when the live read fails
// or a campaign id is unknown, so a shared link ALWAYS lands on a real screen.
export function mockCampaign(id: string): CampaignView {
  const now = Date.now()
  return {
    id,
    title: 'Send the crew to Tokyo',
    organizer: 'Maya',
    raised: 3120,
    goal: 4000,
    deadline: now + 2 * 24 * 60 * 60 * 1000,
    backerCount: 23,
    segments: [
      { chain: 'base', amount: 1400 },
      { chain: 'arbitrum', amount: 720 },
      { chain: 'optimism', amount: 400 },
      { chain: 'solana', amount: 600 },
    ],
    contributors: [
      { id: 'a', name: 'Maya', amount: 250, chain: 'base', timestamp: now - 90_000 },
      { id: 'b', name: 'Tomás', amount: 40, chain: 'solana', timestamp: now - 240_000 },
      { id: 'c', name: 'Priya', amount: 120, chain: 'arbitrum', timestamp: now - 600_000 },
      { id: 'd', name: 'Wei', amount: 60, chain: 'optimism', timestamp: now - 1_500_000 },
    ],
    status: 'live',
    live: false,
  }
}

// ── Potluck (group-gift) preview ─────────────────────────────────────────────
// The same CampaignView shape, re-skinned festive: gift NOTES carry the feed
// (surfaced by ContributorFeed's potluck branch). Used by /c/$id?skin=potluck.
export function mockPotluckCampaign(id: string): CampaignView {
  const now = Date.now()
  return {
    id,
    title: 'Aisha’s surprise send-off',
    organizer: 'The design team',
    raised: 620,
    goal: 800,
    deadline: now + 3 * 24 * 60 * 60 * 1000,
    backerCount: 14,
    segments: [
      { chain: 'base', amount: 300 },
      { chain: 'arbitrum', amount: 140 },
      { chain: 'optimism', amount: 80 },
      { chain: 'solana', amount: 100 },
    ],
    contributors: [
      { id: 'p1', name: 'Diego', amount: 50, chain: 'base', note: 'Go get ’em in Lisbon 🇵🇹', timestamp: now - 60_000 },
      { id: 'p2', name: 'Hannah', amount: 25, chain: 'solana', note: 'We’ll miss you at standup!', timestamp: now - 320_000 },
      { id: 'p3', name: 'Marcus', amount: 40, chain: 'arbitrum', note: 'For the fancy espresso machine ☕️', timestamp: now - 900_000 },
      { id: 'p4', name: 'Yuki', amount: 30, chain: 'optimism', note: 'One more for the road ✨', timestamp: now - 1_800_000 },
    ],
    status: 'live',
    live: false,
  }
}
