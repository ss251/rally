# Agent 3 — Economic Security

Date: 2026-08-18  
Specialty: external dependencies, value flows, incentives, pot conservation  
Scope: `RotatingVault.sol`, `GoalVault.sol`, `IRotatingVault.sol`  
Focus: broken-circle refund accounting, `claimFor` griefing, invite-expiry grief, pot conservation

---

## Severity counts

| Severity | Count |
| -------- | ----- |
| Critical | 0 |
| High     | 1 |
| Medium   | 0 |
| Low      | 3 |
| Informational | 0 |
| FINDING (total) | 4 |
| LEAD     | 4 |

- **High:** 1 (GoalVault stale-`raised` × grace-window credit)
- **Low:** 3 (claimFor unwind grief, stale-invite snipe, unbounded campaign deadline)
- **Leads:** 4
- **Cleared (focus areas):** RotatingVault broken-circle refund identity and per-circle pot conservation

---

## Mental-tool trace

Markers below are working notes for the orchestrator (`[Tool: …]` protocol). They are not findings.

[Feynman: RotatingVault]
A group of N people each put the same amount of money into a shared pot every time-box. Each time-box has one named recipient who may take the whole pot only after every person has paid that time-box. If any time-box ends without every person paying, the group is dead: nobody may take a pot after that, and each person may pull back whatever they still have in the box that has not already gone out as a paid pot.

[Feynman: GoalVault]
A fundraiser holds USDC until a target is hit or time runs out. Hit the target and the named receiver takes the pile. Miss it and each backer takes their own pile back. Money that arrives from another chain is labeled by a trusted clerk after it physically shows up.

[Feynman: createCircle]
Someone opens an empty group: which token, how much each person pays per time-box, how long a time-box lasts, and how many seats. No money moves.

[Feynman: redeemInvite]
Anyone may present a permission slip the organizer signed. The slip names one person, one seat, a one-time ticket number, and a clock time after which the slip is dead. If the slip is still good and the seat is empty, that person now occupies the seat. They cannot leave.

[Feynman: start]
The organizer starts the clock once every seat is filled. From this moment the time-boxes are counted off the start time.

[Feynman: cancel]
The organizer can kill an empty group before the clock starts. After the clock starts they cannot.

[Feynman: deposit / _deposit]
A member (or a sponsor paying on their behalf) puts in exactly one share for the *current* time-box. They cannot pay ahead, cannot pay twice, and cannot pay if the group is already dead. The contract checks that the token pile actually grew by that exact share.

[Feynman: depositFor]
Same as deposit, but a stranger may pay the share and the credit still lands on the named member. The comments say this cannot hurt that member. It can change whether a failing time-box becomes a paid pot.

[Feynman: claim / claimFor / _claimTo]
The named recipient of a fully-paid time-box (or anyone speaking their name) takes the whole pot. The money always goes to that named person. Taking it counts as “this pot has left,” which later shrinks everyone’s broken-group refund.

[Feynman: markBroken / _ensureBroken]
Anyone may flip a group that is already dead-by-the-clock into stored “Broken.” Refunds do this on their own if needed.

[Feynman: refund / refundFor / _refund]
On a dead group, a member gets back (everything they ever put in) minus (number of pots already paid × one share). The leftover bookkeeping is set down to that floor so they cannot be paid twice.

[Feynman: _lazyBroken]
Look at the most recently finished time-box. If it was not fully paid, the group is dead. The authors claim you only need to look at that last finished box, because nobody can pay into a later box once an earlier one has failed.

[Feynman: _elapsedRounds]
How many full time-boxes have passed since the clock started. May be larger than N after the rotation is over.

[Feynman: _firstFailedRound]
Walk from seat 0 upward and name the first under-paid time-box. Used only for the break event.

[Feynman: refundableAmount]
If the group is dead, same arithmetic as refund, as a view. If the group is healthy, zero.

