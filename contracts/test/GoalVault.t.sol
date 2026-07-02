// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GoalVault, ITokenMessengerV2} from "../src/GoalVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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

/// @dev Simulates the Circle CCTP v2 TokenMessenger burn: pulls the approved USDC
///      from the caller (the vault) and records the burn params so tests can assert
///      the mintRecipient is the backer and funds actually left the vault.
contract MockTokenMessenger is ITokenMessengerV2 {
    IERC20 public immutable usdc;

    event DepositForBurn(
        uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, uint256 maxFee
    );

    struct Burn {
        uint256 amount;
        uint32 destinationDomain;
        bytes32 mintRecipient;
        uint256 maxFee;
        uint32 minFinalityThreshold;
    }

    Burn[] public burns;

    constructor(IERC20 _usdc) {
        usdc = _usdc;
    }

    function burnsLength() external view returns (uint256) {
        return burns.length;
    }

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32, /* destinationCaller */
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external override {
        // Simulate the burn by pulling the approved USDC out of the vault.
        require(burnToken == address(usdc), "wrong token");
        usdc.transferFrom(msg.sender, address(this), amount);
        burns.push(Burn(amount, destinationDomain, mintRecipient, maxFee, minFinalityThreshold));
        emit DepositForBurn(amount, destinationDomain, mintRecipient, burnToken, maxFee);
    }
}

