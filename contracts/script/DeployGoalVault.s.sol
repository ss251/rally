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
 *   RELAYER       relayer allowed to attribute CCTP mints (default: deployer)
 *
 * USDC and LOCAL_DOMAIN are NOT env-configurable: they are derived from
 * block.chainid so pointing the script at the wrong RPC can never wire the
 * vault to the wrong token/domain — it reverts instead.
 *
 * Run:
 *   forge script script/DeployGoalVault.s.sol \
 *     --rpc-url "$ARB_SEPOLIA_RPC" --broadcast \
 *     --verify --verifier etherscan --etherscan-api-key "$ARBISCAN_API_KEY"
 */
contract DeployGoalVault is Script {
    // Arbitrum Sepolia — the ONLY supported deploy target (Rally's home chain).
    uint256 constant ARBITRUM_SEPOLIA_CHAINID = 421614;

    // Verified CCTP-v2 testnet USDC on Arbitrum Sepolia.
    // Source: developers.circle.com/stablecoins/usdc-contract-addresses
    address constant ARB_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    uint32 constant ARB_SEPOLIA_DOMAIN = 3; // Arbitrum Sepolia (CCTP domain)

    error WrongChain(uint256 actual, uint256 expected);

    function run() external returns (GoalVault vault) {
        // Guard: refuse to deploy anywhere but Arbitrum Sepolia. A wrong --rpc-url
        // would otherwise wire the vault to a foreign USDC/domain and silently ship.
        if (block.chainid != ARBITRUM_SEPOLIA_CHAINID) {
            revert WrongChain(block.chainid, ARBITRUM_SEPOLIA_CHAINID);
        }

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        // Derived from chainid, not env — cannot be pointed at the wrong token.
        address usdc = ARB_SEPOLIA_USDC;
        uint32 localDomain = ARB_SEPOLIA_DOMAIN;
        address relayer = vm.envOr("RELAYER", deployer);

        console2.log("ChainId:", block.chainid);
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
