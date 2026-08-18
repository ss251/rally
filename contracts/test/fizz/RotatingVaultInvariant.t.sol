// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RotatingVaultFuzz} from "./RotatingVaultFuzz.sol";

/**
 * @notice Foundry invariant wrapper around the RotatingVault Echidna/Medusa
 *         harness. Modest run/depth so `forge test` stays fast; run
 *         `medusa fuzz` / `echidna . --contract RotatingVaultFuzz` for depth.
 */
contract RotatingVaultInvariant is Test {
    RotatingVaultFuzz internal harness;

    function setUp() public {
        harness = new RotatingVaultFuzz();
        targetContract(address(harness));
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_conservation() public view {
        assertTrue(harness.echidna_conservation(), "conservation violated");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_noStrayPayout() public view {
        assertTrue(harness.echidna_no_stray_payout(), "claimFor paid the harness");
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 64
    function invariant_refundFloor() public view {
        assertTrue(harness.echidna_refund_floor(), "refundable exceeds still-held deposits");
    }
}
