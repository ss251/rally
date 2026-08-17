# AGENTS.md

## Cursor Cloud specific instructions

Rally is a single-product repo: a TanStack Start (React 19 + Vite, SSR via Nitro) web app. Standard commands live in `README.md` and `package.json`; the notes below are the non-obvious bits for this environment.

### Services

- Web app (only long-running service): `bun run dev` serves on `http://localhost:3000`. This is the dev command to use — not `bun run build` / `bun run start` (those produce the production SSR bundle).
- There is no separate backend; server functions run inside the same TanStack Start / Nitro process.

### Package manager

- Use `bun` (there is a `bun.lock`). The `pnpm.onlyBuiltDependencies` block in `package.json` is legacy; dependency installs go through `bun install`.

### Environment variables

- The app runs and renders **without any `.env`**. All keys in the README "Getting started" section (`VITE_MAGIC_PUBLISHABLE_KEY`, `VITE_ZERODEV_PROJECT_ID`, `CIRCLE_API_KEY`, `ALCHEMY_API_KEY`, `ARBISCAN_API_KEY`, plus dispenser/relayer keys read in `src/lib/`) are optional and code falls back gracefully when they're missing.
- Live campaign/circle pages (`/c/$id`, `/circle/$id`) and the landing hero read real on-chain state from Arbitrum Sepolia over public RPC, so they render real data even without `ALCHEMY_API_KEY`.
- Email login (Magic OTP → embedded EIP-7702 wallet) and gasless writes (ZeroDev) require the `VITE_MAGIC_*` / `VITE_ZERODEV_*` keys AND a human to type the OTP. Without those keys, login silently no-ops — so the contribute/create-onchain flows can be exercised in the UI but cannot complete a real transaction in an unattended environment.
- **Preferred way to get a full local `.env.local`:** use the Railway CLI against project `rally` (id `d5a61522-8c08-4b54-b827-ffcaca158121`), environment `production`, service `rally`:
  1. `railway login` (device-code / browser) if `railway whoami` fails.
  2. `railway variable list --project d5a61522-8c08-4b54-b827-ffcaca158121 --environment production --service rally --json`
  3. Write non-`RAILWAY_*` keys into gitignored `.env.local`. Remap volume paths: `DISPENSER_CLAIMS_FILE` / `RALLY_META_FILE` are `/data/...` on Railway — use `/workspace/.rally-data/...` locally (dir is gitignored).
  4. Restart `bun run dev` so Vite reloads `.env.local`.
- Client-safe `VITE_*` keys also ship in the production `/create` auth chunk if Railway auth isn't available, but that path cannot recover private keys (`CIRCLE_API_KEY`, `RELAYER_KEY`, `DISPENSER_KEY`, `GH_CLIENT_*`, etc.).
- `ARBISCAN_API_KEY` is not set on the Railway service (only needed for `forge` verify).

### Tests / lint

- `bun run test` (vitest) has **no application tests** and is currently broken: vitest globs into `contracts/lib/openzeppelin-contracts/**/*.test.js` (Foundry library Hardhat tests) which fail with `Cannot find module 'hardhat'`. This is pre-existing, not an env problem. Do not treat it as a regression.
- The real test suite is the Solidity/Foundry suite in `contracts/` (`forge test`, 86 tests). `forge` is **not** installed by the update script; run `curl -L https://foundry.paradigm.xyz | bash && foundryup` first if you need to work on contracts.
- There is no ESLint/lint script configured; "lint" for the frontend is TypeScript type-checking (`bunx tsc --noEmit`) plus `bun run build`.

### Vite gotcha (do not "fix")

- `vite.config.ts` applies the `events` node polyfill **only** in dev (`command === 'serve'`). The comment there explains that applying it to `build` corrupts the SSR bundle's `process` global and crash-loops the deployed server. Leave the `command === 'serve'` gate alone.