[Feynman: createCampaign]
Anyone opens a fundraiser with a target, a deadline, and a receiver. This also pushes out the date after which leftover unlabeled USDC may be swept.

[Feynman: contribute]
A same-chain backer sends USDC in and is credited for the amount that actually arrived.

[Feynman: recordContribution]
The clerk labels USDC that already sits in the box as belonging to a backer and a source chain. Allowed until one hour after the deadline, even if the fundraiser already missed.

[Feynman: withdraw]
Once the credited total is at least the target, the receiver (or the creator) takes the *credited* total — not “what is still in this campaign’s pocket.”

[Feynman: GoalVault _refund]
After a miss, a backer is paid their credited total. The global “still owed” counter drops. The campaign’s credited-total (`raised`) does **not** drop.

[Feynman: refundCrossChain]
Same miss path, but remote-chain slices are burned back to the backer. Also zeros that backer’s credit and drops the global owed counter, not `raised`.

[Feynman: rescueExcess]
After every campaign’s deadline-plus-one-hour has passed, the owner may sweep USDC that is not in the owed counter.

[Feynman: _credit]
Add to `raised`, add to global owed, add to the backer’s totals, append a log row. May flip the fundraiser to “target hit.”

[Feynman: _requireOpen / _requireCreditable / _requireFailed]
Open = not swept and before the deadline. Creditable = not swept and before deadline-plus-one-hour. Failed = not swept, deadline reached, credited total still under target.

[Socratic: RotatingVault.sol:447 — why?]
Why is the refund floor `claimedCount * depositAmount` rather than “this member’s deposits into claimed rounds”?
Because the authors believe every claimed pot was funded by all N members, so every member’s consumed share is identical. That belief holds only if a claim can never succeed without `roundFundedCount[r] == N` and each of those N deposits was exactly `A`. Both are enforced. The floor is therefore uniform and safe.

[Socratic: RotatingVault.sol:391 — why?]
Why may a stranger call `claimFor` at all?
Because the product wants a gasless relayer to pull a pot to the scheduled person. The implicit belief: paying the rightful person cannot hurt anyone else. That belief fails for the dissolve-on-break hatch, which exists only while the pot is still unclaimed.

[Socratic: RotatingVault.sol:251 — why?]
Why is `expiresAt == 0` rejected but a century-away `expiresAt` accepted?
Because the authors believe “a leaked invite cannot live forever” once a deadline exists. The implicit belief is that the organizer will pick a short deadline. The contract does not enforce one, and it also cannot kill a slip before that deadline.

[Socratic: RotatingVault.sol:486 — why?]
Why does brokenness look only at the last finished time-box?
Because deposits target only the live box and are refused once that check trips, so a later box cannot fill after an earlier miss. Implicit belief: `roundFundedCount` for a non-current box can never increase. True — there is no path that writes a past or future box.

[Socratic: GoalVault.sol:496 — why?]
Why does `_refund` zero the backer’s credit and drop `totalEscrowed` but leave `c.raised` untouched?
Because `raised` is treated as a lifetime thermometer, not as “still held for this campaign.” Implicit belief: after a miss, `raised` will never be read again as a withdrawable liability. That belief is false during the one-hour grace window, where `_credit` can still grow `raised` and `withdraw` still pays `c.raised`.

[Socratic: GoalVault.sol:520 — why?]
Why may the clerk still label money after the deadline?
So a burn that was sent in time is not stranded by attestation delay. Implicit belief: labeling after the deadline cannot collide with refunds already paid. There is no “refunds-have-started” latch.

[Socratic: GoalVault.sol:375 — why?]
Why does withdraw send `c.raised` instead of a per-campaign escrow bucket?
Because the authors believe `raised` always equals tokens still attributed to that campaign. After a refund, it does not.

