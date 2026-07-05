# Rally demo video — creative direction (Fable, 2026-07-05)

The stack decision + v2 creative direction. Research memos in the session transcript; playbook in PLAYBOOK.md.

## Stack (decided)
- **Split stages.** Premium real-iPhone quality + agent-automation can't coexist in one tool → capture the REAL app in a REAL iPhone frame, then composite in **Remotion** (stays as the only compositor). The first draft failed on 3 ASSETS, not the pipeline: fake CSS bezel, cursorless linear footage, a composited fake money-moment.
- **Two hard brand rules:** (1) NEVER fake state — every on-screen change happened on a real chain. (2) Real geometry only — real iPhone 16 Pro frame (Dynamic Island, correct radii), licensed third-party (RemotionUI `device-mockup-zoom` / Keyloom `PhoneFrame`); NOT Apple's bezel (static-use-only license). No brag/Hyperframes (re-creates UI = slop class).
- **NO tumbling 3D phone (skip Rotato).** One real iPhone, plumb (0° rotation), front-on, throughout. Energy from the CAMERA (spring push-ins/pull-backs, one lateral slide), not the object. Restraint = the differentiator.
- Volume/repeatable layer = Fable-driven Remotion (proof: @trq212/Anthropic Fable→Remotion launch video, 1.03M views).
- Optional premium upgrade: founder Matte session (matte.app) on his real iPhone, 3-4 hero clips, swapped into the same Remotion `Clip` slots later. Not a dependency.

## The cut — 42s (hard target), 1920×1080
| Beat | Time | Direction |
|---|---|---|
| Cold open | 0–4s | Open INSIDE the screen — full-bleed crop on the thermometer mid-rise, live numbers ticking. Product first, no logo. Spring pull-back reveals iPhone + "Group money that pays out **together**." |
| Money moment | 4–14s | REAL chip-in. Tap "Chip in $25" (restrained tap dot, real press state) → "You're in" → **bar genuinely rises on-chain.** Push in + hold; captions SILENT ~2s. The shot — let it breathe. |
| Any chain | 14–22s | The ONE logo moment: 6 official chain marks (from ChainIcon.tsx, Optimism #FF0421) spring into an even horizontal rank (spec-sheet), collapse along a drawn line into the vessel. "Chip in from any chain. Just an email." |
| Circles | 22–29s | Lateral slide, mode switch → /circle/1 rotation. "Or take turns — rotating savings, same rules." |
| Trust punchline | 29–38s | /circle/2 broken+refunded. Copy verbatim: "We broke this circle on purpose. Nobody holds the money — **including us**." Push in on "Settled on-chain · vault 0xdd9b…" — the receipt is proof. |
| Close | 38–42s | The vessel mark CONSTRUCTS itself (stroke paths draw → coral fills). Wordmark, URL, hold 2s, cut to black. No pulse/shimmer. |

## Craft rules
- **Motion:** springs everywhere; `@remotion/motion-blur` on any move >~300ms. ZERO linear easing.
- **Capture:** iPhone viewport, DPR 3 (sharp screen inside sharp bezel). Restrained iOS tap indicator synced to real touch events. No fake cursors/hands.
- **Kill the coral halo** in Phone.tsx (real objects don't emit brand light) → grounded contact shadow only.
- **Captions:** ≤7 words/card, headline-grade fragments; drop ✦ glyphs. NO VO.
- **Music:** quiet warm percussive ~92–100 BPM (Teenage Engineering / early Stripe register). Banned: risers, whooshes, braams, drops. One sound-design "thock" when the bar lands. Founder picks the track.
- **Official chain logos:** verbatim from ChainIcon.tsx, never recolored; one moment only, no orbiting-coin/token-rain slop.
- **The one feeling: CALM CERTAINTY** — the quiet click of a mechanism that can't hold your money hostage. If a beat feels exciting instead of certain, cut it.

## Sequencing
- **Agent now (no founder time, submission-grade):** frame transplant + kill halo + contact shadow; recapture all footage at DPR 3 with tap dots, driving a REAL chip-in (automated-e2e + Gmail OTP) for the genuine bar-rise; motion rebuild (springs + motion-blur, 42s beat map); chain-logo beat; tightened captions; constructed-mark closer; placeholder score at final levels; render 1920×1080. Clips stay in swappable `Clip` slots.
- **Founder when he has 45 min (before ~Jul 16):** Matte session, 3-4 hero interactions + pick music track. Agent swaps clips; cut/timings/type never move.
- **Fast-follow (P2, cheap once comp exists):** 9:16 vertical of beats 1–2+close for X-native.
