# FreelanceChain — BAC2002 Team 13

A decentralised freelance escrow DApp built on Ethereum Sepolia testnet.

## Team

| Member | Role |
|--------|------|
| Stephanie | React Frontend |
| Shina | EscrowContract.sol · DisputeResolver.sol |
| Kai Min | ReputationSBT.sol · Chainlink integration |
| Nicholas | Report Writing |
| Crystal | Project Demo |

## Deployed Contracts (Sepolia Testnet)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| EscrowContract | `0x57006E4CCf82bBB7Fe8486dbdfA673c3B38211FD` | [View](https://sepolia.etherscan.io/address/0x57006E4CCf82bBB7Fe8486dbdfA673c3B38211FD#code) |
| DisputeResolver | `0xBC849c92bBC6f2978106E7bf317fbcF5e76faC09` | [View](https://sepolia.etherscan.io/address/0xBC849c92bBC6f2978106E7bf317fbcF5e76faC09#code) |
| ReputationSBT | `0x` | [View]() |
| Chainlink ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | Sepolia feed |

---

## Opening in GitHub Codespace

> Recommended for all teammates — no local installation needed.

1. Go to the repository on GitHub
2. Click the green **Code** button
3. Select the **Codespaces** tab
4. Click **Create codespace on main**
5. Once the Codespace loads, run:
```bash
npm install
cp .env.example .env
# Fill in your .env values, then:
npx hardhat compile
npx hardhat test
```

---

## Prerequisites

- Node.js v18+
- npm v8+
- MetaMask browser extension
- Sepolia testnet ETH (get from https://sepolia-faucet.pk910.de/)

---

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/stephaniewee/BAC2002-T13-TeamProject.git
cd BAC2002-T13-TeamProject
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Fill in your values:
```
ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_WITHOUT_0x
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
ARBITRATOR_ADDRESS=YOUR_ARBITRATOR_WALLET_ADDRESS

# Frontend (Vite) Variables
VITE_ESCROW_ADDRESS=0x...
VITE_DISPUTE_ADDRESS=0x...
VITE_PRICEFEED_ADDRESS=0x...
VITE_SBT_ADDRESS=0x...
VITE_PINATA_JWT=YOUR_PINATA_JWT_TOKEN
VITE_IPFS_GATEWAY=https://ipfs.io/ipfs/
VITE_RPC_URL=${ALCHEMY_SEPOLIA_URL}
VITE_CHAIN_ID=11155111
```

> Get a free Alchemy API key at https://alchemy.com
> Get a free Etherscan API key at https://etherscan.io/myapikey
> Generate a Pinata JWT for IPFS uploads at https://app.pinata.cloud/developers/api-keys

---

## Compile Contracts
```bash
npx hardhat compile
```

---

## Run Tests
```bash
npx hardhat test
```

Expected output:
```
ChainlinkPriceFeed
DisputeResolver
EscrowContract
ReputationSBT

  ...individual test cases...

  50 passing
```

If your local count differs slightly after future edits, the key success signal is that all suites pass with 0 failing.

---

## Run Gas Report
```bash
REPORT_GAS=true npx hardhat test
```

---

## Run Frontend
```bash
npm run frontend:dev
```

Build and preview:
```bash
npm run frontend:build
npm run frontend:preview
```

---

## Deploy to Sepolia

> Contracts are already deployed. Only run this if redeploying.
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

After deploying, verify on Etherscan:
```bash
npx hardhat verify --network sepolia <MOCK_SBT_ADDRESS>

npx hardhat verify --network sepolia <ESCROW_ADDRESS> \
  "0x694AA1769357215DE4FAC081bf1f309aDC325306" \
  "<MOCK_SBT_ADDRESS>"

npx hardhat verify --network sepolia <DISPUTE_ADDRESS> \
  "<ESCROW_ADDRESS>" \
  "<ARBITRATOR_ADDRESS>"
```

---

## Project Structure
```
contracts/
  ChainlinkPriceFeed.sol    — Chainlink ETH/USD feed wrapper
  EscrowContract.sol        — Escrow logic, USD-denominated milestones
  DisputeResolver.sol       — Arbitrator role and dispute resolution
  ReputationSBT.sol         — Non-transferable reputation NFT (SBT)
  interfaces/
    IReputationSBT.sol      — Interface for SBT contract
  mocks/
    MockPriceFeed.sol       — Mock Chainlink feed for testing
    MockReputationSBT.sol   — Mock SBT for testing
scripts/
  deploy.js                 — Deployment script
test/
  ChainlinkPriceFeed.test.js — Chainlink feed wrapper tests
  DisputeResolver.test.js   — Dispute resolution tests
  EscrowContract.test.js    — Escrow workflow tests
  ReputationSBT.test.js     — Reputation SBT tests
frontend/                   — React frontend
.env.example                — Environment variable template
hardhat.config.js           — Hardhat configuration
```

---

## Smart Contract Architecture

- **EscrowContract** holds ETH in escrow per milestone. Uses Chainlink ETH/USD feed to convert USD milestone values to ETH at funding time. Reads SBT tier to apply slippage buffer.
- **Escrow metadata** stores a `metadataHash` and `metadataCID` per milestone. The frontend uploads job/milestone title + description JSON to IPFS and links it on-chain during milestone creation.
- **DisputeResolver** holds the ARBITRATOR_ROLE. Calls `resolveFromDispute()` on Escrow to release or refund funds.
- **ReputationSBT** mints a non-transferable ERC-721 token per wallet. Returns tier 0–3 which actively adjusts escrow terms.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Ethereum Sepolia |
| Smart contracts | Solidity ^0.8.20 |
| Security libraries | OpenZeppelin v5 |
| Oracle | Chainlink ETH/USD |
| Development | Hardhat v2 |
| Testing | Mocha + Chai |
| Frontend | React + ethers.js v6 |
| Wallet | MetaMask |
| Off-chain storage | IPFS / Pinata |