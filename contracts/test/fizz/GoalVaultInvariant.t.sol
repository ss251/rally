// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {GoalVaultFuzz} from "./GoalVaultFuzz.sol";

/**
 * @notice Foundry invariant wrapper around the Echidna/Medusa harness. Lets
 *         `forge test` drive the same stateful campaign so the all-or-nothing
 *         invariants are exercised in CI without needing echidna/medusa
 *         installed. The harness is the only fuzz target; its handlers keep the
 *         ghost accounting authoritative.
 *
 *         Modest run/depth budget so it stays fast in the unit-test suite; run
 *         `medusa fuzz` / `echidna . --contract GoalVaultFuzz` for deep campaigns.
 */
contract GoalVaultInvariant is Test {
    GoalVaultFuzz internal harness;

    function setUp() public {
        harness = new GoalVaultFuzz();
        targetContract(address(harness));
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_solvency() public view {
        assertTrue(harness.echidna_solvency(), "vault balance < totalEscrowed");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_escrowConservation() public view {
        assertTrue(harness.echidna_escrow_conservation(), "escrow != credited - withdrawn - refunded");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_raisedMatchesCredits() public view {
        assertTrue(harness.echidna_raised_matches_credits(), "campaign.raised != sum of credits");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_noDoubleWithdraw() public view {
        assertTrue(harness.echidna_no_double_withdraw(), "campaign withdrawn more than once");
    }
}
