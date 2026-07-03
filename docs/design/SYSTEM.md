# Rally — the construction sheet

One page: the geometry the UI is built on, what the black test said, and the
kill/keep ledger. Derived from what was latently there (Loewy: measure first,
then draw the system); enforced in `src/design/tokens.css` + the screens.

## The derived geometry

**Base unit: 4px.** Everything below is a multiple (one deliberate half-step:
`py-3.5` = 14px, the quiet-row height — one rung shorter than the CTA's 16).

### Type ladder (px) — every size has ONE job

| px | job | where |
|---|---|---|
| 10 | uppercase micro tags | `NEW`, `THIS POT`, chain badges |
| 12 | metadata | timestamps, counts, field labels, status pill, ticks |
| 13 | supporting sentences | helper copy, meta rows, errors, fine print |
| 14 | body + text links | names, labels, "or start your own rally →" |
| 15 | lead | sheet intros, standing status in the CTA slot |
| 16 | action | inputs and CTAs |
| 18 | title | wordmark, sheet + card titles |
| 24 | readout | the `%`, `pot`, success titles |
| 34 | display | screen h1 (`--text-display`) |
| 44 | figure | the money (`--text-figure`) |
| 72 | mega | reserved: withdraw-success total (`--text-mega`) |

The display tier marches evenly — **24 → 34 → 44, +10 each; mega = 3 × 24.**
The figure outranks the h1 on purpose: the money state is the hero, the title
is the setup. Figure + suffix share a **baseline** (`items-baseline`), the same
rule the instrument's own readout uses.

Exempt: the 8.5px goal etching inside the instruments — printed on the glass
(canvas scale), not set in the page.

What was collapsed to get here: 12.5px → 13 (15 uses), 11px → 12 (7), raw
12px → `text-xs`, 9px → 10, and three near-duplicate screen-h1 sizes
(1.9rem / 2rem / 2.15rem, a 4px spread doing one job) → one 34px token.

### Radius ladder — derived from the tube down

| value | name | job |
|---|---|---|
| 999px | tube | capsules: the glass column, buttons, pills, chips, dots, ghost bars |
| 24px | card | the shareable artifact card + the sheet's top edge |
| 16px | row | list rows, sections, framed groups (`rounded-2xl`) |
| 12px | field | inputs + freestanding choice chips (`rounded-xl`) |
| 10px | nested | **outer − inset**: a chip inside a `p-1.5` row frame = 16 − 6 |

Fixed to the ladder: the sheet top was 28px (unrelated to anything) → 24 =
card; nested mode chips were 12 → 10 (concentric); skeleton ghost bars were
`rounded-lg` (the one slop-tell radius in the codebase, per BIBLE §1) → tube.

### Spacing rhythm

24 between sections (`gap-6`) · 16 card padding + CTA height (`p-4`) ·
12 header→list (`mb-3`) · 8 between rows (`gap-2`) · 6 chip inset (`p-1.5`).
The one off-rhythm gap (a lone `gap-7`) was snapped to 24.

### Surfaces (for completeness)

White-alpha over `ink-950`: 0.02 quiet rows · 0.03 chips/pills · 0.04 fields
and secondary buttons · 0.05–0.06 raised/newest. Hairlines: 7% quiet · 10%
standard (`--color-line`) · 15–16% emphasis/hover.

## The black test (Stankowski)

All four key screens grayscaled at iPhone-15 @3x (`system-*-black[-before].png`
alongside this file). Verdict: **the hierarchy survives without color** —
the states were already form-carried:

- current round = pulse dot · funded = check · payee = crown tag · newest
  feed row = luminance lift · selected mode = inset ring · CTA = the
  brightest large shape on the page (luminance, not just hue).

Two signals were color-only and died in gray; both now carry form:

1. **Urgent countdown** (< 6h) was `text-warn` alone → `font-medium` added.
2. **Error lines** were `text-warn` alone → `font-medium` added.

Amber stays; it just never works alone.

## Reduction ledger (Rams)

**Killed — no reason found:**

- CSS keyframes `wave`, `bump`, `float`, `ribbon` + their `--animate-*`
  tokens. The liquid went canvas (`LiquidColumn` does its own wave math);
  these were animations nothing plays.
- The static dots inside the two landing row-links ("This bar is on-chain…",
  "See a real circle…"). Second and third status lamps per screen, saying
  what the header pill and the words already say. One lamp per screen.

**Kept — with the reason it earns its place:**

| element | reason |
|---|---|
| CTA gradient + top sheen + inset edge | the coral button's material identity — warmth is the brand |
| hero pulse-dot (one per screen) | the heartbeat; only beats when the data is live |
| header pill lamp | the screen's single status lamp (Demo / Live) |
| section-header index dots | one consistent list anatomy across feed/rotation/members |
| pour, gulp, confetti | celebration is the product, not decoration |
| newest-row luminance lift | "just arrived" emphasis, echoes the pour |
| sheet/header backdrop blur | legibility over scrolling content |
| empty-tube glass recipe (inset shadow + blur) | parity with the live instrument — the skeleton must match what loads |
| avatar rings | separates gradient avatars from row surfaces |
| rotation strip edge fade | scroll affordance for long rotations |

Nothing else asked to be cut: the screens were already past several
reduction loops, and honesty beats performative deletion.

## Fugu (vision fleet) verdicts

- Round 1 (on the afters — post geometry + black-test + reduction):
  **ALMOST** — "the bones are constructed … not AI-slop"; praised one-family
  type/surfaces/tubes/status pills. One in-scope construction finding: the
  figure/suffix lockup read optically floated → fixed (`items-baseline`
  everywhere, matching the instrument's own readout; endorsed exactly the
  ladder shipped here: "H1 at 34, amount at 44, suffix at 24"). Its
  remaining notes were product-identity questions (visible chain chrome),
  which is Rally's pitch — out of scope by design.
- Round 2 (confirmation on the baseline-locked finals): blocked by the
  Sakana subscription window (`HTTP 429 usage_limit_reached`, resets
  2026-07-04T02:02Z). The fix is visually verified in
  `system-*-{png,black.png}`. Re-run when the window resets:
  `python ~/.claude/skills/fleet/fugu_review.py "<round-2 prompt>"
  docs/design/system-0*.png` (downscale first: `sips -Z 1500`).
