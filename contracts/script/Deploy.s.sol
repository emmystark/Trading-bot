// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console2} from "forge-std/Script.sol";
import {PrivateTradingBot} from "../src/PrivateTradingBot.sol";

contract DeployScript is Script {
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        console2.log("Deploying PrivateTradingBot...");
        console2.log("Deployer:", vm.addr(deployerPrivateKey));
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy contract
        PrivateTradingBot bot = new PrivateTradingBot();
        
        console2.log("Contract deployed at:", address(bot));
        console2.log("Owner:", bot.owner());
        console2.log("Paused:", bot.isPaused());
        
        vm.stopBroadcast();
        
        // Print next steps
        console2.log("\n========================================");
        console2.log("DEPLOYMENT SUCCESSFUL!");
        console2.log("========================================");
        console2.log("Contract Address:", address(bot));
        console2.log("\nNext steps:");
        console2.log("1. Save this address to backend/.env");
        console2.log("2. Save to frontend/.env.local");
        console2.log("3. Verify on block explorer (if available)");
        console2.log("========================================\n");
    }
}