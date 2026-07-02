// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {RotatingVault} from "../src/RotatingVault.sol";

/**
 * @notice Deploy RotatingVault (Rally "Circles") to Arbitrum Sepolia.
 *
 * Env:
 *   PRIVATE_KEY   deployer burner key (hex, funded with Arb Sepolia ETH)
 *
 * RotatingVault is ownerless and takes no constructor args: circles pick
 * their token per-circle at createCircle() time. For Rally that token is the
 * verified CCTP-v2 testnet USDC below (logged for the frontend/relayer
 * config; NOT baked into the contract).
 *
 * Run (from contracts/):
 *   forge script script/DeployRotatingVault.s.sol \
 *     --rpc-url "$ARB_SEPOLIA_RPC" --broadcast \
 *     --verify --verifier etherscan --etherscan-api-key "$ARBISCAN_API_KEY"
 */
contract DeployRotatingVault is Script {
    // Arbitrum Sepolia — the ONLY supported deploy target (Rally's home chain).
    uint256 constant ARBITRUM_SEPOLIA_CHAINID = 421614;

    // Verified CCTP-v2 testnet USDC on Arbitrum Sepolia (same constant the
    // GoalVault deploy uses). Source:
    // developers.circle.com/stablecoins/usdc-contract-addresses
    address constant ARB_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    error WrongChain(uint256 actual, uint256 expected);

    function run() external returns (RotatingVault vault) {
        // Guard: refuse to deploy anywhere but Arbitrum Sepolia, mirroring
        // DeployGoalVault — a wrong --rpc-url reverts instead of shipping.
        if (block.chainid != ARBITRUM_SEPOLIA_CHAINID) {
            revert WrongChain(block.chainid, ARBITRUM_SEPOLIA_CHAINID);
        }

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("ChainId:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("USDC for circles (frontend config):", ARB_SEPOLIA_USDC);

        vm.startBroadcast(pk);
        vault = new RotatingVault();
        vm.stopBroadcast();

        console2.log("RotatingVault deployed at:", address(vault));
    }
}
