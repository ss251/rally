# First-principles scan — 2026-08-18 agent 07

Scope: `RotatingVault.sol`, `GoalVault.sol`, `IRotatingVault.sol`.
Method: ignore named vuln classes; extract each implicit assumption and try to break it.
Severity counts: **Crit 0, High 1, Med 0, Low 1, Lead 3**.

---

## Working notes (mental-tool protocol)

Markers below are the scan trace. FINDING/LEAD blocks are the only scored items.

### IRotatingVault

[Feynman: IRotatingVault] This file is the dictionary for a rotating savings club. It names the life stages of a club (does not exist, recruiting, running, wrecked, finished, aborted), the club's settings (who started it, how many seats, how much each person pays, how long a turn lasts, which token is held), and the promises: a seat is admitted only with the organizer's signed invitation that expires; a turn's pot pays only that turn's designated person and only if every seat paid that turn; if any finished turn is short, the club dies and each person can pull back whatever they still have on the books. Fuzzy spot: stored "running" can secretly already be "wrecked" — the file itself says look at `circleStatus`, not the stored word.

[Feynman: Status/Circle] The stored status word is allowed to lag. "Running" on disk can mean "wrecked in real life" until someone pokes a refund. That lag is an assumption: every money-moving path must re-derive wrecked-ness, not trust the stored word.

[Socratic: IRotatingVault:20 — why store Active while derived Broken?] Because flipping storage on every view would cost a write. Implicit belief: no money path will treat stored Active as "safe to pay a pot" without also asking whether the last finished turn was full.

### RotatingVault — create / invite / start / cancel

[Feynman: RotatingVault] One contract holds many clubs, each with its own token and schedule. People join by handing in an organizer-signed invitation that names the person, their payout seat, a one-time ticket number, and a drop-dead time. Once every seat is taken the organizer starts the clock. Each turn, every member must pay exactly the same amount into that turn only. The person whose seat number equals the turn number can pull the whole pot only after every seat has paid that turn. If a finished turn is short, the club is dead: nobody can pay or pull a pot, and each person can pull back what they paid minus one share per pot that already left.

[Feynman: constructor] Remembers the chain it was born on and a "who am I / what am I called" stamp so invitations cannot be replayed on a copy of the world or a different chain.

[Feynman: createCircle] Anyone opens a club: pick a token, a per-turn payment, a turn length, and a seat count. Rejects a missing token, a zero payment, a turn length of zero or longer than a year, a seat count outside 2..256, and a payment so huge that "payment × seats" would wrap. Hands back the next club number and records the opener as organizer with zero members and the clock not started.

[Inversion: createCircle] (1) Open a club with a hostile token that lies about balances — members must opt in; exact-received check still blocks under-collateral deposits. (2) Open with payment = max/N — pot still fits; not a wrap. (3) Open 2^256 clubs — not reachable.

[Feynman: redeemInvite] Anyone may submit the invitation. The contract checks the club is recruiting, the named person exists, the seat is in range and empty, the person is not already seated, the ticket number is fresh, the drop-dead time is a real time that has not passed, and the signature recovers to this club's organizer. Then it burns the ticket, seats the person, and increments the headcount. Rights stick to the named person, not the submitter.

[Socratic: RotatingVault.sol:250 — why reject expiresAt == 0?] So a leaked invitation cannot live forever. Implicit belief: a non-zero expiry is a real, bounded unix time. Nothing stops `expiresAt = 2^256-1`.

[Inversion: redeemInvite] (1) Replay the same ticket on this club — `InviteNonceUsed`. (2) Replay on another club the same organizer runs — digest binds `circleId`. (3) Relayer swaps the member address — digest binds `member`; recover fails or seats the signed person only.

[Feynman: start] Only the organizer, only while recruiting, only when every seat is filled. Flips the club to running and stamps "now" as the start of turn 0.

[Inversion: start] (1) Start with an empty seat — `joined != target` reverts. (2) Start twice — second sees not-recruiting. (3) Start and immediately take turn 0 money — elapsed turns is 0; that is the intended first window.

[Feynman: cancel] Organizer aborts only while recruiting. No money has ever been taken, so abort is always clean. After start this door is welded shut on purpose so an already-paid organizer cannot force an unwind.

### RotatingVault — deposits

[Feynman: deposit] A member pays their own seat for the live turn.

[Feynman: depositFor] Anyone with tokens may pay a named member's live-turn seat. The named member is only credited, never debited.