[Inversion: _claimTo]
1. Stranger calls `claimFor(id, alice)` in the last second of a failing later round (circle still healthy because the last *finished* round was funded) → Alice is paid, `claimedCount` ticks, later refunds shrink by `A` each.
2. Payee is a receiving-reverting contract → transfer reverts, state rolls back, pot stays; not a theft, a self-DoS of that pot until break dissolves it.
3. Caller names Bob while only Alice’s round is funded → `_claimTo` derives Bob’s own index and reverts `RoundNotFunded`; cannot redirect Alice’s pot.

[Inversion: _refund]
1. Refund Alice on a healthy circle → `_ensureBroken` reverts `NotBroken`.
2. Refund Alice twice → second call hits `held <= consumedFloor` and reverts `NothingToRefund`.
3. After one paid pot, refund a defaulter who only funded that paid pot → `held == floor`, `NothingToRefund`; they already “spent” their share inside the paid pot. Conservation holds.

[Inversion: redeemInvite]
1. Replay the same slip → `InviteNonceUsed`.
2. Change the member on a valid slip → digest mismatches, `InvalidSigner`.
3. After the organizer issued a replacement slip for the same seat, redeem the *old* still-unexpired slip first → old member takes the seat, new slip dies on `SlotTaken`. This one lands.

[Inversion: _deposit]
1. Pay a fee-on-transfer token → balance delta ≠ `A`, revert `UnexpectedTransferAmount`.
2. Pay after the last finished box missed → `_lazyBroken` true, `CircleIsBroken`.
3. Sponsor pays the missing member in the last second of an under-paid box → box flips to fully funded, payee can take the pot, other depositors lose the refund they were waiting for.

[Inversion: recordContribution]
1. Credit more than `balance - totalEscrowed` → `UnattributedFunds`.
2. Credit after deadline+grace → `CampaignClosed`.
3. Credit during grace *after* a backer already refunded, by enough to push stale `raised` over `goal` → campaign looks succeeded; `withdraw` tries to pay the stale total. This one lands.

[Inversion: GoalVault.withdraw]
1. Withdraw before `raised >= goal` → `GoalNotReached`.
2. Withdraw twice → `AlreadyWithdrawn`.
3. Withdraw after a grace-window resurrection of a missed campaign whose `raised` still includes refunded amounts → pays the stale figure out of the shared pile.

[Inversion: createCampaign]
1. Deadline in the past → `DeadlineInPast`.
2. Goal zero → `InvalidGoal`.
3. Deadline `type(uint64).max` → `DeadlineTooFar` is declared and never used; `rescueUnlockTime` is pushed to the end of time.

---

## FINDINGS

