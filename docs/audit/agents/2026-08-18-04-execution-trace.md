# Execution-trace agent — 2026-08-18-04

Scope: `RotatingVault.sol`, `GoalVault.sol`, `IRotatingVault.sol`.
Lens: entry → encoding → storage → branch → external call → final state, inside one tx and across txs. Assigned path: `redeemInvite → start → deposit → claimFor → refund`. No contract edits.

Severity counts: **Crit 1, High 0, Med 1, Low 1, Lead 5.**

---

## Tool protocol (scan)

[Feynman: RotatingVault] One contract holds many savings circles. An organizer opens a circle and names the token, the exact chip each person puts in, how long each turn lasts, and how many seats. People join with a signed ticket that locks who they are and which turn they get paid. When every seat is taken the organizer starts the clock. Each open window, every member (or someone paying for them) puts in exactly that chip. The pot for a turn is paid only to the person whose seat number is that turn, and only after every seat has paid. If a window closes short, the circle dies and everyone pulls back what they still have here, minus the slice that already left in pots that were actually paid.

[Feynman: GoalVault] One contract holds many crowdfunds. Same-chain backers send USDC themselves. Other-chain backers burn USDC through Circle; a trusted helper later writes down who that arriving USDC belongs to. Hit the target: the beneficiary takes the credited pile. Miss: each backer pulls their credit back here, or burns it home.

[Feynman: createCircle] Organizer names token, chip size, turn length, seat count. Contract hands out the next id and stores those rules. No money moves. Chip × seats must fit in a 256-bit number so a later pot payout cannot get stuck on overflow.

[Feynman: redeemInvite] Anyone submits an organizer-signed ticket naming a person, a seat, a one-use number, and a deadline. If the circle is still filling, the seat is empty, the person is new, the number is unused, the deadline is real and not past, and the signature is the organizer’s, that person sits in that seat. The caller of the transaction does not become the member — the name in the ticket does.

[Socratic: RotatingVault.sol:223 — why?] Why may anyone submit the ticket? Implicit belief: the signature is the only authorization, and every later right (pay, pot, refund) sticks to the named person, so a relayer or a leaked ticket cannot redirect money.

[Socratic: RotatingVault.sol:250 — why?] Why reject only a zero deadline, not a far-future one? Implicit belief: the organizer’s signature is consent to that lifetime. A leaked ticket with deadline = max lives until cancel.

[Inversion: redeemInvite] (1) Relayer swaps `member` to themselves and keeps the same signature — `InvalidSigner` (member is in the digest). (2) Replay the same nonce on a second seat — `InviteNonceUsed`. (3) Redeem after `start` — `NotFilling`.

[Feynman: start] Only the organizer, only while filling, only when every seat is taken. Flips the circle to running and stamps “now” as the start of turn 0.

[Inversion: start] (1) Alice (a member, not organizer) starts — `NotOrganizer`. (2) Organizer starts with one empty seat — `CircleNotFull`. (3) Organizer starts after cancel — `NotFilling`.

[Feynman: cancel] Organizer, only while filling (no money has ever been held), marks the circle dead. After start this door does not exist.

[Feynman: _deposit] Circle must be running and not derived-dead. Credit goes to `member`. Tokens are pulled from the caller. The live turn is “how many full windows have passed since start.” One exact payment per person per turn. The “how many have paid this turn” counter ticks up. If the tokens that actually arrived are not exactly the chip, the call dies.

[Feynman: deposit / depositFor] Same inner path. `deposit` pays for yourself. `depositFor` lets a stranger pay and still writes the credit on `member`.

[Socratic: RotatingVault.sol:338 — why?] Why measure the balance, then pull tokens, then measure again, *before* writing the credit? Implicit belief: the token might take a cut, and a short receipt would underwrite a later full pot. Implicit belief that is *not* encoded in the order: nobody can re-enter a money function during the pull (they rely on the contract-wide lock, not on “effects first”).

[Inversion: _deposit] (1) Pay turn 1 while turn 0 is still open — live turn is 0; you pay turn 0. (2) Pay after a short finished turn — derived-dead, revert. (3) `depositFor` a non-member — `NotMember`.

[Feynman: _claimTo] The payee must be a member; their seat number *is* the turn. That turn must be fully paid and not yet paid out. Mark paid, bump the paid-turn counter, send chip × seats to the payee. The last pot flips the circle to finished.

[Feynman: claim / claimFor] Same inner path. Anyone may push a payee’s pot to that payee.

