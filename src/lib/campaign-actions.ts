/**
 * Rally · Pools — TanStack Start server functions (RPC bridge)
 * ---------------------------------------------------------------------------
 * Mirrors lib/circle-actions.ts exactly: intentionally NOT `*.server.ts` (a
 * createServerFn is MEANT to be imported by the client — the compiler swaps
 * its `.handler()` body for an RPC call), and the heavy server-only lib
 * (viem wallet + relayer key loading) is dynamically imported INSIDE each
 * handler so it never reaches the client bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import type { Address } from 'viem'
import type { CampaignMeta, CreateCampaignResult } from '#/lib/campaign-relayer'

const isHexAddress = (a: unknown): a is Address =>
  typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)

// NOTE: GET server-fn payloads round-trip through the search-param
// serializer, which re-parses digits-only strings as numbers — so a campaign
// id may arrive as `2` OR `'2'`. Accept both, normalize to string.
const isCampaignId = (v: unknown): v is string | number =>
  (typeof v === 'string' || typeof v === 'number') && /^[0-9]{1,10}$/.test(String(v))

// ── createCampaign ───────────────────────────────────────────────────────────
export interface CreateCampaignFnInput {
  title: string
  organizer: string
  goalUsd: number
  days: number
  /** The creator's email-wallet address — paid out on success. */
  beneficiary: string
}

export const createCampaignServerFn = createServerFn({ method: 'POST' })
  .validator((data: CreateCampaignFnInput): CreateCampaignFnInput => {
    if (!data || typeof data.title !== 'string' || data.title.trim().length < 2)
      throw new Error('give your rally a name first')
    if (typeof data.goalUsd !== 'number' || !Number.isFinite(data.goalUsd) || data.goalUsd <= 0)
      throw new Error('a goal amount is required')
    if (typeof data.days !== 'number' || !Number.isFinite(data.days) || data.days <= 0)
      throw new Error('a campaign length is required')
    if (!isHexAddress(data.beneficiary))
      throw new Error('a valid beneficiary address is required')
    return {
      title: data.title,
      organizer: typeof data.organizer === 'string' ? data.organizer : '',
      goalUsd: data.goalUsd,
      days: data.days,
      beneficiary: data.beneficiary,
    }
  })
  .handler(async ({ data }): Promise<CreateCampaignResult> => {
    const { createCampaignOnchain } = await import('#/lib/campaign-relayer')
    return createCampaignOnchain({
      title: data.title,
      organizer: data.organizer,
      goalUsd: data.goalUsd,
      days: data.days,
      beneficiary: data.beneficiary as Address,
    })
  })

// ── campaign metadata lookup (title/organizer for created campaigns) ─────────
export const getCampaignMetaServerFn = createServerFn({ method: 'GET' })
  .validator((data: { id: string }): { id: string } => {
    if (!data || !isCampaignId(data.id)) throw new Error('a valid campaign id is required')
    return { id: String(data.id) }
  })
  .handler(async ({ data }): Promise<CampaignMeta | null> => {
    const { getCampaignMeta } = await import('#/lib/campaign-relayer')
    return getCampaignMeta(data.id)
  })
