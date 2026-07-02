# RALLY — Design Bible & Interaction Manifesto
### The bar: legendary. UXmaxx judges UX at 40%. This app must FEEL like the future and BE the future. No AI slop. It just works.

> Read this before writing a single line of UI. It is the constitution. Any screen that violates it gets rebuilt, not shipped. Builds on `src/design/DESIGN.md` (art direction) — this doc governs *craft, motion, and the quality bar*.

---

## 0. The Jobs test (apply to every screen)
1. **What is the ONE thing?** Every screen has a single hero. On the campaign screen it's the liquid rising. Everything else recedes. If two things fight for attention, cut one.
2. **Would you show this at a keynote?** If a detail would make you wince on a projector at 4×, fix it. No placeholder text, no misaligned pixel, no janky frame.
3. **Does it feel inevitable?** Great design feels like the only way it could have been. No decoration for decoration's sake. Subtract until it breaks, then add back one thing.
4. **Does it just work?** Zero dead ends. Every state designed. First-run, empty, loading, error, offline, success, reduced-motion. The demo cannot have a "hmm, that's broken" moment.

---

## 1. Anti-slop constitution (the tells of AI slop → the fix)
| Slop tell | What we do instead |
|---|---|
| Default Tailwind `shadow-lg`, `rounded-lg`, `blue-500` | Bespoke tokens only. Custom layered shadows (ambient + key + contact), the dusk/coral palette, `--radius-tube`/`--radius-card`. Never a raw utility color. |
| Linear/`ease-in-out` transitions, uniform 200ms everywhere | **Spring physics** (mass/tension/friction). Different weights for different objects. Nothing moves linearly. Motion is interruptible. |
| Everything fades/slides the same way | A **motion vocabulary**: money *rises* (expo-out), chips *spring in* (overshoot), sheets *drag* (rubber-band), errors *shake* (damped). Each object has one signature motion. |
| Generic centered card stack, even margins | Intentional composition: optical alignment, a real 4px spacing rhythm, deliberate asymmetry, generous whitespace. The eye is led. |
| Emoji as icons, inconsistent icon weights | One icon set, consistent stroke weight + optical size. Icons are quiet. |
| Lorem ipsum / "Campaign 1" | Real, specific demo copy in Rally's voice. Names, amounts, notes that feel human. |
| Layout shift on load; spinners | Skeletons that match the final layout *exactly* (no shift). Content-first. Perceived-instant. |
| Numbers that jump/jitter | Tabular figures (`.tnum`), count-up animation with easing, monospace tickers. Money is the hero — it never jitters. |
| Over-animated, everything moving at once | **Restraint.** Cap simultaneous motions. Silence between beats. Ambient loops are ≤ subtle. A still screenshot must look calm and alive, not busy. |

---

