// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GoalVault, ITokenMessengerV2} from "../../src/GoalVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*//////////////////////////////////////////////////////////////////////////
                    Rally · GoalVault stateful fuzz harness
    ---------------------------------------------------------------------------
    Echidna / Medusa compatible. Also driven by Foundry's invariant engine via
    GoalVaultInvariant.t.sol (so `forge test` exercises the same properties).

    The harness is the SOLE actor: it is the vault's owner, relayer, backer and
    beneficiary. That intentionally collapses every role onto one address so the
    fuzzers can freely sequence createCampaign / contribute / recordContribution
    / withdraw / refund / refundCrossChain / time-warp and stress the
    all-or-nothing accounting without needing multi-sender orchestration.

    Handlers only mutate ghost accumulators on SUCCESS (try/catch), so the
    ghosts always mirror on-chain state exactly and the invariants below can
    never flake on a legitimately-reverted call.

    INVARIANTS (the #12 all-or-nothing set):
      echidna_solvency              token.balanceOf(vault) >= totalEscrowed
      echidna_escrow_conservation   totalEscrowed == credited - withdrawn - refunded
      echidna_raised_matches_credits  per campaign: raised == sum of credits
      echidna_no_double_withdraw    each campaign withdrawn at most once
      + refund-completeness asserted inline: a successful refund zeroes the
        backer's credited total (assert inside h_refund / h_refundCrossChain).
//////////////////////////////////////////////////////////////////////////*/

/// @dev Minimal 6-decimal USDC with open minting (simulates CCTP arrivals).
contract FuzzUSDC is ERC20 {
    constructor() ERC20("Fuzz USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Stand-in CCTP TokenMessenger: pulls the approved USDC out of the vault,
///      exactly like a real cross-chain burn, so refundCrossChain moves value
///      out of the vault and solvency stays truthful.
contract FuzzMessenger is ITokenMessengerV2 {
    IERC20 public immutable usdc;

    constructor(IERC20 _usdc) {
        usdc = _usdc;
    }

    function depositForBurn(
        uint256 amount,
        uint32, /* destinationDomain */
        bytes32, /* mintRecipient */
        address burnToken,
        bytes32, /* destinationCaller */
        uint256, /* maxFee */
        uint32 /* minFinalityThreshold */
    ) external override {
        require(burnToken == address(usdc), "wrong token");
        usdc.transferFrom(msg.sender, address(this), amount);
    }
}

interface IHevm {
    function warp(uint256) external;
    function roll(uint256) external;
}

contract GoalVaultFuzz {
    // Hevm/Foundry cheatcode address — honoured by Echidna, Medusa AND Foundry.
    IHevm internal constant vm = IHevm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    uint32 internal constant LOCAL_DOMAIN = 3; // Arbitrum Sepolia

    GoalVault public vault;
    FuzzUSDC public usdc;
    FuzzMessenger public messenger;

    // --- ghost accounting (updated ONLY on a successful mutation) -----------
    uint256 public ghost_credited; // sum of all amounts ever credited
    uint256 public ghost_withdrawn; // sum of all raised amounts ever withdrawn
    uint256 public ghost_refunded; // sum of all amounts ever refunded
    uint256 public numCampaigns; // highest campaign id created

    mapping(uint256 => uint256) public ghost_raised; // per-campaign credited total
    mapping(uint256 => uint256) public ghost_withdrawCount; // per-campaign successful withdraws

    constructor() {
        usdc = new FuzzUSDC();
        vault = new GoalVault(IERC20(address(usdc)), LOCAL_DOMAIN, address(this), address(this));
        messenger = new FuzzMessenger(IERC20(address(usdc)));
        vault.setTokenMessenger(ITokenMessengerV2(address(messenger)));

        // Fund the actor and pre-approve the vault for same-chain contributions.
        usdc.mint(address(this), 1_000_000_000e6);
        usdc.approve(address(vault), type(uint256).max);
    }

    // --- helpers ------------------------------------------------------------

    function _clamp(uint256 x, uint256 lo, uint256 hi) internal pure returns (uint256) {
        if (hi <= lo) return lo;
        return lo + (x % (hi - lo + 1));
    }

    function _pickCampaign(uint256 seed) internal view returns (uint256) {
        // ids are 1..numCampaigns
        return (seed % numCampaigns) + 1;
    }

    // --- handlers -----------------------------------------------------------

    function h_createCampaign(uint256 goalSeed, uint256 durationSeed) external {
        uint256 goal = _clamp(goalSeed, 1, 1_000_000e6);
        uint256 duration = _clamp(durationSeed, 1, 30 days);
        uint64 deadline = uint64(block.timestamp + duration);
        try vault.createCampaign(goal, deadline, address(this)) returns (uint256 id) {
            numCampaigns = id;
        } catch {}
    }

    function h_contribute(uint256 campaignSeed, uint256 amountSeed) external {
        if (numCampaigns == 0) return;
        uint256 id = _pickCampaign(campaignSeed);
        uint256 bal = usdc.balanceOf(address(this));
        if (bal == 0) return;
        uint256 amount = _clamp(amountSeed, 1, bal > 100_000e6 ? 100_000e6 : bal);
        try vault.contribute(id, amount) {
            ghost_credited += amount;
            ghost_raised[id] += amount;
        } catch {}
    }

    function h_recordContribution(uint256 campaignSeed, uint256 amountSeed, uint256 domainSeed) external {
        if (numCampaigns == 0) return;
        uint256 id = _pickCampaign(campaignSeed);
        uint256 amount = _clamp(amountSeed, 1, 100_000e6);
        uint32 domain = uint32(domainSeed % 7); // CCTP domains 0..6

        // Simulate the CCTP mint physically landing at the vault first.
        usdc.mint(address(vault), amount);
        try vault.recordContribution(id, address(this), amount, domain) {
            ghost_credited += amount;
            ghost_raised[id] += amount;
        } catch {
            // Not creditable (e.g. past the settlement grace): the minted USDC
            // becomes unattributed slack. Solvency (balance >= escrowed) holds.
        }
    }

    function h_withdraw(uint256 campaignSeed) external {
        if (numCampaigns == 0) return;
        uint256 id = _pickCampaign(campaignSeed);
        (,,,, uint256 raised,,) = vault.getCampaign(id);
        try vault.withdraw(id) {
            ghost_withdrawn += raised; // withdraw pays exactly c.raised
            ghost_withdrawCount[id] += 1;
        } catch {}
    }

    function h_refund(uint256 campaignSeed) external {
        if (numCampaigns == 0) return;
        uint256 id = _pickCampaign(campaignSeed);
        uint256 owed = vault.contributionOf(id, address(this));
        try vault.refund(id) {
            ghost_refunded += owed;
            // refund-completeness: the backer's credited total is fully cleared.
            assert(vault.contributionOf(id, address(this)) == 0);
        } catch {}
    }

    function h_refundCrossChain(uint256 campaignSeed) external {
        if (numCampaigns == 0) return;
        uint256 id = _pickCampaign(campaignSeed);
        uint256 owed = vault.contributionOf(id, address(this));
        try vault.refundCrossChain(id, address(this)) {
            ghost_refunded += owed;
            // refund-completeness across both local + cross-chain legs.
            assert(vault.contributionOf(id, address(this)) == 0);
        } catch {}
    }

    function h_warp(uint256 secondsSeed) external {
        vm.warp(block.timestamp + _clamp(secondsSeed, 1, 10 days));
    }

    // --- properties (Echidna / Medusa read these; forge asserts them) -------

    /// INV-1: the vault can always cover everything it still owes.
    function echidna_solvency() public view returns (bool) {
        return usdc.balanceOf(address(vault)) >= vault.totalEscrowed();
    }

    /// INV-2: escrow is exactly what was credited minus what left (paid/refunded).
    function echidna_escrow_conservation() public view returns (bool) {
        if (ghost_credited < ghost_withdrawn + ghost_refunded) return false;
        return vault.totalEscrowed() == ghost_credited - ghost_withdrawn - ghost_refunded;
    }

    /// INV-3: each campaign's on-chain `raised` equals the sum of its credits.
    function echidna_raised_matches_credits() public view returns (bool) {
        for (uint256 id = 1; id <= numCampaigns; id++) {
            (,,,, uint256 raised,,) = vault.getCampaign(id);
            if (raised != ghost_raised[id]) return false;
        }
        return true;
    }

    /// INV-4: no campaign can be withdrawn more than once (no double-spend).
    function echidna_no_double_withdraw() public view returns (bool) {
        for (uint256 id = 1; id <= numCampaigns; id++) {
            if (ghost_withdrawCount[id] > 1) return false;
        }
        return true;
    }
}
