# Rally — Phase 1 Live Cross-Chain Fill Proof

**VERDICT: GO — confirmed LIVE on-chain.** A real Circle CCTP v2 cross-chain USDC
transfer (Base Sepolia → Arbitrum Sepolia) landed in the deployed, Arbiscan-verified
`GoalVault` and moved the campaign thermometer, all on public testnets, $0 real money.

## The deployed contract

| Field | Value |
| --- | --- |
| Contract | `GoalVault` |
| Network | Arbitrum Sepolia (chainId **421614**) |
| Address | **`0x914e4682aD2FeBb3e00a21dB29B93c16fc080AB4`** |
| Verified (Arbiscan) | https://sepolia.arbiscan.io/address/0x914e4682ad2febb3e00a21db29b93c16fc080ab4#code |
| Deploy tx | https://sepolia.arbiscan.io/tx/0xe16ec89e26bd66b2d26043074435fac9cad074bec4c4e3db6815fd585050d267 |
| Deploy block | 283235364 |
| Compiler | solc 0.8.28, optimizer 200 runs, evm `paris` |
| USDC (Arb Sepolia) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| CCTP v2 TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP v2 MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| Owner / Relayer | `0x6A63bDD548715b4Dac5e2ee62a6D4085c2d393B1` |

## The demo campaign

Created on-chain via `createCampaign(goal, deadline, beneficiary)` — permissionless.

| Field | Value |
| --- | --- |
| campaignId | **1** |
| goal | 30 USDC (`30000000`) |
| deadline | `1784176143` (~14 days out from deploy) |
| beneficiary | `0x6A63bDD548715b4Dac5e2ee62a6D4085c2d393B1` |
| create tx | https://sepolia.arbiscan.io/tx/0x0a0d828c3a2be97a002f27771c5faa2f70e17396bb9a5911e53183f81e8b9ad0 |

## The live CCTP v2 fill (THE CAKE)

Flow: `approve` + `depositForBurn` on Base Sepolia (domain 6, fast transfer,
finalityThreshold 1000) → poll Circle Iris v2 attestation → `receiveMessage`/mint on
Arbitrum Sepolia (domain 3) → relayer `recordContribution` → assert `campaign.raised` rose
by the exact attested amount (parsed from the USDC `Transfer(->vault)` mint event, not a
balance delta).

| Step | Chain | Explorer link |
| --- | --- | --- |
| 1. BURN (approve + depositForBurn) | Base Sepolia | https://sepolia.basescan.org/tx/0x297eb69cf2cac222179de81f58d356822c5ddb663e51c4ce28fed65022fc59bc |
| 2. Iris attestation | Circle Iris v2 | nonce `0x5076d7fc5f7664f3dd49eb083f97dece4ea1c938bb4eb2615f4319fb9be6ace5` |
| 3. MINT (receiveMessage) | Arbitrum Sepolia | https://sepolia.arbiscan.io/tx/0xc354c2051c70d2e77524ad30dcf9dd31f38466a6fa0456d4c0b8f13a472d1bf1 |
| 4. recordContribution | Arbitrum Sepolia | https://sepolia.arbiscan.io/tx/0xe3e115f33c3f1996dbe25321130fc054d72370194d606c6652c9fdb218eed91d |

### Measured result

- **Amount burned:** 5 USDC on Base Sepolia
- **Amount minted into GoalVault:** 4.99935 USDC (`4999350`) — 5 USDC minus the 1.3 bps CCTP fast-transfer fee
- **`campaign #1` raised: 0 → 4.99935 USDC** ✅ thermometer moved
- **Measured Iris attestation latency: 9.8 s** (fast transfer) — fast enough for a live demo (prior estimate ~8 s; confirmed real)
- **Source domain recorded:** 6 (Base Sepolia), per-backer `{sourceDomain, amount}` tracked on-chain for the all-or-nothing refund path

### Spend log (guardrail: minimum, leave headroom)

| Account | Chain | Before | After |
| --- | --- | --- | --- |
| deployer USDC | Base Sepolia | 20 USDC | 15 USDC (5 burned) |
| deployer USDC | Arbitrum Sepolia | 20 USDC | 20 USDC (untouched) |
| GoalVault USDC | Arbitrum Sepolia | 0 | 4.99935 USDC |

15 USDC on Base + 20 USDC on Arb remain — headroom preserved for the demo + a later refund test.

## Notes

- One burn attempt was retried: the `approve` landed, but `depositForBurn` gas-estimation
  hit a stale Alchemy read replica before the approval propagated ("transfer amount exceeds
  allowance"). Re-running with the allowance already confirmed on-chain succeeded on the
  first try. No funds were lost (approve is not a spend).
- 58 Foundry tests green (54 unit + 4 invariants incl. `invariant_solvency`) prior to deploy.
- On-chain relayer == deployer for this proof; production splits them.
