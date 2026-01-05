// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title PrivateTradingBot
 * @notice Smart contract for private cryptocurrency trading on Seismic blockchain
 * @dev Uses Seismic's shielded types (suint256, sbool, saddress) for privacy
 * 
 * FILE: contracts/PrivateTradingBot.sol
 * 
 * COMPILE WITH: sforge (NOT regular forge!)
 * 
 * IMPORTANT SETUP:
 * 1. Install Seismic Foundry: curl -L https://api.github.com/repos/SeismicSystems/seismic-foundry/contents/sfoundryup/install?ref=seismic | bash
 * 2. Run: sfoundryup
 * 3. Compile: sforge build
 * 4. Test: sforge test
 * 
 * SHIELDED TYPES (Seismic-specific):
 * - suint256 = shielded uint256 (encrypted on-chain)
 * - sbool = shielded boolean (encrypted true/false)
 * - saddress = shielded address (encrypted wallet address)
 * - suint8 = shielded uint8
 * - No imports needed - built into ssolc compiler!
 */

contract PrivateTradingBot {
    
    // ==================== STRUCTS ====================
    
    struct Trade {
        suint256 amount;        // PRIVATE: Trade size
        suint256 price;         // PRIVATE: Entry price
        sbool isBuy;            // PRIVATE: true = BUY, false = SELL
        uint256 timestamp;      // PUBLIC: Block timestamp
        suint8 coinId;          // PRIVATE: Coin identifier
    }
    
    struct Position {
        suint256 entryPrice;    // PRIVATE: Price when opened
        suint256 amount;        // PRIVATE: Position size
        suint256 stopLoss;      // PRIVATE: Stop-loss price
        suint256 takeProfit;    // PRIVATE: Take-profit price
        uint256 openedAt;       // PUBLIC: When position opened
        sbool isActive;         // PRIVATE: Is position still open?
        suint8 coinId;          // PRIVATE: Which coin
    }
    
    struct BotConfig {
        suint256 maxPositionSize;   // PRIVATE: Max % per trade
        suint256 dailyTradeLimit;   // PRIVATE: Max trades per day
        sbool isActive;             // PRIVATE: Is bot currently trading?
        suint256 minConfidence;     // PRIVATE: Min AI confidence (0-100)
    }
    
    
    // ==================== STATE VARIABLES ====================
    
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
    
    
    // ==================== EVENTS ====================
    
    event TradeExecuted(
        address indexed user,
        uint256 timestamp,
        bool isBuy,
        uint8 coinId
    );
    
    event PositionClosed(
        address indexed user,
        uint256 timestamp,
        uint8 coinId
    );
    
    event BotConfigured(
        address indexed user,
        uint256 timestamp
    );
    
    event Deposit(
        address indexed user,
        uint256 timestamp
    );
    
    event Withdrawal(
        address indexed user,
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
            dailyTradeCount[msg.sender] < uint256(config.dailyTradeLimit),
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
        
        // Convert public ETH to private shielded balance
        suint256 maskedAmount = suint256(msg.value);
        
        // Add to user's balance (encrypted)
        balances[msg.sender] = balances[msg.sender] + maskedAmount;
        
        // If first deposit, increment user counter
        if (uint256(balances[msg.sender]) == msg.value) {
            totalUsers++;
        }
        
        emit Deposit(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Withdraw funds from the bot
     */
    function withdraw(uint256 amount) external whenNotPaused {
        suint256 currentBalance = balances[msg.sender];
        require(uint256(currentBalance) >= amount, "Insufficient balance");
        
        // Reduce balance BEFORE sending (reentrancy protection)
        balances[msg.sender] = suint256(uint256(currentBalance) - amount);
        
        // Send ETH to user
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(msg.sender, block.timestamp);
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
        require(bool(config.isActive), "Bot not active");
        
        suint256 currentBalance = balances[msg.sender];
        require(uint256(currentBalance) >= amount, "Insufficient balance");
        
        // Create private trade record
        Trade memory newTrade = Trade({
            amount: suint256(amount),
            price: suint256(price),
            isBuy: sbool(isBuy),
            timestamp: block.timestamp,
            coinId: suint8(coinId)
        });
        
        // Add to trade history (encrypted)
        tradeHistory[msg.sender].push(newTrade);
        
        // Update balance (deduct cost + fees)
        uint256 totalCost = amount + (amount / 1000); // 0.1% fee
        balances[msg.sender] = suint256(uint256(currentBalance) - totalCost);
        
        // Increment counters
        dailyTradeCount[msg.sender]++;
        totalTrades++;
        
        // Emit public event (no amounts)
        emit TradeExecuted(msg.sender, block.timestamp, isBuy, coinId);
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
        require(bool(config.isActive), "Bot not active");
        
        suint256 currentBalance = balances[msg.sender];
        require(uint256(currentBalance) >= amount, "Insufficient balance");
        
        // Validate risk management parameters
        require(stopLoss < entryPrice, "Stop-loss must be below entry");
        require(takeProfit > entryPrice, "Take-profit must be above entry");
        
        // Create position (all fields encrypted)
        Position memory newPosition = Position({
            entryPrice: suint256(entryPrice),
            amount: suint256(amount),
            stopLoss: suint256(stopLoss),
            takeProfit: suint256(takeProfit),
            openedAt: block.timestamp,
            isActive: sbool(true),
            coinId: suint8(coinId)
        });
        
        openPositions[msg.sender].push(newPosition);
        
        // Deduct from balance
        balances[msg.sender] = suint256(uint256(currentBalance) - amount);
        
        dailyTradeCount[msg.sender]++;
        totalTrades++;
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
        require(bool(position.isActive), "Position not active");
        
        // Calculate profit/loss
        uint256 entryPrice = uint256(position.entryPrice);
        uint256 amount = uint256(position.amount);
        
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
        balances[msg.sender] = suint256(uint256(currentBalance) + returnAmount);
        
        // Mark position as closed
        position.isActive = sbool(false);
        
        emit PositionClosed(msg.sender, block.timestamp, uint8(position.coinId));
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
        
        botConfigs[msg.sender] = BotConfig({
            maxPositionSize: suint256(maxPositionSize),
            dailyTradeLimit: suint256(dailyTradeLimit),
            isActive: sbool(isActive),
            minConfidence: suint256(minConfidence)
        });
        
        emit BotConfigured(msg.sender, block.timestamp);
    }
    
    
    // ==================== VIEW FUNCTIONS ====================
    
    function getBalance() external view returns (uint256) {
        return uint256(balances[msg.sender]);
    }
    
    function getTradeHistory() external view returns (Trade[] memory) {
        return tradeHistory[msg.sender];
    }
    
    function getOpenPositions() external view returns (Position[] memory) {
        return openPositions[msg.sender];
    }
    
    function getBotConfig() external view returns (BotConfig memory) {
        return botConfigs[msg.sender];
    }
    
    function getPublicStats() external view returns (uint256[3] memory stats) {
        stats[0] = totalUsers;
        stats[1] = totalTrades;
        stats[2] = dailyTradeCount[msg.sender];
    }
    
    
    // ==================== ADMIN FUNCTIONS ====================
    
    function pause() external onlyOwner {
        isPaused = true;
    }
    
    function unpause() external onlyOwner {
        isPaused = false;
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
}

/**
 * ====================================================================================
 * SETUP INSTRUCTIONS (IMPORTANT!)
 * ====================================================================================
 * 
 * ❌ DO NOT USE: forge (regular Foundry)
 * ✅ USE: sforge (Seismic Foundry)
 * 
 * STEP 1: Install Seismic Foundry
 * ---------------------------------
 * 
 * # Install Rust (if not installed)
 * curl https://sh.rustup.rs -sSf | sh
 * source ~/.zshenv
 * 
 * # Install Seismic Foundry
 * curl -L \
 *   -H "Accept: application/vnd.github.v3.raw" \
 *   "https://api.github.com/repos/SeismicSystems/seismic-foundry/contents/sfoundryup/install?ref=seismic" | bash
 * 
 * source ~/.zshenv
 * 
 * # Install sforge, sanvil, ssolc (takes 5-20 minutes)
 * sfoundryup
 * source ~/.zshenv
 * 
 * # Verify installation
 * sforge --version
 * ssolc --version
 * 
 * 
 * STEP 2: Initialize Project
 * --------------------------
 * 
 * # Create new project
 * sforge init my-trading-bot
 * cd my-trading-bot
 * 
 * # Or in existing project
 * sforge clean  # Remove old artifacts
 * 
 * 
 * STEP 3: Save Contract
 * ---------------------
 * 
 * # Save this file as:
 * # src/PrivateTradingBot.sol
 * 
 * 
 * STEP 4: Compile
 * ---------------
 * 
 * sforge build
 * 
 * # Expected output:
 * # [⠊] Compiling...
 * # [⠒] Compiling 1 files with Ssolc 0.8.13
 * # [⠢] Ssolc 0.8.13 finished
 * # Compiler run successful!
 * 
 * 
 * STEP 5: Create Test File
 * -------------------------
 * 
 * Create test/PrivateTradingBot.t.sol:
 * 

 * pragma solidity ^0.8.13;
 * 
 * import {Test} from "forge-std/Test.sol";
 * import {PrivateTradingBot} from "../src/PrivateTradingBot.sol";
 * 
 * contract PrivateTradingBotTest is Test {
 *     PrivateTradingBot bot;
 *     address user = address(0x123);
 *     
 *     function setUp() public {
 *         bot = new PrivateTradingBot();
 *         vm.deal(user, 10 ether);
 *     }
 *     
 *     function testDeposit() public {
 *         vm.startPrank(user);
 *         bot.deposit{value: 1 ether}();
 *         assertEq(bot.getBalance(), 1 ether);
 *         vm.stopPrank();
 *     }
 *     
 *     function testExecuteTrade() public {
 *         vm.startPrank(user);
 *         
 *         // Deposit funds
 *         bot.deposit{value: 1 ether}();
 *         
 *         // Configure bot
 *         bot.configureBotSettings(30, 5, true, 70);
 *         
 *         // Execute trade
 *         bot.executeTrade(0.1 ether, 45000, true, 0);
 *         
 *         // Check trade was recorded
 *         assertEq(bot.getTradeHistory().length, 1);
 *         
 *         vm.stopPrank();
 *     }
 * }
 * 
 * 
 * STEP 6: Test
 * ------------
 * 
 * sforge test -vvv
 * 
 * # Expected output:
 * # Running 2 tests...
 * # [PASS] testDeposit() (gas: 123456)
 * # [PASS] testExecuteTrade() (gas: 234567)
 * # Test result: ok. 2 passed
 * 
 * 
 * STEP 7: Deploy to Seismic Testnet
 * ----------------------------------
 * 
 * # Create .env file:
 * SEISMIC_RPC_URL=https://testnet-rpc.seismic.systems
 * PRIVATE_KEY=0x...
 * 
 * # Deploy
 * source .env
 * sforge create PrivateTradingBot \
 *   --rpc-url $SEISMIC_RPC_URL \
 *   --private-key $PRIVATE_KEY
 * 
 * # Expected output:
 * # Deployer: 0x...
 * # Deployed to: 0xabcdef...  <- SAVE THIS ADDRESS
 * 
 * 
 * ====================================================================================
 * TROUBLESHOOTING
 * ====================================================================================
 * 
 * ERROR: "Identifier not found or not unique" for suint256
 * SOLUTION: You're using forge instead of sforge. Install Seismic Foundry!
 * 
 * ERROR: "command not found: sforge"
 * SOLUTION: Run sfoundryup and source ~/.zshenv
 * 
 * ERROR: "sfoundryup: command not found"
 * SOLUTION: Re-run the installation script from Step 1
 * 
 * ERROR: Compilation takes too long
 * SOLUTION: This is normal. First compilation can take 5-20 minutes.
 * 
 * ====================================================================================
 * KEY DIFFERENCES: SEISMIC vs ETHEREUM
 * ====================================================================================
 * 
 * ETHEREUM SOLIDITY          | SEISMIC SOLIDITY
 * ---------------------------|---------------------------
 * uint256 balance;           | suint256 balance;
 * bool isActive;             | sbool isActive;
 * address owner;             | saddress owner;
 * Compiler: solc             | Compiler: ssolc
 * Build tool: forge          | Build tool: sforge
 * Local node: anvil          | Local node: sanvil
 * Data: PUBLIC by default    | Data: PRIVATE with stypes
 * 
 * ====================================================================================
 * CASTING BETWEEN TYPES
 * ====================================================================================
 * 
 * // Public to Shielded (mask)
 * uint256 publicValue = 100;
 * suint256 shieldedValue = suint256(publicValue);
 * 
 * // Shielded to Public (unmask)
 * suint256 shieldedValue = suint256(100);
 * uint256 publicValue = uint256(shieldedValue);
 * 
 * // Direct construction
 * suint256 amount = suint256(msg.value);
 * sbool isActive = sbool(true);
 * suint8 coinId = suint8(0);
 * 
 * ====================================================================================
 */