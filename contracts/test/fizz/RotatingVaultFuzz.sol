// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RotatingVault} from "../../src/RotatingVault.sol";
import {IRotatingVault} from "../../src/IRotatingVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*//////////////////////////////////////////////////////////////////////////
                    Rally · RotatingVault stateful fuzz harness
    ---------------------------------------------------------------------------
    Echidna / Medusa compatible (hevm cheatcodes). Also driven by Foundry's
    invariant engine via RotatingVaultInvariant.t.sol.

    A 3-member circle is seeded in the constructor (org-signed EIP-712 invites
    with a far expiry) so handlers can stress deposit / claim / claimFor /
    break / refund without needing multi-sender orchestration. The harness
    fronts every deposit via {depositFor}; claims use {claimFor} so payouts
    still land on the designated payee.

    INVARIANTS:
      echidna_conservation   vault.balance == Σ totalDeposited − claimedCount·A·N
      echidna_no_stray_payout  a successful claimFor never credits the harness
      echidna_refund_floor     refundable ≤ still-held deposits
//////////////////////////////////////////////////////////////////////////*/

contract FuzzUSDC is ERC20 {
    constructor() ERC20("Fuzz USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

interface IHevm {
    function warp(uint256) external;
    function roll(uint256) external;
    function prank(address) external;
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
}

contract RotatingVaultFuzz {
    IHevm internal constant vm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint256 internal constant ORG_PK = 0xA11CE;
    uint256 internal constant AMOUNT = 100e6;
    uint32 internal constant WEEK = 7 days;

    RotatingVault public vault;
    FuzzUSDC public usdc;
    address public organizer;
    address public alice;
    address public bob;
    address public carol;
    uint256 public circleId;

    uint256 public ghost_claimedPots;
    uint256 public ghost_harnessGain; // must stay 0 — claimFor must not pay us

    constructor() {
        usdc = new FuzzUSDC();
        vault = new RotatingVault();
        organizer = vm.addr(ORG_PK);
        alice = address(uint160(uint256(keccak256("alice"))));
        bob = address(uint160(uint256(keccak256("bob"))));
        carol = address(uint160(uint256(keccak256("carol"))));

        usdc.mint(address(this), 1_000_000_000e6);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(organizer);
        circleId = vault.createCircle(address(usdc), AMOUNT, WEEK, 3);
        _join(alice, 0, 0);
        _join(bob, 1, 1);
        _join(carol, 2, 2);
        vm.prank(organizer);
        vault.start(circleId);
    }

    function _join(address member, uint256 payoutIndex, uint256 nonce) internal {
        uint256 expiresAt = block.timestamp + 365 days;
        bytes32 digest = vault.inviteDigest(circleId, member, payoutIndex, nonce, expiresAt);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORG_PK, digest);
        vault.redeemInvite(circleId, member, payoutIndex, nonce, expiresAt, abi.encodePacked(r, s, v));
    }

    function _member(uint256 seed) internal view returns (address) {
        address[3] memory m = [alice, bob, carol];
        return m[seed % 3];
    }

    function _clamp(uint256 x, uint256 lo, uint256 hi) internal pure returns (uint256) {
        if (hi <= lo) return lo;
        return lo + (x % (hi - lo + 1));
    }

    function h_deposit(uint256 memberSeed) external {
        address m = _member(memberSeed);
        try vault.depositFor(circleId, m) {} catch {}
    }

    function h_claimFor(uint256 memberSeed) external {
        address payee = _member(memberSeed);
        uint256 payeeBefore = usdc.balanceOf(payee);
        uint256 usBefore = usdc.balanceOf(address(this));
        try vault.claimFor(circleId, payee) {
            ghost_claimedPots += 1;
            if (usdc.balanceOf(address(this)) > usBefore) {
                ghost_harnessGain += usdc.balanceOf(address(this)) - usBefore;
            }
            // pot must have moved to the payee, not the caller
            assert(usdc.balanceOf(payee) >= payeeBefore);
        } catch {}
    }

    function h_claim_self() external {
        // harness is not a member — must revert; counted only if it wrongly succeeds
        try vault.claim(circleId) {
            ghost_harnessGain += 1;
        } catch {}
    }

    function h_refundFor(uint256 memberSeed) external {
        address m = _member(memberSeed);
        try vault.refundFor(circleId, m) {} catch {}
    }

    function h_markBroken() external {
        try vault.markBroken(circleId) {} catch {}
    }

    function h_warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + _clamp(secondsSeed, 1, 14 days));
    }

    /// INV-1: every deposited token is still in the vault or left inside a claimed pot.
    function echidna_conservation() public view returns (bool) {
        IRotatingVault.Circle memory c = vault.getCircle(circleId);
        uint256 liability = vault.totalDeposited(circleId, alice) + vault.totalDeposited(circleId, bob)
            + vault.totalDeposited(circleId, carol);
        liability -= uint256(c.claimedCount) * c.depositAmount * c.memberTarget;
        return usdc.balanceOf(address(vault)) == liability;
    }

    /// INV-2: permissionless claimFor never pays the harness.
    function echidna_no_stray_payout() public view returns (bool) {
        return ghost_harnessGain == 0;
    }

    /// INV-3: refundable is never more than still-held deposits for any member.
    function echidna_refund_floor() public view returns (bool) {
        IRotatingVault.Circle memory c = vault.getCircle(circleId);
        uint256 floor = uint256(c.claimedCount) * c.depositAmount;
        address[3] memory members = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) {
            uint256 held = vault.totalDeposited(circleId, members[i]);
            uint256 refundable = vault.refundableAmount(circleId, members[i]);
            uint256 maxRefund = held > floor ? held - floor : 0;
            if (refundable > maxRefund) return false;
        }
        return true;
    }
}
