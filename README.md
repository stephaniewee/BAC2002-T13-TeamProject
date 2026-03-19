# FreelanceChain — BAC2002 Team 13

A decentralised freelance escrow DApp built on Ethereum Sepolia testnet.

## Team

| Member | Role |
|--------|------|
| Stephanie | React Frontend |
| Shina | EscrowContract.sol · DisputeResolver.sol |
| Kai Min | ReputationSBT.sol · Chainlink integration |
| Nicholas | |
| Crystal | |

## Deployed Contracts (Sepolia Testnet)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| EscrowContract | `0x57006E4CCf82bBB7Fe8486dbdfA673c3B38211FD` | [View](https://sepolia.etherscan.io/address/0x57006E4CCf82bBB7Fe8486dbdfA673c3B38211FD#code) |
| DisputeResolver | `0xBC849c92bBC6f2978106E7bf317fbcF5e76faC09` | [View](https://sepolia.etherscan.io/address/0xBC849c92bBC6f2978106E7bf317fbcF5e76faC09#code) |
| MockReputationSBT | `0x9c9F204B8FfC8DcA83F24Dc48670fF5B4DA673F7` | [View](https://sepolia.etherscan.io/address/0x9c9F204B8FfC8DcA83F24Dc48670fF5B4DA673F7#code) |
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
- Sepolia testnet ETH (get from https://sepoliafaucet.com)

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
PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
ARBITRATOR_ADDRESS=YOUR_ARBITRATOR_WALLET_ADDRESS

VITE_ESCROW_ADDRESS=0x...
VITE_FACTORY_ADDRESS=0x...
VITE_SBT_ADDRESS=0x...
VITE_USDC_ADDRESS=0x...
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_CHAIN_ID=11155111
VITE_API_URL=http://localhost:3001
```

> Get a free Alchemy API key at https://alchemy.com
> Get a free Etherscan API key at https://etherscan.io/myapikey

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
EscrowContract
  ✔ creates a milestone correctly
  ✔ funds a milestone with correct ETH amount
  ✔ reverts if ETH sent is insufficient
  ✔ completes full lifecycle: create → fund → submit → approve
  ✔ handles dispute and arbitrator resolution

5 passing
```

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
  EscrowContract.sol        — Escrow logic, Chainlink USD→ETH, SBT tier
  DisputeResolver.sol       — Arbitrator role, dispute resolution
  interfaces/
    IReputationSBT.sol      — Interface for SBT contract
  mocks/
    MockPriceFeed.sol       — Mock Chainlink feed for testing
    MockReputationSBT.sol   — Mock SBT for testing
scripts/
  deploy.js                 — Deployment script
test/
  EscrowContract.test.js    — Full test suite
  DisputeResolver.test.js   — Dispute resolution tests
frontend/                   — React frontend (Stephanie)
.env.example                — Environment variable template
hardhat.config.js           — Hardhat configuration
```

---

## Smart Contract Architecture

- **EscrowContract** holds ETH in escrow per milestone. Uses Chainlink ETH/USD feed to convert USD milestone values to ETH at funding time. Reads SBT tier to apply slippage buffer.
- **DisputeResolver** holds the ARBITRATOR_ROLE. Calls `resolveFromDispute()` on Escrow to release or refund funds.
- **ReputationSBT** (Kai Min) mints a non-transferable ERC-721 token per wallet. Returns tier 0–3 which actively adjusts escrow terms.

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