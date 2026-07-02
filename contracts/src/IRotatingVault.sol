// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRotatingVault
 * @notice Interface, types, events and errors for {RotatingVault} — Rally's
 *         on-chain rotating savings circle (ROSCA / chit fund) for "Circles".
 *
 *         Lifecycle: create → invite (EIP-712) → start → [deposit* → claim]ⁿ
 *         and, on any under-funded round, → Broken → refund*.
 */
interface IRotatingVault {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /**
     * @notice Stored lifecycle state of a circle.
     * @dev `Active` is stored lazily: a circle whose latest completed round is
     *      under-funded is *derivedly* Broken even while storage still says
     *      Active. Use {RotatingVault.circleStatus} for the derived state; the
     *      stored state flips to Broken on the first {markBroken}/{refund}.
     */
    enum Status {
        None, // id not allocated
        Filling, // created; members joining via signed invites; no funds yet
        Active, // started; rounds running (may be derivedly Broken — see above)
        Broken, // a round's window closed under-funded; terminal; refunds open
        Completed, // every round's pot was claimed; terminal
        Cancelled // organizer aborted before start; terminal; no funds ever held
    }

    /**
     * @notice Core circle parameters + counters. Packs into 3 storage slots.
     * @param organizer     Creator; signs invites, may start/cancel. NOT
     *                      automatically a member (they can invite themselves).
     * @param status        Stored state (see {Status} for the lazy-Broken nuance).
     * @param memberTarget  Fixed rotation size N. Round i pays member i.
     * @param joined        Members admitted so far (== memberTarget to start).
     * @param claimedCount  Pots paid out so far (== memberTarget => Completed).
     * @param token         ERC-20 escrowed (USDC, 6 decimals, for Rally).
     * @param startTime     block.timestamp of {start}; 0 while Filling.
     * @param roundDuration Seconds per round; round r spans
     *                      [startTime + r*D, startTime + (r+1)*D).
     * @param depositAmount Exact per-member per-round contribution (token units).
     */
    struct Circle {
        address organizer;
        Status status;
        uint16 memberTarget;
        uint16 joined;
        uint16 claimedCount;
        address token;
        uint64 startTime;
        uint32 roundDuration;
        uint256 depositAmount;
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event CircleCreated(
        uint256 indexed circleId,
        address indexed organizer,
        address indexed token,
        uint256 depositAmount,
        uint32 roundDuration,
        uint16 memberTarget
    );

    event InviteRedeemed(uint256 indexed circleId, address indexed member, uint16 payoutIndex, uint256 nonce);

    event CircleStarted(uint256 indexed circleId, uint64 startTime);

    event CircleCancelled(uint256 indexed circleId);

    event Deposited(uint256 indexed circleId, uint256 indexed round, address indexed member, uint256 amount);

    /// @notice Every member has funded `round`; its pot is now claimable by the payee.
    event RoundFunded(uint256 indexed circleId, uint256 indexed round, uint256 pot);

    event PotClaimed(uint256 indexed circleId, uint256 indexed round, address indexed payee, uint256 amount);

    /// @notice A round's window closed under-funded. Terminal: refunds are open.
    event CircleBroken(uint256 indexed circleId, uint256 firstFailedRound);

    event Refunded(uint256 indexed circleId, address indexed member, uint256 amount);

    event CircleCompleted(uint256 indexed circleId);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error InvalidDepositAmount(); // zero, or pot (amount * N) would overflow
    error InvalidRoundDuration();
    error InvalidMemberCount(); // outside [MIN_MEMBERS, MAX_MEMBERS]
    error CircleNotFound();
    error NotOrganizer();
    error NotFilling(); // invite/start/cancel attempted outside Filling
    error CircleNotFull(); // start() before every slot is filled
    error NotActive(); // deposit/claim attempted on a non-Active circle
    error NotStarted(); // time-derived view on a circle with no startTime
    error NotMember();
    error AlreadyMember();
    error SlotTaken(); // payout index already redeemed
    error PayoutIndexOutOfRange();
    error InviteNonceUsed();
    error InvalidSigner(); // invite not signed by the circle's organizer
    error AlreadyDeposited(); // one exact deposit per member per round
    error CircleExpired(); // deposit after the final round's window
    error CircleIsBroken(); // deposit/claim on a (derivedly) broken circle
    error RoundNotFunded(); // claim before all N deposits for the round are in
    error PotAlreadyClaimed();
    error NotBroken(); // refund/markBroken on a healthy circle
    error NothingToRefund();
    error UnexpectedTransferAmount(); // fee-on-transfer / non-standard token

    // ---------------------------------------------------------------------
    // Mutating functions
    // ---------------------------------------------------------------------

    function createCircle(address token, uint256 depositAmount, uint32 roundDuration, uint16 memberTarget)
        external
        returns (uint256 circleId);

    function redeemInvite(uint256 circleId, address member, uint256 payoutIndex, uint256 nonce, bytes calldata signature)
        external;

    function start(uint256 circleId) external;

    function cancel(uint256 circleId) external;

    function deposit(uint256 circleId) external;

    function depositFor(uint256 circleId, address member) external;

    function claim(uint256 circleId) external;

    function markBroken(uint256 circleId) external;

    function refund(uint256 circleId) external;

    function refundFor(uint256 circleId, address member) external;

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function nextCircleId() external view returns (uint256);

    function getCircle(uint256 circleId) external view returns (Circle memory);

    function circleStatus(uint256 circleId) external view returns (Status);

    function getMembers(uint256 circleId) external view returns (address[] memory);

    function memberAt(uint256 circleId, uint16 payoutIndex) external view returns (address);

    function isMember(uint256 circleId, address member) external view returns (bool);

    function memberIndexOf(uint256 circleId, address member) external view returns (uint16);

    function currentRound(uint256 circleId) external view returns (uint256);

    function roundWindow(uint256 circleId, uint256 round) external view returns (uint64 opensAt, uint64 closesAt);

    function potOf(uint256 circleId) external view returns (uint256);

    function payeeOf(uint256 circleId, uint256 round) external view returns (address);

    function isRoundFunded(uint256 circleId, uint256 round) external view returns (bool);

    function roundDeposits(uint256 circleId, uint256 round, address member) external view returns (uint256);

    function roundFundedCount(uint256 circleId, uint256 round) external view returns (uint16);

    function potClaimed(uint256 circleId, uint256 round) external view returns (bool);

    function totalDeposited(uint256 circleId, address member) external view returns (uint256);

    function usedNonces(uint256 circleId, uint256 nonce) external view returns (bool);

    function refundableAmount(uint256 circleId, address member) external view returns (uint256);

    function inviteDigest(uint256 circleId, address member, uint256 payoutIndex, uint256 nonce)
        external
        view
        returns (bytes32);

    function domainSeparator() external view returns (bytes32);
}
