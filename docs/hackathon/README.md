# UXmaxx Hackathon — source archive + extracted intel

**Purpose.** Durable, version-controlled record of everything the founder has shared about the UXmaxx Hackathon (Encode Club × Particle Network). The **verbatim sources** below are the accurate reference — never overwrite/summarize them. This README is the *extracted* actionable layer; when it and a source disagree, the source wins.

## Verbatim sources (do not edit)
- [`discord-general-2026-07-03.md`](discord-general-2026-07-03.md) — full `#general` channel dump.
- [`workshop-01-arbitrum-founder-support.md`](workshop-01-arbitrum-founder-support.md) — Arbitrum "How Arbitrum Supports Founders" (speaker: Swagimus, Arbitrum Foundation).
- [`workshop-02-transaction-abstraction.md`](workshop-02-transaction-abstraction.md) — Particle "Transaction Abstraction for Better DApp UX" (speaker: David Zambiasi, Particle DevRel).

## 🎥 Videos — TODO: extract frames for vision
Not yet processed. The founder wants slide/demo frames pulled for visual reference.
- https://www.youtube.com/watch?v=9uCkgVvt7NA&t=3s
- https://www.youtube.com/watch?v=UAdWc3WIl3g&t=2s

Map each URL → workshop by content (transcripts identify the speaker/topic). Frames worth grabbing: the **tracks/prizes** slide, the **Open House funnel** slide, and the **UA demo UI** (balance breakdown, delegate-on-base, convert-to-Solana). `yt-dlp` + `ffmpeg` are available locally (see user memory: yt-dlp is zero-config).

---

## ⚠️ DEADLINES — time-critical, one discrepancy to resolve
| Milestone | Date | Source | Note |
|---|---|---|---|
| **Mid-hackathon checkpoint** | **Sun Jul 5** | WS-01 (Arbitrum host, 0:39) | Called a **REQUIRED submission** — "make sure you've got your progress in." **This Sunday.** |
| **Final submissions** | **Jul 19** | WS-01 (0:48 + 26:18) | Stated twice as "the big important one." |
| **Finale / prize-giving** | **Jul 30** | WS-01 (26:51), WS-02 (27:30), Giles | Also the Arbitrum-bounty submission date per Giles. |

**Conflict to verify on the official Devfolio/Encode page:** the Arbitrum workshop clearly says **final submissions Jul 19**, finale/prizes Jul 30. But Giles (Encode, Discord) said the **Arbitrum bounty is "submitted by July 30th."** Our prior plan assumed a single Jul 30 deadline. Most likely reading: **project submission closes Jul 19; Jul 30 is judging + finale.** → **Do not assume Jul 30 is the build deadline.** The Jul 5 checkpoint is imminent and required regardless.

## Tracks & eligibility
- **2 main tracks — pick ONE:** **General** or **Universal Account** (Soos3D). Rally targets **General** (it dropped Particle UA — see below).
- **Arbitrum "Road to Open House London" bounty — $2k** — judged **independently**; a main-track pick does **not** affect Arbitrum eligibility (Eunum, confirmed). Requires app **"deployed primarily on Arbitrum"** + submitted by Jul 30. **No** Open House attendance required (Giles). Rally's GoalVault is on **Arbitrum Sepolia** ✓.
- **Solo or team both allowed** (Giles).
- **Open question:** Arbitrum track — mainnet or Sepolia OK? (gethsun asked; unanswered in dump. "must be onsite for arbitrum track" was an *unconfirmed guess* by 0xMogate — likely conflated with Open House.) **Verify.**

## 🔑 Technical constraints — these VALIDATE Rally's architecture
- **Particle Universal Account is MAINNET-ONLY.** "universal account infrastructure is only on mainet… it just does not work on test net" (WS-02, 25:27). → Since the founder will **not** spend mainnet money, Rally **correctly dropped Particle UA** for **Circle CCTP (testnet) + Magic + ZeroDev**. Doubly-confirmed now. (Only escape hatch mentioned: forking mainnet with Anvil — not viable for a live demo.)
- **Particle Auth does NOT support the 7702 authorization signature** (Soos3D). 7702 needs an **embedded wallet (Magic/Dynamic/Privy) or server-side** key. Rally uses **Magic** ✓.
- 7702 delegation = a **type-4 tx** needing gas **per chain**; Magic defaults to **blind signatures** (no popup, automatable) — a big UX win; UA "unlocks Solana out of the box."
- **Magic Google sign-in** needs Google Cloud **client ID + server creds**; email-only otherwise; React Native has issues. Rally uses **Magic email OTP** ✓ (Google is optional polish, not required).

## Judging signal (what wins here)
- Theme = **UX**: "pushing crypto toward its potential by fixing the thing that holds it back most — user experience." Judges reward **transaction abstraction / sponsored tx / cleaner signing / removing friction** (WS-02). → Rally's **gasless (ZeroDev) + no-wallet/no-seed (Magic) + invisible cross-chain (CCTP)** hits this dead center.
- **Web app is the safe format** — judges "prefer something we can run out of the box, even on testflight." Mobile = build/run or TestFlight/APK burden. Rally is a **web PWA** ✓.

## 🥊 Competitor to watch — Beam
- **Beam** (pankaj [Arc]) · https://beam-encoder.vercel.app/ — "send money by link, any chain; claim with Google; settles on Arbitrum." Stack: **Magic wallet + Particle UA** ("Stripe for the card network — rails real, user never touches them").
- **Adjacent to Rally** (cross-chain money, Magic, Arbitrum settlement, abstraction framing) but **different shape:** Beam = **1:1 send-by-link**; Rally = **group crowdfunding with an all-or-nothing goal bar + automatic refund.** Differentiate on the *social/emotional* "fill the bar together or everyone's refunded."
- Beam uses **Particle UA → mainnet-only → likely real funds**; Rally is **testnet/$0**. They're building "aggressively." Keep an eye on their submission.

## Post-hackathon funnel (Arbitrum, WS-01 — relevant only if Rally continues)
Open House London (3-wk buildathon → founder house **Jul 10–12** → 8-wk mentorship → demo day, **$100k non-dilutive**, equity-free); **Arb "Fuel"** gas sponsorship (~10k credits/team via PIMLICO + ERC20 paymasters); **$10M audit program** (OpenZeppelin / Nethermind / Trail of Bits — audit-ready teams only); milestone grants (mainnet onchain impact); amplification/intros. Applications rolling.

## Remaining workshops
- **Jul 7** — ZeroDev on chain abstraction · **Jul 8** — Openfort + x402 · **Jul 22** — Magic on social login · **Jul 30** — finale/prizes.

## Resource links (from Discord)
- Particle docs: https://developers.particle.network/universal-accounts/overview · dashboard: https://dashboard.particle.network/ · MCP: https://developers.particle.network/intro/more/mcp
- Demos: github.com/soos3d/workshop-demo · github.com/soos3d/workshop-demo-02 · github.com/Particle-Network/ua-7702-magic-demo · github.com/Particle-Network/ua-dynamic-7702 · github.com/Particle-Network/universal-account-example
- SDK: `@particle-network/universal-account-sdk@^2.0.0-beta.3` → `npm i @particle-network/universal-account-sdk@beta`