/// @dev USDC that re-enters GoalVault.refund() the first time it is transferred out,
///      to prove the ReentrancyGuard blocks the reentrant call.
contract ReentrantUSDC is ERC20 {
    GoalVault public vault;
    uint256 public campaignId;
    bool public armed;
    bool private _attacking;

    bool public reentrancyBlocked; // set true if the reentrant refund reverted
    bool public reentrancySucceeded; // set true if it (dangerously) did not revert

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(GoalVault _vault, uint256 _campaignId) external {
        vault = _vault;
        campaignId = _campaignId;
        armed = true;
    }

    /// @notice Entry point: this token IS a backer; it tries to refund itself and
    ///         re-enter during the payout transfer.
    function attack() external {
        vault.refund(campaignId);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (armed && !_attacking) {
            _attacking = true;
            try vault.refund(campaignId) {
                reentrancySucceeded = true;
            } catch {
                reentrancyBlocked = true;
            }
        }
        return super.transfer(to, value);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

contract GoalVaultTest is Test {
    GoalVault internal vault;
    MockUSDC internal usdc;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal beneficiary = makeAddr("beneficiary");

    // CCTP domains
    uint32 internal constant ARB = 3; // local (Arbitrum Sepolia)
    uint32 internal constant OP = 2;
    uint32 internal constant BASE = 6;
    uint32 internal constant SOL = 5;

    uint256 internal constant GOAL = 1_000e6; // 1,000 USDC (6 decimals)

    // Mirror of contract events for expectEmit.
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address indexed beneficiary,
        uint256 goal,
        uint64 deadline
    );
    event ContributionRecorded(
        uint256 indexed campaignId,
        address indexed backer,
        uint256 amount,
        uint32 indexed sourceDomain,
        uint256 newRaised,
        uint256 contributionIndex
    );
    event GoalReached(uint256 indexed campaignId, uint256 raised, uint256 goal);
    event Withdrawn(uint256 indexed campaignId, address indexed beneficiary, uint256 amount);
    event Refunded(uint256 indexed campaignId, address indexed backer, uint256 amount);
    event CrossChainRefundInitiated(
        uint256 indexed campaignId, address indexed backer, uint32 indexed destinationDomain, uint256 amount
    );

    function setUp() public {
        usdc = new MockUSDC();
        vault = new GoalVault(IERC20(address(usdc)), ARB, relayer, owner);

        // Fund same-chain backers and approve the vault.
        _fund(alice, 10_000e6);
        _fund(bob, 10_000e6);
        _fund(carol, 10_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _newCampaign(uint256 goal, uint64 duration) internal returns (uint256 id) {
        vm.prank(alice);
        id = vault.createCampaign(goal, uint64(block.timestamp) + duration, beneficiary);
    }

    /// @dev Global safety invariant: the vault can always cover what it owes.
    function _assertSolvent() internal view {
        assertGe(usdc.balanceOf(address(vault)), vault.totalEscrowed(), "insolvent: balance < escrowed");
    }

    // ------------------------------------------------------------------
    // Deployment
    // ------------------------------------------------------------------

    function test_constructor_setsState() public view {
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.LOCAL_DOMAIN(), ARB);
        assertEq(vault.relayer(), relayer);
        assertEq(vault.owner(), owner);
        assertEq(vault.nextCampaignId(), 1);
    }

    function test_constructor_revertsZeroToken() public {
        vm.expectRevert(GoalVault.ZeroAddress.selector);
        new GoalVault(IERC20(address(0)), ARB, relayer, owner);
    }

    function test_constructor_revertsZeroRelayer() public {
        vm.expectRevert(GoalVault.ZeroAddress.selector);
        new GoalVault(IERC20(address(usdc)), ARB, address(0), owner);
    }

    // ------------------------------------------------------------------
    // createCampaign
    // ------------------------------------------------------------------

    function test_createCampaign_succeeds() public {
        uint64 deadline = uint64(block.timestamp) + 3 days;
        vm.expectEmit(true, true, true, true);
        emit CampaignCreated(1, alice, beneficiary, GOAL, deadline);

        vm.prank(alice);
        uint256 id = vault.createCampaign(GOAL, deadline, beneficiary);

        assertEq(id, 1);
        (address creator, address ben, uint256 goal, uint64 dl, uint256 raised, bool withdrawn, uint32 count) =
            vault.getCampaign(id);
        assertEq(creator, alice);
        assertEq(ben, beneficiary);
        assertEq(goal, GOAL);
        assertEq(dl, deadline);
        assertEq(raised, 0);
        assertFalse(withdrawn);
        assertEq(count, 0);
        assertEq(uint256(vault.status(id)), uint256(GoalVault.Status.Active));
    }

    function test_createCampaign_incrementsIds() public {
        uint256 a = _newCampaign(GOAL, 1 days);
        uint256 b = _newCampaign(GOAL, 1 days);
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(vault.nextCampaignId(), 3);
    }

    function test_createCampaign_revertsZeroGoal() public {
        vm.prank(alice);
        vm.expectRevert(GoalVault.InvalidGoal.selector);
        vault.createCampaign(0, uint64(block.timestamp) + 1 days, beneficiary);
    }

    function test_createCampaign_revertsZeroBeneficiary() public {
        vm.prank(alice);
        vm.expectRevert(GoalVault.ZeroAddress.selector);
        vault.createCampaign(GOAL, uint64(block.timestamp) + 1 days, address(0));
    }

    function test_createCampaign_revertsPastDeadline() public {
        vm.prank(alice);
        vm.expectRevert(GoalVault.DeadlineInPast.selector);
        vault.createCampaign(GOAL, uint64(block.timestamp), beneficiary);
    }

    // ------------------------------------------------------------------
    // contribute (same-chain, trustless)
    // ------------------------------------------------------------------

    function test_contribute_creditsBackerWithLocalDomain() public {
        uint256 id = _newCampaign(GOAL, 1 days);

        vm.expectEmit(true, true, true, true);
        emit ContributionRecorded(id, alice, 250e6, ARB, 250e6, 0);

        vm.prank(alice);
        vault.contribute(id, 250e6);

        (,,,, uint256 raised,,) = vault.getCampaign(id);
        assertEq(raised, 250e6);
        assertEq(vault.contributionOf(id, alice), 250e6);
        assertEq(vault.contributionOfByDomain(id, alice, ARB), 250e6);
        assertEq(vault.totalEscrowed(), 250e6);
        assertEq(usdc.balanceOf(address(vault)), 250e6);

        uint32[] memory domains = vault.backerDomains(id, alice);
        assertEq(domains.length, 1);
        assertEq(domains[0], ARB);
        _assertSolvent();
    }

    function test_contribute_accumulatesAcrossBackers() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.prank(bob);
        vault.contribute(id, 200e6);

        (,,,, uint256 raised,, uint32 count) = vault.getCampaign(id);
        assertEq(raised, 500e6);
        assertEq(count, 2);
        assertEq(vault.contributionsCount(id), 2);
        assertEq(vault.contributionOf(id, alice), 300e6);
        assertEq(vault.contributionOf(id, bob), 200e6);
    }

    function test_contribute_revertsZeroAmount() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vm.expectRevert(GoalVault.ZeroAmount.selector);
        vault.contribute(id, 0);
    }

    function test_contribute_revertsUnknownCampaign() public {
        vm.prank(alice);
        vm.expectRevert(GoalVault.CampaignNotFound.selector);
        vault.contribute(999, 100e6);
    }

    function test_contribute_revertsAfterDeadline() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.warp(block.timestamp + 1 days); // exactly at deadline => closed
        vm.prank(alice);
        vm.expectRevert(GoalVault.CampaignClosed.selector);
        vault.contribute(id, 100e6);
    }

    function test_contribute_revertsAfterWithdraw() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL); // hits goal
        vm.prank(beneficiary);
        vault.withdraw(id);

        vm.prank(bob);
        vm.expectRevert(GoalVault.CampaignClosed.selector);
        vault.contribute(id, 10e6);
    }

    // ------------------------------------------------------------------
    // recordContribution (CCTP relayer path + bounded-trust invariant)
    // ------------------------------------------------------------------

    function test_recordContribution_attributesArrivedMint() public {
        uint256 id = _newCampaign(GOAL, 1 days);

        // Simulate a CCTP v2 mint landing at the vault from Base Sepolia.
        usdc.mint(address(vault), 400e6);

        vm.expectEmit(true, true, true, true);
        emit ContributionRecorded(id, bob, 400e6, BASE, 400e6, 0);

        vm.prank(relayer);
        vault.recordContribution(id, bob, 400e6, BASE);

        assertEq(vault.contributionOf(id, bob), 400e6);
        assertEq(vault.contributionOfByDomain(id, bob, BASE), 400e6);
        assertEq(vault.totalEscrowed(), 400e6);
        (,,,, uint256 raised,,) = vault.getCampaign(id);
        assertEq(raised, 400e6);
        _assertSolvent();
    }

    function test_recordContribution_revertsIfFundsNotArrived() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        // No mint arrived => relayer cannot conjure funds.
        vm.prank(relayer);
        vm.expectRevert(GoalVault.UnattributedFunds.selector);
        vault.recordContribution(id, bob, 400e6, BASE);
    }

    function test_recordContribution_revertsOnDoubleSpendOfSameMint() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        usdc.mint(address(vault), 400e6);

        vm.prank(relayer);
        vault.recordContribution(id, bob, 400e6, BASE);

        // The 400e6 is already attributed; a second attribution needs new funds.
        vm.prank(relayer);
        vm.expectRevert(GoalVault.UnattributedFunds.selector);
        vault.recordContribution(id, carol, 400e6, OP);
    }

    function test_recordContribution_onlyRelayer() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        usdc.mint(address(vault), 400e6);
        vm.prank(alice);
        vm.expectRevert(GoalVault.NotRelayer.selector);
        vault.recordContribution(id, bob, 400e6, BASE);
    }

    function test_recordContribution_revertsZeroBacker() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        usdc.mint(address(vault), 400e6);
        vm.prank(relayer);
        vm.expectRevert(GoalVault.ZeroAddress.selector);
        vault.recordContribution(id, address(0), 400e6, BASE);
    }

    // ------------------------------------------------------------------
    // GoalReached event
    // ------------------------------------------------------------------

    function test_goalReached_emitsExactlyOnCrossing() public {
        uint256 id = _newCampaign(GOAL, 5 days);

        vm.prank(alice);
        vault.contribute(id, 600e6); // under goal, no event

        // Crossing contribution fires GoalReached.
        vm.expectEmit(true, false, false, true);
        emit GoalReached(id, GOAL, GOAL);
        vm.prank(bob);
        vault.contribute(id, 400e6);

        assertTrue(vault.isSuccessful(id));
        assertEq(uint256(vault.status(id)), uint256(GoalVault.Status.Succeeded));
    }

    // ------------------------------------------------------------------
    // withdraw
    // ------------------------------------------------------------------

    function test_withdraw_beneficiaryOnGoalHitBeforeDeadline() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);

        uint256 balBefore = usdc.balanceOf(beneficiary);
        vm.expectEmit(true, true, false, true);
        emit Withdrawn(id, beneficiary, GOAL);
        vm.prank(beneficiary); // early withdraw allowed once goal met
        vault.withdraw(id);

        assertEq(usdc.balanceOf(beneficiary) - balBefore, GOAL);
        assertEq(vault.totalEscrowed(), 0);
        (,,,,, bool withdrawn,) = vault.getCampaign(id);
        assertTrue(withdrawn);
        _assertSolvent();
    }

    function test_withdraw_callableByCreator() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);

        vm.prank(alice); // alice is the creator; funds still go to beneficiary
        vault.withdraw(id);
        assertEq(usdc.balanceOf(beneficiary), GOAL);
    }

    function test_withdraw_revertsIfGoalNotReached() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL - 1);
        vm.prank(beneficiary);
        vm.expectRevert(GoalVault.GoalNotReached.selector);
        vault.withdraw(id);
    }

    function test_withdraw_revertsForStranger() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.prank(bob);
        vm.expectRevert(GoalVault.NotBeneficiary.selector);
        vault.withdraw(id);
    }

    function test_withdraw_revertsOnDoubleWithdraw() public {
        uint256 id = _newCampaign(GOAL, 5 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.prank(beneficiary);
        vault.withdraw(id);
        vm.prank(beneficiary);
        vm.expectRevert(GoalVault.AlreadyWithdrawn.selector);
        vault.withdraw(id);
    }

    function test_withdraw_worksAfterDeadlineWhenGoalMet() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.warp(block.timestamp + 2 days); // past deadline, still successful
        vm.prank(beneficiary);
        vault.withdraw(id);
        assertEq(usdc.balanceOf(beneficiary), GOAL);
    }

    // ------------------------------------------------------------------
    // refund (miss, local)
    // ------------------------------------------------------------------

    function test_refund_afterMiss() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.prank(bob);
        vault.contribute(id, 200e6);

        vm.warp(block.timestamp + 1 days); // deadline reached, goal missed
        assertTrue(vault.isRefundable(id));
        assertEq(uint256(vault.status(id)), uint256(GoalVault.Status.Failed));
        assertEq(vault.refundableAmount(id, alice), 300e6);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.expectEmit(true, true, false, true);
        emit Refunded(id, alice, 300e6);
        vm.prank(alice);
        vault.refund(id);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 300e6);
        assertEq(vault.contributionOf(id, alice), 0);
        assertEq(vault.contributionOfByDomain(id, alice, ARB), 0);
        assertEq(vault.totalEscrowed(), 200e6); // bob still owed
        _assertSolvent();
    }

    function test_refund_revertsBeforeDeadline() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.prank(alice);
        vm.expectRevert(GoalVault.NotFailed.selector);
        vault.refund(id);
    }

    function test_refund_revertsWhenGoalMet() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(GoalVault.NotFailed.selector);
        vault.refund(id);
    }

    function test_refund_revertsOnDoubleRefund() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vault.refund(id);
        vm.prank(alice);
        vm.expectRevert(GoalVault.NothingToRefund.selector);
        vault.refund(id);
    }

    function test_refund_revertsForNonBacker() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.warp(block.timestamp + 1 days);
        vm.prank(carol);
        vm.expectRevert(GoalVault.NothingToRefund.selector);
        vault.refund(id);
    }

    function test_refund_revertsAfterSuccessfulWithdraw() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, GOAL);
        vm.prank(beneficiary);
        vault.withdraw(id);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(GoalVault.AlreadyWithdrawn.selector);
        vault.refund(id);
    }

    function test_refundFor_onlyRelayer_returnsToBacker() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 300e6);
        vm.warp(block.timestamp + 1 days);

        // Non-relayer cannot use the convenience path.
        vm.prank(bob);
        vm.expectRevert(GoalVault.NotRelayer.selector);
        vault.refundFor(id, alice);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(relayer);
        vault.refundFor(id, alice);
        assertEq(usdc.balanceOf(alice) - aliceBefore, 300e6); // funds go to backer, not relayer
    }

    // ------------------------------------------------------------------
    // Deadline edges
    // ------------------------------------------------------------------

    function test_deadline_contributeAllowedOneSecondBefore() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.warp(block.timestamp + 1 days - 1);
        vm.prank(alice);
        vault.contribute(id, 100e6);
        assertEq(vault.contributionOf(id, alice), 100e6);
    }

    function test_deadline_refundAtExactDeadlineWhenMissed() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 100e6);
        vm.warp(block.timestamp + 1 days); // exactly deadline
        vm.prank(alice);
        vault.refund(id); // allowed
        assertEq(vault.contributionOf(id, alice), 0);
    }

    // ------------------------------------------------------------------
    // Multi-domain attribution + cross-chain refund (the CHERRY)
    // ------------------------------------------------------------------

    function test_multiDomain_attributionAndDomainList() public {
        uint256 id = _newCampaign(GOAL, 2 days);
        // Same backer contributes from three chains via CCTP mints.
        usdc.mint(address(vault), 100e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 100e6, BASE);

        usdc.mint(address(vault), 50e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 50e6, OP);

        usdc.mint(address(vault), 25e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 25e6, BASE); // same domain again

        assertEq(vault.contributionOf(id, bob), 175e6);
        assertEq(vault.contributionOfByDomain(id, bob, BASE), 125e6);
        assertEq(vault.contributionOfByDomain(id, bob, OP), 50e6);

        uint32[] memory domains = vault.backerDomains(id, bob);
        assertEq(domains.length, 2); // deduped: BASE, OP
        assertEq(domains[0], BASE);
        assertEq(domains[1], OP);
    }

    function test_refundCrossChain_burnsPerRemoteDomainToBacker() public {
        MockTokenMessenger messenger = new MockTokenMessenger(IERC20(address(usdc)));
        vm.prank(owner);
        vault.setTokenMessenger(ITokenMessengerV2(address(messenger)));

        uint256 id = _newCampaign(GOAL, 1 days);
        // bob contributes from OP + BASE + local ARB.
        usdc.mint(address(vault), 100e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 100e6, OP);
        usdc.mint(address(vault), 40e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 40e6, BASE);
        vm.prank(bob);
        vault.contribute(id, 60e6); // local ARB

        vm.warp(block.timestamp + 1 days); // miss

        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 vaultBefore = usdc.balanceOf(address(vault));

        // OP is a remote domain -> expect a burn event; assert one of them.
        vm.expectEmit(true, true, true, true);
        emit CrossChainRefundInitiated(id, bob, OP, 100e6);
        vault.refundCrossChain(id, bob); // anyone can trigger; funds only go to bob

        // Local ARB portion returned directly to bob.
        assertEq(usdc.balanceOf(bob) - bobBefore, 60e6);
        // Remote portions (OP 100 + BASE 40) were burned via the messenger.
        assertEq(messenger.burnsLength(), 2);
        assertEq(usdc.balanceOf(address(messenger)), 140e6);
        // Vault emptied of bob's stake.
        assertEq(vaultBefore - usdc.balanceOf(address(vault)), 200e6);
        assertEq(vault.contributionOf(id, bob), 0);
        assertEq(vault.totalEscrowed(), 0);

        // Verify a burn routed to bob's own address on OP.
        (uint256 amt, uint32 dstDomain, bytes32 recipient,,) = messenger.burns(0);
        assertEq(amt, 100e6);
        assertEq(dstDomain, OP);
        assertEq(recipient, bytes32(uint256(uint160(bob))));
        _assertSolvent();
    }

    function test_refundCrossChain_revertsWhenMessengerUnset() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        usdc.mint(address(vault), 100e6);
        vm.prank(relayer);
        vault.recordContribution(id, bob, 100e6, OP); // remote domain, no messenger set
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert(GoalVault.CrossChainRefundDisabled.selector);
        vault.refundCrossChain(id, bob);
    }

    function test_refundCrossChain_localOnlyNeedsNoMessenger() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(bob);
        vault.contribute(id, 100e6); // local ARB only
        vm.warp(block.timestamp + 1 days);

        uint256 bobBefore = usdc.balanceOf(bob);
        vault.refundCrossChain(id, bob); // no messenger needed for local funds
        assertEq(usdc.balanceOf(bob) - bobBefore, 100e6);
        assertEq(vault.contributionOf(id, bob), 0);
    }

    function test_refundCrossChain_revertsBeforeFailure() public {
        MockTokenMessenger messenger = new MockTokenMessenger(IERC20(address(usdc)));
        vm.prank(owner);
        vault.setTokenMessenger(ITokenMessengerV2(address(messenger)));

        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(bob);
        vault.contribute(id, 100e6);
        vm.expectRevert(GoalVault.NotFailed.selector); // still active
        vault.refundCrossChain(id, bob);
    }

    // ------------------------------------------------------------------
    // Reentrancy
    // ------------------------------------------------------------------

    function test_refund_reentrancyIsBlocked() public {
        ReentrantUSDC rusdc = new ReentrantUSDC();
        GoalVault rvault = new GoalVault(IERC20(address(rusdc)), ARB, relayer, owner);

        uint256 id;
        vm.prank(alice);
        id = rvault.createCampaign(GOAL, uint64(block.timestamp) + 1 days, beneficiary);

        // Make the malicious token itself a backer, funded via a simulated mint.
        rusdc.mint(address(rvault), 300e6);
        vm.prank(relayer);
        rvault.recordContribution(id, address(rusdc), 300e6, ARB);

        vm.warp(block.timestamp + 1 days); // miss => refundable
        rusdc.arm(rvault, id);

        // The token refunds itself; its transfer hook tries to re-enter refund().
        rusdc.attack();

        // Reentrancy was blocked, and the (single) legitimate refund still paid out.
        assertTrue(rusdc.reentrancyBlocked(), "guard did not block reentry");
        assertFalse(rusdc.reentrancySucceeded(), "reentrancy succeeded (double-spend!)");
        assertEq(rusdc.balanceOf(address(rusdc)), 300e6);
        assertEq(rvault.contributionOf(id, address(rusdc)), 0);
        assertEq(rvault.totalEscrowed(), 0);
    }

    // ------------------------------------------------------------------
    // Access control
    // ------------------------------------------------------------------

    function test_setRelayer_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setRelayer(bob);

        vm.prank(owner);
        vault.setRelayer(bob);
        assertEq(vault.relayer(), bob);
    }

    function test_setRelayer_revertsZero() public {
        vm.prank(owner);
        vm.expectRevert(GoalVault.ZeroAddress.selector);
        vault.setRelayer(address(0));
    }

    function test_setTokenMessenger_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setTokenMessenger(ITokenMessengerV2(address(0xBEEF)));

        vm.prank(owner);
        vault.setTokenMessenger(ITokenMessengerV2(address(0xBEEF)));
        assertEq(address(vault.tokenMessenger()), address(0xBEEF));
    }

    function test_setCctpRefundParams_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setCctpRefundParams(5, 500);

        vm.prank(owner);
        vault.setCctpRefundParams(5, 500);
        assertEq(vault.cctpMaxFee(), 5);
        assertEq(vault.cctpMinFinalityThreshold(), 500);
    }

    // ------------------------------------------------------------------
    // rescueExcess
    // ------------------------------------------------------------------

    function test_rescueExcess_onlyMovesSlack() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 100e6); // escrowed = 100

        usdc.mint(address(vault), 30e6); // stray transfer, unattributed slack

        vm.prank(owner);
        uint256 rescued = vault.rescueExcess(carol);
        assertEq(rescued, 30e6);
        assertEq(usdc.balanceOf(carol), 10_000e6 + 30e6);
        // Escrowed funds untouched.
        assertEq(vault.totalEscrowed(), 100e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
        _assertSolvent();
    }

    function test_rescueExcess_revertsWhenNoSlack() public {
        uint256 id = _newCampaign(GOAL, 1 days);
        vm.prank(alice);
        vault.contribute(id, 100e6);
        vm.prank(owner);
        vm.expectRevert(GoalVault.ZeroAmount.selector);
        vault.rescueExcess(carol);
    }

    function test_rescueExcess_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.rescueExcess(carol);
    }

    // ------------------------------------------------------------------
    // Fuzz + solvency
    // ------------------------------------------------------------------

    function testFuzz_contributeThenWithdrawOrRefund(uint96 a, uint96 b, bool early) public {
        uint256 amtA = uint256(a) % 5_000e6 + 1;
        uint256 amtB = uint256(b) % 5_000e6 + 1;

        uint256 id = _newCampaign(GOAL, 2 days);
        vm.prank(alice);
        vault.contribute(id, amtA);
        vm.prank(bob);
        vault.contribute(id, amtB);
        _assertSolvent();

        if (amtA + amtB >= GOAL) {
            if (!early) vm.warp(block.timestamp + 3 days);
            uint256 before = usdc.balanceOf(beneficiary);
            vm.prank(beneficiary);
            vault.withdraw(id);
            assertEq(usdc.balanceOf(beneficiary) - before, amtA + amtB);
        } else {
            vm.warp(block.timestamp + 3 days);
            uint256 aBefore = usdc.balanceOf(alice);
            vm.prank(alice);
            vault.refund(id);
            assertEq(usdc.balanceOf(alice) - aBefore, amtA);
        }
        _assertSolvent();
    }
}
