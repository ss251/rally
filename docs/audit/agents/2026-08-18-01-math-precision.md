No Crit/High/Med findings. Residual notes:

RotatingVault v2 pot / claim / expiry math (value-moving paths):

- Scale: amounts are raw token units (Rally USDC = 6 decimals). No WAD/RAY/BPS, no hardcoded `1e18`, no decimal conversion. Pot is `depositAmount * memberTarget` (exact integer; no division, no dust).
- Overflow: `createCircle` rejects `depositAmount > type(uint256).max / memberTarget`, so `_claimTo` / `potOf` / `RoundFunded` / `claimedCount * depositAmount` cannot overflow (claimedCount ≤ N). Edge `A == max/N` is safe: `(max/N)*N = max - max%N ≤ max`.
- Collateral: `_deposit` requires `balanceAfter - balanceBefore == A` (not ≥). Fee-on-transfer cannot underwrite a later `N*A` claim. Rebasing / weird tokens unsupported (documented).
- `_claimTo` / `claimFor`: pot size is always `A * N`, not `A * fundedCount` and not caller-chosen. Claim requires `fundedCount >= N`. `fundedCount` cannot exceed N (one deposit per member, N members, start requires `joined == N`). Recipient is always `payee`; stranger `claimFor` cannot redirect or resize the pot. Concrete: N=3, A=100e6, `claimFor(id, alice)` after round 0 is full pays alice 300e6, caller 0; `claimFor(id, bob)` reverts `RoundNotFunded` (bob's seat is round 1).
- Refund identity: `owed = totalDeposited[m] - claimedCount * A`. Every claimed pot was funded by all N members, so each member's consumed share is A per claimed pot. Conservation: `Σ owed = Σ totalDeposited - N * claimedCount * A` = vault token balance for that circle. Guard `held <= floor` prevents underflow; view uses the same `>` test. Unreachable `held < floor` (a member missing a claimed round) would no-op rather than wrap.
- `_elapsedRounds` is the only division on this contract: `(now - startTime) / D` floors. Correct rounding for "which window is open." `D >= 1` (no div-by-zero). Clock rollback (`now < startTime`) reverts on checked sub — no wrong-round credit.
- `_lazyBroken` last-completed induction holds under time-skips: a jump past later windows leaves those windows at fundedCount 0, so the circle breaks and unclaimed earlier pots dissolve into refunds (documented v1 unwind, not a rounding bug).
- `expiresAt`: zero rejected; `block.timestamp > expiresAt` means the exact expiry second is still valid (OZ/Uniswap deadline convention). Bound into the EIP-712 digest. Organizer may set `type(uint256).max` (invite never expires while Filling; cancel remains available). Not theft.
- Downcasts: `uint16(payoutIndex)` after `payoutIndex < memberTarget <= 256`; `idx + 1` max 256 fits uint16; `startTime = uint64(now)` only wraps ~584e9 years out; `claimedCount` / `joined` / `roundFundedCount` are uint16 with N≤256.
- `roundWindow` `uint64(...)` comment omits `startTime`. Sum wraps the explicit cast only if `startTime > 2^64 - (N+1)*D` (~2^33 below uint64 max). View-only; not a fund path.
- Not a share vault: no exchange-rate inflation / 1-wei deposit steal surface.
- `MIN_MEMBERS = 2` avoids a sole-occupant pot.

GoalVault (cross-check / weaponize; not RotatingVault pot math):

- Same raw-unit accounting. `contribute` credits `received` (allows shortfall on tax tokens). `withdraw` pays full `raised` (oversubscription, no `goal` cap). `totalEscrowed + amount` / `raised + amount` are 0.8-checked.
- `contributionCount = uint32(index + 1)` can wrap at 2^32 credits; money fields stay uint256 (display-only).
- `DeadlineTooFar` is declared and unused; `deadline = type(uint64).max` locks `rescueExcess` until then (grief of unattributed slack, not escrow).
- `raised` is not decremented on refund. A grace-window `recordContribution` after a local refund can make `raised >= goal` while remaining escrow is smaller than `raised`, so `withdraw` underflows and `_requireFailed` blocks refunds. That is state/accounting (relayer + grace race), not integer-precision loss — flagged for the logic/state agent, not proven here as a math FINDING.

Severity counts: Crit 0, High 0, Med 0, Low 0, Lead 0.
