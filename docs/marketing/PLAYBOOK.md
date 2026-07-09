# Rally / founder-brand marketing playbook (research 2026-07-05)

Synthesized from 3 agent-reach research passes (X traction, video tooling, crypto distribution). Full memos in the session transcript. Live decision surface: `.lavish/traction-engine.html`.

## 1. Account architecture — DECIDED: one personal founder hub
- Every successful multi-product solo dev runs a SINGLE personal account, products in bio like an app store: @levelsio (911K, 8 products), @marclou (360K), @tdinh_me (194K), @yongfook (164K — product handle is a dead 9-follower parody).
- Hybrid done right (Marc Lou): personal @marclou 360K; product accounts @DataFast_ 2.6K / @trust_mrr 4.8K (~1% size, changelog/support/trust only). Launches fire from personal, quote-tweeted DOWN to product handle.
- **X rules:** up to 10 accounts for distinct non-duplicative purposes = FINE. BANNABLE: alts liking/replying to boost the main (coordinated inauthentic behavior); cross-posting identical content (SimHash spam); follow-churn / "get followers" automation.
- **Move:** designate ONE personal account as the hub. A @rally handle waits until Rally has real users (post-hackathon).

## 2. 2026 reach mechanics (grounded in live github.com/xai-org/x-algorithm)
- Conversation ≫ all: deep reply ≈ ×75, RT ×20, reply ×13.5, like ×1. **First 30–60 min replying to every comment = highest-ROI action.**
- Native video = 3.4–5× distribution (scores first 3s + completion). Video uploaded TO X ≫ YouTube link.
- External-link penalty INTENSIFIED Mar 2026 → value in main post, LINK IN FIRST REPLY / self-quote.
- Premium = 4–8× reach at $8/mo (highest-ROI purchase). New accounts near-invisible ~2–4 weeks (TweepCred floor) — normal.
- Cold-start engine (0→1000): 5–10 thoughtful in-niche replies/day under bigger accounts. First 1000 ≈ 2–4 months.
- Penalties: >1–2 hashtags; author-diversity decay (halves 2nd back-to-back post) → SPACE different products across days.

## 3. Content stack (agent-driven, ~$0–2/video)
- **Remotion** — FREE solo/≤3 people, best-in-class programmatic video (React). Bites only at 4+ employees ($100/mo Automators).
- **Playwright capture → Remotion compositing** = cleanest path to a polished demo of the live app. Blueprint: github.com/gerokeller/demo-recorder (builds narrative from a PR diff + test plan).
- **OpenMontage** (github.com/**calesthio**/OpenMontage — AGPLv3): agent-orchestration layer, Claude Code is the director; 12 pipelines incl. screen-demo + clip-factory. AGPL = fine for our own marketing (never ship it as a product). ⚠️ MALICIOUS TYPOSQUAT at github.com/OpenMontage/OpenMontage — clone calesthio/ ONLY.
- Social clips: OpenMontage clip-factory, or OpusClip API (zero-maintenance). Write+schedule: **Typefully** (~$10/mo).

## 4. Rally launch (now → Jul 19; adoption = 20% of judging)
- Tag per post the sponsor whose tech is on screen (they RT into judges' feeds):
  **@ParticleBuild** (DevRel, most likely to RT) · @ParticleNtwrk · @arbitrum (+ mentor @Swagtimus) · @magic_labs · **@zerodev_app** (NOT @ZeroDevApp) · **@openfort_hq** (co-sponsor we'd missed) · @circle · @encodeclub.
- Arc: Day-1 kickoff thread → 3 build-in-public updates/wk (one working piece on screen each) → a live seeded pot people join (the adoption proof) → demo-video drop ~Jul 17–18 (real screen recording, link in first tweet, cross-post to Farcaster).
- Day-1 thread + both positioning hooks: in `.lavish/traction-engine.html` and the transcript.

## 5. Farcaster mini-app — WORTH IT
- Seed Club **Crowdfund** (USDC goal + deadline + auto-refund-on-miss, Farcaster mini-app) = Rally's Goals mode verbatim; did 194 crowdfunds / $7,500 vol week 1, #1 mini-app ranking, organic. Proof + competitor + distribution unlock.
- Ship Rally as a Farcaster mini-app in the window = free high-signal distribution + concrete adoption story. Keep email/web app as the durable layer.
- Caveat: Base App split from Farcaster mini-app spec Apr 2026 (pick the surface); optimize completed flows not opens (mini-apps manufacture vanity users).

## 6. Positioning
- Crypto hook: "Group money that can't rug you — including by us. Chip in USDC from any chain with just an email; pays out together or auto-refunds from the contract."
- Normal-people hook: "Remember PayPal Money Pools? They killed it in 2021. We rebuilt it so no one — not even us — can touch the money. It's the chit fund / susu / tanda your family already runs — now nobody can run off with it."
- Competitors to define against: Seed Club Crowdfund (donations, Farcaster-gated), Roda (needs MetaMask), Mi Tanda (Farcaster-gated), Owe3/deves (settle-up-after, not pool-upfront), Splitwise (moves no money), PayPal Money Pools (dead), Tanda/mytanda ("tracks the circle; Rally HOLDS it — trustlessly"), SUSU Circles (custodial).

## 7. Operating model (sustainable, multi-project)
- One founder brand hub; products = spokes. One-product-per-day: Build 2h / Distribute 2h / Measure 1h. Sunday = decisions, kill dead products after 2 weeks.
- Content = byproduct of building (one founder-log/build-day → agent turns week's logs into thread + cast set + LinkedIn + video script; human edits for voice, schedules in Typefully).
- Automate: drafting, repurposing, scheduling. NEVER automate: replies (the ×75 signal), cross-account engagement (= ban), identical cross-posts (= spam flag).
- Realistic: ~30–45 min/day; launches as concentrated bursts (the hackathon is Rally's burst now), 3–5 build-log posts/wk between.
