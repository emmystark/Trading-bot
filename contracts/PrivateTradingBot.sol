// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract PrivateTradingBot {

    struct Trade {
        suint256 amount;        // PRIVATE: Trade size (e.g., 0.5 BTC)
        suint256 price;         // PRIVATE: Entry price (e.g., $45000)
        bool isBuy;            // PRIVATE: true = BUY, false = SELL
        uint256 timestamp;      // PUBLIC: Block timestamp (for ordering)
        uint8 coinId;          // PRIVATE: Coin identifier
    }

    struct Position {
        suint256 entryPrice;    // PRIVATE: Price when you bought
        suint256 amount;        // PRIVATE: How much you hold
        suint256 stopLoss;      // PRIVATE: Auto-sell if price drops here
        suint256 takeProfit;    // PRIVATE: Auto-sell if price rises here
        uint256 openedAt;       // PUBLIC: When position opened
        bool isActive;         // PRIVATE: Is position still open?
        suint8 coinId;          // PRIVATE: Which coin
    }
    
    struct BotConfig {
        suint256 maxPositionSize;   // PRIVATE: Max % of balance per trade
        suint256 dailyTradeLimit;   // PRIVATE: Max trades per day
        bool isActive;             // PRIVATE: Is bot currently trading?
        suint256 minConfidence;     // PRIVATE: Min AI confidence to trade (0-100)
    }
    
    mapping(address => suint256) private balances;
    mapping(address => Trade[]) private tradeHistory;
    mapping(address => Position[]) private openPositions;
    mapping(address => BotConfig) private botConfigs;
    mapping(address => uint256) public dailyTradeCount;
    mapping(address => uint256) private lastTradeDate;
    

    address public owner;
    bool public isPaused;
    uint256 public totalUsers;
    uint256 public totalTrades;   
    
    // Events (without sensitive data)
    
    event TradeExecuted(
        address indexed user,
        uint256 timestamp,
        bool isBuy,              // PUBLIC: Direction (BUY/SELL)
        uint8 coinId             // PUBLIC: Which coin
        // Note: amount and price are NOT emitted (they're private)
    );
    
    event PositionClosed(
        address indexed user,
        uint256 timestamp,
        uint8 coinId
        // Profit/loss NOT emitted (private)
    );
    
    event BotConfigured(
        address indexed user,
        uint256 timestamp
    );
    
    event Deposit(
        address indexed user,
        uint256 timestamp
        // Amount NOT emitted (private)
    );
    
    event Withdrawal(
        address indexed user,
        uint256 timestamp
        // Amount NOT emitted (private)
    );
    
    
    // ==================== MODIFIERS ====================
    
    /**
     * @dev Modifier: Only contract owner can call
     * Used for admin functions like pause/unpause
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    /**
     * @dev Modifier: Function cannot be called when paused
     * Emergency stop mechanism
     */
    modifier whenNotPaused() {
        require(!isPaused, "Trading is paused");
        _;
    }
    
    /**
     * @dev Modifier: User hasn't exceeded daily trade limit
     * Prevents over-trading and protects users
     */
    modifier withinDailyLimit() {
        _resetDailyCounterIfNeeded();
        BotConfig memory config = botConfigs[msg.sender];
        require(
            dailyTradeCount[msg.sender] < unmask(config.dailyTradeLimit),
            "Daily trade limit reached"
        );
        _;
    }
    
    
    // ==================== CONSTRUCTOR ====================
    
    /**
     * @dev Constructor runs once when contract is deployed
     * Sets the deployer as owner
     */
    constructor() {
        owner = msg.sender;
        isPaused = false;
    }
    
    
    // ==================== CORE FUNCTIONS ====================
    
    /**
     * @notice Deposit funds into the trading bot
     * @dev Converts ETH sent to private balance
     * 
     * FLOW:
     * 1. User sends ETH with transaction
     * 2. ETH is stored in contract
     * 3. User's private balance increases by that amount
     * 4. Emit Deposit event (without amount for privacy)
     * 
     * EXAMPLE USAGE (from frontend):
     * await contract.deposit({ value: ethers.parseEther("1.0") })
     */
    function deposit() external payable whenNotPaused {
        require(msg.value > 0, "Must deposit more than 0");
        
        // Convert public ETH to private masked balance
        suint256 maskedAmount = mask(msg.value);
        
        // Add to user's balance (encrypted)
        balances[msg.sender] = balances[msg.sender] + maskedAmount;
        
        // If first deposit, increment user counter
        if (unmask(balances[msg.sender]) == msg.value) {
            totalUsers++;
        }
        
        emit Deposit(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Withdraw funds from the bot
     * @param amount Amount to withdraw (in wei)
     * 
     * SECURITY:
     * - Checks user has sufficient balance
     * - Uses checks-effects-interactions pattern (prevents reentrancy)
     * - Reduces balance BEFORE sending ETH
     * 
     * EXAMPLE USAGE:
     * await contract.withdraw(ethers.parseEther("0.5"))
     */
    function withdraw(uint256 amount) external whenNotPaused {
        suint256 currentBalance = balances[msg.sender];
        require(unmask(currentBalance) >= amount, "Insufficient balance");
        
        // Reduce balance BEFORE sending (reentrancy protection)
        balances[msg.sender] = mask(unmask(currentBalance) - amount);
        
        // Send ETH to user
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Execute a trade (BUY or SELL)
     * @param amount Amount to trade (in wei)
     * @param price Current market price (in wei, e.g., $45000 * 1e18)
     * @param isBuy true for BUY, false for SELL
     * @param coinId Identifier for coin (0=BTC, 1=ETH, etc.)
     * 
     * PRIVACY:
     * - All parameters are masked (encrypted)
     * - Only user can see their trade details
     * - Event emitted but without sensitive data
     * 
     * FLOW:
     * 1. Check bot is configured and active
     * 2. Check user has sufficient balance
     * 3. Check within daily trade limit
     * 4. Create Trade struct (encrypted)
     * 5. Add to trade history
     * 6. Update balance
     * 7. Emit event
     * 
     * CALLED BY: Backend bot when AI generates signal
     */
    function executeTrade(
        uint256 amount,
        uint256 price,
        bool isBuy,
        uint8 coinId
    ) external whenNotPaused withinDailyLimit {
        BotConfig memory config = botConfigs[msg.sender];
        require(unmask(config.isActive), "Bot not active");
        
        suint256 currentBalance = balances[msg.sender];
        require(unmask(currentBalance) >= amount, "Insufficient balance");
        
        // Create private trade record
        Trade memory newTrade = Trade({
            amount: mask(amount),
            price: mask(price),
            isBuy: mask(isBuy),
            timestamp: block.timestamp,
            coinId: mask(coinId)
        });
        
        // Add to trade history (encrypted)
        tradeHistory[msg.sender].push(newTrade);
        
        // Update balance (deduct cost + fees)
        uint256 totalCost = amount + (amount / 1000); // 0.1% fee
        balances[msg.sender] = mask(unmask(currentBalance) - totalCost);
        
        // Increment counters
        dailyTradeCount[msg.sender]++;
        totalTrades++;
        
        // Emit public event (no amounts)
        emit TradeExecuted(msg.sender, block.timestamp, isBuy, coinId);
    }
    
    /**
     * @notice Open a new position with stop-loss and take-profit
     * @dev More advanced than simple trade - includes risk management
     * 
     * EXPLANATION:
     * - Position = holding crypto with auto-sell rules
     * - Stop-loss = sell if price drops to X (limit losses)
     * - Take-profit = sell if price rises to Y (lock in gains)
     * 
     * EXAMPLE:
     * Buy BTC at $45,000
     * Stop-loss at $43,000 (sell if drops 4.4%)
     * Take-profit at $50,000 (sell if rises 11%)
     */
    function openPosition(
        uint256 amount,
        uint256 entryPrice,
        uint256 stopLoss,
        uint256 takeProfit,
        uint8 coinId
    ) external whenNotPaused withinDailyLimit {
        BotConfig memory config = botConfigs[msg.sender];
        require(unmask(config.isActive), "Bot not active");
        
        suint256 currentBalance = balances[msg.sender];
        require(unmask(currentBalance) >= amount, "Insufficient balance");
        
        // Validate risk management parameters
        require(stopLoss < entryPrice, "Stop-loss must be below entry");
        require(takeProfit > entryPrice, "Take-profit must be above entry");
        
        // Create position (all fields encrypted)
        Position memory newPosition = Position({
            entryPrice: mask(entryPrice),
            amount: mask(amount),
            stopLoss: mask(stopLoss),
            takeProfit: mask(takeProfit),
            openedAt: block.timestamp,
            isActive: mask(true),
            coinId: mask(coinId)
        });
        
        openPositions[msg.sender].push(newPosition);
        
        // Deduct from balance
        balances[msg.sender] = mask(unmask(currentBalance) - amount);
        
        dailyTradeCount[msg.sender]++;
        totalTrades++;
    }
    
    /**
     * @notice Close an open position
     * @param positionIndex Index in openPositions array
     * @param currentPrice Current market price
     * 
     * CALCULATES:
     * - Profit/Loss = (currentPrice - entryPrice) * amount
     * - Returns principal + profit to balance
     */
    function closePosition(
        uint256 positionIndex,
        uint256 currentPrice
    ) external whenNotPaused {
        require(positionIndex < openPositions[msg.sender].length, "Invalid index");
        
        Position storage position = openPositions[msg.sender][positionIndex];
        require(unmask(position.isActive), "Position not active");
        
        // Calculate profit/loss (all encrypted)
        uint256 entryPrice = unmask(position.entryPrice);
        uint256 amount = unmask(position.amount);
        
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
        suint256 currentBalance = balances[msg.sender];
        balances[msg.sender] = mask(unmask(currentBalance) + returnAmount);
        
        // Mark position as closed
        position.isActive = mask(false);
        
        emit PositionClosed(msg.sender, block.timestamp, unmask(position.coinId));
    }
    
    /**
     * @notice Configure bot settings
     * @dev Sets risk management and strategy parameters
     * 
     * PARAMETERS:
     * - maxPositionSize: Max % of balance per trade (e.g., 30 = 30%)
     * - dailyTradeLimit: Max trades per day (e.g., 5)
     * - isActive: Turn bot on/off
     * - minConfidence: Min AI confidence to trade (e.g., 70 = 70%)
     */
    function configureBotSettings(
        uint256 maxPositionSize,
        uint256 dailyTradeLimit,
        bool isActive,
        uint256 minConfidence
    ) external {
        require(maxPositionSize <= 100, "Max position size is 100%");
        require(minConfidence <= 100, "Min confidence is 100%");
        
        botConfigs[msg.sender] = BotConfig({
            maxPositionSize: mask(maxPositionSize),
            dailyTradeLimit: mask(dailyTradeLimit),
            isActive: mask(isActive),
            minConfidence: mask(minConfidence)
        });
        
        emit BotConfigured(msg.sender, block.timestamp);
    }
    
    
    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @notice Get user's private balance
     * @return balance User's balance (only they can see)
     * 
     * PRIVACY: This function is private, only msg.sender sees their balance
     * If someone else calls it, they get 0 or revert
     */
    function getBalance() external view returns (uint256) {
        return unmask(balances[msg.sender]);
    }
    
    /**
     * @notice Get user's trade history
     * @return Array of trades (decrypted for owner only)
     * 
     * PRIVACY: Only user can see their own trades
     */
    function getTradeHistory() external view returns (Trade[] memory) {
        return tradeHistory[msg.sender];
    }
    
    /**
     * @notice Get user's open positions
     * @return Array of positions (decrypted for owner only)
     */
    function getOpenPositions() external view returns (Position[] memory) {
        return openPositions[msg.sender];
    }
    
    /**
     * @notice Get bot configuration
     * @return BotConfig struct (decrypted for owner only)
     */
    function getBotConfig() external view returns (BotConfig memory) {
        return botConfigs[msg.sender];
    }
    
    /**
     * @notice Get public stats (no private data)
     * @return stats Array: [totalUsers, totalTrades, dailyTradeCount]
     * 
     * SAFE: No private information leaked
     */
    function getPublicStats() external view returns (uint256[3] memory stats) {
        stats[0] = totalUsers;
        stats[1] = totalTrades;
        stats[2] = dailyTradeCount[msg.sender];
    }
    
    
    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @notice Emergency pause trading
     * @dev Only owner can pause in case of exploit or bug
     */
    function pause() external onlyOwner {
        isPaused = true;
    }
    
    /**
     * @notice Resume trading after pause
     */
    function unpause() external onlyOwner {
        isPaused = false;
    }
    
    
    // ==================== INTERNAL FUNCTIONS ====================
    
    /**
     * @dev Reset daily trade counter if it's a new day
     * Called automatically before each trade
     */
    function _resetDailyCounterIfNeeded() internal {
        uint256 today = block.timestamp / 1 days;
        uint256 lastTradeDay = lastTradeDate[msg.sender] / 1 days;
        
        if (today > lastTradeDay) {
            dailyTradeCount[msg.sender] = 0;
            lastTradeDate[msg.sender] = block.timestamp;
        }
    }
    
    /**
     * @dev Mask a public uint256 to make it private
     * @param value Public number
     * @return Encrypted version (suint256)
     * 
     * NOTE: In real Seismic, this uses TEE encryption
     * This is a simplified version for explanation
     */
    function mask(uint256 value) internal pure returns (suint256) {
        // Seismic handles encryption automatically
        // This is just a type conversion
        return suint256.wrap(value);
    }
    
    /**
     * @dev Unmask a private suint256 to public uint256
     * @param value Encrypted number
     * @return Decrypted version (uint256)
     * 
     * SECURITY: Only the owner of the data can unmask it
     */
    function unmask(suint256 value) internal pure returns (uint256) {
        // Seismic checks permissions automatically
        return suint256.unwrap(value);
    }
    
    /**
     * @dev Mask a boolean
     */
    function mask(bool value) internal pure returns (mbool) {
        return mbool.wrap(value);
    }
    
    /**
     * @dev Unmask a boolean
     */
    function unmask(mbool value) internal pure returns (bool) {
        return mbool.unwrap(value);
    }
    
    /**
     * @dev Mask uint8
     */
    function mask(uint8 value) internal pure returns (muint8) {
        return muint8.wrap(value);
    }
    
    /**
     * @dev Unmask uint8
     */
    function unmask(muint8 value) internal pure returns (uint8) {
        return muint8.unwrap(value);
    }
}

/**
 * ====================================================================================
 * DEPLOYMENT INSTRUCTIONS
 * ====================================================================================
 * 
 * FILE LOCATION: contracts/PrivateTradingBot.sol
 * 
 * STEP 1: Install Foundry
 * curl -L https://foundry.paradigm.xyz | bash
 * foundryup
 * 
 * STEP 2: Initialize Foundry project
 * forge init
 * 
 * STEP 3: Save this file as contracts/PrivateTradingBot.sol
 * 
 * STEP 4: Create .env file
 * SEISMIC_RPC_URL=https://testnet-rpc.seismic.systems
 * PRIVATE_KEY=your_private_key_here
 * 
 * STEP 5: Deploy to Seismic testnet
 * source .env
 * forge create PrivateTradingBot \
 *   --rpc-url $SEISMIC_RPC_URL \
 *   --private-key $PRIVATE_KEY
 * 
 * STEP 6: Copy deployed contract address
 * Example output: Deployed to: 0x1234567890abcdef...
 * 
 * STEP 7: Save address to backend/.env
 * TRADING_CONTRACT_ADDRESS=0x1234567890abcdef...
 * 
 * ====================================================================================
 * TESTING INSTRUCTIONS
 * ====================================================================================
 * 
 * Create test file: test/PrivateTradingBot.t.sol
 * 
 * Run tests:
 * forge test -vvv
 * 
 * Check gas costs:
 * forge test --gas-report
 * 
 * ====================================================================================
 * PRIVACY FEATURES EXPLAINED
 * ====================================================================================
 * 
 * 1. MASKED TYPES (suint256, mbool, etc.)
 *    - Data is encrypted on-chain using TEE
 *    - Only authorized addresses can decrypt
 *    - Appears as random bytes to others
 * 
 * 2. PRIVATE FUNCTIONS
 *    - Internal functions that don't expose data
 *    - mask() and unmask() handle encryption
 * 
 * 3. PUBLIC EVENTS (without amounts)
 *    - Events are logged but don't reveal trade sizes
 *    - Good for UI updates without privacy leaks
 * 
 * 4. VIEW FUNCTIONS (owner-only)
 *    - getBalance(), getTradeHistory() only return YOUR data
 *    - Others calling these get 0 or revert
 * 
 * ====================================================================================
 */