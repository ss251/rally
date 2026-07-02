# Rally — Roadmap

Rally already works end-to-end: a verified escrow on Arbitrum Sepolia, a real cross-chain CCTP fill, email login, and a live-reading thermometer. This is what comes next — the "we will keep building" path from a working demo to a product people use.

---

## Now (shipped)

- ✅ `GoalVault` all-or-nothing escrow, deployed + verified on Arbitrum Sepolia ([`0x914e…0AB4`](https://sepolia.arbiscan.io/address/0x914e4682ad2febb3e00a21db29b93c16fc080ab4#code)), 58 tests incl. a solvency invariant
- ✅ Real Circle CCTP v2 cross-chain fill (Base Sepolia → Arbitrum Sepolia), ~10s attestation, on-chain proof
- ✅ Magic email login → embedded EIP-7702 wallet, no seed phrase
- ✅ Live campaign UI: canvas liquid thermometer, chain-hued bands, contributor feed, gesture-native contribute sheet
- ✅ Live on Railway (SSR), reading real Arbitrum state at `/c/1`

---

## Near-term

### 1. Gasless 7702 from each backer (own their burn)
Today the demo relayer fronts the source USDC because fresh email wallets are empty. Next: each backer burns **their own** USDC directly from their Magic 7702 wallet, with the burn gas fully sponsored by the ZeroDev paymaster. The relayer becomes optional (a "top up my wallet" convenience), not the path. This closes the one honest caveat in the demo and makes Rally trustless end-to-end.

### 2. More CCTP chains
Add every CCTP v2 domain to the contribute picker so backers can chip in from wherever their USDC already lives:
- **Solana Devnet** — the EVM ↔ Solana chain-abstraction wow; a Solana band rising into an Arbitrum vault, no wrapper, no manual bridge.
- **OP Sepolia, Ethereum Sepolia, Avalanche Fuji** — full CCTP v2 coverage.
- Auto-detect where a backer holds USDC and default the source chain for them — one fewer choice.

### 3. Potluck gift mode (GA)
Ship the second skin on the same escrow: instead of a public goal bar, a private group gift ("chip in for Priya's send-off"). Same all-or-nothing rail, warmer framing, a reveal moment when the pot is delivered. The contract is already skin-agnostic; this is a UI + copy layer plus a gift-reveal flow.

### 4. Expo mobile app
A React Native (Expo) app reusing the exact viem / Magic / ZeroDev / CCTP stack, with the thermometer rendered via `react-native-skia`. Crowdfunding is a phone-native, share-in-the-group-chat act — push notifications when the bar moves, native share sheet, home-screen install. The web PWA is the bridge; Expo is the destination.

### 5. Mainnet
Graduate from testnet to mainnet USDC on Arbitrum One + real CCTP domains, once the gasless-own-burn path (#1) is hardened and the escrow has an external audit. Faucet USDC becomes real USDC; everything else stays identical, which is the point.

---

## Later (the product, not the demo)

- **Organizer dashboard** — manage multiple rallies, see per-chain breakdowns, export.
- **Withdraw splits & milestones** — release funds in tranches as goals are met, not just one lump at the end.
- **Named links & rich share cards** — `rally.to/tokyo-crew` with an OG image that shows the live bar.
- **Recurring / streaming contributions** — chip in a little each week toward a bigger goal.
- **Notifications** — "the Tokyo fund just hit 90%" nudges that pull backers back.
- **On/off-ramp** — let a first-timer fund with a card and still land as USDC in the vault, so the very first backer never needs crypto at all.
- **Contract audit + bug bounty** before any mainnet value moves.

---

## Guiding principle

Every item on this list is judged by one question: **does it make the chain more invisible?** Rally wins by being the crowdfunding app that happens to be onchain — never the onchain app that happens to do crowdfunding. We keep subtracting friction until backing a rally is as thoughtless as replying to a group chat.