[Feynman: _deposit] Club must exist, be stored-running, not secretly wrecked, and the name must be a member. The live turn is "how many full turn-lengths have passed since start." That turn must still be one of the N turns and this member must not already have paid it. The contract then pulls the exact payment from the sender and refuses if the vault's token balance did not rise by exactly that amount. Only then does it ink the per-turn payment, add to the member's lifetime paid, and bump the turn's payer count. Fuzzy spot: the token is pulled *before* the books are inked.

[Socratic: RotatingVault.sol:338-342 — why pull tokens before writing books?] To measure the actual rise in the vault's pile. Implicit belief: nothing else that moves this club's money can run during that pull (the reentrancy lock covers every money path; invite/start/cancel/markBroken do not move money).

[Inversion: _deposit] (1) Pay a future turn — live turn is derived; no argument chooses the turn. (2) Pay after a finished turn was short — secret-wrecked check runs first. (3) Pay twice in one turn via `deposit` then `depositFor` — second hits already-paid.

[Socratic: RotatingVault.sol:314 — why "credit-only, can never hurt"?] Because the named person does not pay and cannot be marked unpaid. Implicit belief: being marked paid is never against their interest. A member who already took an early pot and wanted the club to die (so later seats eat the default) can be kept current by a stranger's gift. That gift is the stranger's money; the named person is richer, not poorer. Self-harm / donation, not a finding.

### RotatingVault — claims

[Feynman: claim] The caller pulls their own pot.

[Feynman: claimFor] Anyone may trigger a named member's pot. The coins still go to that member.

[Feynman: _claimTo] Club must be stored-running and not secretly wrecked. The name must be a member. Their seat number *is* the turn being claimed — there is no argument that picks someone else's turn. That turn's pot must not already have been paid, and every seat must have paid that turn. Then the pot is marked paid, the paid-pot counter goes up by one, and if that was the last pot the club is marked finished. Only then are `payment × seats` coins sent to the named person.

[Inversion: _claimTo] (1) Stranger calls `claimFor(id, alice)` hoping to steal — coins go to alice; stranger gets nothing. (2) Claim bob's pot by passing alice — alice can only claim alice's seat. (3) Claim a full pot after a later turn died — secret-wrecked reverts; the pot dissolves into refunds (stated rule).

[Socratic: RotatingVault.sol:371-373 — why let anyone trigger the pot?] So a relayer can push coins to an email-wallet that will not send a transaction. Implicit belief: forcing a full, already-funded pot to its rightful person cannot steal and cannot strand others. Compared with a later break, this *prevents* dissolution: `claimedCount` rises, refunds shrink by one share each. That is the stated rule (a claimed pot is final), not a broken assumption.

### RotatingVault — break / refunds

[Feynman: markBroken] Anyone may write the secret wreck onto disk so indexers see an event. Refunds do this themselves; this is not a gate.

[Feynman: refund] Caller pulls their own leftover.

[Feynman: refundFor] Anyone may push a named member's leftover to that member.

[Feynman: _refund] Club must exist and must be (or become) wrecked. Name must be a member. Leftover is "lifetime paid minus one payment per already-paid pot." If nothing sits above that floor, revert. Then the lifetime paid is slammed down to the floor and the leftover is sent to the member.

[Socratic: RotatingVault.sol:447 — why is the floor claimedCount × payment, not a per-member bitmap?] Because every paid pot was filled by all N people, so each person "spent" exactly one payment per paid pot. Implicit belief: no one can have a pot marked paid unless every member's books went up by one payment for that turn. `_claimTo` requires a full payer count; `_deposit` is the only increment of that count and always bumps that member's lifetime paid. Holds.

[Inversion: _refund] (1) Refund while the club is healthy — `_ensureBroken` reverts. (2) Refund twice — second sees held == floor. (3) Refund a member who missed a paid pot — unreachable: a paid pot required their payment (or a gift in their name, which still raised their lifetime paid).

[Feynman: _ensureBroken] If already marked wrecked, stop. If not stored-running or not secretly wrecked, revert. Otherwise write wrecked and emit the earliest short turn (for the event only).

### RotatingVault — time / wrecked-ness

[Feynman: _elapsedRounds] How many full turn-lengths have passed since start. Can be larger than N.