FINDING | contract: GoalVault | function: _refund | bug_class: stale-raised-accounting | group_key: GoalVault | _refund | stale-raised-accounting
severity: High
confidence: 92
path: backer.refund (deadline miss, grace still open) → `totalEscrowed` drops, `c.raised` does not → relayer.recordContribution (in-flight or stray USDC) → `c.raised` crosses `goal` → beneficiary.withdraw pays stale `c.raised` out of the shared pot
proof: |
  Token = USDC (6 decimals). Two campaigns in one vault.

  Campaign A: goal = 1_000e6. At deadline T: Alice credited 600e6, Bob 300e6, raised=900e6, missed.
  Campaign B: Carol still escrowed 2_000e6 (unrelated live campaign).
  Vault: balance = 2_900e6, totalEscrowed = 2_900e6.

  T+1s (inside SETTLEMENT_GRACE = 1 hour):
    Alice.refund(A) — allowed by `_requireFailed` (now>=T and raised 900<1000).
    Sends Alice 600e6.
    `_contributedTotal[A][Alice]=0`, totalEscrowed=2_300e6, **c.raised stays 900e6**.
    Vault balance = 2_300e6 (Bob 300 + Carol 2_000).

  T+10m: a 100e6 CCTP mint that was burned before T lands (the documented grace reason). Relayer calls
    recordContribution(A, dave, 100e6, BASE).
    `_requireCreditable` passes (not withdrawn, now < T+1h).
    balance 2_400e6 >= totalEscrowed 2_300e6 + 100e6.
    `_credit`: raised becomes **1_000e6**, totalEscrowed=2_400e6. `GoalReached` emits.

  Beneficiary.withdraw(A):
    `c.raised (1000e6) >= goal`, `totalEscrowed -= 1000e6` → 1_400e6, transfers **1_000e6**.
    Campaign A only still held 400e6 (Bob 300 + dave 100). The extra **600e6 is Carol’s**.

  Aftermath:
    Campaign B still records 2_000e6 owed; vault can cover 1_400e6.
    Carol’s later withdraw/refund underflows `totalEscrowed` or, if she is the only remaining creditor, the arithmetic reverts and her 2_000e6 is short 600e6.

  Single-campaign variant (no sibling pile): same steps with only A.
    After the late credit, totalEscrowed=400e6, withdraw wants 1_000e6 → Solidity 0.8 underflow revert.
    `raised >= goal` so Bob and dave fail `_requireFailed` (`NotFailed`).
    Bob’s 300e6 + dave’s 100e6 are **frozen forever**. rescueExcess sees `balance - totalEscrowed = 0`.

  Honest relayer is enough. The grace window exists specifically to attribute late mints; the product also tells backers to refund on a miss. Those two intended actions, in that order, break the pot.
description: `_refund` leaves `Campaign.raised` as a lifetime counter while `withdraw` still treats it as currently-escrowed liability, so a grace-window credit after any refund can mark a miss as a success and overpay the beneficiary from sibling campaigns or freeze the remainder.
fix: Decrement `c.raised` by the refunded amount in `_refund` / `refundCrossChain` (and reject `recordContribution` once any refund has been paid, or once `block.timestamp >= deadline` if you want a simpler latch).

---

FINDING | contract: RotatingVault | function: claimFor | bug_class: forced-claim-unwind-grief | group_key: RotatingVault | claimFor | forced-claim-unwind-grief
severity: Low
confidence: 88
path: stranger.claimFor(circleId, earlyPayee) while a later round is still open (circle not yet `_lazyBroken`) → pot paid, `claimedCount += 1` → later round misses → broken refunds use the higher floor
proof: |
  N=3, A=100e6 USDC, members Alice (index 0), Bob (1), Carol (2). Round length 7 days.

  Round 0: all three deposit 100e6. Alice does not claim. Vault holds 300e6. claimedCount=0.

  Round 1: Alice and Bob deposit 100e6 each; Carol is silent. Vault holds 500e6.
  Circle is still Active: elapsed=1, `_lazyBroken` checks lastCompleted=0, which is fully funded.

  Anyone (stranger, Rally relayer, Alice’s friend) calls `claimFor(id, alice)`:
    potClaimed[0]=true, claimedCount=1, Alice receives 300e6. Vault holds 200e6.

  Round 1 window closes. Circle broken. Refunds:
    Alice: 200e6 − 1×100e6 = 100e6
    Bob:   200e6 − 1×100e6 = 100e6
    Carol: 100e6 − 1×100e6 = 0
  Nets: Alice +200e6, Bob −100e6, Carol −100e6.

  Same timeline *without* the permissionless claim (Alice stays offline, nobody pulls her pot):
    claimedCount=0, vault 500e6, refunds 200 / 200 / 100. Everyone net zero —
    the header’s “unclaimed pot dissolves into refunds” / product “everyone’s made whole.”

  v1 already let Alice pull it herself. v2’s incremental grief is that **Alice’s inaction is no longer enough**: any observer can force the extraction in the last healthy window. `_claimTo` only rejects after `_lazyBroken` flips, i.e. after the failing window has already closed.