## 2. Interaction craft — "buttery smooth" defined
- **60fps floor, 120fps target (ProMotion).** Animate ONLY `transform` + `opacity` (GPU-composited). Never animate `width/height/top/left/box-shadow` on the hot path (the thermometer fill uses `transform: scaleY` + a masked column, not `height`). `will-change` on animating layers, removed after. Zero main-thread layout thrash — verify with a frame check.
- **Physics, not durations.** Use **Motion** (`motion.dev`, the modern Framer Motion) for React springs, gestures, layout + exit animations. Springs tuned per object (the sheet is heavy/rubbery; a chip is light/snappy). Animations are **interruptible** — grab a moving sheet mid-flight and it follows your finger.
- **Gesture-native.** The **contribute bottom sheet** is drag-to-dismiss with rubber-banding + velocity-based snap (not a modal that just appears). Swipe, momentum, and detents like a native iOS sheet.
- **Instant feedback (<100ms).** Every tap has an immediate response: button press = scale 0.97 + subtle inner shadow; optimistic UI (the thermometer bumps the instant you confirm, before the chain settles — reconcile on receipt). Latency is hidden behind motion + optimism.
- **Route/state transitions:** use the **View Transitions API** (shared-element morphs; the campaign card morphs into the campaign screen) with a graceful cross-fade fallback. Buttery, native-feeling navigation.
- **Haptics + sound (tasteful, optional):** `navigator.vibrate` for micro-haptics on contribution/goal (Android/Chromium; note iOS Safari won't fire it — motion + sound carry it there). A single, gorgeous, *muted-by-default* Web Audio chime when money lands and a richer one on goal-hit. Never annoying; always optional.
- **prefers-reduced-motion:** strips decoration, keeps the fill height (it's DATA), swaps the confetti burst for the calm funded state. Accessibility is not an afterthought.

---

## 3. The signature moment — the liquid (make it world-class, not a CSS bar)
This is the whole pitch, made tactile. It must look like *liquid*, not a progress bar.
- **Rendering:** canvas/WebGL. A real **wave surface** (layered sine + Perlin noise, drifting), a **bright animated meniscus** with a specular highlight, **subsurface glow** keyed to the topmost chain, and **chain-hued bands** that refract slightly (a faint vertical distortion) so the mercury reads as a *material*, not flat fill. Explore a lightweight **WebGL shader** for the glass/refraction if perf allows (this is the "future" texture — think Apple Liquid Glass / visionOS materiality, restrained); canvas-2D with craft is the reliable floor.
- **The rise:** expo-out over ~900ms; bands re-proportion with a spring as a new chain's USDC lands; a one-shot squash-and-stretch "gulp" bump on each contribution.
- **The cross-chain reveal:** you can *see* "half came from Solana" in the band heights — no legend needed. Tap the mercury → the bands gently separate with labels (a delightful, discoverable detail).
- **Goal-hit:** the number slams to 100% (spring overshoot) → confetti (chain-tinted) + haptic + chime → the CTA morphs "Chip in" → "Share the win." Fires once, on the live crossing only.

---

## 4. "It just works" — the states that must exist (every screen)
first-run · loading (skeleton, no shift) · empty ("Be the first to chip in") · in-progress (optimistic) · success (celebratory, plain) · error (human voice: what happened + the one fix) · offline (PWA — cached shell, graceful) · reduced-motion. A demo that hits any unhandled state fails the Jobs test.

---

## 5. Materiality & depth (the "future" look, tastefully)
- Dusk plum canvas as the void; the thermometer is the light source (it casts glow on nearby surfaces).
- **Layered glass** for sheets/cards: frosted backdrop-blur, a hairline top highlight (1px inner light), a soft ambient shadow + a tight contact shadow. Depth via light, not heavy borders.
- Specular highlights that respond to position (subtle). Grain/noise at ~3% to kill banding on the gradients.
- Restraint: glass is a seasoning, not the whole meal. If it reads as "glassmorphism demo," pull it back.

---

## 6. THE UI QUALITY GATE (enforced like the skill-gates — no slop ships)
Every UI PR MUST pass this loop before merge (report the evidence):
1. **Build + screenshot on a real mobile viewport** (iPhone 15 dimensions, 3x DPR) for each key screen + each state.
2. **`Skill(frontend-design)`** — apply its distinctive-design guidance while building (not templated defaults).
3. **Fugu (vision) review** on the screenshots: `python ~/.claude/skills/fleet/fugu_review.py "<critique prompt>" shot.png` — critique hierarchy, alignment, spacing rhythm, contrast, motion-feel, and "does this read as premium consumer or as a dapp / AI slop?" Downscale via `sips -Z 1500`.
4. **`Skill(design-review)`** — the designer's-eye QA pass for inconsistency/AI-slop patterns.
5. **Apply fixes → re-screenshot → repeat** until Fugu + design-review both clear a HIGH bar (not "fine" — genuinely great). Log the before/after.
6. **Perf check:** no layout shift (CLS ~0), transforms/opacity only on animations, 60fps.
7. Self-audit against the §1 anti-slop table. Any hit → fix before PR.

---

## 7. Reference altitude (the bar to clear — study these, don't copy)
Family wallet (family.co) fluid iOS motion · Phantom / Rainbow wallet polish · Robinhood / Cash App money-clarity · Linear + Arc craft & restraint · Apple/visionOS materiality & spring physics. Rally should sit comfortably next to these — a consumer product that happens to be onchain, indistinguishable in polish from the best fintech apps.

---

## 8. Stack (decided)
- **Motion** (`motion` / motion.dev) — springs, gestures, layout + exit, interruptible.
- **View Transitions API** — shared-element route morphs (fallback cross-fade).
- **Liquid:** canvas-2D craft floor → WebGL/shader refraction if perf-verified.
- **Web Audio** (muted-by-default cues) + `navigator.vibrate` (progressive, iOS-aware).
- TanStack Start / Vite / Tailwind v4 (tokens.css) + the existing presentational components as the base to elevate. PWA: installable, standalone, custom icon/splash, offline shell.
- Keep bundle lean; lazy-load the shader/audio; the money path must be instant.