[Feynman: _lazyBroken] A club is secretly wrecked if any *finished* turn is short. The code only looks at the most recently finished turn (or the last of the N turns if the clock ran past the end). Turn 0 still open → not wrecked. Implicit belief (stated as induction): you cannot pay a later turn after an earlier finished turn was short, so the latest finished turn is short whenever any earlier one was.

[Socratic: RotatingVault.sol:479-484 — why is one turn enough?] Deposits target only the live turn and are refused once this check trips. Implicit belief: there is no other writer of `roundFundedCount` and no way to aim a payment at a non-live turn. Both hold in this bundle.

[Inversion: _lazyBroken] (1) Fund turn 0, jump the clock past every later turn — latest finished turn has payer count 0 → wrecked; unclaimed turn-0 pot dissolves. (2) Jump from turn 0 straight into the last turn — the turn before last is unfinished and short → wrecked; cannot fill the last turn. (3) Fund turn 0, fail turn 1, try to pay turn 2 — check trips on turn 1. Induction holds.

[Feynman: _firstFailedRound] Walks turns from 0 to find the first short one. Event data only. Reverts if none are short (should be unreachable under the guard).

### RotatingVault — EIP-712 and views

[Feynman: _buildDomainSeparator] Builds the "name RotatingVault / version 2 / this chain / this contract" stamp.

[Feynman: _domainSeparatorV4] Uses the cached stamp unless the chain id changed (fork), then rebuilds.

[Feynman: _hashTypedDataV4] Prefixes the invitation hash with the EIP-712 header and the stamp.

[Feynman: _hashInvite] Hashes the invitation fields under that stamp.

[Feynman: eip712Domain] Tells wallets the same stamp (current chain id, not the cached one).

[Feynman: inviteDigest] Public wrapper so the frontend signs the exact bytes the contract will check.

[Feynman: domainSeparator] Public stamp.

[Feynman: getCircle] Returns the stored record, including a stored status that may still say "running" while the club is secretly wrecked. Documented.

[Feynman: circleStatus] Stored word, but "running + secretly wrecked" reads as wrecked.

[Feynman: getMembers] Lists seats 0..N-1, including empty seats while recruiting.

[Feynman: isMember] True if the plus-one index is set.

[Feynman: memberIndexOf] Seat number, or revert if not seated.

[Feynman: currentRound] Live turn, uncapped. Reverts if the clock never started.

[Feynman: roundWindow] Open and close times for a turn. Casts down to 64-bit; safe for real start times and the one-year turn cap.

[Feynman: potOf] Payment × seats (0 for a missing club).

[Feynman: payeeOf] Seat occupant, or the zero address if the turn is out of range.

[Feynman: isRoundFunded] True only if the club has a real seat count and that turn's payer count equals it.

[Feynman: refundableAmount] Zero unless wrecked (stored or secret). Else the same leftover formula as `_refund`.

### GoalVault — admin / create / credit

[Feynman: GoalVault] One vault, one token (USDC), many one-shot fundraisers. Same-chain backers pay in and are named as themselves. Cross-chain USDC shows up as a pile with no name, so a privileged labeler writes "this pile belongs to this person, this fundraiser, this origin world." If the fundraiser hits its target the named receiver can sweep. If time runs out short, each backer can pull their credit back here, or ask to burn it home through Circle. The header swears the labeler cannot invent coins, cannot puff a fundraiser past coins that arrived, and cannot drain — because the vault's pile is always at least the sum of still-held credits, and sweeps/refunds only pay a fundraiser's own raised figure or a backer's own credit.

[Feynman: constructor] Sets the token, this world's Circle domain number, the first labeler, and the owner.

[Feynman: setRelayer] Owner replaces the labeler. No delay.

[Feynman: setTokenMessenger] Owner sets or clears the Circle burner used for send-home refunds.

[Feynman: setCctpRefundParams] Owner sets how much Circle may skim and how final a message must be.

[Feynman: rescueExcess] Owner skims only the slack (vault pile minus still-held credits), and only after every fundraiser's deadline-plus-grace has passed.

[Socratic: GoalVault.sol:190 — why does DeadlineTooFar exist?] Someone believed a deadline could be too far. Implicit belief at create time: deadlines are bounded. The check was never written. Anyone can push the rescue lock to the end of uint64 time.

[Feynman: createCampaign] Anyone opens a fundraiser: a target, a future deadline, a receiver. No upper bound on the deadline. Extends the global rescue lock to that deadline plus one hour if that is later than any previous lock.

