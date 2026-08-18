/**
 * Rally · Circles — TanStack Start server functions (RPC bridge)
 * ---------------------------------------------------------------------------
 * Mirrors lib/contribute.ts exactly: intentionally NOT `*.server.ts` (a
 * createServerFn is MEANT to be imported by the client — the compiler swaps
 * its `.handler()` body for an RPC call), and the heavy server-only lib
 * (viem wallet + relayer key loading) is dynamically imported INSIDE each
 * handler so it never reaches the client bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import type { Address, Hex } from 'viem'
import type {
  CreateCircleResult,
  DepositForResult,
  FillRoundResult,
  RedeemSeatResult,
  RefundResult,
} from '#/lib/circle-relayer'

const isHexAddress = (a: unknown): a is Address =>
  typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)
const isHexBytes = (s: unknown): s is Hex => typeof s === 'string' && /^0x[0-9a-fA-F]*$/.test(s)

function parseCircleId(v: unknown): string {
  const id = typeof v === 'string' || typeof v === 'number' ? BigInt(v) : null
  if (id == null || id <= 0n) throw new Error('a valid circle id is required')
  return id.toString()
}

// ── createCircle ─────────────────────────────────────────────────────────────
export interface CreateCircleFnInput {
  depositUsd: number
  roundSeconds: number
  seats: number
  /** The creator's email-wallet address — seat 0 is theirs. */
  creator?: string
  /** Fill the remaining seats with demo members + start immediately. */
  demoFill?: boolean
}

export const createCircleServerFn = createServerFn({ method: 'POST' })
  .validator((data: CreateCircleFnInput): CreateCircleFnInput => {
    if (!data || typeof data.depositUsd !== 'number' || !Number.isFinite(data.depositUsd))
      throw new Error('a deposit amount is required')
    if (typeof data.roundSeconds !== 'number' || !Number.isFinite(data.roundSeconds))
      throw new Error('a round length is required')
    if (typeof data.seats !== 'number' || !Number.isFinite(data.seats))
      throw new Error('a member count is required')
    if (data.creator !== undefined && !isHexAddress(data.creator))
      throw new Error('a valid creator address is required')
    return {
      depositUsd: data.depositUsd,
      roundSeconds: data.roundSeconds,
      seats: data.seats,
      creator: data.creator,
      demoFill: data.demoFill === true,
    }
  })
  .handler(async ({ data }): Promise<CreateCircleResult> => {
    const { createCircleOnchain } = await import('#/lib/circle-relayer')
    return createCircleOnchain({
      depositUsd: data.depositUsd,
      roundSeconds: data.roundSeconds,
      seats: data.seats,
      creator: data.creator as Address | undefined,
      demoFill: data.demoFill,
    })
  })

// ── join (redeem an invite for a seat) ───────────────────────────────────────
export interface JoinCircleFnInput {
  circleId: string
  payoutIndex: number
  member: string
  /** Optional pre-signed org invite (URL-encoded shape) — relayed as-is. */
  nonce?: string
  expiresAt?: string
  signature?: string
}

export const joinCircleServerFn = createServerFn({ method: 'POST' })
  .validator((data: JoinCircleFnInput): JoinCircleFnInput => {
    const circleId = parseCircleId(data?.circleId)
    if (!isHexAddress(data.member)) throw new Error('a valid member address is required')
    const idx = Number(data.payoutIndex)
    if (!Number.isInteger(idx) || idx < 0 || idx > 255) throw new Error('a valid seat is required')
    if (data.signature !== undefined && !isHexBytes(data.signature))
      throw new Error('a valid invite signature is required')
    if (data.signature !== undefined && data.nonce === undefined)
      throw new Error('a signed invite needs its nonce')
    if (data.signature !== undefined && data.expiresAt === undefined)
      throw new Error('a signed invite needs its expiry')
    return {
      circleId,
      payoutIndex: idx,
      member: data.member,
      nonce: data.nonce,
      expiresAt: data.expiresAt,
      signature: data.signature,
    }
  })
  .handler(async ({ data }): Promise<RedeemSeatResult> => {
    const { redeemSeat } = await import('#/lib/circle-relayer')
    return redeemSeat({
      circleId: BigInt(data.circleId),
      payoutIndex: data.payoutIndex,
      member: data.member as Address,
      nonce: data.nonce !== undefined ? BigInt(data.nonce) : undefined,
      expiresAt: data.expiresAt !== undefined ? BigInt(data.expiresAt) : undefined,
      signature: data.signature as Hex | undefined,
    })
  })

// ── chip in (relayer-fronted deposit — the fresh-email-wallet fallback) ──────
export interface ChipInCircleFnInput {
  circleId: string
  member: string
}

