/**
 * Rally · dispenser — TanStack Start server functions (RPC bridge)
 * ---------------------------------------------------------------------------
 * Mirrors lib/contribute.ts: intentionally NOT `*.server.ts`; the heavy
 * server-only lib is dynamically imported inside handlers so it never reaches
 * the client bundle. See lib/dispenser.ts for the actual faucet logic.
 */
import { createServerFn } from '@tanstack/react-start'
import { parseChipInSource, type ChipInSource } from '#/lib/chip-in-source'

export interface DispenserStatus {
  /** Faucet configured and at least one source chain is funded. */
  enabled: boolean
  /** USD granted per claim. */
  claimUsd: number
  /** Old relayer-fronting behavior forced on via DISPENSER_FALLBACK (kill switch). */
  fallback: 'relayer' | 'none'
  /** Live USDC in the dispenser on each chip-in source. */
  treasuries: Record<ChipInSource, number>
}

const EMPTY_TREASURIES: Record<ChipInSource, number> = { base: 0, optimism: 0, arbitrum: 0 }

export const dispenserStatusServerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DispenserStatus> => {
    const d = await import('#/lib/dispenser')
    if (!d.dispenserEnabled()) {
      return { enabled: false, claimUsd: 0, fallback: d.fallbackMode(), treasuries: EMPTY_TREASURIES }
    }
    const treasuries = await d.treasuryUsdByChain().catch(() => EMPTY_TREASURIES)
    const min = d.claimUsd()
    return {
      enabled: Object.values(treasuries).some((usd) => usd >= min),
      claimUsd: min,
      fallback: d.fallbackMode(),
      treasuries,
    }
  },
)

export const beginClaimServerFn = createServerFn({ method: 'POST' })
  .validator((data: { wallet: string; chain?: string }) => {
    if (!data || typeof data.wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.wallet)) {
      throw new Error('a valid wallet address is required')
    }
    return { wallet: data.wallet, chain: parseChipInSource(data.chain) }
  })
  .handler(async ({ data }): Promise<{ authorizeUrl: string }> => {
    const d = await import('#/lib/dispenser')
    const state = await d.signState(data.wallet as `0x${string}`, data.chain)
    const params = new URLSearchParams({
      client_id: process.env.GH_CLIENT_ID ?? '',
      state,
      // No scopes: public profile identity is all the faucet needs.
      allow_signup: 'false',
    })
    return { authorizeUrl: `https://github.com/login/oauth/authorize?${params}` }
  })

export const redeemClaimServerFn = createServerFn({ method: 'POST' })
  .validator((data: { code: string; state: string }) => {
    if (!data || typeof data.code !== 'string' || !data.code || typeof data.state !== 'string') {
      throw new Error('code and state are required')
    }
    return { code: data.code, state: data.state }
  })
  .handler(async ({ data }) => {
    const d = await import('#/lib/dispenser')
    try {
      return await d.claimForCode(data.code, data.state)
    } catch (e) {
      // Surface the real reason to the callback UI (and the logs) instead of a
      // generic "something went wrong" — the faucet is testnet-only, no secrets
      // leak in these messages.
      // eslint-disable-next-line no-console
      console.error('[dispenser] claim failed:', e)
      return { ok: false as const, reason: 'error' as const, message: String((e as Error)?.message ?? e) }
    }
  })
