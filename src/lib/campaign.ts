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
  CHAIN_META,
  CHAIN_ORDER,
  type Chain,
  type ChainSegment,
  type CampaignStatus,
} from '#/design/chains'
import type { Contributor } from '#/components/ContributorFeed'
import { getCampaignMetaServerFn } from '#/lib/campaign-actions'

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
// `knownBackers` names the demo crew's wallets in the live feed — mirroring
// how Circles names its seats. Keys are LOWERCASE addresses.
interface CampaignMetaView {
  title: string
  organizer: string
  knownBackers?: Record<string, string>
}

const KNOWN: Record<string, CampaignMetaView> = {
  '1': {
    title: 'Rally’s first live fund',
    organizer: 'The Rally crew',
    knownBackers: {
      // The three wallets that filled campaign #1 live (see the on-chain log).
      '0x6a63bdd548715b4dac5e2ee62a6d4085c2d393b1': 'Sam',
      '0xf0fe5731ef41e101f1fd37cf481bb2bb8117d74f': 'Maya',
      '0xe8723d9b24a1a1d59eff5dd4e794c39b5c39ce89': 'Tom',
    },
  },
  // Created live through the product's own /create flow (tx 0xd554bd41…83fc) —
  // pinned here because the off-chain title store is container-ephemeral and
  // this campaign is cited in the submission docs as proof the rail is real.
  '2': {
    title: 'Coffee for the launch crew',
    organizer: 'The launch crew',
  },
}

const toUsd = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/**
 * A backer's display name is ALWAYS human — a known crew name when we have
 * one, else a warm anonymous label. Never a hex address on the money screen.
 * The name does NOT repeat the chain: the feed row's chain badge is the one
 * carrier of that identity ("A friend · from Base" next to a BASE chip said
 * the same thing twice).
 */
function backerName(meta: CampaignMetaView, addr: string, _chain: Chain): string {
  return meta.knownBackers?.[addr.toLowerCase()] ?? 'A friend'
}

function deriveStatus(raised: number, goal: number, deadlineMs: number): CampaignStatus {
  if (goal > 0 && raised >= goal) return 'funded'
  if (Date.now() >= deadlineMs) return 'missed'
  return 'live'
}

/** How a campaign load resolved — the routes branch on this, honestly. */
export type CampaignLoad =
  | { kind: 'view'; view: CampaignView }
  | { kind: 'not-found'; id: string }

/**
 * Read a live campaign off Arbitrum Sepolia. Resolves to a `CampaignView` on
 * success, `null` when the campaign definitively does not exist, and THROWS on
 * a transport/RPC failure (so callers can tell "gone" from "flaky network").
 * Bounded + defensive: the event query is best-effort — if it fails we still
 * return the core numbers with a single derived source band.
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

  // Modest timeout: this read sits in route loaders (SSR included) — a hung
  // public RPC should degrade to the fallback path, not stall first paint.
  const client = createPublicClient({
    transport: http(ARBITRUM_SEPOLIA_RPC, { timeout: 4_000, retryCount: 1 }),
  })

  // Throws on transport failure — deliberately NOT caught here.
  const [creator, , goalRaw, deadlineRaw, raisedRaw, , count] = await client.readContract({
    address: GOAL_VAULT,
    abi: GET_CAMPAIGN_ABI,
    functionName: 'getCampaign',
    args: [campaignId],
  })
  const contributionCount = Number(count)

  // A non-existent campaign returns the zero-struct (creator == 0x0, goal == 0).
  if (creator === '0x0000000000000000000000000000000000000000' || goalRaw === 0n) {
    return null
  }

  const raised = toUsd(raisedRaw)
  const goal = toUsd(goalRaw)
  const deadline = Number(deadlineRaw) * 1000

  // Resolve the human label: the KNOWN table first, then the off-chain title
  // store (campaigns born in /create), then an honest generic.
  const meta: CampaignMetaView =
    KNOWN[id] ??
    (await getCampaignMetaServerFn({ data: { id } }).catch(() => null)) ?? {
      title: 'A live Rally fund',
      organizer: 'On-chain',
    }

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

    // REAL ages for real money: resolve block timestamps (one bounded, parallel,
    // best-effort pass over the unique blocks). A row whose block can't be read
    // simply shows no age — the feed never invents a time for an on-chain fact.
    const blockNumbers = [...new Set(logs.map((l) => l.blockNumber).filter((b) => b != null))]
    const blockTimes = new Map<bigint, number>()
    await Promise.all(
      blockNumbers.slice(0, 24).map(async (bn) => {
        try {
          const block = await client.getBlock({ blockNumber: bn! })
          blockTimes.set(bn!, Number(block.timestamp) * 1000)
        } catch {
          // best-effort — the row renders without an age
        }
      }),
    )

    for (const log of logs) {
      const backer = log.args.backer as string
      const amount = toUsd(log.args.amount as bigint)
      const domain = Number(log.args.sourceDomain)
      const chain = DOMAIN_TO_CHAIN[domain] ?? 'arbitrum'
      backerSet.add(backer.toLowerCase())
      segMap.set(chain, (segMap.get(chain) ?? 0) + amount)
      contributors.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        name: backerName(meta, backer, chain),
        amount,
        chain,
        timestamp: log.blockNumber != null ? blockTimes.get(log.blockNumber) : undefined,
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

  return {
    id,
    title: meta.title,
    organizer: meta.organizer,
    raised,
    goal,
    deadline,
    backerCount,
    segments,
    // Newest money first — by the REAL block time. Rows without a resolvable
    // time sink to the end in log order; nothing is ever back-dated for looks.
    contributors: contributors.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    status: deriveStatus(raised, goal, deadline),
    live: true,
    creator: shortAddr(creator),
  }
}

/**
 * Load a campaign for a route, with the honest fallback policy:
 *   · live read succeeds            → the real numbers
 *   · campaign provably absent      → not-found (the route shows a real 404)
 *   · transport failure, KNOWN id   → representative mock, clearly non-live
 *   · transport failure, unknown id → not-found (never fake a stranger's fund)
 */
export async function loadCampaign(id: string): Promise<CampaignLoad> {
  try {
    const live = await fetchLiveCampaign(id)
    if (live) return { kind: 'view', view: live }
    return { kind: 'not-found', id }
  } catch {
    if (KNOWN[id]) return { kind: 'view', view: mockCampaign(id) }
    return { kind: 'not-found', id }
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
      { id: 'b', name: 'Tom', amount: 40, chain: 'solana', timestamp: now - 240_000 },
      { id: 'c', name: 'Emma', amount: 120, chain: 'arbitrum', timestamp: now - 600_000 },
      { id: 'd', name: 'Chris', amount: 60, chain: 'optimism', timestamp: now - 1_500_000 },
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
    title: 'Kate’s surprise send-off',
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
      { id: 'p4', name: 'Jordan', amount: 30, chain: 'optimism', note: 'One more for the road ✨', timestamp: now - 1_800_000 },
    ],
    status: 'live',
    live: false,
  }
}
