// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RotatingVault} from "../src/RotatingVault.sol";
import {IRotatingVault} from "../src/IRotatingVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/// @dev Minimal USDC-like token (6 decimals) with open minting for tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Fee-on-transfer token: skims 1 unit on every transferFrom. Used to
///      prove the strict received==amount deposit check rejects such tokens.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        super.transferFrom(from, to, value - 1); // skim 1 unit
        _burn(from, 1);
        return true;
    }
}

/// @dev Token whose outbound transfer() re-enters the vault the first time it
///      is armed, to prove the ReentrancyGuard blocks claim/refund reentry.
contract ReentrantUSDC is ERC20 {
    RotatingVault public vault;
    uint256 public circleId;

    enum Attack {
        None,
        Claim,
        Refund
    }

    Attack public mode;
    bool private _attacking;

    bool public reentrancyBlocked; // the reentrant call reverted (good)
    bool public reentrancySucceeded; // the reentrant call went through (BAD)

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(RotatingVault _vault, uint256 _circleId, Attack _mode) external {
        vault = _vault;
        circleId = _circleId;
        mode = _mode;
    }

    /// @notice This token contract doubles as the attacking member: it calls
    ///         the vault itself so the re-entered function sees a real member.
    function doClaim() external {
        vault.claim(circleId);
    }

    function doRefund() external {
        vault.refund(circleId);
    }

    function doDeposit() external {
        _approve(address(this), address(vault), type(uint256).max);
        vault.deposit(circleId);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (mode != Attack.None && !_attacking) {
            _attacking = true;
            if (mode == Attack.Claim) {
                try vault.claim(circleId) {
                    reentrancySucceeded = true;
                } catch {
                    reentrancyBlocked = true;
                }
            } else {
                try vault.refund(circleId) {
                    reentrancySucceeded = true;
                } catch {
                    reentrancyBlocked = true;
                }
            }
            _attacking = false;
        }
        return super.transfer(to, value);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

contract RotatingVaultTest is Test {
    RotatingVault internal vault;
    MockUSDC internal usdc;

    uint256 internal constant ORGANIZER_PK = 0xA11CE;
    address internal organizer;
    uint256 internal constant STRANGER_PK = 0xBEEF;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AMOUNT = 100e6; // 100 USDC (6 decimals)
    uint32 internal constant WEEK = 7 days;

    // Mirror of contract events for expectEmit.
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
    event RoundFunded(uint256 indexed circleId, uint256 indexed round, uint256 pot);
    event PotClaimed(uint256 indexed circleId, uint256 indexed round, address indexed payee, uint256 amount);
    event CircleBroken(uint256 indexed circleId, uint256 firstFailedRound);
    event Refunded(uint256 indexed circleId, address indexed member, uint256 amount);
    event CircleCompleted(uint256 indexed circleId);

    function setUp() public {
        organizer = vm.addr(ORGANIZER_PK);
        usdc = new MockUSDC();
        vault = new RotatingVault();

        _fund(alice, 10_000e6);
        _fund(bob, 10_000e6);
        _fund(carol, 10_000e6);
        _fund(dave, 10_000e6);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _signInvite(uint256 pk, uint256 circleId, address member, uint256 payoutIndex, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, vault.inviteDigest(circleId, member, payoutIndex, nonce));
        return abi.encodePacked(r, s, v);
    }

    function _join(uint256 circleId, address member, uint256 payoutIndex) internal {
        vault.redeemInvite(
            circleId, member, payoutIndex, payoutIndex, _signInvite(ORGANIZER_PK, circleId, member, payoutIndex, payoutIndex)
        );
    }

    /// @dev create + fill + start a 3-member circle [alice, bob, carol].
    function _startedCircle3() internal returns (uint256 id) {
        vm.prank(organizer);
        id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);
        _join(id, alice, 0);
        _join(id, bob, 1);
        _join(id, carol, 2);
        vm.prank(organizer);
        vault.start(id);
    }

    function _members3(uint256) internal view returns (address[3] memory) {
        return [alice, bob, carol];
    }

    function _depositAll3(uint256 id) internal {
        vm.prank(alice);
        vault.deposit(id);
        vm.prank(bob);
        vault.deposit(id);
        vm.prank(carol);
        vault.deposit(id);
    }

    /**
     * @dev THE conservation invariant (asserted after every state change in
     *      these tests): the vault's token balance for a circle always equals
     *      the sum of members' still-held deposits,
     *
     *          balance == Σ_m totalDeposited(m) − N * claimedCount * A
     *
     *      i.e. every deposited token is either still in the vault or left
     *      inside exactly one fully-funded, claimed pot. Refunds only move
     *      balances within this identity (they lower totalDeposited by the
     *      amount transferred out).
     */
    function _assertConservation(uint256 id, address[] memory members) internal view {
        IRotatingVault.Circle memory c = vault.getCircle(id);
        uint256 liability = 0;
        for (uint256 i = 0; i < members.length; i++) {
            liability += vault.totalDeposited(id, members[i]);
        }
        liability -= uint256(c.claimedCount) * c.depositAmount * c.memberTarget;
        assertEq(IERC20(c.token).balanceOf(address(vault)), liability, "conservation violated");
    }

    function _assertConservation3(uint256 id) internal view {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;
        _assertConservation(id, m);
    }

    // ------------------------------------------------------------------
    // createCircle
    // ------------------------------------------------------------------

    function test_createCircle_succeeds() public {
        vm.expectEmit(true, true, true, true);
        emit CircleCreated(1, organizer, address(usdc), AMOUNT, WEEK, 3);

        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        assertEq(id, 1);
        assertEq(vault.nextCircleId(), 2);
        IRotatingVault.Circle memory c = vault.getCircle(id);
        assertEq(c.organizer, organizer);
        assertEq(c.token, address(usdc));
        assertEq(c.depositAmount, AMOUNT);
        assertEq(c.roundDuration, WEEK);
        assertEq(c.memberTarget, 3);
        assertEq(c.joined, 0);
        assertEq(c.startTime, 0);
        assertEq(uint256(c.status), uint256(IRotatingVault.Status.Filling));
        assertEq(vault.potOf(id), 300e6);
    }

    function test_createCircle_validation() public {
        vm.expectRevert(IRotatingVault.ZeroAddress.selector);
        vault.createCircle(address(0), AMOUNT, WEEK, 3);

        vm.expectRevert(IRotatingVault.InvalidDepositAmount.selector);
        vault.createCircle(address(usdc), 0, WEEK, 3);

        vm.expectRevert(IRotatingVault.InvalidRoundDuration.selector);
        vault.createCircle(address(usdc), AMOUNT, 0, 3);

        vm.expectRevert(IRotatingVault.InvalidMemberCount.selector);
        vault.createCircle(address(usdc), AMOUNT, WEEK, 1);

        vm.expectRevert(IRotatingVault.InvalidMemberCount.selector);
        vault.createCircle(address(usdc), AMOUNT, WEEK, 257);

        // pot overflow guard: amount * N must not overflow
        vm.expectRevert(IRotatingVault.InvalidDepositAmount.selector);
        vault.createCircle(address(usdc), type(uint256).max / 2, WEEK, 3);
    }

    function test_getCircle_revertsUnknownId() public {
        vm.expectRevert(IRotatingVault.CircleNotFound.selector);
        vault.getCircle(42);
    }

    // ------------------------------------------------------------------
    // EIP-712 invites
    // ------------------------------------------------------------------

    function test_inviteDigest_matchesManualEip712Encoding() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        // Pin the exact EIP-712 encoding (domain + struct) independently of
        // the contract's own implementation.
        bytes32 domainSep = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("RotatingVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(vault)
            )
        );
        assertEq(vault.domainSeparator(), domainSep, "domain separator mismatch");

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Invite(uint256 circleId,address member,uint256 payoutIndex,uint256 nonce)"),
                id,
                alice,
                uint256(0),
                uint256(77)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSep, structHash));
        assertEq(vault.inviteDigest(id, alice, 0, 77), digest, "typed data digest mismatch");
    }

    function test_redeemInvite_succeeds_andAnyoneMaySubmit() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        bytes memory sig = _signInvite(ORGANIZER_PK, id, alice, 0, 1);

        vm.expectEmit(true, true, true, true);
        emit InviteRedeemed(id, alice, 0, 1);

        // A relayer (stranger) submits the redemption — gasless composability.
        vm.prank(stranger);
        vault.redeemInvite(id, alice, 0, 1, sig);

        assertTrue(vault.isMember(id, alice));
        assertEq(vault.memberIndexOf(id, alice), 0);
        assertEq(vault.memberAt(id, 0), alice);
        assertTrue(vault.usedNonces(id, 1));
        assertEq(vault.getCircle(id).joined, 1);
    }

    function test_redeemInvite_rejectsWrongSigner() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        bytes memory sig = _signInvite(STRANGER_PK, id, alice, 0, 1);
        vm.expectRevert(IRotatingVault.InvalidSigner.selector);
        vault.redeemInvite(id, alice, 0, 1, sig);
    }

    function test_redeemInvite_rejectsTamperedFields() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        // Signed for alice/slot0/nonce1 — any tampered field must fail.
        bytes memory sig = _signInvite(ORGANIZER_PK, id, alice, 0, 1);

        vm.expectRevert(IRotatingVault.InvalidSigner.selector);
        vault.redeemInvite(id, bob, 0, 1, sig); // wrong member

        vm.expectRevert(IRotatingVault.InvalidSigner.selector);
        vault.redeemInvite(id, alice, 1, 1, sig); // wrong slot

        vm.expectRevert(IRotatingVault.InvalidSigner.selector);
        vault.redeemInvite(id, alice, 0, 2, sig); // wrong nonce
    }

    function test_redeemInvite_rejectsReplayAndCollisions() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        _join(id, alice, 0);

        // same nonce replay
        bytes memory sig = _signInvite(ORGANIZER_PK, id, bob, 1, 0);
        vm.expectRevert(IRotatingVault.InviteNonceUsed.selector);
        vault.redeemInvite(id, bob, 1, 0, sig);

        // occupied slot
        sig = _signInvite(ORGANIZER_PK, id, bob, 0, 9);
        vm.expectRevert(IRotatingVault.SlotTaken.selector);
        vault.redeemInvite(id, bob, 0, 9, sig);

        // duplicate member
        sig = _signInvite(ORGANIZER_PK, id, alice, 1, 9);
        vm.expectRevert(IRotatingVault.AlreadyMember.selector);
        vault.redeemInvite(id, alice, 1, 9, sig);

        // out-of-range slot
        sig = _signInvite(ORGANIZER_PK, id, bob, 3, 9);
        vm.expectRevert(IRotatingVault.PayoutIndexOutOfRange.selector);
        vault.redeemInvite(id, bob, 3, 9, sig);
    }

    function test_redeemInvite_rejectsAfterStartOrCancel() public {
        uint256 id = _startedCircle3();
        bytes memory sig = _signInvite(ORGANIZER_PK, id, dave, 0, 9);
        vm.expectRevert(IRotatingVault.NotFilling.selector);
        vault.redeemInvite(id, dave, 0, 9, sig);

        vm.prank(organizer);
        uint256 id2 = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);
        vm.prank(organizer);
        vault.cancel(id2);
        sig = _signInvite(ORGANIZER_PK, id2, dave, 0, 9);
        vm.expectRevert(IRotatingVault.NotFilling.selector);
        vault.redeemInvite(id2, dave, 0, 9, sig);
    }

    // ------------------------------------------------------------------
    // start / cancel
    // ------------------------------------------------------------------

    function test_start_requiresOrganizerAndFullCircle() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);
        _join(id, alice, 0);

        vm.prank(alice);
        vm.expectRevert(IRotatingVault.NotOrganizer.selector);
        vault.start(id);

        vm.prank(organizer);
        vm.expectRevert(IRotatingVault.CircleNotFull.selector);
        vault.start(id);

        _join(id, bob, 1);
        _join(id, carol, 2);

        vm.expectEmit(true, false, false, true);
        emit CircleStarted(id, uint64(block.timestamp));
        vm.prank(organizer);
        vault.start(id);

        IRotatingVault.Circle memory c = vault.getCircle(id);
        assertEq(uint256(c.status), uint256(IRotatingVault.Status.Active));
        assertEq(c.startTime, uint64(block.timestamp));
        assertEq(vault.currentRound(id), 0);

        // can't start twice
        vm.prank(organizer);
        vm.expectRevert(IRotatingVault.NotFilling.selector);
        vault.start(id);
    }

    function test_cancel_onlyWhileFilling() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);

        vm.prank(alice);
        vm.expectRevert(IRotatingVault.NotOrganizer.selector);
        vault.cancel(id);

        vm.prank(organizer);
        vault.cancel(id);
        assertEq(uint256(vault.getCircle(id).status), uint256(IRotatingVault.Status.Cancelled));

        uint256 id2 = _startedCircle3();
        vm.prank(organizer);
        vm.expectRevert(IRotatingVault.NotFilling.selector);
        vault.cancel(id2);
    }

    // ------------------------------------------------------------------
    // Full-circle happy path: N members, all rounds rotate + pay out
    // ------------------------------------------------------------------

    function test_fullCircle_rotatesEveryPotToItsPayee() public {
        uint256 id = _startedCircle3();
        address[3] memory members = [alice, bob, carol];
        uint256[3] memory startBal =
            [usdc.balanceOf(alice), usdc.balanceOf(bob), usdc.balanceOf(carol)];
        uint256 pot = 3 * AMOUNT;

        for (uint256 r = 0; r < 3; r++) {
            assertEq(vault.currentRound(id), r);
            assertEq(vault.payeeOf(id, r), members[r]);

            // everyone funds round r
            for (uint256 i = 0; i < 3; i++) {
                vm.prank(members[i]);
                vault.deposit(id);
                _assertConservation3(id);
            }
            assertTrue(vault.isRoundFunded(id, r));

            // only the designated payee gets the full pot
            uint256 balBefore = usdc.balanceOf(members[r]);
            vm.expectEmit(true, true, true, true);
            emit PotClaimed(id, r, members[r], pot);
            vm.prank(members[r]);
            vault.claim(id);
            assertEq(usdc.balanceOf(members[r]) - balBefore, pot, "payee did not receive exact pot");
            _assertConservation3(id);

            vm.warp(block.timestamp + WEEK);
        }

        // Completed; vault fully drained; every member is net zero
        // (deposited 3*A across the circle, received one 3*A pot).
        assertEq(uint256(vault.getCircle(id).status), uint256(IRotatingVault.Status.Completed));
        assertEq(usdc.balanceOf(address(vault)), 0, "vault must end empty");
        for (uint256 i = 0; i < 3; i++) {
            assertEq(usdc.balanceOf(members[i]), startBal[i], "member not net zero");
        }
    }

    function test_claim_worksLateOnHealthyCircle() public {
        uint256 id = _startedCircle3();
        address[3] memory members = [alice, bob, carol];

        // fund all three rounds; nobody claims during the circle
        for (uint256 r = 0; r < 3; r++) {
            for (uint256 i = 0; i < 3; i++) {
                vm.prank(members[i]);
                vault.deposit(id);
            }
            vm.warp(block.timestamp + WEEK);
        }

        // long after the circle ended, pots are still claimable (never broken)
        vm.warp(block.timestamp + 52 weeks);
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(members[i]);
            vault.claim(id);
            _assertConservation3(id);
        }
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint256(vault.getCircle(id).status), uint256(IRotatingVault.Status.Completed));
    }

    // ------------------------------------------------------------------
    // Deposit rules
    // ------------------------------------------------------------------

    function test_deposit_rules() public {
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);
        _join(id, alice, 0);

        // before start
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.NotActive.selector);
        vault.deposit(id);

        _join(id, bob, 1);
        _join(id, carol, 2);
        vm.prank(organizer);
        vault.start(id);

        // non-member
        vm.prank(stranger);
        vm.expectRevert(IRotatingVault.NotMember.selector);
        vault.deposit(id);

        // double deposit in the same round
        vm.prank(alice);
        vault.deposit(id);
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.AlreadyDeposited.selector);
        vault.deposit(id);

        // unknown circle
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.CircleNotFound.selector);
        vault.deposit(999);
    }

    function test_deposit_afterFinalRoundReverts() public {
        uint256 id = _startedCircle3();
        address[3] memory members = [alice, bob, carol];

        for (uint256 r = 0; r < 3; r++) {
            for (uint256 i = 0; i < 3; i++) {
                vm.prank(members[i]);
                vault.deposit(id);
            }
            vm.warp(block.timestamp + WEEK);
        }

        // circle time is over (still healthy) — no round to deposit into
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.CircleExpired.selector);
        vault.deposit(id);
    }

    function test_depositFor_creditsMemberNotSender() public {
        uint256 id = _startedCircle3();
        _fund(stranger, 1_000e6);

        vm.prank(stranger);
        vault.depositFor(id, alice);

        assertEq(vault.roundDeposits(id, 0, alice), AMOUNT);
        assertEq(vault.totalDeposited(id, alice), AMOUNT);
        assertEq(vault.roundDeposits(id, 0, stranger), 0);
    }

    function test_deposit_rejectsFeeOnTransferToken() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(fee), AMOUNT, WEEK, 2);
        _join(id, alice, 0);
        _join(id, bob, 1);
        vm.prank(organizer);
        vault.start(id);

        fee.mint(alice, 1_000e6);
        vm.startPrank(alice);
        fee.approve(address(vault), type(uint256).max);
        vm.expectRevert(IRotatingVault.UnexpectedTransferAmount.selector);
        vault.deposit(id);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Access control on claims
    // ------------------------------------------------------------------

    function test_claim_accessControl() public {
        uint256 id = _startedCircle3();
        _depositAll3(id);

        // a stranger cannot claim at all
        vm.prank(stranger);
        vm.expectRevert(IRotatingVault.NotMember.selector);
        vault.claim(id);

        // bob is a member but NOT round 0's payee: his claim targets his own
        // round (1), which is not funded — there is structurally no way to
        // touch alice's pot.
        vm.prank(bob);
        vm.expectRevert(IRotatingVault.RoundNotFunded.selector);
        vault.claim(id);

        // the payee claims; a second claim reverts
        vm.prank(alice);
        vault.claim(id);
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.PotAlreadyClaimed.selector);
        vault.claim(id);
    }

    function test_claim_revertsWhileRoundUnderfunded() public {
        uint256 id = _startedCircle3();
        vm.prank(alice);
        vault.deposit(id);
        vm.prank(bob);
        vault.deposit(id);
        // carol hasn't funded round 0 yet — no partial payout, ever.
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.RoundNotFunded.selector);
        vault.claim(id);
    }

    // ------------------------------------------------------------------
    // Failed round → Broken → refunds (conservation of funds)
    // ------------------------------------------------------------------

    function test_failedFirstRound_everyDepositorRefundedExactly() public {
        uint256 id = _startedCircle3();

        // alice and bob fund round 0; carol defaults
        vm.prank(alice);
        vault.deposit(id);
        vm.prank(bob);
        vault.deposit(id);
        _assertConservation3(id);

        // window still open → not broken yet
        assertEq(uint256(vault.circleStatus(id)), uint256(IRotatingVault.Status.Active));
        vm.expectRevert(IRotatingVault.NotBroken.selector);
        vault.markBroken(id);
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.NotBroken.selector);
        vault.refund(id);

        // round 0 window closes under-funded → circle is (derivedly) broken
        vm.warp(block.timestamp + WEEK);
        assertEq(uint256(vault.circleStatus(id)), uint256(IRotatingVault.Status.Broken));

        // no more deposits, no claims — the round pays out to NO ONE
        vm.prank(carol);
        vm.expectRevert(IRotatingVault.CircleIsBroken.selector);
        vault.deposit(id);
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.CircleIsBroken.selector);
        vault.claim(id);

        // anyone can formalize the break
        vm.expectEmit(true, false, false, true);
        emit CircleBroken(id, 0);
        vm.prank(stranger);
        vault.markBroken(id);

        // refunds: each depositor gets back exactly what they put in
        uint256 aliceBefore = usdc.balanceOf(alice);
        assertEq(vault.refundableAmount(id, alice), AMOUNT);
        vm.prank(alice);
        vault.refund(id);
        assertEq(usdc.balanceOf(alice) - aliceBefore, AMOUNT);
        _assertConservation3(id);

        // double refund blocked
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.NothingToRefund.selector);
        vault.refund(id);

        // anyone can trigger bob's refund; funds go to bob only
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(stranger);
        vault.refundFor(id, bob);
        assertEq(usdc.balanceOf(bob) - bobBefore, AMOUNT);
        _assertConservation3(id);

        // carol never deposited → nothing to refund
        assertEq(vault.refundableAmount(id, carol), 0);
        vm.prank(carol);
        vm.expectRevert(IRotatingVault.NothingToRefund.selector);
        vault.refund(id);

        // perfect conservation: the vault ends empty, nobody over/under-paid
        assertEq(usdc.balanceOf(address(vault)), 0, "vault must end empty after refunds");
    }

    function test_failedMidCircle_refundsExcludeAlreadyPaidPots() public {
        uint256 id = _startedCircle3();
        uint256[3] memory startBal =
            [usdc.balanceOf(alice), usdc.balanceOf(bob), usdc.balanceOf(carol)];

        // Round 0 completes and alice claims her pot.
        _depositAll3(id);
        vm.prank(alice);
        vault.claim(id);
        _assertConservation3(id);

        // Round 1: alice and bob fund; carol defaults; window closes.
        vm.warp(block.timestamp + WEEK);
        vm.prank(alice);
        vault.deposit(id);
        vm.prank(bob);
        vault.deposit(id);
        vm.warp(block.timestamp + WEEK);

        assertEq(uint256(vault.circleStatus(id)), uint256(IRotatingVault.Status.Broken));
        vm.expectEmit(true, false, false, true);
        emit CircleBroken(id, 1); // round 1 is the true failure origin
        vault.markBroken(id);

        // Refundable = still-held deposits only: round-0 deposits left inside
        // alice's legitimately-claimed pot and are NOT clawed back.
        assertEq(vault.refundableAmount(id, alice), AMOUNT); // her round-1 deposit
        assertEq(vault.refundableAmount(id, bob), AMOUNT); // his round-1 deposit
        assertEq(vault.refundableAmount(id, carol), 0); // round-0 deposit was consumed by the paid pot

        vm.prank(alice);
        vault.refund(id);
        _assertConservation3(id);
        vm.prank(bob);
        vault.refund(id);
        _assertConservation3(id);
        vm.prank(carol);
        vm.expectRevert(IRotatingVault.NothingToRefund.selector);
        vault.refund(id);

        assertEq(usdc.balanceOf(address(vault)), 0, "vault must end empty");

        // Net outcomes (documented ROSCA semantics, not a bug): completed
        // rounds are final. alice: -A(r0) +3A(pot) -A(r1) +A(refund) = +2A.
        // bob: -A -A +A = -A. carol (defaulter): -A.
        assertEq(usdc.balanceOf(alice), startBal[0] + 2 * AMOUNT);
        assertEq(usdc.balanceOf(bob), startBal[1] - AMOUNT);
        assertEq(usdc.balanceOf(carol), startBal[2] - AMOUNT);
    }

    function test_brokenCircle_foreclosesUnclaimedEarlierPot() public {
        uint256 id = _startedCircle3();

        // Round 0 fully funded but alice does NOT claim.
        _depositAll3(id);

        // Round 1 fails outright (nobody deposits).
        vm.warp(block.timestamp + 2 * WEEK);
        assertEq(uint256(vault.circleStatus(id)), uint256(IRotatingVault.Status.Broken));

        // Her unclaimed pot dissolved into refunds — claim is foreclosed…
        vm.prank(alice);
        vm.expectRevert(IRotatingVault.CircleIsBroken.selector);
        vault.claim(id);

        // …and every round-0 depositor pulls their deposit back instead.
        address[3] memory members = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) {
            assertEq(vault.refundableAmount(id, members[i]), AMOUNT);
            vm.prank(members[i]);
            vault.refund(id);
            _assertConservation3(id);
        }
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function test_brokenDetection_lateFormalizationFindsTrueOrigin() public {
        uint256 id = _startedCircle3();
        // Round 0 funded; rounds 1..2 pass with zero activity.
        _depositAll3(id);
        vm.warp(block.timestamp + 10 * WEEK); // way past the circle's end

        vm.expectEmit(true, false, false, true);
        emit CircleBroken(id, 1); // first failed round is 1, not 2
        vault.markBroken(id);
        assertEq(uint256(vault.getCircle(id).status), uint256(IRotatingVault.Status.Broken));
    }

    // ------------------------------------------------------------------
    // Reentrancy
    // ------------------------------------------------------------------

    function test_reentrancy_claimBlocked() public {
        ReentrantUSDC evil = new ReentrantUSDC();
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(evil), AMOUNT, WEEK, 2);

        // the token contract itself is member 0 (payee of round 0)
        _join(id, address(evil), 0);
        _join(id, bob, 1);
        vm.prank(organizer);
        vault.start(id);

        evil.mint(address(evil), 1_000e6);
        evil.mint(bob, 1_000e6);
        evil.arm(vault, id, ReentrantUSDC.Attack.None); // wire up, no attack yet
        evil.doDeposit();
        vm.startPrank(bob);
        evil.approve(address(vault), type(uint256).max);
        vault.deposit(id);
        vm.stopPrank();

        // pot transfer to the token re-enters claim() mid-transfer
        evil.arm(vault, id, ReentrantUSDC.Attack.Claim);
        evil.doClaim();

        assertTrue(evil.reentrancyBlocked(), "reentrant claim must revert");
        assertFalse(evil.reentrancySucceeded(), "reentrant claim must not succeed");
        assertEq(evil.balanceOf(address(vault)), 0, "vault paid the pot exactly once");
    }

    function test_reentrancy_refundBlocked() public {
        ReentrantUSDC evil = new ReentrantUSDC();
        vm.prank(organizer);
        uint256 id = vault.createCircle(address(evil), AMOUNT, WEEK, 2);

        _join(id, address(evil), 0);
        _join(id, bob, 1);
        vm.prank(organizer);
        vault.start(id);

        evil.mint(address(evil), 1_000e6);
        evil.arm(vault, id, ReentrantUSDC.Attack.None); // wire up, no attack yet
        evil.doDeposit(); // only the token-member deposits; bob defaults
        vm.warp(block.timestamp + WEEK); // round 0 fails → broken

        evil.arm(vault, id, ReentrantUSDC.Attack.Refund);
        evil.doRefund();

        assertTrue(evil.reentrancyBlocked(), "reentrant refund must revert");
        assertFalse(evil.reentrancySucceeded(), "reentrant refund must not succeed");
        assertEq(evil.balanceOf(address(vault)), 0, "vault refunded exactly once");
    }

    // ------------------------------------------------------------------
    // Multiple circles coexist independently
    // ------------------------------------------------------------------

    function test_multipleCircles_independentAccounting() public {
        uint256 idA = _startedCircle3();

        vm.prank(organizer);
        uint256 idB = vault.createCircle(address(usdc), 50e6, 2 * WEEK, 2);
        _join(idB, dave, 0);
        _join(idB, alice, 1);
        vm.prank(organizer);
        vault.start(idB);

        _depositAll3(idA); // circle A round 0 funded
        vm.prank(dave);
        vault.deposit(idB);
        vm.prank(alice);
        vault.deposit(idB); // circle B round 0 funded

        assertEq(usdc.balanceOf(address(vault)), 3 * AMOUNT + 2 * 50e6);

        vm.prank(alice);
        vault.claim(idA);
        vm.prank(dave);
        vault.claim(idB);

        // each circle paid exactly its own pot
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(vault.totalDeposited(idA, alice), AMOUNT);
        assertEq(vault.totalDeposited(idB, alice), 50e6);
    }

    // ------------------------------------------------------------------
    // Fuzz: deposit/claim ordering never breaks payouts or conservation
    // ------------------------------------------------------------------

    /// @dev Whatever order members deposit in each round, and whenever payees
    ///      claim (immediately or rounds later), every payee ends up with
    ///      exactly one full pot and the vault ends empty.
    function testFuzz_depositClaimOrdering(uint256 seed) public {
        uint256 id = _startedCircle3();
        address[3] memory members = [alice, bob, carol];
        uint256[3] memory startBal =
            [usdc.balanceOf(alice), usdc.balanceOf(bob), usdc.balanceOf(carol)];
        bool[3] memory claimed;

        for (uint256 r = 0; r < 3; r++) {
            // permute deposit order with the fuzzed seed
            uint256 first = uint256(keccak256(abi.encode(seed, r))) % 3;
            for (uint256 k = 0; k < 3; k++) {
                vm.prank(members[(first + k) % 3]);
                vault.deposit(id);
                _assertConservation3(id);
            }

            // each already-eligible payee flips a fuzzed coin to claim now
            for (uint256 p = 0; p <= r; p++) {
                if (!claimed[p] && uint256(keccak256(abi.encode(seed, r, p))) % 2 == 0) {
                    vm.prank(members[p]);
                    vault.claim(id);
                    claimed[p] = true;
                    _assertConservation3(id);
                }
            }
            vm.warp(block.timestamp + WEEK);
        }

        // sweep the stragglers after the circle's time has fully elapsed
        for (uint256 p = 0; p < 3; p++) {
            if (!claimed[p]) {
                vm.prank(members[p]);
                vault.claim(id);
                _assertConservation3(id);
            }
        }

        assertEq(usdc.balanceOf(address(vault)), 0, "vault must end empty");
        assertEq(uint256(vault.getCircle(id).status), uint256(IRotatingVault.Status.Completed));
        for (uint256 i = 0; i < 3; i++) {
            assertEq(usdc.balanceOf(members[i]), startBal[i], "member not net zero");
        }
    }

    /// @dev Any defaulter, any failed round, any subset of eager claimers:
    ///      the break always refunds exactly every still-held deposit and the
    ///      vault always drains to zero. (Fuzzed over a 4-member circle.)
    function testFuzz_failedRound_refundConservation(uint8 defaulterSeed, uint8 failRoundSeed, uint8 claimMask)
        public
    {
        address[4] memory members = [alice, bob, carol, dave];
        uint256 defaulter = uint256(defaulterSeed) % 4;
        uint256 failRound = uint256(failRoundSeed) % 4;

        vm.prank(organizer);
        uint256 id = vault.createCircle(address(usdc), AMOUNT, WEEK, 4);
        for (uint256 i = 0; i < 4; i++) {
            _join(id, members[i], i);
        }
        vm.prank(organizer);
        vault.start(id);

        uint256[4] memory balAfterStart =
            [usdc.balanceOf(alice), usdc.balanceOf(bob), usdc.balanceOf(carol), usdc.balanceOf(dave)];
        uint256 claimedCount = 0;

        // healthy rounds before the failure — payee claims iff their mask bit is set
        for (uint256 r = 0; r < failRound; r++) {
            for (uint256 i = 0; i < 4; i++) {
                vm.prank(members[i]);
                vault.deposit(id);
            }
            if (claimMask & (1 << r) != 0) {
                vm.prank(members[r]);
                vault.claim(id);
                claimedCount++;
            }
            vm.warp(block.timestamp + WEEK);
        }

        // the failed round: everyone but the defaulter deposits
        for (uint256 i = 0; i < 4; i++) {
            if (i == defaulter) continue;
            vm.prank(members[i]);
            vault.deposit(id);
        }
        vm.warp(block.timestamp + WEEK);

        assertEq(uint256(vault.circleStatus(id)), uint256(IRotatingVault.Status.Broken));

        // conservation across the break: refunds must exactly drain the vault
        uint256 vaultBal = usdc.balanceOf(address(vault));
        uint256 totalRefunded = 0;
        for (uint256 i = 0; i < 4; i++) {
            uint256 deposits = failRound + (i == defaulter ? 0 : 1); // rounds funded by member i
            uint256 expected = (deposits - claimedCount) * AMOUNT; // minus consumed-by-paid-pots floor
            assertEq(vault.refundableAmount(id, members[i]), expected, "refundable mismatch");
            if (expected > 0) {
                vm.prank(stranger);
                vault.refundFor(id, members[i]);
                totalRefunded += expected;
            }
        }
        assertEq(totalRefunded, vaultBal, "refunds != held balance");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault must end empty");

        // no one was over/under-paid: final balance == start - deposits + refund (+ pot if claimed)
        for (uint256 i = 0; i < 4; i++) {
            uint256 deposits = failRound + (i == defaulter ? 0 : 1);
            uint256 expectedFinal = balAfterStart[i] - deposits * AMOUNT // everything they put in
                + (deposits - claimedCount) * AMOUNT // refund of still-held deposits
                + (i < failRound && (claimMask & (1 << i) != 0) ? 4 * AMOUNT : 0); // pot if they claimed
            assertEq(usdc.balanceOf(members[i]), expectedFinal, "member over/under-paid");
        }
    }
}