description: Permissionless `claimFor` lets any third party convert a funded-but-unclaimed pot into a paid pot before a pending default breaks the circle, strictly raising `claimedCount` and cutting every member’s refund by `depositAmount` versus the dissolve path the header advertises.
fix: Restrict `claimFor` to the payee (and optionally a per-circle claimed relayer), or reject claims once the *current* round is already under-funded even if its window is still open.

---

FINDING | contract: RotatingVault | function: redeemInvite | bug_class: stale-invite-snipe | group_key: RotatingVault | redeemInvite | stale-invite-snipe
severity: Low
confidence: 86
path: organizer signs Alice@slot0@nonce1@expT → Alice “backs out” → organizer signs Bob@slot0@nonce2@expT2 → Alice or anyone with the first slip calls redeemInvite → Alice takes the seat, Bob’s slip reverts SlotTaken
proof: |
  App default TTL is 7 days (`INVITE_TTL_SECONDS`). The slip is a URL
  (`/invite?c=&i=&m=&n=&e=&s=`), so anyone who saw it can submit it.

  t=0: organizer signs Invite(circle=1, member=Alice, payoutIndex=0, nonce=1, expiresAt=t+7d).
  t=1d: Alice says she is out. Organizer signs Invite(..., member=Bob, payoutIndex=0, nonce=2, expiresAt=t+8d).
  t=1d+1s: Alice (or a holder of the first URL) calls redeemInvite with nonce 1.
    `usedNonces[1][1]` is false, `memberAt[1][0]` is 0, signature recovers organizer.
    Alice is seated. joined += 1.
  t=1d+2s: Bob’s slip reverts `SlotTaken`. Alice cannot be kicked. Organizer’s only
    recourse is `cancel` + recreate (header line 231–233) or wait until t+7d and
    hope nobody redeems — but she already did.

  Funds: none while Filling. After an inattentive `start` (demo relayer auto-starts
  once `joined == memberTarget`), Alice can sit out round 0 and lock Bob/Carol’s
  deposits until `roundDuration` elapses (capped at 365 days). Then they refund.
  The grief is the forced seat plus up to a year of locked deposits, not theft.
description: Expiry is the only revocation; a still-unexpired invite remains executable after the organizer issued a replacement for the same seat, so the old member (or anyone holding the URL) can snipe the slot.
fix: Add organizer `revokeNonce(circleId, nonce)` (and revoke-on-replace), or bind replacement to an on-chain “slot generation” that invalidates prior slips for that index.

---

FINDING | contract: GoalVault | function: createCampaign | bug_class: rescue-lock-grief | group_key: GoalVault | createCampaign | rescue-lock-grief
severity: Low
confidence: 84
path: attacker.createCampaign(goal=1, deadline=type(uint64).max, beneficiary=attacker) → rescueUnlockTime jumps to ~2^64 → owner.rescueExcess reverts RescueLocked for every subsequent stray mint
proof: |
  `DeadlineTooFar` is declared at GoalVault.sol:190 and never written.
  `createCampaign` only checks `deadline > block.timestamp`.
  `rescueUnlockTime = max(rescueUnlockTime, deadline + SETTLEMENT_GRACE)`.

  Attacker (permissionless) opens a campaign with deadline = 2^64-1.
  unlock = 2^64-1 + 3600, stored in uint256.
  From then on `rescueExcess` hits `block.timestamp < rescueUnlockTime`.

  Cost: one `createCampaign` gas. Effect: every unattributed USDC in this
  vault — including a late CCTP mint for an already-closed short campaign
  that the relayer failed to label — can never be swept. Escrowed balances
  are not stolen; the owner recovery hatch for slack is permanently bricked.
description: `DeadlineTooFar` is dead code, so anyone can push `rescueUnlockTime` to the uint64 horizon and permanently disable `rescueExcess` for the whole vault.
fix: Enforce a maximum deadline (wire up `DeadlineTooFar`) and/or compute rescue unlock per campaign rather than a single global max.

---

## LEADS

