# Rally

**One link. A bar that fills itself from every chain. Hit the goal, or everyone gets their money back.**

Rally is a live cross-chain fundraising thermometer. An organizer creates a campaign (goal + deadline) and shares a single link. Each backer logs in with email (embedded wallet, no seed phrase) and contributes testnet USDC from whatever chain they hold. Every contribution moves cross-chain via Circle CCTP v2 into a goal-vault on Arbitrum Sepolia, and the thermometer fills live. If the goal is hit the organizer withdraws the consolidated funds; if it misses, every backer is refunded — all-or-nothing.

> Testnet only. No real money is ever involved.

## Stack

- **Frontend:** [TanStack Start](https://tanstack.com/start) (React 19 + Vite) + Tailwind CSS v4
- **Cross-chain rail:** Circle CCTP v2 (Arbitrum Sepolia, Base Sepolia, OP Sepolia, Solana Devnet)
- **Embedded wallet + gasless:** Magic (email login, EIP-7702) + ZeroDev paymaster
- **Contracts:** Solidity via Foundry, deployed to Arbitrum Sepolia
- **Deploy:** Railway
- **Package manager:** bun

## Getting started

```bash
bun install
bun run dev      # http://localhost:3000
```

Other scripts:

```bash
bun run build    # production build
bun run start    # serve the production build
bun run test     # run the test suite
```

Create a `.env.local` with the following keys before running against live testnet services (all free, all testnet):

```
VITE_MAGIC_PUBLISHABLE_KEY=     # Magic — email login + EIP-7702
VITE_ZERODEV_PROJECT_ID=        # ZeroDev — gasless 7702 (Arbitrum Sepolia)
CIRCLE_API_KEY=                 # Circle — CCTP v2 + testnet USDC faucet
ALCHEMY_API_KEY=                # Alchemy — RPC for Arbitrum/Base/OP Sepolia
ARBISCAN_API_KEY=               # Arbiscan — verify the goal-vault contract
```

## Contracts

Solidity contracts live in [`contracts/`](./contracts) and use [Foundry](https://book.getfoundry.sh/).

```bash
cd contracts
forge build
forge test
```

## Project layout

```
src/routes/        file-based routes (index = landing)
src/router.tsx     router setup
contracts/         Foundry project (goal-vault escrow)
public/            static assets
```

## License

MIT
