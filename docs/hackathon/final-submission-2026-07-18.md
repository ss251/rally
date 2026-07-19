# UXmaxx — FINAL SUBMISSION (submitted 2026-07-18)

Submitted via the Encode dashboard on **Jul 18, ~10:30 PM IST** — ~1d 19h before the
deadline (**Mon Jul 20, 2026, 5:29 PM IST / Asia-Calcutta**). The dashboard shows the
stage green with a **View / Edit Submission** button, so every field below remains
editable until the deadline.

## What was submitted

| Field | Value |
|---|---|
| Project name | Rally |
| Description | The 150-word rubric-aware blurb from [`submission-blurb.md`](submission-blurb.md) (markdown stripped) |
| Work / process / achievements | New final-stage field — contracts-first narrative: 86/86 tests, dual audits, 7702 type-4 tx, gasless via ZeroDev, 9.8s CCTP, broken-circle refund proof, live RPC reads |
| Link to Code | https://github.com/ss251/rally (public; origin/main current through PR #38) |
| Link to Presentation | https://drive.google.com/file/d/1sHx5HJywoaQDK3sdajx0nWQ_dH3_aSe5/view — 8-slide PDF deck, "Anyone with the link · Viewer" |
| Link to Demo Video | **https://youtu.be/CmTjjBtBMeA** — real uncut walkthrough (replaced the composite on 2026-07-19; see below), unlisted, 1:06, British VO (Lily) |
| Live Demo Link | https://rally-production-94cc.up.railway.app |
| Submission files | `rally-uxmaxx-deck.pdf` (1.0MB, deck v2 w/ new video link) + **`rally-demo-real.mp4`** (3.1MB) |

## ⚠️ Demo video REPLACED 2026-07-19 (real footage, not a composite)

The founder rejected the first video: it was a Remotion **composite** with **invented Base/
Arbitrum chain-logo graphics** and a **simulated** chip-in ("path (a)" — the OTP was never
entered). The replacement (`marketing/demo/rally-demo-real.mp4`, YouTube `CmTjjBtBMeA`) is
**100% real screens** captured off the live app via the `demo-recorder` skill:
- Live landing → real chip-in on `/c/5` → the **Magic login code landing in the founder's
  actual Gmail inbox** (code 604456, shot in their real Chrome) → code typed → money sent.
- Real on-chain outcome shown on `/c/4`: **Goal met, $3 / 103%**, "Settled on-chain · vault
  0x914e…0AB4" — the $3 came from a genuine CCTP burn (Base) → mint (Arbitrum).
- Real `/circle/1` rotation + `/circle/2` broken-and-refunded, then close.
- No drawn graphics, no fake logos, no composited "You're in ✦". Voice = ElevenLabs **Lily**
  (velvety British female), replacing Autumn Veil.

### Load-bearing fix shipped alongside (deployed to prod)
Root cause the chip-in "Sending…" hung forever: Circle raised the CCTP **fast-transfer fee
floor to 1.3 bps**, but `src/lib/backer-gasless.ts` paid a hardcoded **1.0 bps** `maxFee` —
below the floor, the burn silently **degrades to standard finality (~15–30 min)**, iris
reports `delayReason: insufficient_fee`. Fix: query Circle's fee API
(`GET /v2/burn/USDC/fees/6/3`), pad 2×, fall back to 3 bps. Verified: post-fix burn showed
`delayReason: None` and minted fast. Also pinned demo campaign titles #3/#4/#5 in
`campaign.ts` KNOWN (the off-chain title store is container-ephemeral). New helper scripts:
`scripts/demo-mint-now.ts`, `scripts/demo-create-c5.ts`. Both changes are **uncommitted** on
`fix/feed-real-times` — push if keeping.

## ⚠️⚠️ Demo video REPLACED AGAIN 2026-07-19 — the ~2-min FILM (current submission)

The founder wanted more depth and a genuinely multi-chain bar. Current submitted video is
**`marketing/demo/rally-demo-film.mp4`, YouTube `LjRc0v0KI9I`** (2:07, unlisted). Still 100%
real screens, now with:
- **A real multi-chain bar.** New hero campaign **#6 "Send the crew to Lisbon"** ($12 goal)
  filled by **three real chains**: Arbitrum-native `contribute()` ($4, the "Sam"/light-blue
  band), a real **Optimism → Arbitrum CCTP** burn ($4, "Maya"/red), and the **live filmed
  Base chip-in** ($5, "You"/blue) → **$13 / 108%, goal met on camera**. The UI path is
  Base-only by design, so the other bands are seeded by real burns via new scripts
  `scripts/demo-fill-from-chain.ts` (generalised any-source CCTP) + `demo-fill-native-arb.ts`
  (Arbitrum-native). Funds for OP/Base source came from the founder (thanks).
