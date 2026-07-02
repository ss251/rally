# Rally — Auth & Gasless Layer (`src/lib/auth`)

Email login → embedded wallet → **gasless** first transaction. This is the layer
that lets a backer go from "tapped a link in a group chat" to "contributed
cross-chain USDC" without a seed phrase, a browser extension, or holding gas.

- **`magic.ts`** — Magic embedded wallet: email OTP login, the EOA, EIP-7702 signing helpers, viem interop.
- **`zerodev.ts`** — ZeroDev Kernel smart account (7702) + verifying paymaster: sponsored UserOps, the gasless CCTP contribution.

> **Testnet only.** No real money. Chains: Arbitrum Sepolia (`421614`, the
> goal-vault / CCTP destination), Base Sepolia (`84532`), OP Sepolia (`11155420`).
> Solana Devnet contributions do **not** flow through this module — Magic + ZeroDev
> 7702 are EVM-only; the CCTP-Solana path is handled by the chain module.

---

## Packages to install

```bash
bun add magic-sdk@^33.7 @magic-ext/evm@^1.5 \
        @zerodev/sdk@^5.5 @zerodev/ecdsa-validator@^5.4 \
        viem@^2.54
```

| Package | Version | Role |
| --- | --- | --- |
| `magic-sdk` | `^33.7.1` | Email-login embedded wallet + `wallet.sign7702Authorization` / `wallet.send7702Transaction` |
| `@magic-ext/evm` | `^1.5.1` | EVM extension → `magic.evm.switchChain`, multi-chain RPC config |
| `@zerodev/sdk` | `^5.5.10` | Kernel account (7702), paymaster client, kernel account client |
| `@zerodev/ecdsa-validator` | `^5.4.9` | ECDSA validator (only needed for the non-7702 smart-account fallback) |
| `viem` | `^2.54.1` | Clients, ABI encoding, chain defs, EntryPoint 0.7 types |

`@zerodev/ecdsa-validator` is **not** required for the pure-7702 path (the EOA's
own key is the root validator). Keep it only if you also build a classic
counterfactual smart-account fallback.

---

## Environment variables

Names match `.env.local.TEMPLATE`:

```
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_...   # dashboard.magic.link → app → Publishable API Key
NEXT_PUBLIC_ZERODEV_PROJECT_ID=...              # dashboard.zerodev.app → project (Arb/Base/OP Sepolia)
ALCHEMY_API_KEY=...                             # optional RPC upgrade; public RPC used if absent
```

### ⚠️ Vite env prefix (one-line config change, required)

The project is **TanStack Start / Vite**, and Vite only exposes vars prefixed
with `VITE_` to the browser by default. The env names above use `NEXT_PUBLIC_`.
So the config owner must widen the prefix in `vite.config.ts`:

```ts
export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // ...existing config
})
```

Without this, `import.meta.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` is `undefined`
in the browser and login silently no-ops. The code also reads `process.env` as a
fallback for SSR / server functions.

- The **Magic publishable key** is public by design (safe on the client).
- The **ZeroDev project ID** is public by design (gas policies are enforced
  server-side by ZeroDev — set a policy or nothing gets sponsored).
- Do **not** ship a raw `ALCHEMY_API_KEY` to the client. Either use a
  `NEXT_PUBLIC_ALCHEMY_API_KEY` scoped to testnet or proxy RPC through a server
  function. When absent, the code falls back to each chain's public RPC.

---

## The onboarding UX: email → wallet → gasless first tx

```
 backer taps link
        │
        ▼
 loginWithEmail("a@b.com")            magic.ts   → Magic mints an EOA (no seed)
        │
        ▼
 getMagicWalletClient(sourceChainId)  magic.ts   → viem WalletClient over Magic
        │
        ▼
 createRallyKernelClient({...})       zerodev.ts → EOA upgraded to a 7702 Kernel
        │                                          smart account (same address)
        ▼
 sendGaslessCctpContribution({...})   zerodev.ts → approve + depositForBurn in ONE
        │                                          sponsored UserOp; backer signs,
        ▼                                          ZeroDev pays the gas
 thermometer ticks up 🎉
```

### Exact call sequence for a gasless contribution

