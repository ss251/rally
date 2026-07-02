// Live Circle reads from the deployed RotatingVault on Arbitrum Sepolia.
// ---------------------------------------------------------------------------
// The Circles twin of src/lib/campaign.ts. This is the ONLY place the app talks
// to the chain for the circle detail screen: it reads getCircle + members +
// per-round funding over a public RPC (no key), normalizes the on-chain shape
// into the presentational `CircleView` the components speak, and NEVER throws
// at the callsite. If the read fails or the circle doesn't exist it returns
// `null` and the route falls back to representative mock data.

import { createPublicClient, http, type Address } from 'viem'
import { arbitrumSepolia } from 'viem/chains'

// ── Deployment (RotatingVault, deployed + Arbiscan-verified 2026-07-03) ─────
export const ROTATING_VAULT: Address = '0xdd9b3e5F407B99e2C2827695608741B328F97838'
export const ROTATING_VAULT_SHORT = '0xdd9b…7838'
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc'
const USDC_DECIMALS = 6

// ── EIP-712 invite (must mirror RotatingVault.sol exactly) ──────────────────
// Domain: name "RotatingVault", version "1", chainId 421614, the vault address.
// Struct: Invite(uint256 circleId,address member,uint256 payoutIndex,uint256 nonce)
export const INVITE_DOMAIN = {
  name: 'RotatingVault',
  version: '1',
  chainId: arbitrumSepolia.id,
  verifyingContract: ROTATING_VAULT,
} as const

