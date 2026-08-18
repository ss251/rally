# Rally — finale deck

16:9. Seven slides. No build step.

**Present:** open `index.html`, or `python3 -m http.server` in `deck/`.

After this branch is on the live app: `https://rally-production-94cc.up.railway.app/pitch`

GitHub Pages (once Settings → Pages → Source: GitHub Actions): `https://ss251.github.io/rally/`

| Key | |
|---|---|
| `←` `→` space `j` `k` | next / prev |
| `F` | fullscreen |
| `N` | speaker notes under every slide |
| Print | File → Print → PDF, landscape, one slide per page |

## Talk (≈3 minutes)

0. Landing. The bar is live RPC. Each color is a source chain. (~20s)
1. PayPal killed pools. Tandas still need a foreman. Custody was the bug. (~20s)
2. Goals / Circles — same refund promise, two instruments. `/c/9` and `/circle/7`. (~30s)
3. Chip in: email, amount, paying-from. Incognito if you want the OTP on camera. (~30s)
4. Judge slide. Magic 7702 → ZeroDev UserOp → CCTP v2 domains 6/2→3 → two verified vaults. `UnattributedFunds` is the trust bound. User never sees it. (~45s)
5. `/c/9` three domains. `/circle/2` we broke; `refundFor` already ran. (~20s)
6. URL. Stop. (~10s)

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