```ts
import {
  loginWithEmail,
  getMagicWalletClient,
  baseSepolia, // via RALLY_CHAINS if you need the chain object
} from '#/lib/auth/magic';
import {
  createRallyKernelClient,
  sendGaslessCctpContribution,
} from '#/lib/auth/zerodev';

// 1. Email login → Magic EOA
const user = await loginWithEmail('backer@example.com');

// 2. viem wallet client on the source chain (e.g. Base Sepolia = 84532)
const magicWallet = await getMagicWalletClient(84532);

// 3. Upgrade the EOA to a gasless 7702 Kernel account (AUTO auth path)
const kernelClient = await createRallyKernelClient({
  magicWallet,
  chainId: 84532,
});

// 4. Gasless cross-chain contribution: burn USDC on Base Sepolia,
//    Circle attests, mint into the goal-vault on Arbitrum Sepolia.
const { transactionHash } = await sendGaslessCctpContribution({
  kernelClient,
  usdc: USDC_BASE_SEPOLIA,             // from the CCTP module
  tokenMessenger: TOKEN_MESSENGER_V2,  // from the CCTP module
  amount: 5_000_000n,                  // 5 USDC (6 decimals)
  destinationDomain: 3,                // Arbitrum Sepolia CCTP domain
  goalVaultOnHomeChain: GOAL_VAULT,    // the Rally vault on Arb Sepolia
  minFinalityThreshold: 2000,          // standard; use 1000 + maxFee for fast
});
```

The backer sees **one signature prompt**, never a gas fee, never a token
balance requirement. That is the whole pitch.

---

## The 7702 footgun (read before you debug for an hour)

EIP-7702 delegation **type-checks cleanly and then reverts / silently no-ops
on-chain** when any of these are wrong. All three bit the reference
implementation (`Particle-Network/ua-7702-magic-demo`):

1. **`chainId: 0` is unsignable by Magic.** Magic **cannot** sign a
   chain-agnostic (chainId 0) authorization. Always delegate per concrete chain.
   `signMagic7702Authorization` forces a real chainId — keep it that way.

2. **Nonce off-by-one.** The authorization nonce must match the EOA's expected
   nonce for the delegation tx. In the raw Magic self-delegation pattern it is
   `currentNonce + 1`; when ZeroDev drives it, use exactly the nonce ZeroDev
   provides. Wrong nonce → tx reverts with no useful error.

3. **AUTO vs MANUAL authorization.** `createRallyKernelClient` defaults to the
   **AUTO** path (pass only `eip7702Account`, let ZeroDev call viem's
   `signAuthorization`). This works only if **Magic's provider answers
   `eth_signAuthorization`**. If you see "method not supported" / a hang:
   - pre-sign with `signMagic7702Authorization({ contractAddress: getKernelImplementationAddress(), chainId, nonce })`
   - pass it as `presignedAuth` to `createRallyKernelClient` (the **MANUAL** path).
   The `v → yParity` conversion (27/28 → 0/1) is done for you; getting it wrong
   is another silent-revert source.

4. **Delegation needs testnet ETH in the EOA _only for the raw Magic path_.**
   The gasless ZeroDev path sponsors it. If you fall back to
   `sendMagic7702Transaction`, the EOA needs faucet ETH (free from
   `faucet.circle.com`).

5. **No ZeroDev gas policy = no sponsorship.** A brand-new ZeroDev project
   sponsors nothing until you enable a gas policy for that exact chain in the
   dashboard. UserOps just fail. Enable a policy per chain (Arb/Base/OP Sepolia).

**Test delegation on Base Sepolia AND Arbitrum Sepolia on day one** — before
building any UI on top. Delegation is one-time per chain and reversible.

---

## What's stubbed / needs a live key

- `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` — without it `getMagic()` warns and returns
  `null` (login disabled). No crash.
- `NEXT_PUBLIC_ZERODEV_PROJECT_ID` — without it `zerodevRpcUrl()` throws. Plus a
  **gas policy** must be enabled in the dashboard.
- CCTP addresses (`usdc`, `tokenMessenger`, `goalVaultOnHomeChain`,
  `destinationDomain`) are **parameters**, supplied by the CCTP / contracts
  modules — this layer stays decoupled and only owns the gasless send.
- AUTO-vs-MANUAL 7702 path: cannot be decided without a live Magic key to probe
  `eth_signAuthorization`. Ship AUTO, keep MANUAL wired as the fallback.