[Socratic: RotatingVault.sol:375 — why?] Why let a stranger call `claimFor`? Implicit belief: the pot address is derived from the payee’s own seat, so the stranger cannot point the money at themselves.

[Inversion: _claimTo] (1) `claimFor(bob)` while only turn 0 is full — bob’s seat is turn 1, `RoundNotFunded`. (2) Claim alice’s full pot after turn 1 closed short — derived-dead, pot dissolves into refunds. (3) Claim twice — `PotAlreadyClaimed`.

[Feynman: _refund] Circle must be dead (stored or derived). Pay the member `lifetime deposits − paid-turns × chip`. Write their deposited total down to that floor. Anyone may trigger it; tokens only go to them.

[Feynman: _ensureBroken] If already stored-dead, return. If running and derived-dead, store dead and emit the earliest short turn. Otherwise revert.

[Feynman: _lazyBroken] A circle is dead iff the most recently *finished* turn is short. Deposits only hit the live turn and stop the moment this trips, so a later finished turn being short means an earlier failure already happened, or this one is the first. The first window never counts as finished.

[Socratic: RotatingVault.sol:490 — why?] Why only the last finished turn, not a full scan? Implicit belief: nobody can fund a later turn after an earlier one failed. Both `deposit` and `depositFor` call this check before taking money.

[Inversion: _lazyBroken] (1) Fund turn 0, skip ahead several windows — later turns sit at 0, last-finished is short, circle dies, unclaimed turn-0 pot becomes refunds. (2) Try to fund turn 2 after turn 1 died — deposit sees dead and reverts. (3) All turns full, clock past the end — last-finished is full, not dead; deposits expire, claims still work.

[Feynman: _elapsedRounds] How many full turn-lengths have passed since start. Not capped at the seat count — can read past the end.

[Feynman: _firstFailedRound] Walk seats from 0; return the first short turn. Only called after the last-finished check already said someone is short.

[Feynman: _hashInvite / _hashTypedDataV4 / _domainSeparatorV4] Build the ticket hash the organizer signed: this contract, this chain, this circle, this person, this seat, this number, this deadline. If the chain id changed since deploy, rebuild the domain so an old-chain ticket cannot be replayed.

[Feynman: GoalVault.createCampaign] Anyone opens a campaign with a target, a future deadline, and a beneficiary. The global “do not sweep stray USDC” clock is pushed out to that deadline plus one hour.

[Socratic: GoalVault.sol:190 — why?] Why does `DeadlineTooFar` exist if `createCampaign` never uses it? Implicit belief at write time: a far deadline would pin the sweep-lock forever. The check was forgotten.

[Feynman: contribute] Same-chain backer, campaign still open (not swept, now before the deadline). Pull tokens, credit whatever actually arrived, tag it as this chain.

[Feynman: recordContribution] Relayer only. Campaign not swept and still inside deadline+1h. Vault balance must already cover existing escrow plus this amount. Write the named backer, amount, and origin domain. No token pull.

[Socratic: GoalVault.sol:516 — why?] Why is the relayer window an hour looser than same-chain pay-in? Implicit belief: a burn that left before the deadline may mint late, and that money should still count. Implicit belief that is *not* encoded: nobody has already been refunded, and `raised` still equals money still held for this campaign.

[Feynman: withdraw] Creator or beneficiary. Not yet swept. Lifetime credits ≥ target. Pay the *entire historical* `raised` to the beneficiary and drop global escrow by that same number.

[Feynman: _refund / refund / refundFor] Campaign missed (deadline passed, lifetime credits still under the target, not swept). Zero the backer’s credit and every per-domain bucket. Drop global escrow by that credit. Send the full credit to the backer on this chain. **Do not touch `raised`.**

[Feynman: refundCrossChain] Backer or relayer. Same miss check. Zero the backer’s credit up front. Pay each origin domain locally or burn it back to the backer on that domain. **Do not touch `raised`.**

[Socratic: GoalVault.sol:375 — why?] Why does withdraw send `c.raised` rather than “tokens still sitting here for this campaign”? Implicit belief: nothing can leave a campaign except this withdraw. Refunds break that.

[Socratic: GoalVault.sol:530 — why?] Why does “failed” mean `raised >= goal` is impossible, when `raised` is never reduced by a refund? Implicit belief: after the deadline, `raised` is frozen. That belief is false — `recordContribution` can still add to `raised` for another hour.

[Inversion: withdraw] (1) Sweep a miss — `raised < goal` reverts. (2) Sweep twice — `withdrawn` blocks. (3) After a miss-refund, a late credit pushes `raised` over the goal — withdraw pays the stale historical `raised`, which is larger than this campaign’s remaining escrow.

