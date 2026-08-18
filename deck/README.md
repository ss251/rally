# Rally — finale deck

16:9. Eight slides. No build step.

**Present:** open `index.html`, or `python3 -m http.server` in `deck/`.

After this branch is on the live app: `https://rally-production-94cc.up.railway.app/pitch`

GitHub Pages: `https://ss251.github.io/rally/`

The first deploy failed because the repo had never had Pages turned on (`Get Pages site failed`). The workflow now passes `enablement: true` to `actions/configure-pages@v5` so the Actions job can create the site. If that is still blocked by org policy: Settings → Pages → Source: GitHub Actions.

| Key | |
|---|---|
| `←` `→` space `j` `k` | next / prev |
| `F` | fullscreen |
| `N` | speaker notes (not shown on the chrome — this deck is audience-facing) |
| Print | File → Print → PDF, landscape, one slide per page |

Keyboard changes are instant (Raycast rule — never animate an action the presenter fires tens of times). First paint only: a 220ms ease-out stagger on the title slide (`translateY(8px) scale(0.97)`, 40ms delays). Pressable chrome scales to `0.97`. Dots grow with `scaleX`, not width. Visual language is Emil’s markdown-graph chrome: `#050505`, Geist + Geist Mono, one accent (`#ff6b4a`), dashed frames, no grain / glow / Clash Display.

## Talk (≈3 minutes)

0. Landing. One link, a bar that fills from every chain. Point at the colors. (~20s)
1. PayPal killed pools. Tandas still go through one person. The pot needed a contract. (~20s)
2. Goals and circles. `/c/9` and `/circle/7`. (~30s)
3. Chip in: email, amount, paying-from. Incognito if you want the OTP on camera. (~30s)
4. Write path: Magic 7702 → ZeroDev UserOp → CCTP v2 domains 6/2→3 → two verified vaults. `UnattributedFunds`. (~45s)
5. `/c/9` three domains. `/circle/2` refunded after an unfunded round. (~20s)
6. Roadmap: mainnet, Coinbase / MoonPay, connect an existing wallet, Magic export/recover. (~20s)
7. URL. Stop. (~10s)

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
