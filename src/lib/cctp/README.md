# Rally · Circle CCTP v2 cross-chain rail (TESTNET)

This module is Rally's cross-chain money movement layer. Every contribution to a
Rally campaign is a **real CCTP v2 burn-and-mint of testnet USDC** from the
backer's chain into the **GoalVault on Arbitrum Sepolia**. No bridges-of-liquidity,
no wrapped assets — native USDC is burned on the source and freshly minted on the
destination by Circle's protocol.

> **Testnet only. $0.** All addresses and endpoints here are CCTP **v2 testnet**.
> Faucet USDC + gas are free from https://faucet.circle.com. Never introduce
> mainnet addresses.

---

## 1. Files

| File | What it is |
| --- | --- |
| `addresses.ts` | Verified constants: v2 testnet contract addresses (unified), USDC tokens, domain IDs, Iris API hosts, finality thresholds, latency table, minimal ABIs. Every block cites its Circle source URL. |
| `cctp.ts` | Typed functions: `burnOnSource`, `fetchAttestation`, `mintOnDestination`, plus `contribute` (all three) and `getBurnFee`. Implemented against `viem`; `fetchAttestation`/`getBurnFee` are dependency-free. |
| `README.md` | This doc — the flow, latency, and how Rally uses it. |

**Dependency:** the on-chain helpers import `viem`, which is **not yet in
`package.json`**. Add it before use:

```bash
bun add viem
```

`fetchAttestation` and `getBurnFee` use the global `fetch` and need nothing.

---

## 2. The CCTP v2 flow

```
  SOURCE CHAIN (backer)                 CIRCLE (offchain)            DEST CHAIN (Arbitrum Sepolia)
  ─────────────────────                 ────────────────            ─────────────────────────────
  approve(USDC -> TokenMessengerV2)
  depositForBurn(...)  ── burns USDC ──► Iris waits for finality
        emits MessageSent               signs the message
                                        │
  poll GET /v2/messages/{domain}?       │
      transactionHash=0x...  ◄──────────┘ returns { message, attestation, status }
                                                              │
                                          receiveMessage(message, attestation)
                                          └─ mints USDC to mintRecipient (GoalVault) ─►
```

Three steps, mapped to the module:

1. **`burnOnSource()`** — `approve` USDC to `TokenMessengerV2`, then
   `depositForBurn` (or `depositForBurnWithHook`) on the backer's chain.
   `depositForBurn` params (v2):
   `(amount, destinationDomain, mintRecipient (bytes32), burnToken, destinationCaller (bytes32), maxFee, minFinalityThreshold)`.
   Returns the **burn txHash** — the only handle you need for step 2.

2. **`fetchAttestation()`** — poll Circle's **Iris v2** API:
   `GET https://iris-api-sandbox.circle.com/v2/messages/{sourceDomainId}?transactionHash={txHash}`.
   Response: `{ messages: [{ status, message, attestation, eventNonce, decodedMessage }] }`.
   Wait until `status === "complete"`; that yields the `message` bytes + `attestation`
   signature. (`404` while Circle indexes the burn → keep polling.)

3. **`mintOnDestination()`** — `MessageTransmitterV2.receiveMessage(message, attestation)`
   on Arbitrum Sepolia. Mints USDC to the `mintRecipient` chosen at burn time
   (the GoalVault). Anyone can submit it — Rally runs it from a **relayer** so
   backers never touch the destination chain.

### Fast vs Standard (the `minFinalityThreshold` knob)

| Mode | `minFinalityThreshold` | Attested at | Notes |
| --- | --- | --- | --- |
| **Fast** | `1000` (`CONFIRMED`) | "confirmed" (soft) | seconds; charges a small fast-burn fee; subject to a global allowance |
| **Standard** | `2000` (`FINALIZED`) | hard finality | minutes on L2s (waits for Ethereum L1 batch finality) |

**Use Fast for the live demo** so the thermometer moves in seconds. If Fast is
ever unavailable/allowance-capped, fall back to Standard and pre-warm.

---

## 3. Latency expectations (VERIFIED — Circle's published averages)

Source: https://developers.circle.com/cctp/required-block-confirmations

| Source chain (domain) | Fast Transfer | Standard Transfer |
| --- | --- | --- |
| Arbitrum Sepolia (3) | ~8 s | ~15–19 min |
| Base Sepolia (6) | ~8 s | ~15–19 min |
| OP Sepolia (2) | ~8 s | ~15–19 min |
| Ethereum Sepolia (0) | ~20 s | ~15–19 min |
| Solana Devnet (5) | ~8 s | ~25 s |

Numbers are Circle's mainnet averages; testnet is the same order of magnitude
(occasionally slower). **Demo implication:** L2→L2 Fast transfers land in
seconds → live thermometer fill is realistic. Standard on L2s is minutes because
L2 finality is gated on the Ethereum L1 batch — never use Standard for the live
fill; use it only for the (pre-recorded) refund path if needed.

---

## 4. Verified constants (quick reference)

**CCTP v2 testnet contracts — UNIFIED (same address on every EVM v2 testnet chain):**

