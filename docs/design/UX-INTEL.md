# UX design intelligence — frontier references for the Fable design pass (2026-07-05)

Gathered to ground Fable's UI consultation in specific mechanics (not vibes). Part 1 = web2 frontier (Linear/Superhuman/Family/Geist/Stripe/Emil Kowalski's motion rulebook/Liquid Glass). Crypto-app brief (Family/Rainbow/Polymarket/Robinhood) appended when its agent returns.

## The 9 frontier techniques (mechanic · exemplar · React/Motion repro)
1. **Optimistic-first state** (Linear/Superhuman) — mutate local store, render, reconcile in bg; never block UI on network. TanStack Query `onMutate` / Zustand. *Biggest perceived-speed lever; an architecture choice.*
2. **Spatial-origin motion** (Linear/Family) — elements animate out of/into the control they belong to. `transformOrigin` at trigger; `layoutId` for shared-element travel.
3. **Asymmetric enter/exit** (Linear) — in ~instant/100ms, out ~150ms fade. Different transition on `animate` vs `exit`.
4. **Interruptible springs > fixed tweens** (Emil Kowalski/Family) — anything grabbable mid-motion uses velocity-preserving springs. `type:"spring", stiffness:400, damping:30`. Everything else `ease-out` <300ms.
5. **Teaching command palette** (Superhuman/Raycast) — Cmd+K, fuzzy-scored, shows shortcut beside each command. `cmdk`. *(Rally: skip — mobile consumer; borrow only the teach-the-next-action instinct.)*
6. **Restraint-as-luxury** (Geist/Linear/Craft) — depth from 1px borders + tint, NOT shadows (shadows only on transient overlays); one accent used "like punctuation."
7. **Living numbers** (Family/Geist) — money as first-class animated objects: tabular/mono numerals (no jitter), digits roll/tween, commas slide into place, values count up. `font-variant-numeric: tabular-nums` + rolling-number component.
8. **GPU-composited atmospheric expression, contained to ONE zone** (Stripe/Raycast) — one rich moment (WebGL mesh/glow) bounded to a region, GPU-rendered, everything else calm.
9. **Ceremony budgeting — delight scaled to frequency** (Family/Things 3) — big/skeuomorphic/sound/confetti on RARE milestones; near-invisible restraint on frequent actions.
Bonus: **specular-rim glass cheat** — `backdrop-filter: blur()` + translucent fill + bright thin top/left rim (fake the highlight); skip true SVG `feDisplacementMap` refraction (Chrome-only, expensive, mobile is Rally's target).

## Signature moves worth stealing (specific)
- **Family:** directional tab motion (touch-side → transition direction); **text-morph button** "Continue"→"Confirm" morphing shared letters to escalate an irreversible action; **commas physically slide** as digits enter an amount; persistent component travel (one object moving, not two appearing); **stealth-mode shimmer** for background value updates; ceremony reserved (creation animation, backup confetti, delete-tumbles-to-trash-with-sound).
- **Linear:** motion tokens `.1s / .25s / .35s`; warmer-gray 2026 refresh ("don't compete for attention you haven't earned"; "structure should be felt, not seen"); spatial-origin popovers; composited props only.
- **Geist:** dark-first (light is the alt); mono/tabular numerals everywhere numbers matter; color as punctuation; borders over shadows.
- **Stripe:** WebGL mesh gradient (~10kb minigl, GPU not CSS) contained to upper third.
- **Emil Kowalski motion rules:** <300ms; never animate keyboard-repeat actions; `ease-out` for interactive, spring for interruptible; never `scale(0)`→in (start ~0.9–0.95); scale-on-press 0.96–0.98; 60fps transform/opacity only; always `prefers-reduced-motion`.

## Rally transfer map (dusk #130d1a + coral #ff7a50, mobile, liquid vessel)
**Tier 1 (define Rally's character):**
- **Living numbers** — pool balance + each contribution: tabular numerals that count/roll on change, commas slide in. Highest-leverage for a money app.
- **The vessel = Rally's ONE contained GPU-expression zone + ceremony budget** — GPU-smooth coral fill with SPRING physics on fill level (a contribution *sloshes* up + settles, not linear tween); reserve confetti/haptic/full-screen ceremony for condition-met/pool-fills ONLY.
- **Spatial-origin motion** — contribution sheet scales out of the button; vessel is a persistent `layoutId` element traveling between list ↔ detail.
- **Optimistic-first** — contribution lands in UI + bumps vessel INSTANTLY, reconcile on-chain in bg; pending = Family stealth shimmer over the optimistic value. *This is what makes a crypto app feel web2-frontier not web3-laggy.*

**Tier 2 (the discipline):** borders over shadows on dusk (`border-white/6–10`), coral as punctuation only; all transitions <300ms ease-out, springs on vessel + draggables, `prefers-reduced-motion` static-fill fallback; **text-morph "Contribute"→"Confirm"** to escalate committing real money.

**Tier 3 (skip):** command palette (mobile consumer); true Liquid-Glass refraction (Chrome-only); AI-native canvas.

**Through-line:** Rally's WARMTH = living numbers + physically-springy coral vessel + optimistic instant feedback. Rally's RESTRAINT = Geist/Linear discipline (borders over shadows, coral as punctuation, sub-300ms motion, ceremony spent only on pool-fills).

Sources: performance.dev/Linear, Linear design-refresh posts, Superhuman command-palette blog, benji.org/family-values + useinari Family principles, vercel.com/geist, Stripe gradient guides, emilkowal.ski/ui/great-animations, kube.io Liquid Glass, awesome-ios-design-md.

---

## Part 2 — Crypto/money-app intel (Family/Rainbow/Polymarket/Robinhood/Cash App)

**⚠️ LOAD-BEARING CURRENT CONSTRAINT:** iOS 26.5 (mid-2026) PATCHED the `<input switch>`/`<label>` trick that web-haptics libs used → **programmatic web haptics are DEAD on iPhone Safari** (`navigator.vibrate` = Android only). Rally is a web app → **do NOT rely on haptics for money-tangibility on iPhone**; carry it with MOTION + SOUND + the vessel's physicality. (Only if Rally ships an Expo/native wrapper: `expo-haptics`, one haptic on payout.)

**Copy-pasteable assets (highest ROI):**
- **Vaul** (github.com/emilkowalski/vaul — Emil's open-source recreation of Family's tray system) — the EXACT Family feel: `EASE: cubic-bezier(0.32, 0.72, 0, 1)`, `DURATION: 0.5s`, `VELOCITY_THRESHOLD: 0.4`, `CLOSE_THRESHOLD: 0.25` (drag past 25% dismisses), nested-drawer displacement 16px, top offset 26px. Trays vary height deliberately (each = one idea); theme each tray to its parent flow; keep the vessel visible behind the tray (preserve context).
- **`@number-flow/react`** (Maxwell Barvian, MIT, 24KB, 760k wk dl) — animated tabular number ticker with `trend` for per-digit up/down. THE install for pot total / balances / odds. `number-flow.barvian.me`.
- **`canvas-confetti`** — fired ONCE on the rare essential success (payout), never on routine chip-ins.

**Family signature money-moments (Benji Taylor, benji.org/family-values):**
- **Continue → Confirm text morph** (shared letters stay, tail animates) at the money boundary — escalate an irreversible action. The entered amount physically TRAVELS into the confirm screen (`layoutId`) so you see the number-entered IS the number-sent.
- **Delight-Impact Curve:** delight intensity ∝ 1/frequency. Confetti only after a RARE essential action (Family: after wallet backup, not every send). High-frequency actions get whisper-touches (comma shift, checkmark).
- **Fly don't teleport:** directional tab flash (touch-side → transition direction); components PERSIST/travel between screens (never duplicate an element in a transition).
- **1:1 gesture, threshold-gated commit:** apply scale/translate delta live with the finger; fire LIGHTWEIGHT actions mid-gesture, DESTRUCTIVE/committing actions only on release (`offset>threshold || velocity>0.4`). Separates pro from amateur.
- Spinner migrates into the bottom nav on confirm (teaches where the pending tx lives); stealth-mode shimmer for hidden-but-updating values.

**Rainbow:** identity-as-personalization (emoji + color per wallet = first-class primitive); SF Pro Rounded Black display 80–100px, tracking −0.03em; exactly TWO chromatic CTAs (tangerine #ff8a00 / pink #ff54bb) — decoration uses separate gradients; 40–50px pill radii; depth from inset highlights + pastel washes, NO harsh shadows/borders.

**Polymarket 2026 redesign:** capital-flow-as-NEWS — homepage rebuilt to look like Reuters not an exchange: hero carousel of high-heat cards + a big probability line chart as the "headline," volume + up/down arrow + live comments per card; dense list pushed below fold. Lesson: dense real-time data → scannable via news-media hierarchy. Trap: never ship the web-wrapper feel.

**Robinhood (calm-money gold standard):** number + graph animate together on value change; tapping a card animates it to fill screen from its origin (shared-element); haptic-synced feature reveal used as RARE surprise reward; color (green/red) as the primary money signal; "emotional architecture" — design for how it FEELS; progressive disclosure (simple surface, pathways to depth).

**Cash App:** proprietary 3D icon library (650+) turns money tasks into a game (delight in ILLUSTRATION, structure stays clean); Cash Sans; high-contrast heavy-white-on-saturated (an accessibility decision); "almost nothing has a sharp corner."

**Revolut:** decisive big-✓ "Payment sent!" success; balance in large numbers over gradient; bright accents RESERVED for key/promo actions (where you spend color = what you tell users to do).

## Rally transfer (crypto-brief additions, ranked)
1. **The vessel IS Rally's Family-send-flow signature money-moment:** each contribution LANDS into the liquid — spring-driven fill-height + `@number-flow` pot total + soft liquid/chime sound. Direction = meaning: contributions flow UP; auto-refund gently DRAINS down, warm+safe (coral dims to dusk, "everyone got their money back"), NEVER a red error state.
2. **Payout = `canvas-confetti` exactly ONCE** (coral/warm) — Rally's rare emotional peak. Routine chip-in stays whisper-light (surface ripple + level rise + number tick).
3. **Hide cross-chain/email complexity behind Vaul trays** (varied heights, vessel visible behind); **Continue → "Confirm chip-in" label morph** at the money boundary.
4. **Color discipline:** dusk #130d1a = calm trust canvas; coral #ff7a50 = the SINGLE chromatic CTA AND the rising-liquid fill — reserve it so coral always means "money/act" (Rainbow's tangerine discipline). Soft pill radii, depth from inset glow not harsh shadows.
5. **Pot state scannable via Polymarket news-hierarchy:** hero card = vessel + big NumberFlow total + threshold chip; contributor list below. The thermometer-toward-threshold = Rally's "are we going to make it" glance signal (= Polymarket's probability curve).
6. **Identity per pot** (Rainbow/Zora): a pot carries an emoji + inherits coral accent → recognizable in a list, shareable, makes "group money" feel personal (Rally's whole thesis).

Sources (crypto): benji.org/family-values, rauno.me/craft/interaction-design, github.com/emilkowalski/vaul + emilkowal.ski/ui/family-tray-system, 60fps.design/apps/family, number-flow.barvian.me, design.google Robinhood, buck.co Cash App, styles.refero.design Rainbow teardown, Gate News Polymarket-2026.
