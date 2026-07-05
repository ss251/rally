# Rally demo video — Playwright → Remotion pipeline

A **repeatable** pipeline that produces `rally-demo.mp4` — a ~66s, 1920×1080
H.264 product film for the hackathon submission + marketing. Re-run it whenever
the app or the script changes; nothing here is a hand-edited one-off.

```
capture (Playwright)  ──►  clips/*.mp4 + stills/*.png  ──►  render (Remotion)  ──►  rally-demo.mp4
   live app, per beat            captured beats            composite + captions        the master
```

- **Playwright** records a smooth clip of the *live* app for each storyboard beat
  (`scripts/capture.mjs`) — most beats come straight from existing live state
  (landing bar mid-fill, `/circle/1` rotating, `/circle/2` broken+refunded).
- **Remotion** (`src/`) composites those clips into a device frame on the dusk
  brand canvas, adds Clash-Display lower-thirds/captions, motion graphics, and a
  logo close — motion is transforms/opacity only.

## Run it

```bash
cd marketing/demo
bun install                 # or npm install  (isolated from the app's deps)

bun run capture             # 1. record clips + stills off the LIVE app  (~1 min)
bun run render              # 2. assemble the 1920x1080 master           (~2-4 min)
# or: bun run all           # capture then render

bun run preview             # optional: open Remotion Studio to scrub/tweak
```

Outputs:
- `rally-demo.mp4` — the master (1920×1080, ~66s, H.264 + faststart).
- `clips/*.mp4` — per-beat source clips (`.webm` originals are gitignored).
- `stills/key-*.png` — composited key frames for the PR/README preview.

Point at a different deployment (or localhost) with `RALLY_URL`:

```bash
RALLY_URL=http://localhost:3000 bun run capture
```

Capture a subset of beats:

```bash
BEATS=chipin,circle-2 bun run capture
```

## The storyboard (what each beat is)

| Beat | Time | Source | Caption |
|------|------|--------|---------|
| Cold open | 0:00 | `landing.mp4` | "Group money that pays out **together**." |
| Chip in | 0:08 | `chipin.mp4` | "Just an **email**. From any chain." |
| Payoff (money moment) | 0:18 | `landing.mp4` + overlay | "You're in ✦" |
| Invisible chain | 0:24 | `landing.mp4` + `ChainHop` | "You never saw a **bridge**." |
| Mode switch → Circles | 0:31 | `mode-switch.mp4` → `circle-1.mp4` | "Same promise, second **shape**." |
| Trust punchline | 0:43 | `circle-2.mp4` | "Everyone gets their money **back**." |
| Close | 0:58 | logo (in-composition) | "One link. Pays out together, or refunds everyone." |

## The money moment — path (a)

Rally's "bar rises" beat is the only one needing a live action. We use **path (a)**:
capture the chip-in *sheet* interaction (open → type email → pick $25 → press
"Chip in") through the **real "Check your email…" auth step** — but we **never
enter an OTP**, so no contribution completes and prod state is never mutated.
The "You're in ✦" payoff is then composited over the live filled bar in Remotion.
This keeps the pipeline deterministic and repeatable.

> Path (b) — a real end-to-end chip-in (cloud browser + Gmail-MCP OTP) to film
> the bar genuinely rising — is the second-pass upgrade. The `LiquidColumn`
> snaps to fill on first paint and only *pours* on a live `raised` increase, so a
> genuine on-screen rise requires a real contribution.

## Layout / structure

```
scripts/capture.mjs   Playwright — records clips/*.mp4 + stills/*.png per beat
scripts/render.mjs    Remotion  — bundles src/ and renders rally-demo.mp4
scripts/recon.mjs     one-shot probe of live state (not part of the pipeline)
src/RallyDemo.tsx     the timeline (all beats) — edit captions/timing here
src/components/       Background, Phone (device frame), Caption, Mark (logo)
src/beats/            ChainHop, MoneyBadge — the two motion-graphic overlays
src/theme.ts          brand tokens mirrored from src/design/tokens.css
assets/fonts/         Clash Display woff2 (bundled so the render is host-independent)
public/               derived Remotion static dir (mirrored at render, gitignored)
```

Edit the script/timing in `src/RallyDemo.tsx` (the `DUR` map + `Caption` props),
re-run `bun run render`.
