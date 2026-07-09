# ZeroDev team answer — SRA on testnet (verbatim, authoritative)

> Asked by the founder in the UXmaxx Discord; answer received ~2026-07-06. This settles the ZeroDev-subtrack question: **no testnet SRA exists or is coming** — the SRA-30% criterion is only scorable via small mainnet amounts.

**Question (founder):**

> gm ZeroDev team - Is there a testnet SRA manager/baseUrl? The SDK ships Base/Arb Sepolia USDC tables, but the v2 API returns mainnet-only supportedChainIds and rejects 84532/421614.

**Answer (ZeroDev team):**

> no, we don't have deployments on testnet, reason being almost nothing works on testnet, every bridges have their own problem on the testnet but you can test with small amounts on mainnet

## What this means for Rally

- Confirms the empirical recon (2026-07-03): the SRA backend is mainnet-only; the SDK's Base/Arb Sepolia token tables are scaffolding the backend does not honor.
- **Decision: SKIP the SRA build** (PO recommendation, standing) — the $0/testnet-only story is clean and rewarded by the Arbitrum bounty rubric; the only scoring path (~$15–25 of real mainnet funds) breaks the founder's $0-mainnet rule and needs his explicit yes.
- Submission line this earns for free: *SRA integration is architected and blocked only by ZeroDev's own testnet coverage — confirmed by their team.*
- Bonus narrative point: ZeroDev's own reasoning ("every bridge has its own problems on testnet") validates Rally's cross-chain choice — CCTP burn/mint is not a liquidity bridge, which is why Rally's cross-chain flow works on testnet at all.
