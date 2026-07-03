# Rally — Demo Script

**The one line:** One link. A bar that fills itself from every chain. It pays out together, or refunds everyone — automatically.

**Live:** https://rally-production-94cc.up.railway.app
**Contracts (Arbitrum Sepolia, verified):** Goals [`0x914e…0AB4`](https://sepolia.arbiscan.io/address/0x914e4682ad2febb3e00a21db29b93c16fc080ab4#code) · Circles [`0xdd9b…7838`](https://sepolia.arbiscan.io/address/0xdd9b3e5f407b99e2c2827695608741b328f97838#code)

---

## The 3-minute demo (beat by beat)

> **Tone:** confident, warm, fast. The product does the talking — narrate lightly, let the bars fill. Every number on screen is read live from Arbitrum; say so once, early, and then let the receipts carry it.

### Beat 0 — Open cold on the money (0:00–0:20)

Open the landing. It *is* a live campaign — "Rally's first live fund," the bar partway up, real names in the feed (Sam, Maya, Tom — the crew that filled it), the quiet **Live on Arbitrum** pill in the corner. Don't explain yet. Let them look.

> "This is Rally. This bar is not a mockup — it's reading an escrow on Arbitrum right now, and every color in it is a different chain the money came from. Nobody who chipped in bridged anything, paid gas, or knows what network they were on."

### Beat 1 — The frame, in one sentence (0:20–0:35)

> "Rally is conditional group money: one link that lets any group — a trip chat, a family, a savings committee — move money together under a condition a contract enforces. It pays out together, or it refunds everyone. Automatically. Crowdfunding strangers is a graveyard; money between people who *know each other* is the thing nobody owns — PayPal shut it down in 2021 and never replaced it."

### Beat 2 — The chip-in beat (0:35–1:15)

This is the heart. Do it live.

> "I got the link. Watch how I back this."

- Tap **Chip in $25**. Enter an email. **"No wallet. No seed phrase. No extension."** The one-time code arrives; enter it — an embedded wallet is minted behind that code.
- Pick the amount. Confirm. The button walks through **Sending… → You're in ✦**.
- The bar rises, and your name joins the feed.

> "That's the whole interaction — email, amount, done. Underneath: my USDC just burned on Base, Circle attested it in about ten seconds, and it minted straight into the vault on Arbitrum. That rise is the escrow balance going up. I never left this screen."

### Beat 3 — The switch (1:15–1:30)

Tap the **Goals · Circles** switch at the top of the landing.

> "Hit-the-goal-or-refund is one shape of that promise. Here's the second — the oldest group-money instrument on earth. A savings circle: everyone chips in the same amount every round, and each round one member takes the whole pot. Chit funds, tandas, susus — they run on a trusted foreman. Ours runs on a contract that nobody — including us — has a key to."

The Circles landing shows a circle mid-rotation and says the whole model in three lines: *everyone chips in the same amount · each round one member takes the pot · anyone misses, the circle stops and everyone's refunded.*

### Beat 4 — A real circle, live (1:30–2:20)

- Tap **Start a circle** — name it, set the amount and seats, create. The success moment lands: check, confetti, and **the seat invites front and center** — "Share these with the crew — one per seat." Each invite is a signed seat pass; joining is just an email login.

> "Those links go in the group chat. That's the entire onboarding for a savings circle."

- Now jump to the real one: **"See a real circle, rotating live on Arbitrum" → `/circle/1`.** Round 1 of 4, three of four in, $1 a seat.
- Chip in the last seat — **"You're in this round ✦"** — the round bar tops out.
- The round's payee claims: the pot figure goes hero, the burst fires — **"You got the pot ✦."**

> "One member just took the whole pot, gaslessly, from an email wallet. Next round, the turn rotates. Every claim you just saw is a transaction on Arbitrum."

### Beat 5 — The trust punchline: the circle that broke (2:20–2:45)

Open **`/circle/2`** — "The circle that broke (on purpose)."

> "And this is the part every group-money product hides from you: what happens when someone flakes. This circle broke — a round went unfunded and the contract stopped it. Nobody's money is stuck: the refund already ran. Here's the transaction."

The broken state reads settled, not alarming; the CTA says **Get your money back**, and a member's refund is already an onchain receipt (show the pre-opened Arbiscan tab). Pull the remaining refund live if you want — **"Money's back ✦."**

> "We didn't record a promise. We broke a circle on purpose, on-chain, before this demo — so you could watch the refund rail exist. This is what happens when things go wrong: nobody loses money."

### Beat 6 — Close (2:45–3:00)

Hold on the filled bar.

> "Two shapes, one primitive: conditional group money. A goal that pays out together or refunds everyone. A circle that rotates the pot or refunds everyone. Email in, any chain in, one contract holding the pot — and the chain never once introduced itself.
>
> Rally makes group money feel like passing a hat. Except this hat pays out together, or hands everything back — automatically."

Stop.

---

## The 60-second version

> **One link. A bar that fills itself from every chain. It pays out together, or refunds everyone — automatically. That's Rally.**

1. **(0:00–0:12) Open on the live landing.** "This bar is an escrow on Arbitrum, filling live — every color is a different chain, and nobody bridged anything."
2. **(0:12–0:32) Chip in.** "Email — no wallet, no seed phrase." Code, amount, **You're in ✦**. "Underneath: burned on Base, attested in ~10 seconds, minted into the Arbitrum vault."
3. **(0:32–0:50) The switch.** Tap **Goals · Circles**. "Same promise, second shape: a savings circle — the pot rotates every round, and here's `/circle/1` doing it live. And `/circle/2`? We broke it on purpose. The refund already ran — here's the transaction."
4. **(0:50–1:00) The kicker.** "Conditional group money: the primitive PayPal abandoned, plus the world's largest informal financial instrument, with the pot held by a contract nobody can walk off with. You never notice it's onchain."

---

## Recorded-fallback plan

Live demos die on flaky wifi and faucet weather. Have a safety net.

- **Full screen-recording of the complete happy path** — email login → chip in → bar rise on Goals, then the Circles act (create → invites → round fill → claim), captured on a good run, ready to narrate over identically.
- **The broken circle needs no fallback — it already happened.** `/circle/2` and the [refund tx](https://sepolia.arbiscan.io/tx/0xdb9d1d5cef7e32ab9040e8f2878d9e80a634fd42d900eeb791e1a0e151729ba6) are permanent. Worst case, the trust punchline is a browser tab and an explorer tab.
- **Explorer tabs pre-opened:** the campaign burn (Base) + mint (Arbitrum), the circle-#2 refund, and both verified contracts on Arbiscan. The receipts carry the pitch on their own.
- **Pre-stage the goal-side amounts** so the Goals beat lands on cue rather than waiting on attestation timing.
- **If a second phone/member isn't available for the round fill,** live circles carry a quiet **Demo** disclosure that expands a "watch the round fill" action — use it transparently ("I'll have the demo relayer stand in for the last member").
- **The live site itself is the last resort and it's a good one:** the landing, `/c/1`, and `/circle/1` all read real Arbitrum state over public RPC.
