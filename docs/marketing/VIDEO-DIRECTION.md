# Rally demo video — creative direction (Fable, 2026-07-05)

The stack decision + v2 creative direction. Research memos in the session transcript; playbook in PLAYBOOK.md.

## AWARD-CALIBRE ELEVATION (2026-07-05, 5-agent research pass — supersedes where it conflicts)
Founder mandate: "award-winning calibre, not a generic demo." Research reverse-engineered Linear/Family/Raycast/Arc/Superhuman/Stripe/Vercel/Notion-Calendar films + what wins judged hackathons.

**How award films are actually made:** almost never one person doing everything. Winning pattern = a tight CONCEPT spine (in-house or brand agency) + ONE specialist executing motion. The two most solo-relevant (Superhuman, Stripe) were design-direction + a SINGLE freelance animator. That's our realistic model.

**What separates award-winning from good — RANKED:** (1) CONCEPT/narrative over feature-listing — make you FEEL one idea (Linear deleted the screenshot, put a film there; BUCK brief = "no product demos"); (2) RESTRAINT + one signature move (Rams bar — subtract to serve the hero shot); (3) **SOUND DESIGN — disproportionate leverage, the thing solo devs skip, highest quality-per-dollar** (sound sets the emotional read before the first frame lands; crypto-trust palette = low-freq hum under "held/pooled," bright transient on "payout"); (4) TYPOGRAPHY as lead actor in service of the concept (kinetic type carries the idea so VO stays light); (5) real product-UI craft (the money-truth shot); (6) 3D/cinematography LAST — high cost, negative marginal return, faking it reads as slop. DON'T chase it.

**🔴 Rally-specific killer finding:** our current 66s demo is a SILENT FILM (audio = digital silence, −91dB, render references no audio). Sound ranks #2–3 in award-winning work → **adding real sound design + music is the single highest-leverage move for Rally.**

**UXmaxx judging (the load-bearing fact):** UX & Design **~40–45%** (intuitiveness for NON-CRYPTO users) · Technical ~25% (or UA+7702 use 30% on the UA track) · Creativity/Ambition ~20% · Completeness ~10% ("end-to-end functional demo, NO broken flows or placeholders"). Two rubric listings differ slightly; the load-bearing truth = **UX is ~40-45% and "a normal person could actually do this" + "it's real, no placeholders" are what score.** Video cap 5 min; live finale = 5-min pitch, VC judges.

**What wins JUDGED hackathon videos = HYBRID (not either pole):** a tight, REAL, narrated screen demo wrapped in a lightly-produced film shell. NOT a pure product-film (reads as vaporware — fails completeness + "would I use it"), NOT a raw screencast (leaves the 40-45% craft points on the table). Length 90s–2min, front-loaded (judges watch many back-to-back), open on the magic moment NOT a logo, faceless VO over the running product, tie everything to the problem + who it helps. "Storytelling is huge." Winning-pitch skeleton: name → one-sentence what-it-is → problem → 3-4 UX features each tied to sponsor tech → live walkthrough → differentiation close.

**⇒ TWO CUTS, same footage/comps:**
- **A · Hero/social film (~40s)** — Fable's direction below (concept-first, restrained, silent money-moment, constructed-mark close). For X/Twitter. Award-calibre CRAFT piece.
- **B · Submission film (~90–120s)** — the HYBRID judges reward: magic-moment cold open → the "no seed phrase / any chain / just email" unbroken UX take (faceless VO) → features tied to sponsor tech → the trust beat (broken circle → auto-refund) → differentiation close. For UXmaxx.

**Honest ceiling:** top-tier hackathon film, better than ~95% of UXmaxx submissions, genuinely "award-calibre for this venue" — ACHIEVABLE. NOT Linear/BUCK broadcast tier (bespoke C4D/cinematography/original score) — don't try; faking it LOWERS quality and undercuts the "this is real" story that the 40-45% UX + completeness score rewards.

**Highest-leverage BUYS (founder $ decision):** (1) **SOUND — the #1 buy:** freelance sound designer for original score + SFX + mix (~$200–500 on Contra/Fiverr), OR premium licensed track (Epidemic Business $30/mo, ad-safe) + my own beat-synced UI SFX work. (2) Optional: ONE Veo 3.1 human b-roll hero shot (~$20, real friends splitting a dinner / group chip-in) to bookend with human emotion — the one thing Remotion+Screen-Studio can't manufacture. Everything else our stack does natively; don't spend the 2 weeks anywhere but concept + hero shot + sound.

**Stack confirmed sufficient:** Screen Studio/Matte capture (real iOS, real iPhone frame) → Remotion composite (it ships PhoneFrame w/ Dynamic Island + status bar, animated cursor, spring TextOverlay, NumberTicker) → soundtrack + beat-synced SFX.

**FOUNDER DECISIONS (2026-07-05):** (1) SOUND — research the audio stack properly first (GitHub/web/agent-reach, don't default-buy). (2) Human b-roll — NO, product-only (full "this is real" lean, zero AI-slop-tell risk). (3) BUILD ORDER — submission cut (~90–120s, the hybrid judges reward) FIRST, then the ~40s hero/social cut from the same footage. **(4) DEMO NARRATION — FOUNDER runs the whole walkthrough himself (human-in-the-loop; gives judges confidence he knows his own product; 'we look at the end-user experience' is what scores). ⇒ NO AI VO for the submission cut — founder narrates live over his own screen recording. The SUBMISSION-SCRIPT.md draft becomes HIS talking-track to edit + speak, not a TTS input.**

---
(Original Fable direction for Cut A follows — still valid, now scoped as the hero/social cut:)

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
