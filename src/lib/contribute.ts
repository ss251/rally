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

export interface ContributeInput {
  /** The backer's Magic email-wallet address (0x…40 hex). */
  backer: string
  /** Requested USD amount (clamped server-side to a small testnet cap). */
  amountUsd?: number
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
    return { backer: data.backer, amountUsd }
  })
  .handler(async ({ data }): Promise<FillContributionResult> => {
    const { fillContribution } = await import('#/lib/cctp/contribute-fill')
    return fillContribution({ backer: data.backer as Address, amountUsd: data.amountUsd })
  })