[Inversion: createCampaign] (1) Deadline = now — rejected. (2) Deadline = uint64 max — accepted; rescue lock becomes unreachable. (3) Receiver = the vault itself — creator can later "sweep" coins back into the vault as slack; backers who check the receiver can refuse. Self-harm / parameter choice.

[Feynman: contribute] Same-world payment. Fundraiser must exist, not be swept, and still be before the deadline. Pulls the asked amount, credits whatever actually arrived, names the caller, origin = this world.

[Inversion: contribute] (1) Pay after the deadline during the labeler's extra hour — still rejected (strict clock). (2) Pay after a sweep — rejected. (3) Pay 0 — rejected.

[Feynman: recordContribution] Only the labeler. Fundraiser must not be swept and must still be inside deadline-plus-one-hour. The vault pile must already cover still-held credits plus this new amount. Then the named person is credited on the named origin world. Fuzzy spot: this door is still open after the fundraiser has already failed and after people have already taken refunds.

[Socratic: GoalVault.sol:520-523 — why is the labeler's clock looser?] So a burn that left before the deadline but minted late is not stranded. Implicit belief: "late label" and "refunds are open" cannot both be true in a way that desynchronizes the success number from the still-held pile. That belief is false.

[Inversion: recordContribution] (1) Label more than the slack — `UnattributedFunds`. (2) Label the same mint twice to two names — second fails the slack check. (3) Label after a refund has already gone out, enough to push the never-decremented success number over the target — books now say "succeeded" while cash for this fundraiser is short. This is the break.

[Feynman: _credit] Adds the amount to the fundraiser's success number, the global still-held pile, the backer's total, and the backer's per-world total. Remembers the world if new. Appends a log row. Emits "target hit" if this add crossed the target.

[Socratic: GoalVault.sol:470 — why does raised only ever go up?] The author treated `raised` as a lifetime tally (the x-ray even writes that down as I-3). Implicit belief of every reader of `raised` (`withdraw`, `_requireFailed`, `status`, `isSuccessful`, `isRefundable`): that same number is also "coins still belonging to this fundraiser." Two jobs, one slot.

### GoalVault — withdraw / refunds / gates / views

[Feynman: withdraw] Receiver or creator, once, only if the success number is at least the target. Pays the *success number* (lifetime tally) to the receiver and subtracts that same figure from the global still-held pile.

[Inversion: withdraw] Path looks clean (one-shot, CEI, only receiver). Attacker moves: (1) After a miss, take a refund, then let a late label push the tally over the target, then withdraw — pays the tally, which is larger than this fundraiser's remaining coins; steals from other fundraisers if they have enough still-held coins, or reverts and freezes if they do not. (2) Dust-refund (1 unit) as grief, same flip — bricks or nicks other fundraisers. (3) Full self-refund as creator/receiver, then late-label your own in-flight mint — net steal of (tally − remaining) from neighbors.

[Feynman: refund] Caller pulls their own credit after a miss.

[Feynman: refundFor] Labeler pushes a named backer's credit to that backer.

[Feynman: _refund] Must be a miss (time up, tally under target, not swept). Zeros the backer's credit and per-world credits, lowers the global still-held pile, sends the coins here. Does **not** lower the fundraiser's success number.

[Socratic: GoalVault.sol:495-497 — why not lower raised when coins leave?] No comment. Implicit belief: once time is up and the tally is under the target, the tally can never climb again, so a stale tally cannot later authorize a sweep. Broken by the labeler's extra hour.

[Feynman: refundCrossChain] Backer or labeler. Same miss gate. Zeros the backer's books up front, then for each origin world either sends coins here or burns them home to the same address. A stranger cannot force the burn (a later High already gated this).

[Feynman: _requireOpen] Not swept, and now is still before the deadline.

[Feynman: _requireCreditable] Not swept, and now is still before deadline plus one hour.

[Feynman: _requireFailed] Not swept, time is up, and the *tally* is still under the target.

[Socratic: GoalVault.sol:530 — why is "failed" a function of the tally, not of remaining credits?] Because the author thought the tally and remaining credits were the same after the deadline. They diverge the moment a refund runs.

[Feynman: _toBytes32] Left-pads an address into 32 bytes for Circle.

[Feynman: getCampaign] Raw fields, including the never-decremented tally. Missing ids look like zeros.

[Feynman: status] Tally ≥ target → succeeded; else time up → failed; else live.

[Feynman: isSuccessful] Tally ≥ target (and target is real).

[Feynman: isRefundable] Exists, not swept, time up, tally still under target.

[Feynman: contributionOf] Backer's current credit (0 after they refund).

[Feynman: contributionOfByDomain] Per-world slice.

[Feynman: backerDomains] Worlds they were labeled on.

[Feynman: refundableAmount] 0 unless a current miss; else their credit.

[Feynman: contributionsCount / getContribution / getContributions] The append-only log. Never shrunk on refund. Views only.

---

## FINDINGs

FINDING | contract: GoalVault | function: withdraw | bug_class: stale-raised-after-refund | group_key: GoalVault | withdraw | stale-raised-after-refund
severity: High
assumption: `Campaign.raised` is both a lifetime credit tally *and* the coins still belonging to that campaign, so `withdraw` may pay `c.raised` and `_requireFailed` / `status` / `isSuccessful` may treat `raised >= goal` as "cash is here and refunds must stop." The header also assumes a labeler "can NEVER drain the contract — withdrawals only ever pay a campaign's own raised amount."
violation: `_refund` / `refundCrossChain` send coins out and decrement `totalEscrowed` and `_contributedTotal` but never decrement `c.raised`. After the deadline, `_requireFailed` and `_requireCreditable` are both true at once, so a backer can pull a refund and the labeler can still `_credit` inside `SETTLEMENT_GRACE`. The late credit adds to the stale tally. If `raised` crosses `goal`, the campaign flips to Succeeded with less cash than `raised`.
path: backer.refund (or refundCrossChain) → raised unchanged, escrowed shrinks → relayer.recordContribution during grace → raised += mint, may cross goal → beneficiary.withdraw pays full raised → underflow freeze (solo campaign) or cross-campaign theft (shared USDC pool)
proof: Two campaigns, same vault, USDC 6 decimals.

  Campaign A (attacker is creator + beneficiary): goal = 1000e6, deadline T. Attacker contributes 900e6 same-chain and burns 100e6 via CCTP before T (mint lands at T+20min). Campaign B (victim): 5000e6 already credited, not withdrawn.

  At T: A.raised = 900e6 < goal → Failed. Attacker calls refund(A): `_contributedTotal[A][attacker] = 0`, `totalEscrowed -= 900e6`, USDC returns. A.raised is still 900e6.

  At T+20min (inside grace): vault balance = 5000e6 (B) + 100e6 (mint) = 5100e6. `recordContribution(A, attacker, 100e6, BASE)` passes `5100e6 >= 5000e6 + 100e6`. `_credit` sets A.raised = 1000e6, totalEscrowed = 5100e6. A's remaining cash is 100e6.

  Attacker withdraw(A): `amount = c.raised = 1000e6`; `totalEscrowed = 5100e6 - 1000e6 = 4100e6`; transfer 1000e6 to attacker. B's books still say 5000e6. Vault cash is 4100e6. B is 900e6 insolvent. Attacker's net: +900e6 (900 local refunded, 100 burned, 1000 withdrawn).

  Solo-campaign variant (no B): after the same refund+credit, `totalEscrowed = 100e6`, withdraw does `100e6 - 1000e6` and reverts; `_requireFailed` sees raised >= goal and blocks further refunds. The 100e6 mint is frozen. Same books, worse if any other backer had not yet refunded — their refunds also die.

  Honest labeler is enough: grace exists specifically so they will attribute that late mint. Attacker need not be the relayer.
description: Refunds leave `raised` stale, so a grace-window credit can mark a campaign successful and `withdraw` then pays the stale tally, freezing the campaign or stealing neighbor escrow.
fix: Keep a live outstanding (decrement `raised` — or a separate field — on every refund) and make `withdraw` / `_requireFailed` / `status` read outstanding; do not let a post-refund grace credit flip success against a stale tally.

FINDING | contract: GoalVault | function: createCampaign | bug_class: unbounded-deadline-rescue-lock | group_key: GoalVault | createCampaign | unbounded-deadline-rescue-lock
severity: Low
assumption: Deadlines are bounded. `DeadlineTooFar` exists for that reason, and `rescueUnlockTime` is only ever a short, honest "last campaign + 1 hour" so unattributed mints can still be attributed before the owner skims slack.
violation: `createCampaign` checks `deadline > now` only. `uint256(deadline) + SETTLEMENT_GRACE` with `deadline = type(uint64).max` writes an unreachable `rescueUnlockTime`. Permissionless.
path: anyone.createCampaign(goal=1, deadline=uint64.max, beneficiary=attacker) → rescueUnlockTime = 2^64-1 + 3600 → owner.rescueExcess reverts RescueLocked for the life of the chain
proof: `createCampaign:295` is the only time check. `createCampaign:310-311` does `if (unlock > rescueUnlockTime) rescueUnlockTime = unlock` with no cap. `rescueExcess:270` requires `block.timestamp >= rescueUnlockTime`. `block.timestamp` will not reach ~2^64. Escrowed credits are untouched; unattributed CCTP mints that missed the relayer (the exact pile `rescueExcess` is for) cannot be recovered.
description: Anyone can open a campaign whose deadline permanently disables `rescueExcess`, stranding unattributed USDC the owner is supposed to return.
fix: Throw the already-declared `DeadlineTooFar` when `deadline` exceeds `now + MAX_CAMPAIGN_DURATION` (and cap `rescueUnlockTime` the same way).

---

## LEADs

LEAD | contract: GoalVault | function: withdraw | bug_class: no-permissionless-success-pull | group_key: GoalVault | withdraw | no-permissionless-success-pull
code_smells: Success sweep is only `beneficiary || creator`. Circles added permissionless `claimFor` so a pot cannot sit behind a missing key. GoalVault has `refundFor` for misses but no `withdrawFor` for hits.
description: If both creator and beneficiary keys are lost after `raised >= goal`, backers have no on-chain pull; coins sit until those keys return. Not theft. Unverified: whether Rally's relayer is supposed to be able to finalize a success the way it finalizes a miss.

LEAD | contract: RotatingVault | function: _deposit | bug_class: interaction-before-effects | group_key: RotatingVault | _deposit | interaction-before-effects
code_smells: Token pull and the exact-delta read happen before `roundDeposits` / `totalDeposited` / `roundFundedCount` are written. Money-moving functions share a lock, so a re-entered `deposit`/`claim`/`refund` dies. Unguarded functions (`redeemInvite`, `start`, `cancel`, `markBroken`, `createCircle`) can still run in a token callback; none of them credit a pot or a refund on the in-flight club.
description: The "measure then ink" order is a CEI smell whose current unguarded neighbors do not move this club's money; a later unguarded money path would inherit a broken assumption. Residual: confirm no future hook is added without the lock.

LEAD | contract: RotatingVault | function: redeemInvite | bug_class: expiry-upper-bound-missing | group_key: RotatingVault | redeemInvite | expiry-upper-bound-missing
code_smells: Comment says a zero/elapsed expiry exists so a leaked invite "cannot live forever." The check is only `expiresAt == 0` or `now > expiresAt`. Organizer (or a buggy signer) may set `expiresAt = type(uint256).max`. While Filling, cancel still works and no coins are held.
description: The "cannot live forever" belief is organizer-honesty, not an on-chain cap. Not theft. Same shape as GoalVault's unused `DeadlineTooFar`.

---

## Assumptions checked and held

- RotatingVault refund floor `claimedCount * A` matches "every claimed pot was funded by all N" — claim requires a full payer count; the only payer-count writer is `_deposit`, which always raises that member's `totalDeposited`.
- `_lazyBroken` last-turn induction — deposits cannot aim at a non-live turn; a time-skip past empty later turns leaves the latest finished turn at count 0, so the club dies and unclaimed earlier pots dissolve as specified.
- `claimFor` / `refundFor` / `depositFor` cannot retarget coins — recipient is the named member; `claimFor` derives the turn from that member's seat.
- Invite replay — digest binds club, member, seat, ticket, expiry, chain, and this contract; ticket is consumed only after a good recover.
- GoalVault slack check `balance >= totalEscrowed + amount` prevents inventing coins. It does **not** keep `raised` in lockstep with a campaign's remaining cash after refunds (that is FINDING 1). The global `balance >= totalEscrowed` invariant can still hold while one campaign is paid with another's cash.
- GoalVault `contribute` after a hit, before sweep — extra backers are oversubscription; they are not owed a miss-refund. Held as a stated rule, not a bug.
- Circle early-pot then default — inherent ROSCA counterparty risk, documented, not a missing require.

---

## Severity counts

| Severity | Count |
|----------|------:|
| Critical | 0 |
| High     | 1 |
| Medium   | 0 |
| Low      | 1 |
| Lead     | 3 |
