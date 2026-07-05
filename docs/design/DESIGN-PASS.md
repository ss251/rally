# Rally design pass — Fable consultation (2026-07-05)

Grounded in the two UX-INTEL briefs + Rally's live screens + real source. Verdict: Rally's craft is already at-tier; the gap is that **the craft performs to a covered stage.**

## Already at-tier — PROTECT, do not touch
- **Vessel already has the spring physics the briefs told us to add** (LiquidColumn: K=220, C=19, ζ≈0.64, ~7% overshoot, ~400ms settle, per-chain pour slug, meniscus seam, full stop at rest, IO-pause, reduced-motion snap).
- **BottomSheet is already Vaul-class** (interruptible spring 420/44/0.9, drag-dismiss on offset OR velocity 700px/s). → REJECT the Vaul swap.
- **Token discipline is Linear-grade** (type ladder one-job-per-rung, radii from the tube, formatUsd, OKLCH chain bands, one-pulse-dot rule, borders-over-shadows).
- **The broken-circle screen is the best in the app** ("everyone's made whole," moonlight-mauve not red, refund CTA still coral = still a money act). Feature it in the demo.

## The gaps (all visible on the live screens)
1. **The numbers are dead** — `$16.50`/`55%` are static spans. Vessel sloshes, figure teleports. The most visible tier gap.
2. **The signature moment plays behind a scrim** — chip-in SuccessView says "Watch the bar rise" while a `bg-black/55 backdrop-blur` scrim COVERS the bar; `onContributed` fires while the sheet's still up → the pour plays to an empty house.
3. **Delight-Impact Curve violated** — confetti fires on EVERY routine chip-in (110 particles), devaluing the goal-met burst. Family fires confetti after backup, not every send.
4. **Nothing travels** — `.vt-hero`/`.vt-card` view-transition names reserved in tokens.css, applied NOWHERE. Landing→detail cross-fades; vessel duplicates.
5. **"Live" isn't live for spectators** — no polling; the bar only re-reads after YOUR contribution. A friend on the shared link sees a still image until reload.

## THE ONE SIGNATURE MOVE: "You watch your money land."
Not the vessel physics (exist). The completed LOOP = #1+#2+#4 choreographed: tap Chip in → check lands in sheet → sheet gets out of the way → your chain-colored slug pours in, meniscus sloshes + settles, `$16.50` rolls to `$41.50` in the same 400ms spring — in full view, feed row sliding in beneath. Then #3 extends it to everyone else's money. No app in the category has it: Family animates a send OUT; Rally animates the group's money IN, colored by where it came from. The thesis rendered as physics. **Build only one thing → build this.**

## Ranked adoption list
1. **Living numbers** (`@number-flow/react`, 24KB MIT) — replace raised/%/pot/feed spans; timing `duration:400, cubic-bezier(0.22,1,0.36,1)` to land with the spring; NumberFlow only on live-changing values (goal stays static — a target doesn't tick). *Quick win ~½ day, very high impact.*
2. **Ceremony sequence** — success view: spring check + "You're in", DELETE the confetti; auto-dismiss ~900ms; hold `onContributed()` until AFTER sheet exit (`onExitComplete`); optimistic bump via `res.movedUsd` (already returned) so the pour is instant, RPC reconciles in bg. *~1 day, very high — creates the moment.*
3. **Spectator liveness** — visibility-aware `setInterval(()=>visible && router.invalidate(), 20_000)` on `/c/$id` + `/circle/$id`. Thermometer already pours in the arriving chain's color; it's just starved of data. *Quick win ~½ day, high — social proof + demo-video gold.*
4. **Lighter scrim** — `bg-black/55 backdrop-blur` → `bg-black/35`, drop blur (blur over canvas forces repaints); optional shell scale 0.985/r12 (Family stacked-app). Makes #2 visible. *Quick win ~1–2h.*
5. **View-transition vessel travel** — add `.vt-hero` to Thermometer on `/` + `/c/$id` (one per DOM), enable TanStack `defaultViewTransition`; 320ms `--ease-rally` already tuned; existing root cross-fade = graceful fallback. *Deeper 1–2 days incl Safari QA; cut first if time-boxed.*
6. **Confirm morph — ONLY on cached-session one-tap** (first-timers: the Magic OTP IS the confirm; a second confirm = friction theater). Returning user w/ live session: first tap morphs `Chip in $25 → Confirm $25`, second sends. *~½ day, medium — closes the "wait, it already sent?" gap.*
7. **Coral discipline** — Circles "New" badge + RotateCw icon on landing drop coral → `text-muted` (leaves exactly one coral element/screen = the CTA). *Minutes.*

## Do NOT (pressure-tested rejections + traps)
- No haptics (iOS 26.5 killed web haptics — dead weight). No sound (web = casino-tell + iOS silent-switch inconsistency; the physics IS the sound).
- No command palette / Liquid-Glass refraction / WebGL atmosphere (mobile consumer; vessel is already the one expression zone — a second atmosphere fights it).
- No confetti except the two rare peaks (goal crossing / final payout). Removing it from routine success RAISES the tier.
- No ambient motion at rest (the instrument stopping is a deliberate Rams move — resist "make it feel alive" idle waves).
- Don't swap BottomSheet for Vaul; don't chase Rainbow's 80–100px rounded display type (Clash Display 34/44/72 IS Rally's identity).

**Signature-move complete (#1+#2+#4+#7) ≈ 2 focused days, all additive, one 24KB dep. The fix is as much DELETION (one scrim, one confetti) as addition.**