export const chipInCircleServerFn = createServerFn({ method: 'POST' })
  .validator((data: ChipInCircleFnInput): ChipInCircleFnInput => {
    const circleId = parseCircleId(data?.circleId)
    if (!isHexAddress(data.member)) throw new Error('a valid member address is required')
    return { circleId, member: data.member }
  })
  .handler(async ({ data }): Promise<DepositForResult> => {
    const { depositForMember } = await import('#/lib/circle-relayer')
    return depositForMember({ circleId: BigInt(data.circleId), member: data.member as Address })
  })

// ── fill the round (demo: everyone else chips in) ────────────────────────────
export interface FillRoundFnInput {
  circleId: string
  /** Skip this member (the real user keeps their own moment). */
  except?: string
}

export const fillCircleRoundServerFn = createServerFn({ method: 'POST' })
  .validator((data: FillRoundFnInput): FillRoundFnInput => {
    const circleId = parseCircleId(data?.circleId)
    if (data.except !== undefined && !isHexAddress(data.except))
      throw new Error('a valid member address is required')
    return { circleId, except: data.except }
  })
  .handler(async ({ data }): Promise<FillRoundResult> => {
    const { fillRound } = await import('#/lib/circle-relayer')
    return fillRound({ circleId: BigInt(data.circleId), except: data.except as Address | undefined })
  })

// ── refund (broken circle; permissionless refundFor, gasless for the member) ─
export interface RefundCircleFnInput {
  circleId: string
  member: string
}

export const refundCircleServerFn = createServerFn({ method: 'POST' })
  .validator((data: RefundCircleFnInput): RefundCircleFnInput => {
    const circleId = parseCircleId(data?.circleId)
    if (!isHexAddress(data.member)) throw new Error('a valid member address is required')
    return { circleId, member: data.member }
  })
  .handler(async ({ data }): Promise<RefundResult> => {
    const { refundMember } = await import('#/lib/circle-relayer')
    return refundMember({ circleId: BigInt(data.circleId), member: data.member as Address })
  })

export interface SaveCircleMetaFnInput {
  circleId: string
  title: string
  organizer: string
}

export const saveCircleMetaServerFn = createServerFn({ method: 'POST' })
  .validator((data: SaveCircleMetaFnInput): SaveCircleMetaFnInput => {
    const circleId = parseCircleId(data?.circleId)
    if (typeof data.title !== 'string' || data.title.trim().length < 2)
      throw new Error('give your circle a name first')
    return {
      circleId,
      title: data.title.trim().slice(0, 80),
      organizer: typeof data.organizer === 'string' ? data.organizer.trim().slice(0, 40) : '',
    }
  })
  .handler(async ({ data }) => {
    const { writeCircleMeta } = await import('#/lib/rally-meta')
    await writeCircleMeta(data.circleId, {
      title: data.title,
      organizer: data.organizer || 'The crew',
      createdAt: Date.now(),
    })
    return { ok: true as const }
  })

export const getCircleMetaServerFn = createServerFn({ method: 'GET' })
  .validator((data: { id: string }): { id: string } => ({ id: parseCircleId(data?.id) }))
  .handler(async ({ data }) => {
    const { getCircleMeta } = await import('#/lib/rally-meta')
    return getCircleMeta(data.id)
  })

export const requestJoinServerFn = createServerFn({ method: 'POST' })
  .validator((data: { circleId: string; seat: number; member: string }) => {
    const circleId = parseCircleId(data?.circleId)
    if (!isHexAddress(data.member)) throw new Error('a valid member address is required')
    const seat = Number(data.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat > 255) throw new Error('a valid seat is required')
    return { circleId, seat, member: data.member }
  })
  .handler(async ({ data }) => {
    const { requestJoin } = await import('#/lib/rally-meta')
    return requestJoin(data.circleId, data.seat, data.member as Address)
  })

export const listPendingJoinsServerFn = createServerFn({ method: 'GET' })
  .validator((data: { circleId: string }) => ({ circleId: parseCircleId(data?.circleId) }))
  .handler(async ({ data }) => {
    const { listPendingJoins } = await import('#/lib/rally-meta')
    return listPendingJoins(data.circleId)
  })

export const clearPendingJoinServerFn = createServerFn({ method: 'POST' })
  .validator((data: { circleId: string; seat: number }) => {
    const circleId = parseCircleId(data?.circleId)
    const seat = Number(data.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat > 255) throw new Error('a valid seat is required')
    return { circleId, seat }
  })
  .handler(async ({ data }) => {
    const { clearPendingJoin } = await import('#/lib/rally-meta')
    await clearPendingJoin(data.circleId, data.seat)
    return { ok: true as const }
  })
