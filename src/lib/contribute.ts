/**
 * Rally · contribute — TanStack Start server function (RPC bridge)
 * ---------------------------------------------------------------------------
 * NOTE: intentionally NOT named `*.server.ts`. TanStack Start's import-protection
 * forbids client code from importing `*.server.*` files, but a createServerFn is
 * MEANT to be imported by the client — the compiler swaps its `.handler()` body
 * for an RPC call. The server-only heavy lib is dynamically imported below so it
 * never reaches the client bundle.
 *
 * The client calls this on "Chip in". It runs a REAL Circle CCTP v2 cross-chain
 * USDC fill into the live GoalVault campaign, server-side, using the funded
 * relayer key (which never leaves the server). Returns the on-chain tx hashes +
 * the new raised total so the UI can show "You're in ✦" and refresh the bar.
 *
 * The heavy lib (viem + node key-loading) is dynamically imported INSIDE the
 * handler so it is only ever bundled/evaluated on the server — the client only
 * ships the thin RPC wrapper.
 */
import { createServerFn } from '@tanstack/react-start'
import type { Address } from 'viem'
import type { FillContributionResult } from '#/lib/cctp/contribute-fill'

/** Digits-only campaign id (matches route params); parsed server-side. */
const parseCampaignId = (v: unknown): number | undefined => {
  if (v === undefined) return undefined
  if (typeof v !== 'string' || !/^[0-9]{1,10}$/.test(v) || Number(v) < 1) {
    throw new Error('a valid campaign id is required')
  }
  return Number(v)
}

export interface ContributeInput {
  /** The backer's Magic email-wallet address (0x…40 hex). */
  backer: string
  /** Requested USD amount (clamped server-side to a small testnet cap). */
  amountUsd?: number
  /** The campaign being funded — the one on screen (defaults to #1). */
  campaignId?: string
}

export const contributeServerFn = createServerFn({ method: 'POST' })
  .validator((data: ContributeInput): ContributeInput => {
    if (!data || typeof data.backer !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.backer)) {
      throw new Error('a valid backer address is required')
    }
    const amountUsd =
      typeof data.amountUsd === 'number' && Number.isFinite(data.amountUsd)
        ? data.amountUsd
        : undefined
    parseCampaignId(data.campaignId)
    return { backer: data.backer, amountUsd, campaignId: data.campaignId }
  })
  .handler(async ({ data }): Promise<FillContributionResult> => {
    const { fillContribution } = await import('#/lib/cctp/contribute-fill')
    return fillContribution({
      backer: data.backer as Address,
      amountUsd: data.amountUsd,
      campaignId: parseCampaignId(data.campaignId),
    })
  })

// ---------------------------------------------------------------------------
// COMPLETE a backer-funded gasless contribution (the REAL product path).
// The backer already burned THEIR OWN USDC gaslessly in the browser (ZeroDev
// 7702) — we receive the burn tx hash and finish the CCTP hop server-side
// (attest → mint → record). The relayer only relays; it does not front funds.
// ---------------------------------------------------------------------------
export interface CompleteInput {
  /** The backer's Magic email-wallet / 7702 kernel address (0x…40 hex). */
  backer: string
  /** The gasless burn tx hash from the backer's kernel account (0x…64 hex). */
  burnTxHash: string
  /** CCTP source domain of the burn (defaults to Base Sepolia = 6). */
  sourceDomain?: number
  /** The campaign being funded — the one on screen (defaults to #1). */
  campaignId?: string
}

export const completeContributionServerFn = createServerFn({ method: 'POST' })
  .validator((data: CompleteInput): CompleteInput => {
    if (!data || typeof data.backer !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.backer)) {
      throw new Error('a valid backer address is required')
    }
    if (typeof data.burnTxHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(data.burnTxHash)) {
      throw new Error('a valid burn tx hash is required')
    }
    const sourceDomain =
      typeof data.sourceDomain === 'number' && Number.isFinite(data.sourceDomain)
        ? data.sourceDomain
        : undefined
    parseCampaignId(data.campaignId)
    return {
      backer: data.backer,
      burnTxHash: data.burnTxHash,
      sourceDomain,
      campaignId: data.campaignId,
    }
  })
  .handler(async ({ data }): Promise<FillContributionResult> => {
    const { completeContribution } = await import('#/lib/cctp/complete-fill')
    return completeContribution({
      backer: data.backer as Address,
      burnTxHash: data.burnTxHash as `0x${string}`,
      sourceDomain: data.sourceDomain,
      campaignId: parseCampaignId(data.campaignId),
    })
  })
