// shared/utils.js
const { ethers } = require('ethers');

function generateWallet(privateKey = null) {
  if (privateKey && privateKey !== 'random') {
    return new ethers.Wallet(privateKey);
  }
  return ethers.Wallet.createRandom();
}

function isValidAddress(address) {
  return ethers.isAddress(address);
}

// EXPORT IT CORRECTLY
module.exports = { generateWallet, isValidAddress };