[Inversion: recordContribution] (1) After deadline, credit just enough to cross the goal after Alice already refunded — `raised` jumps, refunds die, withdraw either overpays from sibling escrow or underflows. (2) After an early withdraw, credit a mint that landed 10 minutes later — `CampaignClosed`, mint becomes slack. (3) Credit slack from campaign A’s mint onto campaign B — documented relayer mis-attribution.

[Inversion: _requireFailed] (1) Refund before the deadline — blocked. (2) Refund after the goal is hit — blocked. (3) Refund after a miss, then a grace credit hits the goal — further refunds now see `raised >= goal` and die, even though money is still sitting here.

[Feynman: _requireOpen / _requireCreditable / _requireFailed] Three different doors. Same-chain in: before deadline, not swept. Relayer in: before deadline+1h, not swept. Refunds out: after deadline, `raised < goal`, not swept. From deadline to deadline+1h the last two doors are both open.

[Feynman: rescueExcess] Owner, after every campaign’s deadline+1h. Sweeps only the slack `balance − totalEscrowed`.

[Inversion: rescueExcess] (1) Sweep during grace — locked. (2) Sweep escrowed money — only the slack is movable. (3) Open a campaign with deadline `uint64.max` — lock never lifts.

[Feynman: _credit] Add the amount to the campaign’s lifetime total, to global escrow, to the backer’s total, and to the backer’s per-domain bucket. Remember the domain if new. Append a log row.

[Inversion: createCampaign] (1) `deadline = type(uint64).max` — sweep-lock becomes ~year 584e9. (2) Open a 60-day campaign after others have settled — re-locks rescue of their stray mints. (3) `deadline = now+1` — legal; grace is only one extra hour.

---

## Assigned path — redeemInvite → start → deposit → claimFor → refund

Concrete circle used below (and in `RotatingVault.t.sol`):

- `N = 3` seats, chip `A = 100e6` (100 USDC), turn length `D = 7 days`
- Organizer `Org`, members Alice seat 0, Bob seat 1, Carol seat 2
- Token: ordinary 6-decimal USDC
- `createCircle` already succeeded: `circleId = 1`, `status = Filling`, `joined = 0`, `startTime = 0`

### 1. redeemInvite (three times)

Attacker-controlled inputs on each call: `circleId, member, payoutIndex, nonce, expiresAt, signature`. The implicit binding is “the six fields are one ticket.”

```
digest = EIP-712( name=RotatingVault, version=2, chainid, this
                  Invite(circleId, member, payoutIndex, nonce, expiresAt) )
recovered = ECDSA.recover(digest, signature)
require recovered == Org
```

| step | caller | args | storage writes |
| --- | --- | --- | --- |
| 1a | stranger | Alice, seat 0, nonce 0, exp far, Org sig | `usedNonces[1][0]=true`, `memberAt[1][0]=Alice`, `_memberIndexPlus1[1][Alice]=1`, `joined=1` |
| 1b | stranger | Bob, seat 1, nonce 1, exp far, Org sig | same pattern; `joined=2` |
| 1c | Alice | Carol, seat 2, nonce 2, exp far, Org sig | `joined=3` |

Parameter-divergence attempts that die:

- Same sig, `member = attacker` → digest mismatch → `InvalidSigner`
- Same sig, `payoutIndex = 1` → `InvalidSigner`
- Same sig, `nonce = 99` → `InvalidSigner`
- Same sig, `expiresAt + 1` → `InvalidSigner`
- Valid second ticket, same nonce as 1a → `InviteNonceUsed` (nonce is consumed before the seat is unique-checked? **No**: nonce is checked, then slot, then member, *then* recover, *then* `usedNonces=true`. Order is check-all-then-write. A failing recover does not burn the nonce.)
- Valid ticket, seat 0 after 1a → `SlotTaken`
- Valid ticket, Alice into seat 1 → `AlreadyMember`
- `expiresAt = 0` → `InvalidExpiry` (even with a matching sig)
- `block.timestamp > expiresAt` → `InviteExpired`
- `payoutIndex = 3` → `PayoutIndexOutOfRange` (before the uint16 downcast)
- After `start` or `cancel` → `NotFilling`

Sentinel: `member = address(0)` → `ZeroAddress`. `nonce = 0` is a real ticket number (tests use it). No `address(0)` organizer (create uses `msg.sender`).

Encoding: struct hash is `abi.encode` (typed, padded). Domain wrapper is `abi.encodePacked(0x1901, domain, structHash)` — the standard 2+32+32 layout, not a packed-field collision.

