# Rally — finale deck

16:9. Seven slides. No build step.

**Present:** open `index.html`, or after GitHub Pages is on:

`https://ss251.github.io/rally/`

| Key | |
|---|---|
| `←` `→` `space` `j` `k` | next / prev |
| `F` | fullscreen |
| `N` | speaker notes under every slide |
| Print | File → Print → PDF, landscape |

## Talk (≈3 minutes)

0. Landing. The bar is live RPC. Each color is a source chain.
1. PayPal killed pools. Tandas still need a foreman. Custody was the bug.
2. Goals / Circles — same refund promise, two instruments. Click through if wifi holds.
3. Chip in: email, amount, paying-from. Incognito if you want the OTP on camera.
4. Judge slide. Magic 7702 → ZeroDev UserOp → CCTP v2 domains 6/2→3 → two verified vaults. User never sees it.
5. `/c/6` three chains. `/circle/2` we broke; refund tx is already there.
6. URL. Stop.

Do not chip `/c/1`. Hero pot is `/c/9`.

## Logos

Official kits only. See `assets/ATTRIBUTIONS.md`.

## Tests

```bash
node --test deck/deck.test.mjs
```

## GitHub Pages

Repo **Settings → Pages → Source: GitHub Actions**. The workflow is `.github/workflows/pages.yml`. Until that click, open `deck/index.html` locally.
