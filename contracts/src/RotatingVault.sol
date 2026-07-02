// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IRotatingVault} from "./IRotatingVault.sol";

/**
 * @title RotatingVault
 * @notice On-chain rotating savings circle (ROSCA / chit fund) for Rally's
 *         "Circles". Many circles coexist in one id-keyed contract. Deployed
 *         on Arbitrum Sepolia; escrows USDC (6 decimals) per circle.
 *
 *         MECHANISM (pre-determined rotation, no bidding):
 *           - An organizer creates a circle: token, per-round `depositAmount`,
 *             `roundDuration` (seconds), and rotation size `memberTarget` (N).
 *           - Members are admitted with org-signed EIP-712 invites that bind
 *             (circleId, member, payoutIndex, nonce). No per-member on-chain
 *             whitelist tx by the organizer: anyone may submit the redemption
 *             (relayer-friendly for Rally's email-wallet + gasless flow); the
 *             signature itself is the authorization and the member address in
 *             it is where all rights accrue. `payoutIndex` fixes the rotation:
 *             member i is the sole payee of round i's pot.
 *           - Once all N slots are filled the organizer calls {start}; rounds
 *             are then purely time-derived: round r spans
 *             [startTime + r*D, startTime + (r+1)*D).
 *           - Each round every member deposits exactly `depositAmount` (one
 *             shot, current round only — no prepaying future rounds).
 *
 *         ALL-OR-NOTHING PER ROUND (the core safety property):
 *           Round r's pot (depositAmount * N) is claimable by member r ONLY
 *           once every member has funded round r. There is no partial payout,
 *           ever: a round either pays the full pot to its designated payee or
 *           pays nobody. A member's round-r deposit can therefore never
 *           subsidize a payout that the round's defaulter didn't fund.
 *
 *         FAILED-ROUND SEMANTICS (v1 — locked design decision):
 *           If a round's window closes under-funded the circle is Broken —
 *           terminally. No further deposits or claims are possible (including
 *           claims of earlier fully-funded-but-unclaimed pots: an unclaimed
 *           pot dissolves back into refunds). Every member can then pull back
 *           ALL of their still-held deposits — i.e. every deposit that did not
 *           already leave the contract inside a legitimately claimed pot:
 *
 *               refundable(m) = totalDeposited(m) - claimedCount * depositAmount
 *
 *           (Every claimed round was, by construction, funded by all N
 *           members, so each member's share of already-paid pots is exactly
 *           claimedCount * depositAmount.) This mirrors Breadchain's
 *           decommission-refund and unwinds the circle cleanly instead of
 *           limping on with a known defaulter.
 *
 *           v2 ALTERNATIVE (documented, deliberately deferred): refund just
 *           the failed round and continue with the defaulter evicted. That
 *           requires re-indexing the rotation (whose round is round r now?),
 *           shrinking the pot mid-flight, and a fair policy for a defaulter
 *           who already received their pot — unsolved mechanism design that
 *           would multiply the audit surface. The safe, auditable v1 choice
 *           is the terminal unwind above.
 *
 *         HONEST TRUST NOTES (inherent to any ROSCA, on-chain or off):
 *           - Rounds that already paid out are final. A member who receives an
 *             early pot and then defaults keeps their winnings minus their own
 *             sunk deposits; later-rotation members carry that counterparty
 *             exposure exactly as in a real-world chit fund. What the contract
 *             guarantees is narrower and absolute: no round pays out unless
 *             fully funded, and every still-held deposit is refundable to its
 *             depositor on a break. Circles are invite-only trust groups; the
 *             social layer (and a future collateral/reputation layer) handles
 *             the rest.
 *           - There is deliberately NO organizer abort after {start}: a
 *             voluntary mid-flight break would let an already-paid organizer
 *             weaponize the unwind. Circles only break by actual default.
 *           - Unclaimed pots on a healthy circle never expire; the payee can
 *             claim years later. Only a Broken circle forecloses claims.
 *
 *         DESIGN PROVENANCE:
 *           - Patterned on Breadchain Collective's saving-circles (MIT):
 *             per-round-per-member deposit accounting, EIP-712 signed invites,
 *             time-derived rounds, decommission-style terminal refund.
 *           - WeTrust's Quantstamp-audited ROSCA (GPL) was studied as a
 *             mechanism reference only (pre-determined rotation, delinquency
 *             bookkeeping); no code was copied. Its BIDDING mode is out of
 *             scope for v1, but the per-round `roundDeposits` amounts (rather
 *             than booleans) keep the storage shape a future bidding mode can
 *             slot into.
 *
 *         SECURITY POSTURE: SafeERC20 everywhere, ReentrancyGuard on every
 *         fund-moving path, checks-effects-interactions, pull-payments for
 *         both claims and refunds, no admin/owner (nobody can touch escrowed
 *         funds but their owners), no upgradeability, no selfdestruct.
 *         Fee-on-transfer / rebasing tokens are unsupported: deposits verify
 *         the exact received amount and revert otherwise.
 */