Cross-tx: there is no revoke. Org’s only undo while Filling is `cancel` + recreate (new `circleId`, old ticket dies). Documented.

**Final state after 1c:** Filling, `joined = 3 = memberTarget`, no tokens moved, every later right is keyed off `memberAt` / `_memberIndexPlus1`, not off who submitted the tx.

### 2. start

```
require msg.sender == Org
require status == Filling
require joined == memberTarget          // 3 == 3
status = Active
startTime = uint64(now)                 // t0
```

Wrong-state attempts: member starts → `NotOrganizer`. Start with `joined = 2` → `CircleNotFull`. Start twice → `NotFilling`.

Mid-op config: there is no setter for `roundDuration` / `depositAmount` / `token` / `memberTarget`. Nothing in-flight to mutate.

**Final state:** Active, `startTime = t0`, live turn `_elapsedRounds = (now - t0) / D = 0`.

### 3. deposit / depositFor (turn 0)

Within-tx order in `_deposit` is **check → pull → write** (CIE, not CEI):

```
require Active && !_lazyBroken            // elapsed==0 → lazy false
require _memberIndexPlus1[member] != 0
r = (now - t0) / D                        // 0
require r < 3 && roundDeposits[1][0][member] == 0
bal0 = token.balanceOf(this)
token.safeTransferFrom(msg.sender, this, 100e6)     // INTERACTION
require balanceOf(this) - bal0 == 100e6
roundDeposits[1][0][member] = 100e6                 // EFFECTS
totalDeposited[1][member] += 100e6
roundFundedCount[1][0] += 1
```

Value-leak attempts:

- Caller-chosen amount: **there is none**. Amount is `c.depositAmount`.
- `depositFor(1, Alice)` paid by stranger: pulls 100e6 from stranger, credits Alice. Comment says credit-only. Refunds later pay Alice, not the stranger (LEAD: sponsor cannot reclaim).
- Fee-on-transfer inbound: delta ≠ 100e6 → `UnexpectedTransferAmount`. No under-collateral pot.

Stale `r`: computed before the pull. Same-tx timestamp cannot advance. A token callback cannot call `deposit` / `claim` / `refund` (`nonReentrant`). `markBroken` has no token call and would only fire if already derived-dead, which this path already rejected.

After Alice, Bob, Carol each deposit (or are `depositFor`’d):

| slot | value |
| --- | --- |
| `roundDeposits[1][0][*]` | 100e6 each |
| `roundFundedCount[1][0]` | 3 |
| `totalDeposited[1][*]` | 100e6 each |
| vault USDC | 300e6 |
| `claimedCount` | 0 |

Wrong-state: deposit before start → `NotActive`. Deposit twice in turn 0 → `AlreadyDeposited`. Non-member → `NotMember`. After the last window on a healthy circle → `CircleExpired`. After a short finished turn → `CircleIsBroken` (checked before `CircleExpired`).

### 4. claimFor (Alice’s pot, permissionless)

```
require Active && !_lazyBroken
idx1 = _memberIndexPlus1[Alice] = 1
r = 0
require !potClaimed[1][0]
require roundFundedCount[1][0] >= 3
potClaimed[1][0] = true
claimedCount = 1
pot = 100e6 * 3 = 300e6
token.safeTransfer(Alice, 300e6)          // CEI, after effects
```

Parameter divergence: the only address the caller supplies is `payee`. The turn is **not** a parameter. `claimFor(1, Bob)` while only turn 0 is full targets Bob’s seat (turn 1) → `RoundNotFunded`. `claimFor(1, stranger)` → `NotMember`. `claimFor(1, address(0))` → `ZeroAddress`. Stranger’s own USDC balance does not move (covered by `test_claimFor_anyoneMaySubmit_paysPayeeOnly`).

Partial update: `potClaimed` and `claimedCount` flip before the transfer. If the transfer reverts, the whole tx reverts. Reentrant `claim` during the transfer is blocked (`test_reentrancy_claimBlocked`).

**Final state:** vault 0, Alice +300e6, `claimedCount = 1`, circle still Active (not yet 3 pots). Conservation: `Σ totalDeposited − N × claimedCount × A = 300e6 − 3 × 1 × 100e6 = 0`.

### 5a. Happy continuation (not the break)

