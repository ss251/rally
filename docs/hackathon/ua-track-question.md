# DRAFT — #technical-questions post (General-track UA requirement)

> Founder-approved (decision 2, 2026-07-03): draft + remind in a few days; the capture loop watches for the reply. NOT yet posted — post via the logged-in Discord or paste manually. This settles whether the **General track** *requires* the Particle UA SDK or merely rewards it (the 30%).

**Ready-to-post text:**

> 👋 Track-eligibility check for the **General Track**: is using **Particle's Universal Accounts SDK** a *requirement*, or one of several valid ways to hit the "chain-agnostic UX" bar?
>
> Our app delivers chain-agnostic UX via **EIP-7702 (ZeroDev kernel + paymaster)** + **Circle CCTP** (cross-chain USDC) + **Magic** email login — including a real Type-4 tx with an `authorizationList` and a live cross-chain value flow — but on **testnet** (we're avoiding mainnet costs, and Particle UA is mainnet-only).
>
> So: does a **7702-based chain-agnostic UX *without* Particle's UA SDK** qualify for the General Track, and how is the *"Universal Accounts + EIP-7702 (30%)"* criterion applied to a project that uses 7702 but not Particle UA specifically? 🙏

**Why it matters:** if General *requires* Particle UA, Rally can't win it (mainnet-only), and we go all-in on the Arbitrum bounty ($2k, no-UA rubric) + Magic bonus + ZeroDev subtrack. If UA is merely rewarded (the 30%), Rally still competes on General with a partial 30% via its 7702 usage. See `sponsor-prizes-2026-07-03.md`.
