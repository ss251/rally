// Rally design system — chain metadata + formatting helpers.
// Single source of truth for per-chain identity used by all presentational
// components (Thermometer bands, ContributorFeed badges, Confetti colors).
// The hex values here MUST stay in sync with the `--color-chain-*` tokens in
// `tokens.css` (JS/canvas needs literal colors; Tailwind needs the theme vars).

export type Chain = 'base' | 'arbitrum' | 'optimism' | 'solana'
export type Skin = 'rally' | 'potluck'
export type CampaignStatus = 'live' | 'funded' | 'missed'

export interface ChainMeta {
  id: Chain
  /** Full name, e.g. "Base Sepolia" shown as "Base". */
  label: string
  /** 3–4 char badge label. */
  short: string
  /** Circle CCTP v2 testnet domain id (for reference / tooltips). */
  domain: number
  /** Solid brand color used for chips, dots, badges. */
  color: string
  /** Fill gradient — lighter top edge. */
  from: string
  /** Fill gradient — saturated base. */
  to: string
}

// The `color` field keeps each project's REAL brand hex (chips, dots, confetti,
// official legend marks) — Base #0052FF, Arbitrum #12AAFF, Optimism #FF0420,
// Solana #9945FF. The mercury-band gradient (`from`/`to`) is LUMINANCE-NORMALIZED
// so all four bands sit in one perceptual band (OKLCH L≈0.61–0.73) — otherwise
// Base (raw L≈0.53) reads as a dark navy and Optimism, once feathered into its
// neighbours, muddied into brown "sediment". Normalized (hue preserved, only
// L/chroma shifted): the two blues stay DISTINCT (Base = deeper royal H≈264,
// Arbitrum = brighter cyan H≈233), Optimism reads as a confident vermillion, and
// Solana keeps its purple→green identity across the band. `from` = lighter top
// edge, `to` = saturated base; a hairline meniscus seam (drawn in LiquidColumn)
// keeps adjacent bands crisp so nothing bleeds.
//
//   band 'to'  before → after (normalized):
//     Base      #0052FF → #4A7BE9   (L 0.53 → 0.61)
//     Arbitrum  #12AAFF → #0AA7E2   (L 0.71 → 0.69)
//     Optimism  #FF0420 → #EF4841   (L 0.63 → 0.64, vermillion)
//     Solana    #14F195 → #00C582   (green terminus, L 0.84 → 0.73)
//   Solana 'from' (purple top) #9945FF → #A161E0 (L 0.60 → 0.62)
export const CHAIN_META: Record<Chain, ChainMeta> = {
  base: {
    id: 'base',
    label: 'Base',
    short: 'BASE',
    domain: 6,
    color: '#0052FF',
    from: '#6490EF',
    to: '#4A7BE9',
  },
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum',
    short: 'ARB',
    domain: 3,
    color: '#12AAFF',
    from: '#57B8E9',
    to: '#0AA7E2',
  },
  optimism: {
    id: 'optimism',
    label: 'Optimism',
    short: 'OP',
    domain: 2,
    color: '#FF0420',
    from: '#FC675C',
    to: '#EF4841',
  },
  solana: {
    id: 'solana',
    label: 'Solana',
    short: 'SOL',
    domain: 5,
    color: '#9945FF',
    // Band runs purple (top) → green (bottom); both normalized into the band.
    from: '#A161E0',
    to: '#00C582',
  },
}

/** Stable stacking order for the thermometer fill (bottom → top). */
export const CHAIN_ORDER: Chain[] = ['base', 'arbitrum', 'optimism', 'solana']

/** Warm brand accent used for confetti + goal line, per skin. */
export const ACCENT: Record<Skin, { from: string; to: string; solid: string }> = {
  rally: { from: '#FF6B4A', to: '#FFB020', solid: '#FF7A50' },
  potluck: { from: '#FF4D8D', to: '#FFC24B', solid: '#FF5C9A' },
}

export interface ChainSegment {
  chain: Chain
  /** Amount contributed via this chain, in whole USDC units. */
  amount: number
}

/**
 * One keyboard-focus treatment for every actionable control (CTAs, choice
 * chips, inputs, mode links): a warm 2px accent ring, drawn ONLY on
 * `:focus-visible` so mouse/tap interaction is visually unchanged. Mirrors the
 * ring CampaignCard already carries — append to a control's className so the
 * whole surface answers the Tab key with one consistent state.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:[outline-color:var(--color-rally-500)]'

// ── Formatting ──────────────────────────────────────────────────────────────

const usd = (min: number, max: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })

const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** `$1,240` or `$1.2k` (compact). Cents shown only when present. */
export function formatUsd(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) return usdCompact.format(n)
  // Money is written with two decimals or none at all — "$6.50" or "$4,000",
  // NEVER "$6.5" (a machine leaking through a product that custodies funds).
  const hasCents = Math.round(n * 100) % 100 !== 0
  return (hasCents ? usd(2, 2) : usd(0, 0)).format(n)
}

/** Whole-number percent, clamped to [0, cap]. */
export function pct(raised: number, goal: number, cap = 999): number {
  if (goal <= 0) return 0
  return Math.min(cap, Math.max(0, Math.round((raised / goal) * 100)))
}

/** Compact relative time: "just now", "3m", "2h", "5d". */
export function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

/** Countdown to a deadline. `urgent` when < 24h remain. */
export function countdown(deadline: number, now: number): { label: string; urgent: boolean; ended: boolean } {
  const ms = deadline - now
  if (ms <= 0) return { label: 'Ended', urgent: false, ended: true }
  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / 1440)
  const hours = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  // Suppress zero units — "3d left", not "3d 0h left".
  if (days >= 1)
    return { label: hours > 0 ? `${days}d ${hours}h left` : `${days}d left`, urgent: false, ended: false }
  if (hours >= 1)
    return { label: m > 0 ? `${hours}h ${m}m left` : `${hours}h left`, urgent: hours < 6, ended: false }
  return { label: `${m}m left`, urgent: true, ended: false }
}

/** Initials for avatar fallback: "Ava Chen" → "AC". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic gradient for an avatar fallback, seeded by name. Short names
 *  can hash into near-identical hues (Ana/Ben/Sam all land in the same green
 *  band) — pass a stable `slot` (seat / payout index) to rotate each one by
 *  the golden angle so neighbours in a list stay visually distinct. */
export function avatarGradient(name: string, slot = 0): { from: string; to: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const a = (h + slot * 137) % 360
  const b = (a + 40) % 360
  return { from: `hsl(${a} 70% 62%)`, to: `hsl(${b} 74% 48%)` }
}
