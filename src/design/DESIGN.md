# Rally — Design System & Art Direction

> One link. A bar that fills itself from every chain. Hit the goal, or everyone gets their money back.

Rally must feel like a **beautiful consumer money app** — the emotional lineage is a group chat catching fire, not a block explorer. The UXmaxx rubric weights UX highest ("mobile-first, seamless"), so every decision below optimizes for *legibility, motion, and delight on a phone held at a party* — the crypto plumbing (CCTP, 7702, paymasters) stays invisible.

---

## 1. The thesis (art direction in 5 bullets)

- **The page is dusk; the thermometer is the light source.** The canvas is a warm plum-charcoal (`#130d1a`), deliberately *not* crypto-black — and the goal bar is the brightest, most saturated thing on screen. Everything else stays quiet so the fill can sing. This is the antithesis of the "flat black + one acid-green accent" crypto default.
- **The signature is a multi-chain liquid column.** The cross-chain story isn't told in a legend — it's *readable in the mercury itself*. Each chain contributes a colored band that stacks up as USDC lands (Base blue → Arbitrum cyan → Optimism coral → Solana violet). You can see, at a glance, "half of this came from Solana." No other fundraising bar does this because no other one is cross-chain. That's the whole pitch, made visual.
- **Warmth is the accent, not blue.** The brand accent is a sunrise **coral→amber** (`#ff6b4a → #ffb020`) reserved for CTAs, the live percentage, and the goal ribbon. It signals *human + celebration*, the opposite of the blue/green every crypto app reaches for. Money numerals are set in Clash Display (display) + JetBrains Mono (tickers) with tabular figures — the numbers are the hero, so they get a characterful face, not Inter-everywhere.
- **Motion is information, decoration is banned.** The liquid *rises* with an expo-out ease (money arriving feels like momentum), *bumps* with a squash-and-stretch when a contribution lands, and *rains confetti* the instant it crosses the goal. Ambient loops (wave crest, shimmer, glow bloom) are gentle and continuous so a static screenshot still looks alive — but `prefers-reduced-motion` strips all of it while keeping the fill height (because the fill *is* data).
- **Two skins, one system. Rally = raise, Potluck = gift.** The same contract/components render a second "Confetti/Potluck" skin: accent flips to festive magenta→gold, the feed foregrounds *gift notes* over timestamps, and the card wears a "Group gift" tag. It's a re-theme (accent + copy + a couple of decorations), never a fork — proving the platform generalizes from "fundraiser" to "group present."

**Risk I took (and justify):** a warm-dark canvas sits *near* the crypto-dark default. I earn the difference three ways — (1) the canvas is warm plum, not cold near-black; (2) the fill is *multi-hue*, never a single accent; (3) the accent itself is coral/amber, a color crypto never uses. Screenshot QA (`src/design/` preview) confirms it reads as a consumer app, not a dapp.

---

## 2. Tokens

All tokens live in **`src/design/tokens.css`** as a Tailwind v4 `@theme` extension, and chain identity lives in **`src/design/chains.ts`** (the JS/canvas source of truth — keep the hex in the two files in sync).

### Color
| Role | Token | Hex |
|---|---|---|
| Canvas (deepest) | `--color-ink-950` | `#130d1a` |
| Canvas (cards) | `--color-ink-900` | `#191122` |
| Surfaces step-up | `ink-850 / 800 / 700` | `#20172b … #342740` |
| Primary text | `--color-paper` | `#f6f1f9` |
| Secondary text | `--color-muted` | `#a89fb4` |
| Caption text | `--color-faint` | `#6f6579` |
| Brand accent | `--color-rally-600 → 300` | `#ff6b4a → #ffc36b` |
| Potluck accent | `--color-potluck-600 / 300` | `#ff4d8d → #ffc24b` |
| Chain · Base | `--color-chain-base` | `#3b82f6` |
| Chain · Arbitrum | `--color-chain-arbitrum` | `#22d3ee` |
| Chain · Optimism | `--color-chain-optimism` | `#fb7185` |
| Chain · Solana | `--color-chain-solana` | `#a855f7` |

> Chain colors are prefixed `chain-` on purpose — a bare `base` token would clobber Tailwind's own `text-base` size utility.

### Type
- **Display** (`--font-display`): **Clash Display** 500/600/700 — headings + money figures. Loaded from Fontshare with a `system-ui` fallback.
- **Body/UI** (`--font-sans`): **Inter**.
- **Data** (`--font-mono`): **JetBrains Mono** — for tickers/amounts where mono rhythm helps.
- Money-shot sizes: `text-mega` (4.5rem, hero raised total) and `text-figure` (2.75rem, card/section totals). Always pair with the `.tnum` class (tabular figures) so digits don't jitter as they climb.