export const INVITE_TYPES = {
  Invite: [
    { name: 'circleId', type: 'uint256' },
    { name: 'member', type: 'address' },
    { name: 'payoutIndex', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

// ── ABI (views + writes; single source of truth for client and server) ──────
export const ROTATING_VAULT_ABI = [
  {
    type: 'function',
    name: 'getCircle',
    stateMutability: 'view',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [
      {
        name: 'circle',
        type: 'tuple',
        components: [
          { name: 'organizer', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'memberTarget', type: 'uint16' },
          { name: 'joined', type: 'uint16' },
          { name: 'claimedCount', type: 'uint16' },
          { name: 'token', type: 'address' },
          { name: 'startTime', type: 'uint64' },
          { name: 'roundDuration', type: 'uint32' },
          { name: 'depositAmount', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'circleStatus',
    stateMutability: 'view',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'getMembers',
    stateMutability: 'view',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'roundFundedCount',
    stateMutability: 'view',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'round', type: 'uint256' },
    ],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'potClaimed',
    stateMutability: 'view',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'round', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'roundDeposits',
    stateMutability: 'view',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'round', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'refundableAmount',
    stateMutability: 'view',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isRoundFunded',
    stateMutability: 'view',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'round', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'nextCircleId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // ── writes ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createCircle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'roundDuration', type: 'uint32' },
      { name: 'memberTarget', type: 'uint16' },
    ],
    outputs: [{ name: 'circleId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'redeemInvite',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'member', type: 'address' },
      { name: 'payoutIndex', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'start',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'depositFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'circleId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refundFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'circleId', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'CircleCreated',
    inputs: [
      { name: 'circleId', type: 'uint256', indexed: true },
      { name: 'organizer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'depositAmount', type: 'uint256', indexed: false },
      { name: 'roundDuration', type: 'uint32', indexed: false },
      { name: 'memberTarget', type: 'uint16', indexed: false },
    ],
  },
] as const

// ── Presentational shapes ────────────────────────────────────────────────────

/** IRotatingVault.Status, resolved (circleStatus already folds lazy-Broken in). */
export type CircleStatusView = 'filling' | 'active' | 'broken' | 'completed' | 'cancelled'

export interface CircleMemberView {
  /** 0x0 while the seat is still open (Filling). */
  address: string
  /** Friendly label ("Maya") or short address; "Open seat" while unfilled. */
  name: string
  /** payoutIndex — seat i takes round i's pot. */
  seat: number
  /** Has this member funded the display round? */
  fundedThisRound: boolean
  /** Is this member the payee of the display round? */
  isPayee: boolean
  /** USDC owed back if the circle is broken (0 otherwise). */
  refundableUsd: number
}

export type RoundState = 'claimed' | 'ready' | 'current' | 'upcoming' | 'failed'

export interface CircleRoundView {
  index: number
  payeeName: string
  payeeAddress: string
  state: RoundState
  fundedCount: number
}

/** The normalized circle the screens render (live OR mock). */
export interface CircleView {
  id: string
  title: string
  organizer: string
  status: CircleStatusView
  /** Per-member per-round contribution, whole USDC units. */
  depositUsd: number
  /** The rotating pot: depositUsd × memberTarget. */
  potUsd: number
  memberTarget: number
  joined: number
  members: CircleMemberView[]
  rounds: CircleRoundView[]
  /** Display round (clamped to the last round); null before start. */
  round: number | null
  /** Epoch ms the display round's window closes; null before start. */
  roundClosesAt: number | null
  /** Members who have funded the display round. */
  fundedCount: number
  /** True when the numbers came off-chain; false for the mock fallback. */
  live: boolean
}

// Friendly, human metadata for known on-chain circles (titles/names are not
// stored on-chain). Honest: the numbers are live; the labels are ours.
const KNOWN: Record<string, { title: string; organizer: string; seatNames: string[] }> = {
  '1': {
    title: 'The crew’s first circle',
    organizer: 'The Rally crew',
    seatNames: ['Sam', 'Maya', 'Tomás', 'Priya'],
  },
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
const toUsd = (raw: bigint) => Number(raw) / 10 ** USDC_DECIMALS
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const STATUS_MAP: Record<number, CircleStatusView | null> = {
  0: null, // None — treat as not found
  1: 'filling',
  2: 'active',
  3: 'broken',
  4: 'completed',
  5: 'cancelled',
}

/** Build the shareable invite URL for a seat (client-side; SSR-safe fallback). */
export function inviteLinkFor(circleId: string, seat: number, title?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const t = title ? `&t=${encodeURIComponent(title)}` : ''
  return `${origin}/invite?c=${circleId}&i=${seat}${t}`
}

/**
 * Read a live circle off Arbitrum Sepolia. Resolves to a `CircleView` on
 * success, `null` on any failure / non-existent circle (caller falls back to
 * mock). Reads are batched with multicall so the whole screen costs ~2 RPC
 * round-trips regardless of member count.
 */
export async function fetchLiveCircle(id: string, titleHint?: string): Promise<CircleView | null> {
  const circleId = (() => {
    try {
      return BigInt(id)
    } catch {
      return null
    }
  })()
  if (circleId == null || circleId <= 0n) return null

  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(ARBITRUM_SEPOLIA_RPC),
  })
  const vault = { address: ROTATING_VAULT, abi: ROTATING_VAULT_ABI } as const

  try {
    const [circle, statusRaw, membersRaw] = await client.multicall({
      contracts: [
        { ...vault, functionName: 'getCircle', args: [circleId] },
        { ...vault, functionName: 'circleStatus', args: [circleId] },
        { ...vault, functionName: 'getMembers', args: [circleId] },
      ],
      allowFailure: false,
    })

    const status = STATUS_MAP[Number(statusRaw)]
    if (!status) return null

    const n = Number(circle.memberTarget)
    const members = [...membersRaw]
    const depositUsd = toUsd(circle.depositAmount)
    const potUsd = toUsd(circle.depositAmount * BigInt(n))
    const started = Number(circle.startTime) > 0
    const duration = Number(circle.roundDuration)

    // Round math is derived locally (block time granularity is hours/days).
    const nowSec = Math.floor(Date.now() / 1000)
    const elapsed = started ? Math.floor((nowSec - Number(circle.startTime)) / duration) : 0
    const displayRound = started ? Math.min(elapsed, n - 1) : null
    const roundClosesAt =
      started && displayRound != null
        ? (Number(circle.startTime) + (displayRound + 1) * duration) * 1000
        : null

    // Batch 2: per-round funding/claims + per-member deposits for the display
    // round (+ refundables when broken).
    const roundCalls = Array.from({ length: n }, (_, r) => [
      { ...vault, functionName: 'roundFundedCount', args: [circleId, BigInt(r)] } as const,
      { ...vault, functionName: 'potClaimed', args: [circleId, BigInt(r)] } as const,
    ]).flat()
    const depositCalls =
      displayRound != null
        ? members.map(
            (m) =>
              ({
                ...vault,
                functionName: 'roundDeposits',
                args: [circleId, BigInt(displayRound), m === ZERO_ADDR ? ROTATING_VAULT : m],
              }) as const,
          )
        : []
    const refundCalls =
      status === 'broken'
        ? members.map(
            (m) =>
              ({
                ...vault,
                functionName: 'refundableAmount',
                args: [circleId, m === ZERO_ADDR ? ROTATING_VAULT : m],
              }) as const,
          )
        : []

    const batch = await client.multicall({
      contracts: [...roundCalls, ...depositCalls, ...refundCalls],
      allowFailure: true,
    })

    const fundedByRound: number[] = []
    const claimedByRound: boolean[] = []
    for (let r = 0; r < n; r++) {
      const f = batch[r * 2]
      const c = batch[r * 2 + 1]
      fundedByRound.push(f.status === 'success' ? Number(f.result) : 0)
      claimedByRound.push(c.status === 'success' ? Boolean(c.result) : false)
    }
    const depositResults = batch.slice(roundCalls.length, roundCalls.length + depositCalls.length)
    const refundResults = batch.slice(roundCalls.length + depositCalls.length)

    const meta = KNOWN[id] ?? {
      title: titleHint || 'A live circle',
      organizer: 'On-chain',
      seatNames: [],
    }
    const nameFor = (addr: string, seat: number) =>
      addr === ZERO_ADDR
        ? 'Open seat'
        : (meta.seatNames[seat] ?? shortAddr(addr))

    const memberViews: CircleMemberView[] = members.map((addr, i) => {
      const dep = depositResults[i]
      const ref = refundResults[i]
      return {
        address: addr,
        name: nameFor(addr, i),
        seat: i,
        fundedThisRound:
          addr !== ZERO_ADDR && dep?.status === 'success' && (dep.result as bigint) > 0n,
        isPayee: status === 'active' && displayRound === i,
        refundableUsd:
          addr !== ZERO_ADDR && ref?.status === 'success' ? toUsd(ref.result as bigint) : 0,
      }
    })

    const rounds: CircleRoundView[] = members.map((addr, r) => {
      let state: RoundState = 'upcoming'
      if (claimedByRound[r]) state = 'claimed'
      else if (fundedByRound[r] >= n && n > 0) state = 'ready'
      else if (status === 'broken' && displayRound != null && r <= Math.min(elapsed, n - 1))
        state = 'failed'
      else if (status === 'active' && displayRound === r && elapsed < n) state = 'current'
      return {
        index: r,
        payeeName: nameFor(addr, r),
        payeeAddress: addr,
        state,
        fundedCount: fundedByRound[r],
      }
    })

    return {
      id,
      title: meta.title,
      organizer: meta.organizer,
      status,
      depositUsd,
      potUsd,
      memberTarget: n,
      joined: Number(circle.joined),
      members: memberViews,
      rounds,
      round: status === 'filling' ? null : displayRound,
      roundClosesAt: status === 'filling' ? null : roundClosesAt,
      fundedCount: displayRound != null ? fundedByRound[displayRound] : 0,
      live: true,
    }
  } catch {
    return null
  }
}

// ── Representative fallback (never let the screen look broken) ───────────────
// A warm, human demo circle in Rally's voice — the diaspora chit fund. Used by
// the /circles landing hero and whenever a live read fails.
export function mockCircle(id = 'demo'): CircleView {
  const now = Date.now()
  const seatNames = ['Priya', 'Ravi', 'Amma', 'Meena', 'Arjun']
  const fundedSeats = new Set([0, 1, 3]) // Priya, Ravi, Meena are in this round
  const members: CircleMemberView[] = seatNames.map((name, i) => ({
    address: `0x00000000000000000000000000000000000000a${i}`,
    name,
    seat: i,
    fundedThisRound: fundedSeats.has(i),
    isPayee: i === 2,
    refundableUsd: 0,
  }))
  const rounds: CircleRoundView[] = seatNames.map((name, i) => ({
    index: i,
    payeeName: name,
    payeeAddress: members[i].address,
    state: i < 2 ? 'claimed' : i === 2 ? 'current' : 'upcoming',
    fundedCount: i < 2 ? 5 : i === 2 ? 3 : 0,
  }))
  return {
    id,
    title: 'The cousins’ chit fund',
    organizer: 'Priya',
    status: 'active',
    depositUsd: 50,
    potUsd: 250,
    memberTarget: 5,
    joined: 5,
    members,
    rounds,
    round: 2,
    roundClosesAt: now + 9 * 24 * 60 * 60 * 1000,
    fundedCount: 3,
    live: false,
  }
}

/** Map a raw contract revert into the human sentence the sheet shows. */
export function friendlyCircleError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const table: [string, string][] = [
    ['AlreadyDeposited', 'You’re already in this round.'],
    ['NotMember', 'This email isn’t in the circle yet — ask for an invite.'],
    ['RoundNotFunded', 'The round isn’t full yet — the pot unlocks when everyone’s in.'],
    ['PotAlreadyClaimed', 'This round’s pot has already been claimed.'],
    ['CircleIsBroken', 'This circle broke — grab your refund instead.'],
    ['CircleExpired', 'This circle’s rounds have all closed.'],
    ['NotBroken', 'Nothing to refund — the circle is healthy.'],
    ['NothingToRefund', 'Nothing left to refund for this seat.'],
    ['SlotTaken', 'That seat’s already taken — ask for another invite.'],
    ['AlreadyMember', 'You’re already in this circle.'],
    ['InviteNonceUsed', 'This invite was already used.'],
    ['NotFilling', 'This circle is no longer taking new members.'],
    ['InvalidSigner', 'This invite isn’t valid for this circle.'],
    ['NotActive', 'This circle isn’t running right now.'],
  ]
  for (const [needle, friendly] of table) {
    if (msg.includes(needle)) return friendly
  }
  return msg.length > 140 ? 'Something went wrong. Please try again.' : msg
}
