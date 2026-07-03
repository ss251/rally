# UXmaxx — Sponsor prizes, tracks & judging (verbatim, authoritative)

> Provided by the founder 2026-07-03 (fuller/more accurate than the earlier dashboard snapshot). This is the **source of record** for prizes/rules — where it and any other note disagree, this wins. Verbatim text below; strategic reads at top.

## 🔑 Strategic reads (what this changes for Rally)
- **Main-track judging (both UA + General) = UX 40% · use of Universal Accounts + EIP-7702 30% · adoption 20% · technical 10%.** Rally has **EIP-7702 (ZeroDev)** but **NOT Particle Universal Accounts** → on the General track it captures the "7702" half of the 30% but not the "UA" half. This is the handicap. (Particle UA is mainnet-only; founder won't spend mainnet.)
- **Best-fit prize is the Arbitrum bounty ($2k)** — its rubric is **DIFFERENT: UX 30% · Creativity 30% · Adoption 20% · Execution 20%, NO UA requirement.** Brief: "a consumer app where Arbitrum powers the experience behind the scenes, user never thinks about wallets/gas/bridges/chains… feel less like crypto apps and more like normal consumer products." **Rally nails this.** Strong submissions are invited to apply to **Arbitrum Founder House London (Jul 10–12, application-based).**
- **Magic bonus ($500)** — any track; best/most creative embedded-wallet UX (walletless onboarding, email/social login). Rally's Magic email-OTP fits; no UA needed.
- **ZeroDev subtrack ($500, 4 winners)** — requires meaningful use of ZeroDev's **Smart Routing Address (SRA)** for universal multi-chain deposits; judging UX 40% · **use of SRAs 30%** · adoption 20% · technical 10%. ⚠️ Rally uses ZeroDev's **7702 kernel + paymaster** but NOT (yet) an **SRA**. To win this subtrack, integrate a ZeroDev SRA (a universal multi-chain deposit address) — a concrete, high-value add for the remaining sprint.
- **Universal Accounts Track ($2,500 1st)** — HARD qualification (per founder 2026-07-03): "**must use Universal Accounts SDK in EIP-7702 mode, include at least one Type-4 transaction with an authorizationList, and demonstrate at least one cross-chain value flow through UA.** Some achievement bounties may add extra integration requirements on top." → Rally already has a **Type-4 tx with an authorizationList** (ZeroDev 7702 delegation ✓) **and** a **cross-chain value flow** (CCTP ✓) — it meets **2 of 3** — but it uses **ZeroDev's** 7702, NOT the **Particle Universal Accounts SDK**, so it **does NOT qualify for the UA track** without adding Particle UA (mainnet-only; founder won't spend mainnet). **⚠️ Open ambiguity to resolve:** does "the main Particle Network bounty" qualification apply ONLY to the UA track, or ALSO to the **General track**? If General also requires the Particle UA SDK, Rally can't win General either → its only surface would be the **Arbitrum bounty + Magic bonus + ZeroDev subtrack**. VERIFY in #technical-questions ASAP.
- **Incubation:** General + UA track winners "may be considered for incubation by Particle Network."
- **General track requires choosing ONE subtrack** (ZeroDev or Openfort). Rally → **ZeroDev**. (Openfort needs backend wallets + x402 — not our stack.)
- **Net Rally prize surface:** General Track (up to $2k, UA-handicapped) + ZeroDev subtrack ($500, needs SRA) + **Arbitrum bounty ($2k, best fit)** + Magic bonus ($500). Realistic focus: **Arbitrum bounty + Magic bonus are the highest-probability wins; General+ZeroDev are upside if we add an SRA.**

---

## 🏆 Universal Accounts Track — Particle Network
- **1st Place ($2,500)** — Top Prize! · **2nd Place ($2,000)** — Runner up · **3rd Prize ($1,500)** — On the podium!
- Build with Particle Network's Universal Accounts SDK in EIP-7702 mode. The user's EOA becomes a chain-abstracted account in place—one login, one balance, transactions on any chain with any asset. No new address, no migration, no smart-account deployment. Just upgrade the EOA and ship.
- **Requirements:** Must use Universal Accounts SDK in EIP-7702 mode. At least one cross-chain operation moving value via UA. Functional demo (deployed or runnable locally).
- Links: Particle Developer Docs https://developers.particle.network/ · UA Overview https://developers.particle.network/universal-accounts/cha/overview · Web Quickstart https://developers.particle.network/universal-accounts/cha/web-quickstart
- Winners in this track may also be considered for **incubation by Particle Network**.