Warp `t0+D`. Live turn = 1. `_lazyBroken` checks turn 0 (`lastCompleted = 0`), funded 3, not dead. Three deposits into turn 1. `claimFor(1, Bob)` pays Bob 300e6. Same for turn 2 / Carol. `claimedCount = 3` → `status = Completed`. Further refunds: `_ensureBroken` sees Completed, not Active → `NotBroken`. Floor would be `3 × 100e6` against `totalDeposited = 300e6` → `NothingToRefund` anyway.

Late claim on a healthy circle (all turns funded, nobody claimed, warp +1 year): `_lazyBroken` checks turn 2, funded 3, not dead. All three `claimFor`s still pay. Documented. Covered by `test_claim_worksLateOnHealthyCircle`.

### 5b. Break → refund (the assigned terminal)

After Alice’s turn-0 claim, warp `t0+D`. Alice and Bob deposit turn 1 (100e6 each). Carol does not. Warp `t0+2D`.

```
elapsed = 2
lastCompleted = 1
roundFundedCount[1][1] = 2 < 3  →  _lazyBroken = true
```

`claimFor(1, Bob)` now reverts `CircleIsBroken` (Bob’s funded-but-unclaimed pot dissolves — documented v1). `deposit` reverts the same.

`refund` / `refundFor` call `_ensureBroken` → store `Broken`, emit `CircleBroken(1, firstFailed=1)`.

```
consumedFloor = claimedCount * A = 1 * 100e6
Alice held 200e6 → owed 100e6 → totalDeposited[Alice] = 100e6
Bob   held 200e6 → owed 100e6 → totalDeposited[Bob]   = 100e6
Carol held 100e6 → owed 0     → NothingToRefund
```

Vault pays 200e6, ends at 0. Double refund: held == floor → `NothingToRefund`. `refundFor` from a stranger still pays Bob, not the stranger.

Identity: every claimed pot was funded by all N members, so each member’s consumed share is exactly `claimedCount * A`. `depositFor` writes the same `totalDeposited[member]` as a self-deposit, so a sponsored seat cannot make `held < floor`.

Unclaimed-pot dissolve (Alice never claimed turn 0, turn 1 empty, warp past): `claimedCount = 0`, each depositor refunds their full 100e6, Alice cannot claim. Documented (`test_brokenCircle_foreclosesUnclaimedEarlierPot`). Later members defaulting is free for them when no pot has been claimed yet — that is the v1 locked design, not an unguarded steal.

**RotatingVault assigned path: no FINDING.** Rights stick to the signed member; amount is not caller-chosen; claim turn is derived; refund floor matches claimed pots; lazy-break induction holds under time skips; CIE on deposit is fenced by `nonReentrant`.

---

## Across-tx scan (both contracts)

| Pattern | RotatingVault | GoalVault |
| --- | --- | --- |
| Parameter divergence (2+ caller inputs) | Invite fields bound by EIP-712. Deposit amount not an input. `claimFor`/`refundFor`/`depositFor` take an address but pay/credit only that address. | `recordContribution(campaignId, backer, amount, sourceDomain)` — four relayer-chosen fields, only constrained by `balance >= totalEscrowed + amount`. Documented mis-attribution. `contribute(campaignId, amount)` credits *received*, not `amount`. |
| Value leak (fee taken from one var, full amount sent down) | None on the assigned path. Pot is `A*N`, refund is `held - floor`. | **`withdraw` sends lifetime `raised` after `_refund` has already moved tokens out without decrementing `raised`.** |
| Encoding mismatch | Invite uses `abi.encode`; 712 wrapper is the standard packed prefix. | CCTP `mintRecipient` is `bytes32(uint160(backer))`. Hard-coded to the backer. |
| Sentinel bypass | Zero member / zero expiry / zero token rejected. Nonce 0 is valid. | Zero backer / zero amount / zero beneficiary rejected. `sourceDomain == LOCAL_DOMAIN` on a CCTP mint is allowed (relayer). |
| Untrusted return | `ECDSA.recover` compared to organizer. Balance delta compared to `A`. | Relayer `amount` is not taken from a mint receipt on-chain (periphery `complete-fill.ts` does measure the Transfer, then passes it in). |
| Stale read | `r` and `_lazyBroken` before the pull; same-tx time is fixed. | **Periphery `complete-fill.ts` reads `withdrawn` once, waits on Iris (~15–19 min), mints, then `recordContribution` without re-reading.** |
| Partial update | Claim/refund CEI + guard. Deposit CIE + guard. | RefundCrossChain zeros books then loops burns; one revert rolls all back. |
| Wrong-state / interleaving | Deposit/claim refuse derived-Broken. Refund refuses healthy. Cancel refused after start. | **`[deadline, deadline+1h)`: `_requireFailed` and `_requireCreditable` are both open.** |
| Mid-op config | No setters. | Owner can swap messenger / `cctpMaxFee` between a user clicking refund and the tx (admin; not reported). |
| Approval residual | User-chosen allowance on `transferFrom(A)`. | `forceApprove(messenger, amount)` per remote slice; leftover only if messenger pulls less (trusted Circle). |