- **An architecture explainer beat** — a designed slide (`scratchpad/demo/arch/arch.html`,
  Rally design system, real BrandMark SVG): Magic → ZeroDev → CCTP → two vaults.
- **Circles genuinely in action** — new circle **#6 "The trip fund"** (3 seats, $1/round,
  seat 0 = the Magic wallet): on camera a round fills 3-of-3 and the founder **claims the $3
  pot gas-free** ("You got the pot ✦"), then `/circle/2` broken → auto-refund. Staged via
  `scripts/demo-stage-circle.ts`. Circle deposits are native Arbitrum USDC (relayer fronts).
- **VO reworked twice** for pacing: plain English, one idea per sentence, Lily @0.94 speed,
  a breath after each line. Superseded the rushed narration the founder flagged.
- **Honesty fix (deployed):** the chip-in sheet's "Paying from" now hard-codes **Base**
  (`fromChain="base"` in `routes/c.$id.tsx` + `index.tsx`) — it was echoing the bar's top
  band (e.g. "Optimism") while the burn was always Base. Display-only; matches reality now.
- **Deck** rebuilt with the **real Rally logo** (BrandMark SVG, was a placeholder gradient
  square) + the new video link; uploaded to Drive as a **new version of the same file** (same
  share link). Encode video link swapped to `LjRc0v0KI9I`, old mp4 detached, film mp4 attached.

Campaigns #6 title + backer names pinned in `campaign.ts` KNOWN; circle #6 in `circle.ts`
KNOWN. All still **uncommitted** on `fix/feed-real-times`. YouTube channel
UCn4pwaGjNeSQB5YNsVu0ynQ now has three Rally demos — `LjRc0v0KI9I` (current film) is the live
one; `CmTjjBtBMeA` and `KY-U_riFcMU` are superseded.
| Challenges & tracks | Arbitrum "Road to Open House London" Bounty · 🏆 General Track — **Subtrack 2 – ZeroDev** · Magic Labs Bonus Challenge |
| Project image | Rally-branded card (was already set) |

A "No Changes Detected — Link to Code" interstitial appeared (repo link unchanged since
checkpoint — correct, same repo); confirmed with **Submit Anyway**.

## The narrated demo video

`marketing/demo/rally-demo.mp4` (the Remotion master) had a **silent** audio track.
Voiceover was generated with ElevenLabs (`eleven_multilingual_v2`, voice **Autumn Veil**
`KoVIHoyLDrQyd4pGalbs`, key from `~/.config/fleet/elevenlabs.key`) as 7 segments aligned
to the storyboard beats (0:00 / 0:08 / 0:18 / 0:24 / 0:31 / 0:43 / 0:58), mixed at
-16 LUFS with breathing gaps at 14.7–18.3s ("You're in ✦") and 56–59s (before the close).
Output: **`marketing/demo/rally-demo-vo.mp4`** (video stream untouched; master preserved).
Regenerate: scripts in the session scratchpad were one-offs — the durable recipe is
per-beat TTS → ffmpeg `adelay` + `amix=normalize=0` + `loudnorm=I=-16:TP=-1.5`.

## The deck

8 slides in Rally's design system (ink-950 dusk canvas, coral/amber, Clash Display),
built as HTML → Chrome `printToPDF` (1280×720/page), stills from `marketing/demo/stills/`.
Order: title → problem (PayPal Money Pools / ROSCA foreman) → two shapes → UX (the 40%)
→ under-the-hood pipeline (Magic 7702 → ZeroDev → CCTP v2 → Arbitrum, each stamped with
its prize surface) → onchain proof → adoption → close with all links.
Gotcha: `background-clip:text` gradient text prints with box artifacts in printToPDF —
use solid accent color for print.

## If revising before the deadline

Dashboard → UXmaxx → **View / Edit Submission**. To swap the video: upload a new file to
the same YouTube channel (or re-cut `rally-demo-vo.mp4`), update the link field, resubmit.
The unlisted YouTube video can be deleted/replaced from studio.youtube.com (channel
UCn4pwaGjNeSQB5YNsVu0ynQ).
