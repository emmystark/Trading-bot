// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract PrivateTradingBot {
    
    // ==================== STRUCTS ====================
    
    struct Trade {
        uint256 amount;        // Trade size
        uint256 price;         // Entry price
        bool isBuy;            // true = BUY, false = SELL
        uint256 timestamp;     // Block timestamp
        uint8 coinId;          // Coin identifier
    }
    
    struct Position {
        uint256 entryPrice;    // Price when opened
        uint256 amount;        // Position size
        uint256 stopLoss;      // Stop-loss price
        uint256 takeProfit;    // Take-profit price
        uint256 openedAt;      // When position opened
        bool isActive;         // Is position still open?
        uint8 coinId;          // Which coin
    }
    
    struct BotConfig {
        uint256 maxPositionSize;   // Max % per trade
        uint256 dailyTradeLimit;   // Max trades per day
        bool isActive;             // Is bot currently trading?
        uint256 minConfidence;     // Min AI confidence (0-100)
    }
    
    
    // ==================== STATE VARIABLES ====================
    
    mapping(address => uint256) private balances;
    mapping(address => Trade[]) private tradeHistory;
    mapping(address => Position[]) private openPositions;
    mapping(address => BotConfig) private botConfigs;
    
    mapping(address => uint256) public dailyTradeCount;
    mapping(address => uint256) private lastTradeDate;
    
    address public owner;
    bool public isPaused;
    uint256 public totalUsers;
    uint256 public totalTrades;
    
    
    // ==================== EVENTS ====================
    
    event TradeExecuted(
        address indexed user,
        uint256 timestamp,
        bool isBuy,
        uint8 coinId,
        uint256 amount,
        uint256 price
    );
    
    event PositionOpened(
        address indexed user,
        uint256 timestamp,
        uint8 coinId,
        uint256 amount,
        uint256 entryPrice
    );
    
    event PositionClosed(
        address indexed user,
        uint256 timestamp,
        uint8 coinId,
        int256 pnl
    );
    
    event BotConfigured(
        address indexed user,
        uint256 timestamp
    );
    
    event Deposit(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event Withdrawal(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    
    // ==================== MODIFIERS ====================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier whenNotPaused() {
        require(!isPaused, "Trading is paused");
        _;
    }
    
    modifier withinDailyLimit() {
        _resetDailyCounterIfNeeded();
        BotConfig memory config = botConfigs[msg.sender];
        require(
            dailyTradeCount[msg.sender] < config.dailyTradeLimit,
            "Daily trade limit reached"
        );
        _;
    }
    
    
    // ==================== CONSTRUCTOR ====================
    
    constructor() {
        owner = msg.sender;
        isPaused = false;
    }
    
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Deposit funds into the trading bot
     */
    function deposit() external payable whenNotPaused {
        require(msg.value > 0, "Must deposit more than 0");
        
        // Add to user's balance
        balances[msg.sender] += msg.value;
        
        // If first deposit, increment user counter
        if (balances[msg.sender] == msg.value) {
            totalUsers++;
        }
        
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @notice Withdraw funds from the bot
     */
    function withdraw(uint256 amount) external whenNotPaused {
        uint256 currentBalance = balances[msg.sender];
        require(currentBalance >= amount, "Insufficient balance");
        
        // Reduce balance BEFORE sending (reentrancy protection)
        balances[msg.sender] = currentBalance - amount;
        
        // Send ETH to user
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @notice Execute a trade (BUY or SELL)
     */
    function executeTrade(
        uint256 amount,
        uint256 price,
        bool isBuy,
        uint8 coinId
    ) external whenNotPaused withinDailyLimit {
        BotConfig memory config = botConfigs[msg.sender];
        require(config.isActive, "Bot not active");
        
        uint256 currentBalance = balances[msg.sender];
        
        // Calculate total cost including 0.1% fee
        uint256 totalCost = amount + (amount / 1000);
        require(currentBalance >= totalCost, "Insufficient balance");
        
        // Create trade record
        Trade memory newTrade = Trade({
            amount: amount,
            price: price,
            isBuy: isBuy,
            timestamp: block.timestamp,
            coinId: coinId
        });
        
        // Add to trade history
        tradeHistory[msg.sender].push(newTrade);
        
        // Update balance (deduct cost + fees)
        balances[msg.sender] = currentBalance - totalCost;
        
        // Increment counters
        dailyTradeCount[msg.sender]++;
        totalTrades++;
        
        // Emit event
        emit TradeExecuted(msg.sender, block.timestamp, isBuy, coinId, amount, price);
    }
    
    /**
     * @notice Open a new position with stop-loss and take-profit
     */
    function openPosition(
        uint256 amount,
        uint256 entryPrice,
        uint256 stopLoss,
        uint256 takeProfit,
        uint8 coinId
    ) external whenNotPaused withinDailyLimit {
        BotConfig memory config = botConfigs[msg.sender];
        require(config.isActive, "Bot not active");
        
        uint256 currentBalance = balances[msg.sender];
        require(currentBalance >= amount, "Insufficient balance");
        
        // Validate risk management parameters
        require(stopLoss < entryPrice, "Stop-loss must be below entry");
        require(takeProfit > entryPrice, "Take-profit must be above entry");
        
        // Create position
        Position memory newPosition = Position({
            entryPrice: entryPrice,
            amount: amount,
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            openedAt: block.timestamp,
            isActive: true,
            coinId: coinId
        });
        
        openPositions[msg.sender].push(newPosition);
        
        // Deduct from balance
        balances[msg.sender] = currentBalance - amount;
        
        dailyTradeCount[msg.sender]++;
        totalTrades++;
        
        emit PositionOpened(msg.sender, block.timestamp, coinId, amount, entryPrice);
    }
    
    /**
     * @notice Close an open position
     */
    function closePosition(
        uint256 positionIndex,
        uint256 currentPrice
    ) external whenNotPaused {
        require(positionIndex < openPositions[msg.sender].length, "Invalid index");
        
        Position storage position = openPositions[msg.sender][positionIndex];
        require(position.isActive, "Position not active");
        
        // Calculate profit/loss
        uint256 entryPrice = position.entryPrice;
        uint256 amount = position.amount;
        
        int256 pnl;
        if (currentPrice > entryPrice) {
            // Profit
            pnl = int256((currentPrice - entryPrice) * amount / entryPrice);
        } else {
            // Loss
            pnl = -int256((entryPrice - currentPrice) * amount / entryPrice);
        }
        
        // Return to balance (principal + profit/loss)
        uint256 returnAmount = uint256(int256(amount) + pnl);
        uint256 currentBalance = balances[msg.sender];
        balances[msg.sender] = currentBalance + returnAmount;
        
        // Mark position as closed
        position.isActive = false;
        
        emit PositionClosed(msg.sender, block.timestamp, position.coinId, pnl);
    }
    
    /**
     * @notice Configure bot settings
     */
    function configureBotSettings(
        uint256 maxPositionSize,
        uint256 dailyTradeLimit,
        bool isActive,
        uint256 minConfidence
    ) external {
        require(maxPositionSize <= 100, "Max position size is 100%");
        require(minConfidence <= 100, "Min confidence is 100%");
        require(dailyTradeLimit > 0, "Daily limit must be positive");
        
        botConfigs[msg.sender] = BotConfig({
            maxPositionSize: maxPositionSize,
            dailyTradeLimit: dailyTradeLimit,
            isActive: isActive,
            minConfidence: minConfidence
        });
        
        emit BotConfigured(msg.sender, block.timestamp);
    }
    
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Get user's balance
     */
    function getBalance() external view returns (uint256) {
        return balances[msg.sender];
    }
    
    /**
     * @notice Get user's trade history
     */
    function getTradeHistory() external view returns (Trade[] memory) {
        return tradeHistory[msg.sender];
    }
    
    /**
     * @notice Get user's open positions
     */
    function getOpenPositions() external view returns (Position[] memory) {
        return openPositions[msg.sender];
    }
    
    /**
     * @notice Get user's bot configuration
     */
    function getBotConfig() external view returns (BotConfig memory) {
        return botConfigs[msg.sender];
    }
    
    /**
     * @notice Get public statistics
     */
    function getPublicStats() external view returns (
        uint256 users,
        uint256 trades,
        uint256 userDailyTrades
    ) {
        return (
            totalUsers,
            totalTrades,
            dailyTradeCount[msg.sender]
        );
    }
    
    /**
     * @notice Get specific user balance (owner only for monitoring)
     */
    function getUserBalance(address user) external view onlyOwner returns (uint256) {
        return balances[user];
    }
    
    
    // ==================== ADMIN FUNCTIONS ====================
    
    function pause() external onlyOwner {
        isPaused = true;
    }
    
    function unpause() external onlyOwner {
        isPaused = false;
    }
    
    /**
     * @notice Emergency withdraw (owner only, for contract upgrades)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Emergency withdraw failed");
    }
    
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    function _resetDailyCounterIfNeeded() internal {
        uint256 today = block.timestamp / 1 days;
        uint256 lastTradeDay = lastTradeDate[msg.sender] / 1 days;
        
        if (today > lastTradeDay) {
            dailyTradeCount[msg.sender] = 0;
            lastTradeDate[msg.sender] = block.timestamp;
        }
    }
    
    
    // ==================== FALLBACK ====================
    
    receive() external payable {
        // Allow receiving ETH directly (treated as deposit)
        balances[msg.sender] += msg.value;
        
        if (balances[msg.sender] == msg.value) {
            totalUsers++;
        }
        
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
}