### Motion
- `--ease-rally` = `cubic-bezier(0.22, 1, 0.36, 1)` — expo-out, the fill rise.
- `--ease-spring` = `cubic-bezier(0.34, 1.56, 0.64, 1)` — overshoot, chip entrance + bump.
- Keyframes shipped: `wave`, `shimmer`, `rise`, `slideIn`, `pulseDot`, `float`, `bump`, `ribbon`, `sheen` (each exposed as an `animate-*` utility).
- Durations: fill = 900ms, chip entrance = 500ms, bump = 620ms, confetti burst ≈ 3s.

### Radii & spacing
- `--radius-tube` = `999px` (the glass column / pills), `--radius-card` = `1.5rem` (share cards). Spacing follows Tailwind's default 4px scale.

---

## 3. How the thermometer animates (the money moment)

The fill has **three independent motion layers** so it feels alive without ever looking busy:

1. **The rise (data → height).** `raised/goal` maps to a percent. The fill element transitions its `height` (vertical) or `width` (horizontal) over **900ms on `--ease-rally`**. Expo-out means it *launches* then *settles* — money arriving reads as momentum, not a mechanical bar. The per-chain bands are flex children whose `flex-grow` also transitions, so when a new chain's USDC lands the bands re-proportion smoothly *and* the whole column grows at the same time.
2. **The bump (event → squash).** Whenever `raised` increases, the fill plays a one-shot `bump` keyframe (scaleY 1.035 / scaleX 0.99 → settle) anchored at the base — a liquid "gulp." It layers on top of the height transition without fighting it (transform vs. height).
3. **The surface + bloom (ambient life).** At the top edge, two offset wavy divs drift on `wave`/`wave-slow` with a bright 1px meniscus highlight and a colored glow keyed to the topmost chain; a diagonal `shimmer` sweeps the liquid; a radial `sheen` blooms behind it. All continuous, all subtle — a still frame still looks live.

**Goal-hit.** The component tracks the previous percent; when `raised` crosses `goal` *live*, it fires `onGoalReached()` and mounts `<Confetti>` — a zero-dependency canvas burst launched from both lower corners, tinted with the chain palette + skin accent, plus a "Goal met" pill. It fires only on the live crossing (never on a page that loads already-funded), and `prefers-reduced-motion` swaps the burst for the static funded state.

**Accessibility.** The tube is a real `role="progressbar"` with `aria-valuenow/min/max` and a human `aria-label` ("$3,120 of $4,000 USDC raised, 78%"). Reduced-motion keeps the height (information) and drops the rest (decoration).

---

## 4. Components (built, presentational, mock-prop only)

Location: `src/components/`. Every component is pure presentation — no chain calls, no data fetching. Import chain types/helpers from `#/design/chains`.

### `<Thermometer />` — the signature
```ts
interface ThermometerProps {
  raised: number                                   // whole USDC units
  goal: number
  segments?: { chain: Chain; amount: number }[]    // per-chain bands; omit → single accent fill
  currency?: string                                // default 'USDC'
  skin?: 'rally' | 'potluck'                        // default 'rally'
  orientation?: 'vertical' | 'horizontal'          // default 'vertical' (hero) — card uses horizontal
  status?: 'live' | 'funded' | 'missed'
  height?: number                                  // px, vertical tube (default 340)
  showReadout?: boolean                            // big amount + % + goal (default true)
  showTicks?: boolean                              // 25/50/75 marks (default: vertical only)
  celebrate?: boolean                              // force funded visuals w/o a live crossing
  onGoalReached?: () => void                       // fires once on live goal crossing
  className?: string
}
```

### `<ContributorFeed />` — the live named feed
```ts
interface Contributor {
  id: string
  name: string
  avatarUrl?: string                               // else deterministic gradient initials
  amount: number                                   // whole USDC units
  chain: Chain
  note?: string                                    // gift note — foregrounded in potluck skin
  timestamp: number                                // epoch ms
}
interface ContributorFeedProps {
  contributors: Contributor[]                      // any order; component sorts newest-first
  skin?: 'rally' | 'potluck'
  maxVisible?: number                              // default 6, rest → "+N more"
  className?: string
}
```
New rows spring in (`slideIn`); the newest row gets an accent glow. Each row shows avatar, name, a **chain badge** (which chain the USDC arrived from — the CCTP source), relative time / gift note, and the `+$amount` in that chain's color. Relative time is computed client-side (mounted `useNow`) to avoid SSR hydration mismatch.

