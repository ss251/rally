/**
 * Rally · dispenser — TanStack Start server functions (RPC bridge)
 * ---------------------------------------------------------------------------
 * Mirrors lib/contribute.ts: intentionally NOT `*.server.ts`; the heavy
 * server-only lib is dynamically imported inside handlers so it never reaches
 * the client bundle. See lib/dispenser.ts for the actual faucet logic.
 */
import { createServerFn } from '@tanstack/react-start'

export interface DispenserStatus {
  /** Faucet configured + funded — the sheet may offer "verify with GitHub". */
  enabled: boolean
  /** USD granted per claim. */
  claimUsd: number
  /** Old relayer-fronting behavior forced on via DISPENSER_FALLBACK (kill switch). */
  fallback: 'relayer' | 'none'
}

export const dispenserStatusServerFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DispenserStatus> => {
    const d = await import('#/lib/dispenser')
    if (!d.dispenserEnabled()) return { enabled: false, claimUsd: 0, fallback: d.fallbackMode() }
    const treasury = await d.treasuryUsd().catch(() => 0)
    return {
      enabled: treasury >= d.claimUsd(),
      claimUsd: d.claimUsd(),
      fallback: d.fallbackMode(),
    }
  },
)

export const beginClaimServerFn = createServerFn({ method: 'POST' })
  .validator((data: { wallet: string }) => {
    if (!data || typeof data.wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.wallet)) {
      throw new Error('a valid wallet address is required')
    }
    return { wallet: data.wallet }
  })
  .handler(async ({ data }): Promise<{ authorizeUrl: string }> => {
    const d = await import('#/lib/dispenser')
    const state = await d.signState(data.wallet as `0x${string}`)
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
