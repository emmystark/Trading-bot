// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {PrivateTradingBot} from "../src/PrivateTradingBot.sol";

contract PrivateTradingBotTest is Test {
    
    PrivateTradingBot public bot;
    address public alice;
    address public bob;
    
    uint256 constant INITIAL_BALANCE = 10 ether;
    uint256 constant DEPOSIT_AMOUNT = 1 ether;
    
    function setUp() public {
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        
        vm.deal(alice, INITIAL_BALANCE);
        vm.deal(bob, INITIAL_BALANCE);
        
        bot = new PrivateTradingBot();
    }
    
    function testDeposit() public {
        vm.startPrank(alice);
        bot.deposit{value: DEPOSIT_AMOUNT}();
        assertEq(bot.getBalance(), DEPOSIT_AMOUNT);
        vm.stopPrank();
    }
    
    function testMultipleDeposits() public {
        vm.startPrank(alice);
        bot.deposit{value: 1 ether}();
        bot.deposit{value: 0.5 ether}();
        assertEq(bot.getBalance(), 1.5 ether);
        vm.stopPrank();
    }
    
    function testDepositRevertsWithZero() public {
        vm.startPrank(alice);
        vm.expectRevert("Must deposit more than 0");
        bot.deposit{value: 0}();
        vm.stopPrank();
    }
    
    function testWithdrawal() public {
        vm.startPrank(alice);
        bot.deposit{value: 2 ether}();
        uint256 balanceBefore = alice.balance;
        
        bot.withdraw(1 ether);
        
        assertEq(bot.getBalance(), 1 ether);
        assertEq(alice.balance, balanceBefore + 1 ether);
        vm.stopPrank();
    }
    
    function testWithdrawalRevertsInsufficientBalance() public {
        vm.startPrank(alice);
        bot.deposit{value: 1 ether}();
        
        vm.expectRevert("Insufficient balance");
        bot.withdraw(2 ether);
        vm.stopPrank();
    }
    
    function testConfigureBot() public {
        vm.startPrank(alice);
        bot.configureBotSettings(30, 5, true, 70);
        
        PrivateTradingBot.BotConfig memory config = bot.getBotConfig();
        assertEq(uint256(config.maxPositionSize), 30);
        assertEq(uint256(config.dailyTradeLimit), 5);
        assertEq(bool(config.isActive), true);
        vm.stopPrank();
    }
    
    function testExecuteTrade() public {
        vm.startPrank(alice);
        
        bot.deposit{value: 2 ether}();
        bot.configureBotSettings(30, 5, true, 70);
        bot.executeTrade(0.1 ether, 45000, true, 0);
        
        PrivateTradingBot.Trade[] memory trades = bot.getTradeHistory();
        assertEq(trades.length, 1);
        vm.stopPrank();
    }
    
    // function testTradeRevertsNotConfigured() public {
    //     vm.startPrank(alice);
    //     bot.deposit{value: 1 ether}();
        
    //     vm.expectRevert("Bot not active");
    //     bot.executeTrade(0.1 ether, 45000, true, 0);
    //     vm.stopPrank();
    // }
    
    function testOpenPosition() public {
        vm.startPrank(alice);
        
        bot.deposit{value: 2 ether}();
        bot.configureBotSettings(30, 5, true, 70);
        bot.openPosition(0.5 ether, 45000, 43000, 50000, 0);
        
        PrivateTradingBot.Position[] memory positions = bot.getOpenPositions();
        assertEq(positions.length, 1);
        assertEq(bool(positions[0].isActive), true);
        vm.stopPrank();
    }
    
    function testClosePosition() public {
        vm.startPrank(alice);
        
        bot.deposit{value: 2 ether}();
        bot.configureBotSettings(30, 5, true, 70);
        bot.openPosition(0.5 ether, 45000, 43000, 50000, 0);
        
        bot.closePosition(0, 50000);
        
        PrivateTradingBot.Position[] memory positions = bot.getOpenPositions();
        assertEq(bool(positions[0].isActive), false);
        vm.stopPrank();
    }
    
    function testPause() public {
        bot.pause();
        assertEq(bot.isPaused(), true);
        
        vm.startPrank(alice);
        vm.expectRevert("Trading is paused");
        bot.deposit{value: 1 ether}();
        vm.stopPrank();
    }
    
    function testPrivacyIsolation() public {
        vm.prank(alice);
        bot.deposit{value: 5 ether}();
        
        vm.prank(bob);
        bot.deposit{value: 3 ether}();
        
        vm.prank(alice);
        assertEq(bot.getBalance(), 5 ether);
        
        vm.prank(bob);
        assertEq(bot.getBalance(), 3 ether);
    }
}