LEAD | contract: RotatingVault | function: depositFor | bug_class: last-second-cover | group_key: RotatingVault | depositFor | last-second-cover
code_smells: permissionless `depositFor` writes `roundDeposits` / `roundFundedCount` for another member until the window closes; comments say this “can never hurt the member” and ignore other depositors
description: The scheduled payee (or anyone) can fund a silent member in the last second of an under-paid round, then `claimFor` the pot, converting a would-be full unwind into a private payout. Concrete: N=3, A=100e6, Alice+Bob already paid, Carol silent; Alice `depositFor(Carol)` (cost 100e6) then claims 300e6; net +100e6 versus the refund-everyone outcome, taken from Bob. Spec-legal (the round did fill) — left as a lead because the fix is a policy choice (freeze deposits once remaining time is short, or only allow self-deposit in the last slice), not a broken identity.

LEAD | contract: RotatingVault | function: redeemInvite | bug_class: force-enroll | group_key: RotatingVault | redeemInvite | force-enroll
code_smells: anyone may redeem; member never signs; no leave; demo relayer auto-`start`s when the last seat fills (`circle-relayer.ts`)
description: A holder of a signed URL can enroll the named address against their will before `expiresAt`. Combined with auto-start this begins the clock on a ghost member and locks co-members’ first-round deposits for `roundDuration`. Unverified in this pass: whether production self-custody circles still auto-start (demo lane only looks gated on organizer==relayer).

LEAD | contract: RotatingVault | function: redeemInvite | bug_class: uncapped-expiry | group_key: RotatingVault | redeemInvite | uncapped-expiry
code_smells: `expiresAt == 0` reverts; no maximum; header claims a leaked invite cannot live forever
description: An organizer who signs `expiresAt = type(uint256).max` (or any far future) issues an immortal slip. App default is 7 days; the chain does not enforce it. Trail left as a lead because the signer chose the number — same class as “admin set a bad param,” except the organizer is not a protocol admin.

LEAD | contract: RotatingVault | function: claim | bug_class: blacklist-stuck-pot | group_key: RotatingVault | claim | blacklist-stuck-pot
code_smells: `safeTransfer` to payee/member; USDC can blacklist; no rescue; unclaimed healthy pots never expire
description: If the scheduled payee (or a refundee) is blacklisted, `claim*` / `refund*` revert and that share sits in the vault indefinitely on a healthy circle. Other members’ pots and refunds are unaffected. Not theft; recovery would need a break (dissolve) or a token-level unban. Flagged because Rally’s intended token *is* USDC.

---

## Cleared — broken-circle refund accounting (RotatingVault)

The v1 identity

```
refundable(m) = totalDeposited(m) − claimedCount × A
```

holds for every reachable broken state I could construct.

Why the uniform floor is safe:

- A pot can be marked claimed only in `_claimTo` after `roundFundedCount[r] == N`.
- Each of those N credits is exactly `A` (`UnexpectedTransferAmount` otherwise; one shot per member per round).
- So every member’s `totalDeposited` is at least `claimedCount × A` at break. The `held <= floor` branch is the defaulter who already spent their whole pile inside paid pots, not an underflow of someone else’s money.
- After break, `_claimTo` reverts `CircleIsBroken`, so `claimedCount` cannot move under a refund. Refunds set `totalDeposited[m] = floor` before the transfer, so they cannot be replayed.

Worked conservation (matches `test_failedMidCircle_refundsExcludeAlreadyPaidPots` and `test_brokenCircle_foreclosesUnclaimedEarlierPot`):

| State | Vault | claimedCount | Alice td | Bob td | Carol td |
| ----- | ----- | ------------ | -------- | ------ | -------- |
| R0 funded, Alice claimed | 0 | 1 | 100 | 100 | 100 |
| R1 Alice+Bob paid, Carol silent, window open | 200 | 1 | 200 | 200 | 100 |
| R1 closes, broken | 200 | 1 | 200 | 200 | 100 |
| Refunds 100 / 100 / 0 | 0 | 1 | 100 | 100 | 100 |

