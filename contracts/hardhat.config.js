require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.24",
  networks: {
    seismicTestnet: {
      url: "https://testnet-rpc.seismic.systems", // Update from docs
      accounts: [process.env.PRIVATE_KEY || "0x..."] // Test key
    }
  }
};