## 🏆 General Track — Particle Network
- **1st ($2,000)** Top prize! · **2nd ($1,200)** Runner up · **3rd ($800)** On the podium.
- Build a Web3 application with exceptional user experience in any domain. Open to consumer-friendly apps across payments, DeFi, AI, gaming, social, and beyond — as long as the experience is seamless, intuitive, and genuinely improved by the infrastructure being used.
- Projects may also earn additional prizes through their chosen subtrack + the Arbitrum and Magic Labs bonus challenges. Winners may, at Particle's discretion, be considered for **incubation**.
- **Teams entering this track must choose ONE of two subtracks:**

### Subtrack 2 — ZeroDev — Top prize ($500) · 4x Winners!
- Best four implementations of ZeroDev's chain abstraction stack. Project must meaningfully integrate ZeroDev's infrastructure as a core component.
- **Judges look for:** UX excellence 40% · Prominent/innovative use of **SRAs** 30% · Adoption potential 20% · Technical quality/polish 10%.
- **Smart Routing Address – SRA.** SRA Documentation – full implementation guide for universal multi-chain deposits. SRA Features & Use Cases – real-world examples + best practices. https://docs.zerodev.app/ · https://docs.zerodev.app/smart-accounts/eip-7702/quickstart

### Subtrack 1 — Openfort — AirPods (Amazon Giftcard, 1 per team) ($100) · 4 winning teams/individuals
- Create an application that leverages Openfort's backend wallets and their x402 agentic payments integration.
- **Judges look for:** UX excellence 40% · Prominent/innovative use of both Openfort backend wallets and x402 30% · Adoption potential 20% · Technical quality/polish 10%.
- Openfort Docs · Backend Wallets Guide · x402 Agentic Payments.

## Arbitrum "Road to Open House London" Bounty — Arbitrum — Prize pool ($2,000)
- Leading up to Arbitrum's flagship Founder House residency (hosted by Encode House in London), Arbitrum independently awards the best dApp a single $2,000 prize, as long as the application + its components are **deployed on the Arbitrum network**.
- Build a consumer app where **Arbitrum powers the experience behind the scenes, but the user never has to think about wallets, gas fees, bridges, or what chain they're using.** Projects must run **primarily on Arbitrum** and should use chain-abstracted UX patterns like embedded wallets, social login, gas abstraction, invisible bridging, or account abstraction.
- **Example ideas:** AI apps with invisible onchain payments · social/gaming apps with walletless onboarding · consumer payment or loyalty apps · cross-chain apps where Arbitrum is the backend settlement layer · mobile-first apps with seamless UX.
- **Judges look for:** UX excellence (30%) · Creativity (30%) · Adoption potential (20%) · Execution quality (20%). App quality may be a tie-breaker.
- "The best projects will feel less like 'crypto apps' and more like normal consumer products that just happen to run onchain."
- **Next step:** strong submissions encouraged to apply to **Arbitrum Founder House London (Jul 10–12, in-person, application-based, strictly limited capacity)** — mentorship on product, technical direction, business strategy, GTM. https://... (Apply to the London Founder House)

## Magic Labs Bonus Challenge — Magic Labs — Prize ($500)
- Integrate Magic's embedded wallet and qualify for a single $500 prize for the wallet's best + most creative implementation. Build the best onboarding + wallet experience using Magic's embedded wallet infra.
- Open to projects from any main track; focus on seamless, low-friction UX (social login, invisible wallets, smooth auth, apps that feel like modern consumer products).
- **Example ideas:** walletless onboarding · AI/social apps with embedded accounts · consumer apps with email or Google login · mobile-first onboarding · apps where users never install MetaMask.
- **Judges look for:** smooth onboarding + authentication · creative use of Magic infra · UX polish + accessibility · consumer-ready product thinking · technical implementation quality.

## Track Selection, Rules & Judging — Particle Network
- Participants must submit to **one main track**: **Universal Accounts Track** (dApp that prominently uses Particle's UA in EIP-7702 mode + a supported wallet provider, for chain-agnostic UX) **OR General Track** (Web3 app with exceptional UX in any domain).
- Projects on the General track can also earn bonus prizes via **Arbitrum ($2,000)** and **Magic Labs ($500)** — independently judged, own criteria.
- Besides the two main tracks + General's subtracks, the two bonuses are open **regardless of track choice**.
- **Criteria:** "Judges will seek the most seamless user experience, with particular emphasis on chain-agnostic features powered by Universal Accounts + EIP-7702. They will focus on **UX excellence (40%), Prominent/innovative use of Universal Accounts + EIP-7702 (30%), adoption potential (20%), and technical quality/polish (10%)**."
- **Judging note:** Main-track winners selected by the hackathon jury; subtracks + bonus challenges judged independently by the relevant partner teams. Teams may be considered for multiple prizes.
- **Rules:** All work original + created during the hackathon. Plagiarism = disqualification. Judges' decisions final. You keep full IP rights.
