// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GoalVault} from "../src/GoalVault.sol";

/**
 * @notice Deploy GoalVault to Arbitrum Sepolia.
 *
 * Env:
 *   PRIVATE_KEY   deployer/owner burner key (hex, funded with Arb Sepolia ETH)
 *   USDC          USDC on Arbitrum Sepolia (default: verified CCTP-v2 testnet USDC)
 *   LOCAL_DOMAIN  CCTP domain of this chain (Arbitrum Sepolia = 3)
 *   RELAYER       relayer allowed to attribute CCTP mints (default: deployer)
 *
 * Run:
 *   forge script script/DeployGoalVault.s.sol \
 *     --rpc-url "$ARB_SEPOLIA_RPC" --broadcast \
 *     --verify --verifier etherscan --etherscan-api-key "$ARBISCAN_API_KEY"
 */
contract DeployGoalVault is Script {
    // Verified CCTP-v2 testnet USDC on Arbitrum Sepolia.
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses
    address constant DEFAULT_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    uint32 constant DEFAULT_LOCAL_DOMAIN = 3; // Arbitrum Sepolia (CCTP domain)

    function run() external returns (GoalVault vault) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envOr("USDC", DEFAULT_USDC);
        uint32 localDomain = uint32(vm.envOr("LOCAL_DOMAIN", uint256(DEFAULT_LOCAL_DOMAIN)));
        address relayer = vm.envOr("RELAYER", deployer);

        console2.log("Deployer/Owner:", deployer);
        console2.log("USDC:", usdc);
        console2.log("LOCAL_DOMAIN:", localDomain);
        console2.log("Relayer:", relayer);

        vm.startBroadcast(pk);
        vault = new GoalVault(IERC20(usdc), localDomain, relayer, deployer);
        vm.stopBroadcast();

        console2.log("GoalVault deployed at:", address(vault));
    }
}