Weaponize: RotatingVault *does* decrement the lifetime credit on refund (`totalDeposited = consumedFloor`) and *does not* pay a stale sum on the success path. GoalVault is the inverse of that mirror. That is the FINDING below.

---

## FINDINGS

FINDING | contract: GoalVault | function: withdraw | bug_class: stale-raised-interleave | group_key: GoalVault | withdraw | stale-raised-interleave
input: unprivileged `refund` after a miss (any backer); then a grace-window `recordContribution` (documented relayer path / Rally `completeContribution`); then unprivileged `withdraw` by the beneficiary
assumption: after the deadline, `raised` still equals “USDC this campaign still holds,” and a campaign cannot be Failed and then Succeeded. Both are false: `_refund` / `refundCrossChain` drop `totalEscrowed` and zero the backer but never decrement `Campaign.raised`; `_requireCreditable` stays open until `deadline + SETTLEMENT_GRACE` while `_requireFailed` is also open.
path: miss → refund (escrow down, `raised` stale) → grace `recordContribution` (`raised += mint`, may cross `goal`) → `status = Succeeded`, `isRefundable = false` → `withdraw` pays historical `raised` and does `totalEscrowed -= raised`
proof: Foundry PoC (temporary, not committed) `GoalVaultExecTracePoc` — 2/2 pass.

  Sibling drain (theft from another campaign’s escrow):

  Campaign A: goal = 1000e6, deadline = T, beneficiary = benA. Alice contributed 600e6, Bob 300e6. `raised_A = 900e6`.
  Campaign B: Carol contributed 800e6. `totalEscrowed = 1700e6`, vault = 1700e6.

  T+0: Alice `refund(A)`. Books: `_contributedTotal[A][Alice]=0`, `totalEscrowed=1100e6`, Alice +600e6. `raised_A` stays **900e6**.
  T+30m (inside 1h grace): 150e6 USDC lands (honest late CCTP). Relayer `recordContribution(A, dave, 150e6, 6)`. `_requireCreditable` passes (`withdrawn=false`, `now < T+1h`). Balance `1250e6 >= 1100e6+150e6`. `_credit` sets `raised_A = 1050e6`, `totalEscrowed = 1250e6`. `status(A) = Succeeded`. Bob cannot `refund` (`raised >= goal`).

  benA `withdraw(A)`: `1050e6 >= 1000e6`, `amount = c.raised = 1050e6`, `totalEscrowed -= 1050` → 200e6, vault sends **1050e6**. Campaign A still held only Bob 300 + Dave 150 = 450e6. The extra 600e6 is Carol’s.

  Carol: `withdraw(B)` does `totalEscrowed -= 800` → underflow revert. `refund(B)` reverts `NotFailed` (B already succeeded). 200e6 remains; 600e6 stolen.

  Single-campaign freeze (no sibling slack): goal 1000e6, Alice 600 + Bob 399, Alice refunds, relayer credits 1e6. `raised = 1000e6`, `totalEscrowed = 400e6`. Bob `refund` → `NotFailed`. `withdraw` does `400-1000` and reverts. `rescueExcess` sees slack 0 (the 400e6 is still inside `totalEscrowed`). Permanently stuck. Grief cost is `goal - raised` at the miss (here 1e6).

  Honest intended path is enough: Rally `src/lib/cctp/complete-fill.ts` checks only `withdrawn` (not deadline, not “refunds already ran”), waits on Iris, mints, then `recordContribution`. That is the documented grace purpose. Fuzz `GoalVaultFuzz` updates `ghost_raised` only on credit and swallows a failing `withdraw`; `echidna_raised_matches_credits` asserts the bug (raised == lifetime credits).

  RotatingVault already implements the missing mirror: `_refund` writes `totalDeposited[member] = claimedCount * depositAmount` and claim pays `A * N`, not a lifetime sum.
description: After a miss-refund, a grace-window credit can mark the campaign successful while `raised` still includes refunded money, so `withdraw` overpays from other campaigns’ escrow or freezes the remainder.
fix: Close `recordContribution` once any refund has run (or once `now >= deadline`), and make `withdraw` pay remaining per-campaign escrow (decrement `raised` on refund, or store a remaining-escrow field) never the historical lifetime sum. Optionally freeze Failed at the deadline if still under goal.