Unclaimed funded pot (Alice never pulled R0; R1 empty-fails):

| State | Vault | claimedCount | refunds |
| ----- | ----- | ------------ | ------- |
| R0 funded, unclaimed | 300 | 0 | — |
| Broken | 300 | 0 | 100+100+100 |
| After refunds | 0 | 0 | drained |

Inductive `_lazyBroken` (only last finished round) does not skip an earlier miss: deposits write only `_elapsedRounds(c)`, and that write is refused once the last finished round is short. There is no path that fills round `r+1` after round `r` missed.

Contrast with GoalVault: RotatingVault *does* reduce the member’s liability on refund (`totalDeposited → floor`). GoalVault reduces only `totalEscrowed` and leaves `raised` as a withdrawable figure. That is the High.

---

## Cleared — pot conservation (RotatingVault)

Per-circle identity used in tests and the fuzz harness:

```
token.balanceOf(vault)  ≥  Σ_circles ( Σ_m totalDeposited_c(m) − claimedCount_c × A_c × N_c )
```

Equality holds when the vault holds no stray transfers. Extra donations cannot be extracted (`claim`/`refund` send exact `pot` / `owed`; there is no `rescueExcess` on this vault) — they over-collateralize, they do not steal.

Why a circle cannot drain a sibling circle on the same token:

- `claimedCount` cannot increase without a transfer of exactly `A*N` in the same call (CEI + revert-on-failed-transfer).
- `totalDeposited` cannot increase without a `+A` balance delta.
- `createCircle` rejects `A > type(uint256).max / N`, so `pot = A*N` and `consumedFloor = claimedCount*A` (with `claimedCount ≤ N`) cannot overflow uint256.
- Therefore a claim never asks the shared pile for more than that circle deposited toward that pot.

`echidna_conservation` / `_assertConservation` encode this. They do **not** encode GoalVault’s `raised`-vs-escrow split; that vault’s fuzz ghosts never decrement a per-campaign `raised` on refund either, so they cannot see the High.

Fee-on-transfer / rebasing / void-return tokens: deposits refuse a non-`A` delta. Outbound FoT would short the payee, not the vault identity. Header already marks those tokens unsupported. Organizer-chosen token that lies about `balanceOf` could contaminate sibling circles on *that* token — standard “don’t point this at a malicious ERC-20” and not scored.

---

## Focus checklist

| Focus | Verdict |
| ----- | ------- |
| Broken-circle refund accounting (RotatingVault) | **Holds.** Uniform `claimedCount * A` floor is justified and conservative. |
| `claimFor` griefing | **Low FINDING.** Third party can force the early-winner extraction and kill the dissolve hatch; no insolvency. |
| Invite expiry grief | **Low FINDING** (stale-slip snipe) + **LEADs** (force-enroll, uncapped `expiresAt`). No value stolen while Filling. |
| Pot conservation (RotatingVault) | **Holds** for USDC-like tokens; sibling circles on the same token stay separated by the exact-`A` / exact-pot writes. |
| Pot conservation (GoalVault) | **Broken** across the grace-window refund/credit seam — High FINDING. |

---

## Notes for the orchestrator

- Do not merge the GoalVault High with RotatingVault refund notes. Same English word (“refund accounting”), opposite implementations: RotatingVault reduces the liability that later payouts read; GoalVault does not.
- `claimFor` and `redeemInvite` stale-slip are v2 surfaces called out in `ROADMAP.md` as the Pashov gate. Neither is Crit/High/Med by the gates in `judging.md` (rightful payee; Filling-only seat race).
- Gate 3 on the High: relayer is trusted, but the amplifier is an unprivileged `refund` racing the *documented honest* grace attribution, not a malicious admin. Treat as race, not “admin can rug.”
- No contract edits in this pass.