| Contract | Address |
| --- | --- |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| TokenMinterV2 | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` |
| MessageV2 | `0xbaC0179bB358A8936169a63408C8481D582390C4` |

**USDC (testnet) + domain IDs:**

| Chain | Domain | USDC |
| --- | --- | --- |
| Ethereum Sepolia | 0 | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| OP Sepolia | 2 | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` |
| Arbitrum Sepolia | 3 | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| Solana Devnet | 5 | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Base Sepolia | 6 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

**Iris attestation API (testnet):** `https://iris-api-sandbox.circle.com`
· messages: `GET /v2/messages/{sourceDomainId}?transactionHash={txHash}`
· fees: `GET /v2/burn/USDC/fees/{srcDomain}/{dstDomain}`
· fast allowance: `GET /v2/fastBurn/USDC/allowance`

**Faucet:** https://faucet.circle.com (USDC + native gas for ARB/BASE/OP/ETH
Sepolia, Avax Fuji, Solana Devnet).

Full citations live as comments in `addresses.ts`.

---

## 5. How Rally uses it

**Contribute = burn on the backer's chain → mint into the GoalVault on Arbitrum Sepolia.**

- The organizer's campaign has a `GoalVault` deployed on **Arbitrum Sepolia**.
  That contract address is the CCTP **`mintRecipient`** for every contribution.
- A backer logs in with Magic (email, 7702 embedded wallet), holds testnet USDC
  on Base / OP / Arbitrum Sepolia (or Solana Devnet), and contributes:
  1. `burnOnSource()` on their chain (gasless via ZeroDev/Magic 7702 paymaster).
  2. Rally's relayer `fetchAttestation()` then `mintOnDestination()` on Arbitrum
     Sepolia — USDC is minted into the GoalVault.
  3. The thermometer increments live (websocket) with the backer's name.
- **All-or-nothing (the cherry):** on a miss, refund = a **reverse CCTP burn**
  from the vault back to each backer's `sourceDomain`. Degrades to a
  "claim on Arbitrum Sepolia" page if it slips.

### Crediting a specific campaign/backer on mint

Plain `depositForBurn` mints USDC to the vault but carries **no app metadata**.
Two patterns to attribute the deposit to `{campaignId, backer}`:

- **Hook (preferred, atomic):** use `depositForBurnWithHook` with
  `hookData = abi.encode(campaignId, backer, sourceDomain)`. The GoalVault
  implements the v2 handler interface (`handleReceiveFinalizedMessage` /
  `handleReceiveUnfinalizedMessage`) so the credit happens in the same mint tx.
- **Relayer-credit (simpler for the hackathon):** `mintRecipient` = vault; after
  `mintOnDestination`, the relayer calls `vault.credit(campaignId, backer, amount, sourceDomain)`
  (relayer-authorized). Fine for a testnet demo; less trustless than the hook.

The vault contract choice is owned by the contract engineer; this rail module is
agnostic — it just needs the vault **address** as `mintRecipient` and, if the
hook path is chosen, the encoded `hookData`.

### Example (once `viem` is installed)

```ts
import { EVM_CHAINS, GOAL_VAULT_CHAIN } from "#/lib/cctp/addresses";
import { contribute, usdc } from "#/lib/cctp/cctp";

const { burnTx, mintTx } = await contribute({
  source: { walletClient, publicClient, account, chain: baseSepoliaChain },
  destination: { walletClient: relayer, publicClient: arbPublic, account: relayerAcct, chain: arbSepoliaChain },
  sourceChain: EVM_CHAINS.baseSepolia,
  destinationDomain: GOAL_VAULT_CHAIN.domain, // 3 (Arbitrum Sepolia)
  goalVault: "0xVAULT...",
  amount: usdc(5),         // 5 USDC
  transferType: "fast",    // seconds, not minutes
  onStatus: (p) => console.log(p),
});
```

---

## 6. Confidence & open items

| Item | Confidence |
| --- | --- |
| v2 testnet contract addresses (unified) | **VERIFIED** (Circle docs) |
| USDC testnet tokens + domain IDs | **VERIFIED** |
| `depositForBurn` / `receiveMessage` v2 signatures | **VERIFIED** |
| Iris v2 base URL + `/v2/messages` path & response shape | **VERIFIED** |
| Finality thresholds (1000/2000) + latency table | **VERIFIED** |
| `fetchAttestation` implementation | **VERIFIED** logic; **NEEDS-LIVE-TEST** against a real burn txHash |
| `burnOnSource` / `mintOnDestination` | Implemented vs viem; **NEEDS-LIVE-TEST** (viem install + funded/sponsored signer) |
| Fast-transfer `maxFee` sizing (`getBurnFee` field names) | **NEEDS-LIVE-TEST** (confirm sandbox response shape) |
| Gasless 7702 (ZeroDev/Magic) wiring of the WalletClient | **TODO** (owned by the wallet/gasless agent; seams marked in `cctp.ts`) |
| Solana Devnet leg (programs, PDAs) | **NEEDS-LIVE-TEST** — docs table vs IDL links disagree on which program id is which; optional/ambitious leg |