---

FINDING | contract: GoalVault | function: withdraw | bug_class: stale-withdrawn-across-cctp-legs | group_key: GoalVault | withdraw | stale-withdrawn-across-cctp-legs
input: beneficiary `withdraw` the instant `raised >= goal` (no deadline wait — documented); in-flight CCTP mint with `mintRecipient = vault`
assumption: `SETTLEMENT_GRACE` means a legitimately-burned contribution is never stranded. The grace is only coded against the deadline (`_requireCreditable` uses `deadline + 1h`). `withdrawn` is a hard stop with no late-arrival bucket.
path: backer burns on origin → local contributions hit goal → beneficiary.withdraw → USDC mints to vault → recordContribution reverts `CampaignClosed` → after max(deadline)+grace, `rescueExcess` (or a relayer credit to another campaign) takes the mint
proof: goal = 1000e6, deadline = T+7d, raised = 900e6. Bob burned 200e6 on Base (Iris ~15–19 min, `mintRecipient = vault`). Alice contributes 100e6; `raised = 1000e6`. Beneficiary withdraws immediately (`GoalVault.sol:365-382`, “no need to wait for the deadline”). `withdrawn = true`, vault pays 1000e6.

  Bob’s 200e6 then mints. `_requireCreditable` (`:522`) reverts on `c.withdrawn`. Header at `:117-121` says grace exists so a “legitimately-burned-but-late contribution is never stranded” — that promise is only coded against the deadline.

  Production `completeContribution` (`src/lib/cctp/complete-fill.ts:105-176`) is a stale read across legs: it checks `withdrawn` *once before* waiting on Iris, then mints, then `recordContribution` with no re-check. If the sweep happens during the wait, the mint still lands and the record reverts. `rescueUnlockTime` is `deadline+1h` (`:310-311`), so after a week the owner may `rescueExcess` those 200e6. They were never written to `_contributedTotal[Bob]`, so Bob has no refund. Relayer can instead attribute the 200e6 to any still-open campaign (documented mis-attribution).
description: Early success sweep permanently blocks attribution of an in-flight CCTP mint; the backer’s USDC becomes owner-rescuable slack or another campaign’s credit.
fix: After withdraw, allow `recordContribution` into a per-backer late-arrival refund bucket (do not increase withdrawable `raised`), or delay `withdrawn` until `deadline + SETTLEMENT_GRACE`. Re-check campaign state in `complete-fill.ts` after Iris and before `receiveMessage`.

---

FINDING | contract: GoalVault | function: createCampaign | bug_class: unused-deadline-cap | group_key: GoalVault | createCampaign | unused-deadline-cap
input: anyone, `deadline = type(uint64).max` (or any far-future unix time)
assumption: `error DeadlineTooFar` means far deadlines are rejected, and `rescueUnlockTime` cannot be pinned by a stranger. Only `DeadlineInPast` is enforced.
path: `createCampaign(1, type(uint64).max, beneficiary)` → `rescueUnlockTime = uint256(deadline) + SETTLEMENT_GRACE` → every later `rescueExcess` reverts `RescueLocked`
proof: `:295` is the only deadline check (`deadline <= block.timestamp`). `:310-311` raise the global lock to `deadline + 1 hours`. `:270` requires `block.timestamp >= rescueUnlockTime`. One permissionless create pins the lock until ~year 584e9. Escrowed funds remain withdrawable/refundable; unattributed slack (including stranded CCTP from the previous finding) can never be rescued. Opening a merely far campaign after others have ended re-locks their slack as well. RotatingVault already bounded the analogous stall with `MAX_ROUND_DURATION = 365 days`. The frontend clamps to 60 days; the contract does not.
description: Unused `DeadlineTooFar` leaves `rescueUnlockTime` unbounded, so anyone can permanently disable excess rescue.
fix: Enforce a max deadline in `createCampaign` (the already-declared `DeadlineTooFar`) so the shared rescue clock cannot be pinned.

---

## LEADS

LEAD | contract: RotatingVault | function: _deposit | bug_class: cie-view-inconsistency | group_key: RotatingVault | _deposit | cie-view-inconsistency
code_smells: Balance pull happens before `roundDeposits` / `totalDeposited` / `roundFundedCount` are written. `nonReentrant` blocks every other money function. A token callback can still *read* `refundableAmount` / `roundFundedCount` / `balanceOf(vault)` and see extra tokens that are not yet credited. No on-chain consumer of those views in this bundle.
description: Deposit is check-interact-effect. Fund path is fenced; leftover is a view inconsistency during a weird-token callback. Not live on Rally USDC.