contract RotatingVault is IRotatingVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    /// @notice A rotation needs at least two members to mean anything.
    uint16 public constant MIN_MEMBERS = 2;

    /// @notice Bounds the O(N) first-failed-round scan and keeps pots sane.
    uint16 public constant MAX_MEMBERS = 256;

    /// @dev EIP-712 typed struct for an organizer-signed invite. The domain
    ///      (name, version, chainId, verifyingContract) prevents cross-chain
    ///      and cross-contract replay; the per-circle nonce prevents reuse.
    bytes32 private constant _INVITE_TYPEHASH =
        keccak256("Invite(uint256 circleId,address member,uint256 payoutIndex,uint256 nonce)");

    /// @dev Minimal, self-contained EIP-712 domain machinery. The repo pins
    ///      evm_version = paris (conservative Arbitrum target) and OZ 5.6's
    ///      EIP712 helper transitively imports utils/Bytes.sol, which emits
    ///      the Cancun-only `mcopy` opcode — so the ~15 lines of domain logic
    ///      live here (mirroring OZ's own cache-and-rebuild pattern) while
    ///      signature RECOVERY still uses OZ ECDSA (malleability checks etc).
    string private constant _EIP712_NAME = "RotatingVault";
    string private constant _EIP712_VERSION = "1";
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev Domain separator cached for the deployment chain; rebuilt on the
    ///      fly if block.chainid changes (post-fork replay protection).
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
    uint256 private immutable _CACHED_CHAIN_ID;

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @inheritdoc IRotatingVault
    uint256 public nextCircleId = 1; // 0 reserved as "does not exist"

    mapping(uint256 => Circle) private _circles;

    /// @notice circleId => payoutIndex => member. The ordered rotation.
    mapping(uint256 => mapping(uint16 => address)) public memberAt;

    /// @dev circleId => member => payoutIndex + 1 (0 = not a member).
    mapping(uint256 => mapping(address => uint16)) private _memberIndexPlus1;

    /// @notice circleId => round => member => amount deposited for that round.
    ///         Always 0 or exactly `depositAmount` in v1 (kept as an amount,
    ///         not a bool, so a future bidding mode can slot in).
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public roundDeposits;

    /// @notice circleId => round => how many members have funded it (O(1)
    ///         all-funded check instead of Breadchain's O(N) member loop).
    mapping(uint256 => mapping(uint256 => uint16)) public roundFundedCount;

    /// @notice circleId => round => pot already paid to the payee.
    mapping(uint256 => mapping(uint256 => bool)) public potClaimed;

    /// @notice circleId => member => lifetime amount deposited. Only ever
    ///         reduced by {refund} (down to the already-consumed floor).
    mapping(uint256 => mapping(address => uint256)) public totalDeposited;

    /// @notice circleId => invite nonce => consumed.
    mapping(uint256 => mapping(uint256 => bool)) public usedNonces;

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @dev Ownerless by design: there is no admin surface at all.
    constructor() {
        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
    }

    // ---------------------------------------------------------------------
    // Circle lifecycle: create → invite → start (or cancel)
    // ---------------------------------------------------------------------

    /// @inheritdoc IRotatingVault
    function createCircle(address token, uint256 depositAmount, uint32 roundDuration, uint16 memberTarget)
        external
        returns (uint256 circleId)
    {
        if (token == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert InvalidDepositAmount();
        if (roundDuration == 0) revert InvalidRoundDuration();
        if (memberTarget < MIN_MEMBERS || memberTarget > MAX_MEMBERS) revert InvalidMemberCount();
        // The pot (depositAmount * N) must be computable without overflow —
        // validated here so no claim can ever be stranded by checked math.
        if (depositAmount > type(uint256).max / memberTarget) revert InvalidDepositAmount();

        circleId = nextCircleId++;
        _circles[circleId] = Circle({
            organizer: msg.sender,
            status: Status.Filling,
            memberTarget: memberTarget,
            joined: 0,
            claimedCount: 0,
            token: token,
            startTime: 0,
            roundDuration: roundDuration,
            depositAmount: depositAmount
        });

        emit CircleCreated(circleId, msg.sender, token, depositAmount, roundDuration, memberTarget);
    }

    /**
     * @inheritdoc IRotatingVault
     * @dev Anyone may submit the redemption tx (gasless/relayer-friendly);
     *      the organizer's signature over (circleId, member, payoutIndex,
     *      nonce) is the sole authorization and `member` is where every right
     *      (deposit slot, pot, refund) accrues, so a leaked invite or a
     *      malicious relayer can never redirect funds.
     *
     *      There is no invite revocation in v1: the organizer's recourse for a
     *      mis-issued invite is {cancel} + recreate (no funds are at risk
     *      while Filling). ECDSA-only recovery: organizers must be EOAs
     *      (EIP-7702-delegated EOAs included, which is what Rally's email
     *      wallets are); ERC-1271 contract signers are v2.
     */
    function redeemInvite(uint256 circleId, address member, uint256 payoutIndex, uint256 nonce, bytes calldata signature)
        external
    {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        if (c.status != Status.Filling) revert NotFilling();
        if (member == address(0)) revert ZeroAddress();
        if (payoutIndex >= c.memberTarget) revert PayoutIndexOutOfRange();
        if (usedNonces[circleId][nonce]) revert InviteNonceUsed();
        // Safe: payoutIndex < memberTarget <= MAX_MEMBERS (256) checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint16 idx = uint16(payoutIndex);
        if (memberAt[circleId][idx] != address(0)) revert SlotTaken();
        if (_memberIndexPlus1[circleId][member] != 0) revert AlreadyMember();

        bytes32 digest = _hashInvite(circleId, member, payoutIndex, nonce);
        if (ECDSA.recover(digest, signature) != c.organizer) revert InvalidSigner();

        usedNonces[circleId][nonce] = true;
        memberAt[circleId][idx] = member;
        _memberIndexPlus1[circleId][member] = idx + 1;
        c.joined += 1;

        emit InviteRedeemed(circleId, member, idx, nonce);
    }

    /// @inheritdoc IRotatingVault
    function start(uint256 circleId) external {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.status != Status.Filling) revert NotFilling();
        if (c.joined != c.memberTarget) revert CircleNotFull();

        c.status = Status.Active;
        c.startTime = uint64(block.timestamp);

        emit CircleStarted(circleId, c.startTime);
    }

    /**
     * @inheritdoc IRotatingVault
     * @dev Only while Filling — no funds have ever been held, so cancelling is
     *      always safe. Deliberately impossible after {start} (see the
     *      "no organizer abort" trust note in the contract header).
     */
    function cancel(uint256 circleId) external {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        if (msg.sender != c.organizer) revert NotOrganizer();
        if (c.status != Status.Filling) revert NotFilling();

        c.status = Status.Cancelled;

        emit CircleCancelled(circleId);
    }

    // ---------------------------------------------------------------------
    // Deposits
    // ---------------------------------------------------------------------

    /// @inheritdoc IRotatingVault
    function deposit(uint256 circleId) external nonReentrant {
        _deposit(circleId, msg.sender);
    }

    /**
     * @inheritdoc IRotatingVault
     * @dev Pulls the tokens from msg.sender but credits `member` — lets a
     *      relayer/sponsor fund a member's slot (Breadchain's depositFor).
     *      Credit-only: it can never hurt the member.
     */
    function depositFor(uint256 circleId, address member) external nonReentrant {
        _deposit(circleId, member);
    }

    function _deposit(uint256 circleId, address member) private {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        if (c.status != Status.Active) revert NotActive();
        if (_lazyBroken(circleId, c)) revert CircleIsBroken();
        if (_memberIndexPlus1[circleId][member] == 0) revert NotMember();

        uint256 r = _elapsedRounds(c);
        if (r >= c.memberTarget) revert CircleExpired();
        if (roundDeposits[circleId][r][member] != 0) revert AlreadyDeposited();

        uint256 amount = c.depositAmount;
        IERC20 token = IERC20(c.token);

        // Interaction wrapped in a strict balance-delta check: deposits must
        // deliver exactly `depositAmount` (rejects fee-on-transfer tokens so
        // pot math can never be under-collateralized). Reentrancy into any
        // fund-moving function is blocked by the contract-wide guard.
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - balBefore != amount) revert UnexpectedTransferAmount();

        roundDeposits[circleId][r][member] = amount;
        totalDeposited[circleId][member] += amount;
        uint16 funded = ++roundFundedCount[circleId][r];

        emit Deposited(circleId, r, member, amount);
        if (funded == c.memberTarget) {
            emit RoundFunded(circleId, r, amount * c.memberTarget);
        }
    }

    // ---------------------------------------------------------------------
    // Claims (pull-payment; payee-only)
    // ---------------------------------------------------------------------

    /**
     * @inheritdoc IRotatingVault
     * @dev The claimed round is DERIVED from msg.sender's own payout index —
     *      there is structurally no way to claim someone else's round. The
     *      pot only exists once all N members funded the round
     *      (all-or-nothing), and a (derivedly) broken circle forecloses all
     *      claims: an unclaimed pot on a broken circle dissolves into refunds,
     *      so payees should claim promptly (the Rally frontend nudges them).
     */
    function claim(uint256 circleId) external nonReentrant {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        if (c.status != Status.Active) revert NotActive();
        if (_lazyBroken(circleId, c)) revert CircleIsBroken();

        uint16 idx1 = _memberIndexPlus1[circleId][msg.sender];
        if (idx1 == 0) revert NotMember();
        uint256 r = uint256(idx1) - 1;

        if (potClaimed[circleId][r]) revert PotAlreadyClaimed();
        if (roundFundedCount[circleId][r] < c.memberTarget) revert RoundNotFunded();

        // Effects (CEI) — mark the pot consumed before paying it out.
        potClaimed[circleId][r] = true;
        c.claimedCount += 1;
        uint256 pot = c.depositAmount * c.memberTarget; // exact: N * A, no rounding, no dust
        bool completed = c.claimedCount == c.memberTarget;
        if (completed) c.status = Status.Completed;

        IERC20(c.token).safeTransfer(msg.sender, pot);

        emit PotClaimed(circleId, r, msg.sender, pot);
        if (completed) emit CircleCompleted(circleId);
    }

    // ---------------------------------------------------------------------
    // Break + refunds (pull-payment; anyone can trigger for a member)
    // ---------------------------------------------------------------------

    /**
     * @inheritdoc IRotatingVault
     * @dev Permissionless formalization of a lazily-broken circle (indexers
     *      get the {CircleBroken} event promptly). {refund}/{refundFor} call
     *      the same transition implicitly, so this is a convenience, not a
     *      prerequisite.
     */
    function markBroken(uint256 circleId) external {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        _ensureBroken(circleId, c);
    }

    /// @inheritdoc IRotatingVault
    function refund(uint256 circleId) external nonReentrant {
        _refund(circleId, msg.sender);
    }

    /**
     * @inheritdoc IRotatingVault
     * @dev Callable by ANYONE (per spec: "anyone can trigger a refund on a
     *      broken circle") — safe because the funds only ever go to `member`.
     */
    function refundFor(uint256 circleId, address member) external nonReentrant {
        _refund(circleId, member);
    }

    function _refund(uint256 circleId, address member) private {
        Circle storage c = _circles[circleId];
        if (c.status == Status.None) revert CircleNotFound();
        _ensureBroken(circleId, c);
        if (_memberIndexPlus1[circleId][member] == 0) revert NotMember();

        // Every claimed round was fully funded by all N members, so exactly
        // claimedCount * depositAmount of this member's deposits already left
        // inside legitimately-paid pots. Everything above that floor is still
        // held by this contract and belongs back with the depositor.
        uint256 consumedFloor = uint256(c.claimedCount) * c.depositAmount;
        uint256 held = totalDeposited[circleId][member];
        if (held <= consumedFloor) revert NothingToRefund();

        uint256 owed = held - consumedFloor;
        totalDeposited[circleId][member] = consumedFloor; // effects before interaction

        IERC20(c.token).safeTransfer(member, owed);

        emit Refunded(circleId, member, owed);
    }

    /// @dev Flips a lazily-broken Active circle to stored Broken (once).
    function _ensureBroken(uint256 circleId, Circle storage c) private {
        if (c.status == Status.Broken) return;
        if (c.status != Status.Active || !_lazyBroken(circleId, c)) revert NotBroken();
        c.status = Status.Broken;
        emit CircleBroken(circleId, _firstFailedRound(circleId, c));
    }

    // ---------------------------------------------------------------------
    // Time / brokenness internals
    // ---------------------------------------------------------------------

    /// @dev Rounds elapsed since start (uncapped; may exceed memberTarget).
    ///      block.timestamp is only used at round granularity (hours/days);
    ///      sequencer timestamp drift of seconds is immaterial here.
    function _elapsedRounds(Circle storage c) private view returns (uint256) {
        return (block.timestamp - c.startTime) / c.roundDuration;
    }

    /**
     * @dev A circle is broken iff any COMPLETED round is under-funded. It
     *      suffices to check only the most recently completed round:
     *      deposits can only target the live current round and are refused the
     *      moment this check trips, so (by induction) no round after a failed
     *      one can ever receive a deposit — if any earlier round failed, the
     *      latest completed round is necessarily under-funded too. O(1).
     */
    function _lazyBroken(uint256 circleId, Circle storage c) private view returns (bool) {
        uint256 elapsed = _elapsedRounds(c);
        if (elapsed == 0) return false; // round 0's window is still open
        uint256 target = c.memberTarget;
        uint256 lastCompleted = (elapsed >= target ? target : elapsed) - 1;
        return roundFundedCount[circleId][lastCompleted] < c.memberTarget;
    }

    /// @dev The true origin of the failure (for the {CircleBroken} event):
    ///      earliest under-funded round. Bounded by MAX_MEMBERS; runs once.
    function _firstFailedRound(uint256 circleId, Circle storage c) private view returns (uint256 r) {
        uint16 target = c.memberTarget;
        for (r = 0; r < target; r++) {
            if (roundFundedCount[circleId][r] < target) return r;
        }
        // Unreachable when called under _ensureBroken's _lazyBroken guard.
        revert NotBroken();
    }

    // ---------------------------------------------------------------------
    // EIP-712
    // ---------------------------------------------------------------------

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                _DOMAIN_TYPEHASH,
                keccak256(bytes(_EIP712_NAME)),
                keccak256(bytes(_EIP712_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    function _domainSeparatorV4() private view returns (bytes32) {
        // Rebuild if the chain forked to a new chainid so old-chain invites
        // cannot be replayed here (and vice versa).
        return block.chainid == _CACHED_CHAIN_ID ? _CACHED_DOMAIN_SEPARATOR : _buildDomainSeparator();
    }

    function _hashTypedDataV4(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", _domainSeparatorV4(), structHash));
    }

    function _hashInvite(uint256 circleId, address member, uint256 payoutIndex, uint256 nonce)
        private
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(_INVITE_TYPEHASH, circleId, member, payoutIndex, nonce)));
    }

    /**
     * @notice ERC-5267 domain descriptor so signing tooling (viem/ethers
     *         signTypedData helpers, wallets) can discover the domain.
     * @dev fields = 0x0f: name, version, chainId, verifyingContract.
     */
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        )
    {
        return (hex"0f", _EIP712_NAME, _EIP712_VERSION, block.chainid, address(this), bytes32(0), new uint256[](0));
    }

    /// @inheritdoc IRotatingVault
    function inviteDigest(uint256 circleId, address member, uint256 payoutIndex, uint256 nonce)
        external
        view
        returns (bytes32)
    {
        return _hashInvite(circleId, member, payoutIndex, nonce);
    }

    /// @inheritdoc IRotatingVault
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------------
    // Views (frontend + indexer)
    // ---------------------------------------------------------------------

    /// @inheritdoc IRotatingVault
    function getCircle(uint256 circleId) external view returns (Circle memory) {
        if (_circles[circleId].status == Status.None) revert CircleNotFound();
        return _circles[circleId];
    }

    /**
     * @inheritdoc IRotatingVault
     * @notice Stored status with lazy brokenness resolved — what frontends
     *         should render. (Stored status flips on the first markBroken/refund.)
     */
    function circleStatus(uint256 circleId) public view returns (Status) {
        Circle storage c = _circles[circleId];
        if (c.status == Status.Active && _lazyBroken(circleId, c)) return Status.Broken;
        return c.status;
    }

    /// @inheritdoc IRotatingVault
    function getMembers(uint256 circleId) external view returns (address[] memory members) {
        uint16 target = _circles[circleId].memberTarget;
        members = new address[](target);
        for (uint16 i = 0; i < target; i++) {
            members[i] = memberAt[circleId][i];
        }
    }

    /// @inheritdoc IRotatingVault
    function isMember(uint256 circleId, address member) external view returns (bool) {
        return _memberIndexPlus1[circleId][member] != 0;
    }

    /// @inheritdoc IRotatingVault
    function memberIndexOf(uint256 circleId, address member) external view returns (uint16) {
        uint16 idx1 = _memberIndexPlus1[circleId][member];
        if (idx1 == 0) revert NotMember();
        return idx1 - 1;
    }

    /// @inheritdoc IRotatingVault
    function currentRound(uint256 circleId) external view returns (uint256) {
        Circle storage c = _circles[circleId];
        if (c.startTime == 0) revert NotStarted();
        return _elapsedRounds(c);
    }

    /// @inheritdoc IRotatingVault
    function roundWindow(uint256 circleId, uint256 round) external view returns (uint64 opensAt, uint64 closesAt) {
        Circle storage c = _circles[circleId];
        if (c.startTime == 0) revert NotStarted();
        if (round >= c.memberTarget) revert PayoutIndexOutOfRange();
        // Safe: round < 256 and roundDuration < 2^32, so the sum is < 2^64.
        // forge-lint: disable-start(unsafe-typecast)
        opensAt = uint64(c.startTime + round * c.roundDuration);
        closesAt = uint64(c.startTime + (round + 1) * c.roundDuration);
        // forge-lint: disable-end(unsafe-typecast)
    }

    /// @inheritdoc IRotatingVault
    function potOf(uint256 circleId) external view returns (uint256) {
        Circle storage c = _circles[circleId];
        return c.depositAmount * c.memberTarget;
    }

    /// @inheritdoc IRotatingVault
    function payeeOf(uint256 circleId, uint256 round) external view returns (address) {
        if (round >= _circles[circleId].memberTarget) return address(0);
        // Safe: round < memberTarget <= MAX_MEMBERS (256) checked above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return memberAt[circleId][uint16(round)];
    }

    /// @inheritdoc IRotatingVault
    function isRoundFunded(uint256 circleId, uint256 round) external view returns (bool) {
        Circle storage c = _circles[circleId];
        return c.memberTarget != 0 && roundFundedCount[circleId][round] == c.memberTarget;
    }

    /// @inheritdoc IRotatingVault
    function refundableAmount(uint256 circleId, address member) external view returns (uint256) {
        Circle storage c = _circles[circleId];
        bool broken = c.status == Status.Broken || (c.status == Status.Active && _lazyBroken(circleId, c));
        if (!broken) return 0;
        uint256 consumedFloor = uint256(c.claimedCount) * c.depositAmount;
        uint256 held = totalDeposited[circleId][member];
        return held > consumedFloor ? held - consumedFloor : 0;
    }
}
