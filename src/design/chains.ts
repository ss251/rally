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

// REAL chain brand hex (from each project's brand kit — no ballparks):
//   Base     #0052FF  (Base brand blue)
//   Arbitrum #12AAFF  (Arbitrum brand blue)
//   Optimism #FF0420  (Optimism red)
//   Solana   #9945FF → #14F195  (the signature purple→green gradient)
// Base and Arbitrum are BOTH blue on purpose (they're the real brand colors) —
// a hairline separator is drawn between mercury bands (see Thermometer) so the
// two blues stay legible when they stack. `from` = lighter/top edge tint,
// `to` = saturated base; Solana carries its full gradient across the band.
export const CHAIN_META: Record<Chain, ChainMeta> = {
  base: {
    id: 'base',
    label: 'Base',
    short: 'BASE',
    domain: 6,
    color: '#0052FF',
    from: '#4C82FF',
    to: '#0052FF',
  },
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum',
    short: 'ARB',
    domain: 3,
    color: '#12AAFF',
    from: '#5CC6FF',
    to: '#12AAFF',
  },
  optimism: {
    id: 'optimism',
    label: 'Optimism',
    short: 'OP',
    domain: 2,
    color: '#FF0420',
    from: '#FF4D63',
    to: '#FF0420',
  },
  solana: {
    id: 'solana',
    label: 'Solana',
    short: 'SOL',
    domain: 5,
    color: '#9945FF',
    from: '#9945FF',
    to: '#14F195',
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

// ── Formatting ──────────────────────────────────────────────────────────────

const usd = (max: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
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
  const hasCents = Math.round(n * 100) % 100 !== 0
  return usd(hasCents ? 2 : 0).format(n)
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
  if (days >= 1) return { label: `${days}d ${hours}h left`, urgent: false, ended: false }
  if (hours >= 1) return { label: `${hours}h ${m}m left`, urgent: hours < 6, ended: false }
  return { label: `${m}m left`, urgent: true, ended: false }
}

/** Initials for avatar fallback: "Ava Chen" → "AC". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic gradient for an avatar fallback, seeded by name. */
export function avatarGradient(name: string): { from: string; to: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const a = h % 360
  const b = (a + 40) % 360
  return { from: `hsl(${a} 70% 62%)`, to: `hsl(${b} 74% 48%)` }
}
