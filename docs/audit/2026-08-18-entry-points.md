# Entry Point Map

> Rally (GoalVault + RotatingVault) | 22 entry points | 12 permissionless | 6 role-gated | 4 admin-only

---

## Protocol Flow Paths

### Setup (GoalVault owner)

`constructor(token, localDomain, relayer, owner)` → `setTokenMessenger(messenger)` → optional `setCctpRefundParams(maxFee, minFinality)`

### GoalVault — same-chain campaign

`createCampaign(goal, deadline, beneficiary)` → `contribute(id, amount)`  ◄── `now < deadline`, `!withdrawn`, backer approved vault
                                                    ├─→ `withdraw(id)`  ◄── `raised >= goal`; caller is beneficiary or creator
                                                    └─→ `refund(id)`  ◄── `now >= deadline`, `raised < goal`, `!withdrawn`

### GoalVault — CCTP campaign

`[owner setup above]` → `createCampaign(...)` → (Circle mints USDC to vault) → `recordContribution(id, backer, amount, sourceDomain)`  ◄── relayer; `now < deadline + 1h`; `balance >= totalEscrowed + amount`
                                                                                 ├─→ `withdraw(id)`  ◄── same as above
                                                                                 ├─→ `refundFor(id, backer)`  ◄── relayer; failed campaign
                                                                                 └─→ `refundCrossChain(id, backer)`  ◄── backer or relayer; failed campaign; messenger set for remote domains

### Setup (Circle organizer)

`createCircle(token, depositAmount, roundDuration, memberTarget)` → `redeemInvite(...)` × N  ◄── Filling; valid unexpired org EIP-712
                                                                   ├─→ `cancel(id)`  ◄── organizer; still Filling
                                                                   └─→ `start(id)`  ◄── organizer; `joined == memberTarget`

### Circle member / relayer

`[organizer setup + start]` → `deposit(id)` / `depositFor(id, member)`  ◄── Active, not lazy-broken; current round `< N`; member slot unpaid
                              ├─→ `claim(id)` / `claimFor(id, payee)`  ◄── payee’s index `r` funded by all N; pot unclaimed
                              └─→ (round window closes under-funded) → `markBroken(id)` → `refund(id)` / `refundFor(id, member)`  ◄── owed `> claimedCount * A`

---

## Permissionless

### `RotatingVault.createCircle()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Anyone (becomes that circle’s organizer) |
| Parameters | token (user-controlled), depositAmount (user-controlled), roundDuration (user-controlled), memberTarget (user-controlled) |
| Call chain | `→ RotatingVault.createCircle()` |
| State modified | `nextCircleId++`; `_circles[id]` created (`Filling`, `joined=0`, `startTime=0`) |
| Value flow | None |
| Reentrancy guard | no |

### `RotatingVault.redeemInvite()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Anyone (relayer-friendly); authorization is the organizer signature |
| Parameters | circleId (user-controlled), member (user-signed), payoutIndex (user-signed), nonce (user-signed), expiresAt (user-signed), signature (user-signed) |
| Call chain | `→ RotatingVault.redeemInvite() → ECDSA.recover(_hashInvite(...))` |
| State modified | `usedNonces[id][nonce]=true`; `memberAt[id][idx]`; `_memberIndexPlus1[id][member]`; `Circle.joined++` |
| Value flow | None |
| Reentrancy guard | no |

### `RotatingVault.deposit()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Member (credits `msg.sender`) |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.deposit() → _deposit(id, msg.sender) → IERC20.safeTransferFrom(msg.sender, vault, A)` |
| State modified | `roundDeposits[id][r][member]=A`; `totalDeposited[id][member]+=A`; `roundFundedCount[id][r]++` |
| Value flow | Tokens: msg.sender → RotatingVault |
| Reentrancy guard | yes |

### `RotatingVault.depositFor()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Anyone with token + allowance (relayer/sponsor) |
| Parameters | circleId (user-controlled), member (user-controlled) |
| Call chain | `→ RotatingVault.depositFor() → _deposit(id, member) → IERC20.safeTransferFrom(msg.sender, vault, A)` |
| State modified | Same as `deposit`, keyed by `member` not `msg.sender` |
| Value flow | Tokens: msg.sender → RotatingVault (credit to `member`) |
| Reentrancy guard | yes |

