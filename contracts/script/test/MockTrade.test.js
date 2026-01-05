const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockTrade", function () {
  let contract;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const MockTrade = await ethers.getContractFactory("MockTrade");
    contract = await MockTrade.deploy();
    await contract.waitForDeployment();
  });

  it("Should enter trade", async function () {
    const asset = ethers.ZeroAddress;
    const amount = 1000;
    await expect(contract.enterTrade(asset, amount))
      .to.emit(contract, "TradeEntered")
      .withArgs(owner.address, asset, amount, await contract.entryPrices(asset));
  });
});