LEAD | contract: RotatingVault | function: depositFor | bug_class: sponsor-refund-asymmetric | group_key: RotatingVault | depositFor | sponsor-refund-asymmetric
code_smells: Pulls from `msg.sender`, writes `totalDeposited[member]`. `_refund` always `safeTransfer(member, owed)`. Rally `circle-relayer.ts` fronts treasury USDC onto member addresses for the demo lane; `refundFor` on a break pays those members. Documented “credit-only.” Same bytecode on a sponsored mainnet circle is a treasury drain if the member keeps the refund.
description: Sponsor and refund are not mirrors on the payer. Intentional credit model; confirm no mainnet sponsor path treats this as recoverable float.

LEAD | contract: RotatingVault | function: getCircle | bug_class: stored-vs-derived-status | group_key: RotatingVault | getCircle | stored-vs-derived-status
code_smells: After a finished turn is short, `getCircle().status` is still `Active` until the first `markBroken`/`refund`. `circleStatus` and `refundableAmount` apply `_lazyBroken`. A client that enables `claimFor` off `getCircle.status` will send txs that revert `CircleIsBroken`. Relayer uses `circleStatus`. Interface comments warn.
description: Stored vs derived status is a wrong-state UI footgun, not a fund path.

LEAD | contract: GoalVault | function: completeContribution | bug_class: stale-snapshot-then-mint | group_key: GoalVault | recordContribution | stale-snapshot-then-mint
code_smells: `src/lib/cctp/complete-fill.ts:105-176` reads `withdrawn` once, does **not** read deadline, waits on Iris, then `receiveMessage` (irreversible mint to the vault), then `recordContribution`. After grace, the mint still happens and the record reverts `CampaignClosed` — slack the owner can rescue the same second (`rescueUnlockTime = deadline + SETTLEMENT_GRACE`). Amplifies FINDING 2 even without an early withdraw.
description: Periphery stale read + missing deadline check will mint into a campaign that can no longer be credited. Unverified how often Iris exceeds the 1h grace.

LEAD | contract: GoalVault | function: _refund | bug_class: to-vs-backer-split | group_key: GoalVault | _refund | to-vs-backer-split
code_smells: `_refund(campaignId, backer, to)` exists; both call sites pass `to == backer`. A future “refund to relayer” edit would steal. Cross-chain path already refuses a stranger because the origin-chain key may not be the backer’s.
description: Internal `to` parameter is unused divergence. Not exploitable at the current call sites.

---

## Cross-contract weaponize

Same root cause (lifetime counter not decremented on unwind, success path pays that counter) does **not** exist on RotatingVault. `_refund` writes the consumed floor; `_claimTo` pays `A * N`.

`claimFor` is permissionless (payee-only). GoalVault `refundFor` is `onlyRelayer`; `refundCrossChain` is backer|relayer. Different products, same “funds only to the named party.”

Invite `expiresAt` is still valid at the exact second (`timestamp > expiresAt`); campaign deadline is closed at the exact second (`timestamp >= deadline`). Inclusive/exclusive mismatch, no fund path.

`contribute` credits `received` (shortfall allowed); RotatingVault reverts `UnexpectedTransferAmount`. GoalVault stays solvent because it credits the delta. Not a FINDING for USDC.

---

## Admin variants (not reported)

GoalVault `setRelayer` / `setTokenMessenger` / `setCctpRefundParams` / `rescueExcess` are owner-only. A malicious messenger or `cctpMaxFee >= amount` plus a relayer-forced `refundCrossChain` can burn value — trusted-owner surface (shared rule: admin-only doing admin things). Relayer mis-attribution of a real mint is the documented CCTP trust model, not an unguarded steal.

RotatingVault has no admin. Organizer `start`/`cancel` are not silent variants of deposit/claim.

---

## Severity counts

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 0 |
| Medium | 1 |
| Low | 1 |
| Lead | 5 |

Critical: GoalVault stale `raised` after a miss-refund + grace credit — sibling-campaign drain, or remainder permanently frozen. PoC passed.
Medium: early `withdraw` (and periphery stale `withdrawn` read) strands in-flight CCTP to owner rescue / other campaigns.
Low: unused `DeadlineTooFar` pins `rescueUnlockTime`.
RotatingVault `redeemInvite → start → deposit → claimFor → refund`: no FINDING.
