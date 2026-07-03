# Rally — Roadmap

Rally is conditional group money, and both of its shapes are already live: **Goals** (hit it together or everyone's refunded) and **Circles** (the pot rotates, or everyone's refunded). The refund rail — the part every group-money product promises and never shows — is proven onchain. This is what's shipped, what lands before the Jul 19 submission, and where it goes after.

---

## Shipped (proof, not promises)

- ✅ **Goals** — `GoalVault` all-or-nothing escrow, deployed + verified on Arbitrum Sepolia ([`0x914e…0AB4`](https://sepolia.arbiscan.io/address/0x914e4682ad2febb3e00a21db29b93c16fc080ab4#code)). Campaign #1 filled live with real cross-chain CCTP transfers (~10 s attestation, [onchain proof](./deployments/phase1-live-proof.md)); campaign #2 opened end-to-end through the product's own `/create`.
- ✅ **Circles** — `RotatingVault` rotating-savings vault, deployed + verified + **ownerless** ([`0xdd9b…7838`](https://sepolia.arbiscan.io/address/0xdd9b3e5f407b99e2c2827695608741b328f97838#code)). Circle #1 live mid-fill (EIP-712 seat invites, gasless deposits); circle #2 **broke on schedule and auto-refunded** — [the refund tx](https://sepolia.arbiscan.io/tx/0xdb9d1d5cef7e32ab9040e8f2878d9e80a634fd42d900eeb791e1a0e151729ba6) is public.
- ✅ **The invisible spine** — Magic email login → embedded EIP-7702 wallet (real Type-4 tx with an `authorizationList`), ZeroDev kernel + paymaster (gasless end-to-end), Circle CCTP v2 (any-chain USDC in), everything read live from Arbitrum.
- ✅ **Assurance** — 86/86 Foundry tests across both vaults, fund-conservation fuzzes (2,000+ runs), a conservation invariant asserted after every state mutation, and two independent audit passes with zero Critical/High/Medium findings.
- ✅ **The product** — Goals · Circles mode switch, live-reading landings, named feeds, celebration moments (`You're in ✦` · `You got the pot ✦` · `Money's back ✦`), deployed on Railway (SSR).

---

## The Jul 19 runway (submission sprint)

### 1. ZeroDev Smart Routing Address (integration candidate)
The ZeroDev subtrack judges SRA use at 30%. An SRA is a universal multi-chain deposit address — which is exactly what a Rally pot wants to be: *"chip in from anywhere"* becomes one address that routes from any chain. It's the rare sponsor integration that is also a product improvement. Scoped as the one remaining integration before the deadline; if timing gets tight, it drops without touching the core story.

### 2. The UA-track answer (contingency, not code)
One open rubric question is with the organizers: does the General track *require* Particle's Universal Accounts SDK, or merely reward it? Rally already has the substance the criterion describes — a real Type-4 7702 transaction and a live cross-chain value flow — via ZeroDev + CCTP on testnet (Particle UA is mainnet-only, and Rally spends no real money). If UA is required, the submission goes all-in on the Arbitrum bounty + Magic bonus, where the fit is strongest; if it's merely rewarded, General stays in play.

### 3. Circles finish line
- **Self-custodied organizer signing** — circles created in-app today use the concierge relayer as the onchain organizer; move the EIP-712 invite signing to the organizer's own embedded wallet.
- **A human end-to-end pass** on the Magic-OTP → gasless deposit path for Circles (the same rail is already proven for Goals).
- **Polish loop** on the create-success and claim celebrations.

### 4. Demo hardening
Recorded happy-path fallback, pre-staged goal crossing, explorer receipts pre-opened. The broken-circle beat needs no staging — it's permanent.

---

## After the hackathon (the product, not the demo)

### Circles → the people who already do this
Rotating savings circles are the largest informal financial instrument on earth — chit funds, tandas, susus — and they break on exactly three things: the foreman absconding, members moving across borders, and onboarding friction. All three are what Rally already deletes. The plan: put real diaspora committees on it (WhatsApp-native invites, an INR off-ramp partner for the India corridor), and hold the bar at **three committees completing a full rotation without hand-holding.** That's the company; everything else is a feature.

### Bidding mode
The step from fixed rotation to real chit-fund mechanics: members bid a discount to take the pot early, and the discount accrues to the circle. Same vault, one new auction surface.

### Contract hardening (the named Lows)
The audits cleared both vaults for testnet with two pre-mainnet follow-ups, and they stay named until closed: **invite deadlines** (an unredeemed seat invite should expire) and **`claimFor`** (relayer-submitted claims so an email-wallet payee never needs to be online at the right moment).

### Mainnet + external audit
Arbitrum One, real USDC, real CCTP domains — only after the hardening above lands and both vaults pass an external audit. Faucet USDC becomes real USDC; nothing else changes, which is the point.

### The Goals arc continues
More CCTP chains (Solana Devnet is the wow), named links + rich share cards (`rally.to/tokyo-crew`), organizer dashboard, notifications ("the Tokyo fund just hit 90%"), and a card on-ramp so the very first backer never needs crypto at all.

---

## Guiding principle

Every item on this list is judged by two questions: **does it make the chain more invisible, and does it make the promise easier to trust?** Rally wins by being the group-money app that happens to be onchain — never the onchain app that happens to do group money. We keep subtracting friction until moving money with your people is as thoughtless as replying to the group chat — and the pot is held by something none of us can walk off with.
