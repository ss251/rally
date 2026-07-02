# Rally — Demo Script

**The one line:** One link. A bar that fills itself from every chain. Hit the goal, or everyone gets their money back.

**Live:** https://rally-production-94cc.up.railway.app · **Contract:** [`0x914e…0AB4`](https://sepolia.arbiscan.io/address/0x914e4682ad2febb3e00a21db29b93c16fc080ab4#code) (Arbitrum Sepolia, verified)

---

## The 3-minute demo (beat by beat)

> **Tone:** confident, warm, fast. The product does the talking — narrate lightly, let the bar rise. Every claim on screen is real on-chain state; say so.

### Beat 0 — Open cold on the money (0:00–0:20)

Open directly on a live campaign — the thermometer already partway up, colored bands stacked, contributor names ticking. Don't explain yet. Let them look.

> "This is Rally. Maya is raising to send her crew to Tokyo. This bar is real — it's reading a live escrow on Arbitrum right now. And every color in it is a different blockchain the money came from."

Tap the mercury; the bands separate with labels. Base. Optimism. Arbitrum.

> "Half of this came from a chain the next person over never touched. Nobody bridged anything. Nobody picked a network. They just chipped in."

### Beat 1 — The problem, in one sentence (0:20–0:40)

> "Crowdfunding is a social act. But onchain, we've made it a crypto act — pick a chain, bridge your funds, approve a network, hope you're on the right one. So the group chat never becomes contributors. Rally deletes all of that. The chain disappears."

### Beat 2 — The money moment: email → chip in (0:40–1:40)

This is the heart. Do it live.

> "I got the link. Watch how I back this."

- Open the share link. Tap **Chip in**.
- Enter an email. **"No wallet. No seed phrase. No extension."** The one-time code arrives; enter it. An embedded EIP-7702 wallet is minted in the background via Magic.
- Pick an amount. Confirm.

> "That's it. That's the whole interaction — email, amount, done. Now watch what actually happened underneath."

- The bar bumps optimistically the instant you confirm.
- Narrate the rail while it settles: **"My USDC just got burned on Base, Circle attested it in about ten seconds, and it minted straight into the goal vault on Arbitrum."**
- The bar reconciles to the real on-chain amount. A new band appears in the source chain's color. Your name joins the feed.

> "That rise is not an animation. That's the escrow balance on Arbitrum going up. Different chain in, one pot out — and I never left this screen."

### Beat 3 — The all-or-nothing safety (1:40–2:20)

> "Here's the part that makes people actually give: it's all-or-nothing."

Show the goal / deadline. Explain the escrow guarantee.

> "The vault tracks every backer and exactly which chain their money came from. Hit the goal before the deadline — the organizer withdraws one consolidated pot. Miss it — every backer gets refunded, railed right back to the chain they gave from. Nobody's money is ever stuck. That's enforced by a contract that's deployed and verified on Arbitrum — here's the address, go read it."

*(Refund can be shown pre-recorded — see fallback note — since a live refund needs the deadline/miss condition.)*

### Beat 4 — Goal hit, the payoff (2:20–2:45)

Trigger the final contribution that crosses the goal (pre-staged so it lands on cue).

> "And this is the moment the whole thing is built for."

The number slams to 100% with a spring overshoot; chain-tinted confetti; the CTA morphs from **"Chip in"** to **"Share the win."**

> "Goal hit. Money's consolidated on Arbitrum. And the person who started this never had to know what a bridge is."

### Beat 5 — The unexpected high note (2:45–3:00)

End on something they didn't see coming.

> "One more thing. Everything you just watched — the login, the cross-chain move, the rising bar — that already happened for real before this demo. There's a burn tx on Base and a mint tx on Arbitrum, timestamped, on block explorers, that moved a real campaign from zero. This isn't a prototype of an idea. It's a receipt.
>
> Rally makes onchain crowdfunding feel like passing a hat. The best part is you never notice it's onchain at all."

Hold on the filled bar. Stop.

---

## The 60-second version

> **One link. A bar that fills from every chain. Hit the goal, or everyone gets their money back. That's Rally.**

1. **(0:00–0:12) Open on the live bar.** "This thermometer is a real escrow on Arbitrum. Every color is a different blockchain the money came from — Base, Optimism, Arbitrum — and nobody bridged anything."
2. **(0:12–0:38) The money moment.** "I'll back it. Email — no wallet, no seed phrase." Enter code, pick amount, confirm. "Underneath: my USDC burned on Base, Circle attested in ~10 seconds, minted into the Arbitrum vault. The bar just rose — that's on-chain state, not an animation."
3. **(0:38–0:50) Safety.** "It's all-or-nothing. Hit the goal, the organizer withdraws one pot. Miss it, everyone's refunded to the chain they gave from — enforced by a verified contract on Arbitrum."
4. **(0:50–1:00) The kicker.** "And this already happened for real — there's a burn on Base and a mint on Arbitrum on the explorers right now. Rally makes onchain crowdfunding feel like passing a hat. You never notice it's onchain."

---

## Recorded-fallback plan

Live demos die on flaky wifi and faucet weather. Have a safety net.

- **Full screen-recording of the complete happy path** (email login → cross-chain contribute → bar rise → goal hit → confetti), captured on a good run, ready to play if the live attempt stalls. Narrate over it identically.
- **Pre-recorded refund clip** — the all-or-nothing miss/refund path needs a deadline to lapse, so record it ahead of time and cut to it in Beat 3.
- **Explorer tabs pre-opened** — the burn tx (Base), mint tx (Arbitrum), and the verified contract on Arbiscan. Even if everything else fails, the on-chain receipts are undeniable and carry the pitch on their own.
- **The live site itself** (`/c/1`) reads real Arbitrum state, so worst case you show the deployed contract and the live-reading bar and let the receipts do the work.
- **Pre-stage the goal-crossing contribution** so Beat 4 lands on cue rather than waiting on attestation timing.