### `RotatingVault.claim()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Payee (`_claimTo` uses `msg.sender` as `payee`) |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.claim() → _claimTo(id, msg.sender) → IERC20.safeTransfer(payee, N*A)` |
| State modified | `potClaimed[id][r]=true`; `claimedCount++`; maybe `status=Completed` |
| Value flow | Tokens: RotatingVault → payee (`msg.sender`) |
| Reentrancy guard | yes |

### `RotatingVault.claimFor()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Anyone |
| Parameters | circleId (user-controlled), payee (user-controlled) |
| Call chain | `→ RotatingVault.claimFor() → _claimTo(id, payee) → IERC20.safeTransfer(payee, N*A)` |
| State modified | Same as `claim`, keyed by `payee` |
| Value flow | Tokens: RotatingVault → `payee` (never `msg.sender` unless equal) |
| Reentrancy guard | yes |

### `RotatingVault.markBroken()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Anyone |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.markBroken() → _ensureBroken() → _lazyBroken / _firstFailedRound` |
| State modified | `status=Broken` if stored `Active` and lazily broken; emits `CircleBroken` |
| Value flow | None |
| Reentrancy guard | no |

### `RotatingVault.refund()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Member (pays `msg.sender`) |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.refund() → _refund(id, msg.sender) → _ensureBroken → IERC20.safeTransfer(member, owed)` |
| State modified | `status=Broken` if needed; `totalDeposited[id][member]=consumedFloor` |
| Value flow | Tokens: RotatingVault → member (`msg.sender`) |
| Reentrancy guard | yes |

### `RotatingVault.refundFor()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant |
| Caller | Anyone |
| Parameters | circleId (user-controlled), member (user-controlled) |
| Call chain | `→ RotatingVault.refundFor() → _refund(id, member) → _ensureBroken → IERC20.safeTransfer(member, owed)` |
| State modified | Same as `refund`, keyed by `member` |
| Value flow | Tokens: RotatingVault → `member` |
| Reentrancy guard | yes |

### `GoalVault.createCampaign()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Anyone (becomes `creator`) |
| Parameters | goal (user-controlled), deadline (user-controlled), beneficiary (user-controlled) |
| Call chain | `→ GoalVault.createCampaign()` |
| State modified | `nextCampaignId++`; `_campaigns[id]`; `rescueUnlockTime = max(rescueUnlockTime, deadline + SETTLEMENT_GRACE)` |
| Value flow | None |
| Reentrancy guard | no |

### `GoalVault.contribute()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, campaignExists |
| Caller | Backer |
| Parameters | campaignId (user-controlled), amount (user-controlled) |
| Call chain | `→ GoalVault.contribute() → IERC20.safeTransferFrom(msg.sender, vault, amount) → _credit(id, msg.sender, received, LOCAL_DOMAIN)` |
| State modified | `raised`, `totalEscrowed`, `_contributedTotal`, `_contributedByDomain`, `_backerDomains` / `_domainSeen`, `_contributions`, `contributionCount` |
| Value flow | Tokens: msg.sender → GoalVault (credits `received` balance-delta) |
| Reentrancy guard | yes |

### `GoalVault.refund()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, campaignExists |
| Caller | Backer (self) |
| Parameters | campaignId (user-controlled) |
| Call chain | `→ GoalVault.refund() → _refund(id, msg.sender, msg.sender) → IERC20.safeTransfer(backer, total)` |
| State modified | `_contributedTotal[id][backer]=0`; `totalEscrowed -= total`; per-domain contributed zeroed |
| Value flow | Tokens: GoalVault → msg.sender |
| Reentrancy guard | yes |

---

## Role-Gated

### Circle organizer (`msg.sender == Circle.organizer`)

#### `RotatingVault.start()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Organizer |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.start()` |
| State modified | `status=Active`; `startTime=uint64(block.timestamp)` |
| Value flow | None |
| Reentrancy guard | no |

#### `RotatingVault.cancel()`

