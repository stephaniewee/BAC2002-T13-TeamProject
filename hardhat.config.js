require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun"
        }
      }
    ]
  },
  networks: {
    hardhat: {
      hardfork: "cancun"
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};