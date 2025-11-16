// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockTrade {
    mapping(address => uint256) public balances; // Mock balances (private in real Seismic)
    mapping(address => uint256) public entryPrices; // Entry prices
    address public owner;

    event TradeEntered(address indexed user, address asset, uint256 amount, uint256 price);
    event TradeExited(address indexed user, address asset, uint256 pnl);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Enter trade (simulate buy)
    function enterTrade(address asset, uint256 amount) external {
        // Mock: Transfer amount (in real, use ERC20)
        balances[asset] += amount;
        entryPrices[asset] = uint256(block.timestamp); // Mock price as timestamp for sim
        emit TradeEntered(msg.sender, asset, amount, entryPrices[asset]);
    }

    // Exit trade (check profit mock)
    function exitTrade(address asset) external onlyOwner { // Privacy: Owner closes
        uint256 entry = entryPrices[asset];
        uint256 mockProfit = (block.timestamp - entry) % 100; // Random 0-99, >3 = profit
        if (mockProfit > 3) {
            balances[asset] = 0;
            emit TradeExited(msg.sender, asset, mockProfit);
        }
    }

    // Get balance (view, but encrypt off-chain for privacy)
    function getBalance(address asset) external view returns (uint256) {
        return balances[asset];
    }
}