| Aspect | Detail |
|--------|--------|
| Visibility | external |
| Caller | Organizer |
| Parameters | circleId (user-controlled) |
| Call chain | `→ RotatingVault.cancel()` |
| State modified | `status=Cancelled` (Filling only; no funds ever held) |
| Value flow | None |
| Reentrancy guard | no |

### GoalVault relayer (`msg.sender == relayer`)

#### `GoalVault.recordContribution()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, onlyRelayer, campaignExists |
| Caller | Relayer |
| Parameters | campaignId (user-controlled), backer (keeper-provided), amount (keeper-provided), sourceDomain (keeper-provided) |
| Call chain | `→ GoalVault.recordContribution() → _requireCreditable → _credit(...)` |
| State modified | Same credit books as `contribute` |
| Value flow | None (USDC must already be in the vault) |
| Reentrancy guard | yes |

#### `GoalVault.refundFor()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, onlyRelayer, campaignExists |
| Caller | Relayer |
| Parameters | campaignId (user-controlled), backer (keeper-provided) |
| Call chain | `→ GoalVault.refundFor() → _refund(id, backer, backer) → IERC20.safeTransfer(backer, total)` |
| State modified | Same as `GoalVault.refund` for `backer` |
| Value flow | Tokens: GoalVault → `backer` |
| Reentrancy guard | yes |

### Beneficiary or creator (`msg.sender == beneficiary || creator`)

#### `GoalVault.withdraw()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, campaignExists |
| Caller | Campaign beneficiary or creator |
| Parameters | campaignId (user-controlled) |
| Call chain | `→ GoalVault.withdraw() → IERC20.safeTransfer(beneficiary, raised)` |
| State modified | `withdrawn=true`; `totalEscrowed -= raised` |
| Value flow | Tokens: GoalVault → `beneficiary` (not necessarily `msg.sender`) |
| Reentrancy guard | yes |

### Backer or relayer (`msg.sender == backer || relayer`)

#### `GoalVault.refundCrossChain()`

| Aspect | Detail |
|--------|--------|
| Visibility | external, nonReentrant, campaignExists |
| Caller | The `backer` argument, or the relayer |
| Parameters | campaignId (user-controlled), backer (user-controlled / keeper-provided) |
| Call chain | `→ GoalVault.refundCrossChain() → [LOCAL] IERC20.safeTransfer(backer, amount)` / `[remote] IERC20.forceApprove(messenger, amount) → TokenMessenger.depositForBurn(..., mintRecipient=backer, ...)` |
| State modified | `_contributedTotal[id][backer]=0`; `totalEscrowed -= total`; per-domain amounts zeroed before each transfer/burn |
| Value flow | Tokens: GoalVault → backer (local) or burned via CCTP to backer on `sourceDomain` |
| Reentrancy guard | yes |

---

## Admin-Only

GoalVault `onlyOwner`. RotatingVault has no admin functions.

| Contract | Function | Parameters | State Modified |
|----------|----------|------------|----------------|
| GoalVault | `setRelayer(_relayer)` | _relayer (user-controlled, ≠ 0) | `relayer` |
| GoalVault | `setTokenMessenger(_messenger)` | _messenger (user-controlled, may be 0) | `tokenMessenger` |
| GoalVault | `setCctpRefundParams(_maxFee, _minFinalityThreshold)` | both user-controlled | `cctpMaxFee`, `cctpMinFinalityThreshold` |
| GoalVault | `rescueExcess(to)` | to (user-controlled, ≠ 0) | none on books; transfers `balance − totalEscrowed` after `block.timestamp >= rescueUnlockTime` |

---

## Initialization

Not proxy initializers. One-shot constructors:

| Contract | Function | Parameters | Notes |
|----------|----------|------------|-------|
| GoalVault | `constructor(_token, _localDomain, _relayer, _owner)` | token / domain / relayer / owner (deployer-controlled) | `Ownable(_owner)`; `token` and `LOCAL_DOMAIN` immutable; `relayer ≠ 0` |
| RotatingVault | `constructor()` | none | Caches EIP-712 domain (`name=RotatingVault`, `version=2`, `chainId`, `verifyingContract`) |
