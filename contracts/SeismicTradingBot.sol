// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SeismicTradingBot
 * @notice AI-powered automated trading bot with Seismic privacy features
 * @dev Uses Seismic's masked data types for private trading
 */
contract SeismicTradingBot is ReentrancyGuard, Ownable {
    
    // Seismic Privacy: Use masked types for sensitive data
    // Note: In actual Seismic deployment, use masked<uint256>, masked<address>, etc.
    
    struct Trade {
        uint256 id;
        string asset;
        uint256 entryPrice;
        uint256 exitPrice;
        uint256 amount;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 timestamp;
        uint256 closedAt;
        TradeStatus status;
        int256 pnl;
    }
    
    struct UserBalance {
        uint256 totalDeposited;
        uint256 availableBalance;
        uint256 lockedInTrades;
        uint256 totalProfit;
        uint256 totalLoss;
    }
    
    enum TradeStatus { Active, Closed, Cancelled }
    
    // State variables (In Seismic, these would be masked for privacy)
    mapping(address => UserBalance) private userBalances;
    mapping(address => Trade[]) private userTrades;
    mapping(address => bool) public authorizedBots;
    mapping(string => uint256) private assetPrices; // Oracle prices
    
    uint256 public platformFee = 5; // 0.5% fee
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 private tradeCounter;
    
    address public feeCollector;
    IERC20 public tradingToken; // USDT/USDC for trading
    
    // Events (Seismic allows selective event privacy)
    event Deposited(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, uint256 tradeId, string asset, uint256 amount);
    event TradeClosed(address indexed user, uint256 tradeId, int256 pnl);
    event Withdrawn(address indexed user, uint256 amount);
    event BotAuthorized(address indexed bot, bool status);
    
    modifier onlyAuthorizedBot() {
        require(authorizedBots[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    constructor(address _tradingToken, address _feeCollector) {
        tradingToken = IERC20(_tradingToken);
        feeCollector = _feeCollector;
        authorizedBots[msg.sender] = true;
    }
    
    /**
     * @notice Deposit funds to trading account
     * @dev User deposits USDT/USDC to start trading
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(tradingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        userBalances[msg.sender].totalDeposited += amount;
        userBalances[msg.sender].availableBalance += amount;
        
        emit Deposited(msg.sender, amount);
    }
    
    /**
     * @notice Execute a trade (called by authorized bot)
     * @dev Opens a new trading position with AI-determined parameters
     */
    function executeTrade(
        address user,
        string memory asset,
        uint256 amount,
        uint256 stopLoss,
        uint256 takeProfit
    ) external onlyAuthorizedBot nonReentrant returns (uint256) {
        require(amount > 0, "Invalid amount");
        require(userBalances[user].availableBalance >= amount, "Insufficient balance");
        require(stopLoss < assetPrices[asset], "Invalid stop loss");
        require(takeProfit > assetPrices[asset], "Invalid take profit");
        
        // Lock funds
        userBalances[user].availableBalance -= amount;
        userBalances[user].lockedInTrades += amount;
        
        // Create trade
        tradeCounter++;
        Trade memory newTrade = Trade({
            id: tradeCounter,
            asset: asset,
            entryPrice: assetPrices[asset],
            exitPrice: 0,
            amount: amount,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            timestamp: block.timestamp,
            closedAt: 0,
            status: TradeStatus.Active,
            pnl: 0
        });
        
        userTrades[user].push(newTrade);
        
        emit TradeExecuted(user, tradeCounter, asset, amount);
        return tradeCounter;
    }
    
    /**
     * @notice Close a trade position
     * @dev Calculates PnL and updates user balance
     */
    function closeTrade(
        address user,
        uint256 tradeId,
        uint256 exitPrice
    ) external onlyAuthorizedBot nonReentrant {
        Trade[] storage trades = userTrades[user];
        
        for (uint256 i = 0; i < trades.length; i++) {
            if (trades[i].id == tradeId && trades[i].status == TradeStatus.Active) {
                Trade storage trade = trades[i];
                
                // Calculate PnL
                int256 priceDiff = int256(exitPrice) - int256(trade.entryPrice);
                int256 pnl = (priceDiff * int256(trade.amount)) / int256(trade.entryPrice);
                
                // Calculate fee
                uint256 fee = (uint256(pnl > 0 ? pnl : -pnl) * platformFee) / FEE_DENOMINATOR;
                
                // Update trade
                trade.exitPrice = exitPrice;
                trade.closedAt = block.timestamp;
                trade.status = TradeStatus.Closed;
                trade.pnl = pnl;
                
                // Unlock funds and apply PnL
                userBalances[user].lockedInTrades -= trade.amount;
                
                if (pnl > 0) {
                    uint256 profit = uint256(pnl) - fee;
                    userBalances[user].availableBalance += trade.amount + profit;
                    userBalances[user].totalProfit += profit;
                    
                    // Transfer fee
                    tradingToken.transfer(feeCollector, fee);
                } else {
                    uint256 loss = uint256(-pnl) + fee;
                    userBalances[user].availableBalance += trade.amount - loss;
                    userBalances[user].totalLoss += loss;
                }
                
                emit TradeClosed(user, tradeId, pnl);
                return;
            }
        }
        
        revert("Trade not found or already closed");
    }
    
    /**
     * @notice Withdraw funds from trading account
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= userBalances[msg.sender].availableBalance, "Invalid amount");
        
        userBalances[msg.sender].availableBalance -= amount;
        require(tradingToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Update asset price (oracle function)
     * @dev In production, integrate with Chainlink or similar oracle
     */
    function updatePrice(string memory asset, uint256 price) external onlyAuthorizedBot {
        assetPrices[asset] = price;
    }
    
    /**
     * @notice Get user's balance information
     */
    function getUserBalance(address user) external view returns (
        uint256 total,
        uint256 available,
        uint256 locked,
        uint256 profit,
        uint256 loss
    ) {
        UserBalance memory balance = userBalances[user];
        return (
            balance.totalDeposited,
            balance.availableBalance,
            balance.lockedInTrades,
            balance.totalProfit,
            balance.totalLoss
        );
    }
    
    /**
     * @notice Get user's trade history
     */
    function getUserTrades(address user) external view returns (Trade[] memory) {
        return userTrades[user];
    }
    
    /**
     * @notice Get active trades for a user
     */
    function getActiveTrades(address user) external view returns (Trade[] memory) {
        Trade[] memory allTrades = userTrades[user];
        uint256 activeCount = 0;
        
        // Count active trades
        for (uint256 i = 0; i < allTrades.length; i++) {
            if (allTrades[i].status == TradeStatus.Active) {
                activeCount++;
            }
        }
        
        // Create array of active trades
        Trade[] memory activeTrades = new Trade[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allTrades.length; i++) {
            if (allTrades[i].status == TradeStatus.Active) {
                activeTrades[index] = allTrades[i];
                index++;
            }
        }
        
        return activeTrades;
    }
    
    /**
     * @notice Authorize/deauthorize a bot address
     */
    function setBotAuthorization(address bot, bool status) external onlyOwner {
        authorizedBots[bot] = status;
        emit BotAuthorized(bot, status);
    }
    
    /**
     * @notice Update platform fee
     */
    function setPlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 50, "Fee too high"); // Max 5%
        platformFee = newFee;
    }
    
    /**
     * @notice Emergency withdraw (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @notice Get current asset price
     */
    function getAssetPrice(string memory asset) external view returns (uint256) {
        return assetPrices[asset];
    }
}

/**
 * SEISMIC PRIVACY IMPLEMENTATION NOTES:
 * 
 * 1. Masked Data Types:
 *    - Replace `uint256` with `masked<uint256>` for private balances
 *    - Replace `address` with `masked<address>` for user privacy
 *    - Example: masked<uint256> private balance;
 * 
 * 2. Private State:
 *    - User balances remain hidden from public view
 *    - Trade details are encrypted on-chain
 *    - Only user and authorized bot can view their data
 * 
 * 3. Encrypted Events:
 *    - Events can be made private using Seismic's event masking
 *    - Only relevant parties receive event notifications
 * 
 * 4. TEE Execution:
 *    - All contract logic runs in Trusted Execution Environment
 *    - Ensures data remains encrypted during execution
 * 
 * 5. Deployment:
 *    - Deploy using Seismic Foundry
 *    - Use Seismic RPC for all interactions
 *    - Configure privacy settings in constructor
 * 
 * For full Seismic integration, visit: https://docs.seismic.systems
 */