### `<CampaignCard />` — the shareable "one link"
```ts
interface Campaign {
  id: string; title: string; organizer: string
  raised: number; goal: number; currency?: string
  deadline: number                                 // epoch ms
  backerCount: number
  segments?: { chain: Chain; amount: number }[]
  backers?: { name: string; avatarUrl?: string }[] // avatar stack
  coverUrl?: string
  status?: 'live' | 'funded' | 'missed'
  mode?: 'rally' | 'potluck'
}
interface CampaignCardProps {
  campaign: Campaign
  href?: string                                    // renders as <a>; else <div> + onOpen
  onOpen?: (id: string) => void
  className?: string
}
```
The card is the object that lands in a group chat: cover (or generated gradient), title + organizer, an embedded **horizontal `<Thermometer>`**, an overlapping backer stack, a deadline countdown (turns amber < 6h, "urgent"), a "from · ●●●" chain-flow row, and a `Chip in` / `View rally` CTA. Hover lifts the card; focus-visible shows an accent outline.

### `<Confetti />` — supporting (dependency-free)
```ts
interface ConfettiProps {
  active: boolean                                  // fires a burst on false → true
  skin?: 'rally' | 'potluck'
  particleCount?: number                           // default 140
  onDone?: () => void
  className?: string
}
```
Canvas burst, DPR-aware, honors reduced-motion. Owned internally by `<Thermometer>` on goal-hit, but reusable anywhere (e.g. the withdraw success screen).

---

## 5. Key screens (specs for eng)

All screens are **mobile-first**: single column, thumb-reachable primary action pinned near the bottom, safe-area padding, max content width `~480px` centered on desktop with the hero thermometer allowed to grow taller.

1. **Landing / hero.** Full-bleed dusk canvas. Headline (Clash Display) = the one-liner. The hero is a *live* `<Thermometer orientation="vertical" height={~360} showReadout>` with a demo campaign filling in real time beside a `<ContributorFeed>`. Single coral CTA: "Start a Rally." This is the thesis on screen in the first 2 seconds.
2. **Campaign (the fill).** The star. Big vertical thermometer up top (or centered on mobile), `<ContributorFeed>` below it, deadline countdown + backer count, and a pinned primary CTA **"Chip in"** (opens the contribute sheet). Goal-hit → confetti + the CTA morphs to "Share the win." Miss → the bar dims to `muted`, copy flips to "Didn't hit — refunds sent to every backer's chain," CTA → "Claim refund."
3. **Contribute sheet (bottom sheet, mobile-native).** Email field → "Continue" (Magic login, gasless — never say "wallet/seed/gas"). Amount stepper with quick chips ($10/$25/$100). A quiet "Paying from: [chain]" line (auto-detected; the CCTP hop is invisible). Primary button states through: `Chip in $25` → `Sending…` → `You're in ✦` with a mini confetti. Optional gift-note field appears in Potluck mode.
4. **Create campaign.** Title, goal, deadline, and a **Rally / Potluck toggle** (the toggle re-skins the live preview card in place). Ends on a shareable `<CampaignCard>` + copy-link CTA — the artifact you drop in the group chat.
5. **Withdraw / success.** On funded, organizer sees the consolidated total (`text-mega`), a `<Confetti active>` moment, and "Withdraw to [chain]." Copy is celebratory but plain: "You rallied $4,000 from 23 backers across 4 chains."

**States that must exist for every screen (rubric = seamless):** loading (skeleton tube shimmering, no layout shift), empty ("Be the first to chip in"), error (in the interface's voice: what happened + the one action to fix it), and the reduced-motion variant.

---

## 6. Wiring (one change, eng)

`tokens.css` is a self-contained drop-in (`@import "tailwindcss"` + theme + keyframes + base). Point the app at it **one** of two ways:

- **A (preferred):** in `src/routes/__root.tsx`, change `import appCss from '../styles.css?url'` → `import appCss from '../design/tokens.css?url'`.
- **B:** in `src/styles.css`, replace `@import "tailwindcss";` with `@import "./design/tokens.css";` (don't import Tailwind twice).

Then components + the `#/design/chains` helpers work as-is. Fonts load from CDN with system fallbacks (offline-safe for a demo).

---

## 7. Voice (microcopy)

Interface-first, active voice, sentence case, no crypto jargon on the surface. The vocabulary is consistent through a flow: the button that says **Chip in** produces a toast that says **You're in**; **Start a Rally** leads to **Share the win**. Failure is direction, not apology: "Didn't hit the goal — every backer's USDC is on its way back to their chain." Emptiness is an invitation: "Be the first to chip in." Never surface `wallet`, `seed phrase`, `gas`, `bridge`, `attestation`, or a raw address — say **chip in**, **from Base**, **funds returned**.
