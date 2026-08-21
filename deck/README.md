# Rally — finale deck

16:9. Eight slides. No build step.

**Present:** open `index.html`, or `python3 -m http.server` in `deck/`.

Live deck (does not replace the app): `https://rally-deck-production.up.railway.app`

After this branch is on the live app: `https://rally-production-94cc.up.railway.app/pitch`

GitHub Pages: `https://ss251.github.io/rally/` — `gh-pages` is already published. Official `deploy-pages` cannot create the site (`Resource not accessible by integration` — needs repo admin). One click: Settings → Pages → Deploy from a branch → `gh-pages` / `/(root)`.

| Key | |
|---|---|
| `←` `→` space `j` `k` | next / prev |
| `F` | fullscreen |
| `N` | speaker notes (not shown on the chrome — this deck is audience-facing) |
| Print | File → Print → PDF, landscape, one slide per page |

Keyboard changes are instant (Raycast rule — never animate an action the presenter fires tens of times). First paint only: a 220ms ease-out stagger on the title slide (`translateY(8px) scale(0.97)`, 40ms delays). Pressable chrome scales to `0.97`. Dots grow with `scaleX`, not width. Visual language is Emil’s markdown-graph chrome: `#050505`, Geist + Geist Mono, one accent (`#ff6b4a`), dashed frames, no grain / glow / Clash Display.

## Talk (≈2:30, no product demo)

Press `N` on the live deck for the same lines. Do not open the app unless they ask.

0. Each color on that bar is a chain the USDC actually came from. One link. If it fills, it pays out. If it misses, anyone can refund. That's a live shot of pot nine — I'm staying on the slides. (~20s)
1. PayPal shut Money Pools in 2021 and never replaced them. A tanda still goes through one person. The gap wasn't another app. The pot needed a contract. (~18s)
2. Left is a goal — all or nothing. Pot nine, eleven of twenty-five, Base, Arbitrum, Optimism. Right is a circle. Friday dinner, four seats, a dollar each, three of four this round. Miss a round and it stops and refunds. (~22s)
3. Email, amount, paying-from. That's the whole sheet. Magic's OTP makes the account. ZeroDev sponsors gas so they don't need ETH. Circle only runs if the USDC isn't on Arbitrum yet. (~20s)
4. Left to right: 7702 on the same address, a sponsored UserOp, CCTP from domain 6 or 2 onto 3, then the vault. Refund is permissionless. UnattributedFunds is the important revert — you cannot credit money that isn't there. Both vaults are verified. Eighty-six tests, including a fund-conservation fuzz. (~32s)
5. Same pot nine, three domains. And we broke a circle on purpose. Circle two missed its round. refundFor ran. That hash is the miss, not a fill we dressed up. (~20s)
6. Not shipped. Mainnet USDC on the same vaults. Coinbase or MoonPay so people can buy in the flow. Plug in a wallet you already have. Export the email wallet if that's how you signed in. (~18s)
7. App, two-minute film, repo, verified vaults. I'll leave this up. (~10s)

Do not chip `/c/1`. Hero pot is `/c/9`. Live circle for the mid-fill shot is `/circle/7` (Friday dinner, 3 of 4). `/circle/2` is the refund receipt.

Do not Railway-deploy this branch over production until `cursor/hotfix-chipin-identity-4601` is in the same tree — this branch is deck-first.

## Logos

Official kits only. See `assets/ATTRIBUTIONS.md`.

## Recapture shots

```bash
bunx playwright install chromium
# local app running (for named /circle/7)
bun run dev
node deck/capture-shots.mjs
```

## Tests

```bash
node --test deck/deck.test.mjs
```
