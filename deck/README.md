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

## Talk

Press `N` on the live deck for the same lines.

0. Hey guys I'm here to present Rally — group money onchain. Lets people permissionlessly spin up group pots.
1. Inspiration behind this was to let people manage group pots easily without having to go through the friction of setting up a crypto wallet or handling private keys. PayPal shut down Money Pools in 2021 and never replaced. Traditional savings circles still depend on a trusted organizer.
2. We have 2 kinds of pools — goals and circles. Goals let people create an all-or-nothing pot to meet a shared financial goal. Circles are bringing savings circles onchain and taking the hassle out of bookkeeping.
3. Every time a user logs in with their email, Magic spins up an embedded wallet and activates 7702 authorization to enable gasless transactions. ZeroDev enables those gasless transactions.
4. Circle CCTP allows for cross chain deposits into the pool, currently supports Optimism and Base besides Arbitrum. The vault contracts themselves are deployed on Arbitrum testnet.
5. What happens if a goal or circle is not met within the deadline set by the creator? All the funds go back to sender.
6. Future plans include going to mainnet, integrating fiat onramp using Coinbase or MoonPay, letting people bring their own wallet so that crypto native people can jump in right away, and lastly adding email wallet management for people who signed in with their email.
7. App, film, repo, vaults. I'll leave this up.

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
