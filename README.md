# FreelanceChain — BAC2002 Team 13

A decentralised freelance escrow DApp built on Ethereum Sepolia testnet.

### Project Demo: https://youtu.be/7LnRpRNpntY?si=CKON1HPWVSB257_R

## Team

| Member | Student ID | Role |
|--------|------------|------|
| Wee Jia Xin, Stephanie | 2402628 | React Frontend |
| Shina Shih Xin Rong | 2402781| EscrowContract.sol · DisputeResolver.sol |
| Liew Kai Min | 2402800 | ReputationSBT.sol · Chainlink integration |
| Nicholas Chu | 2401588 | Report Writing |
| Crystal Ng Jing Jing| 2401398 | Demo Recording |

## Deployed Contracts (Sepolia Testnet)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| ReputationSBT | `0x3B8784D847d9Fa037f4ff3FF0768A06aE31c2698` | [View](https://sepolia.etherscan.io/address/0x3B8784D847d9Fa037f4ff3FF0768A06aE31c2698#code) |
| EscrowContract | `0x005413203a49105B57c124C327Ae275B33BA86A0` | [View](https://sepolia.etherscan.io/address/0x005413203a49105B57c124C327Ae275B33BA86A0#code) |
| DisputeResolver | `0x9Fb3c076dDCA4Ef17CF552C2AD52D11606595C8A` | [View](https://sepolia.etherscan.io/address/0x9Fb3c076dDCA4Ef17CF552C2AD52D11606595C8A#code) |
| Chainlink ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | Sepolia feed |

## Reputation Tier System

The freelancer's SBT tier is read directly by `EscrowContract` to enforce escrow terms on-chain.

| Tier | Name | Jobs Completed | Escrow Cap | Slippage Buffer |
|------|------|---------------|------------|-----------------|
| 0 | New | 0 | $500 USD | 2.00% |
| 1 | Established | 1 – 4 | $2,000 USD | 1.50% |
| 2 | Trusted | 5 – 9 | $10,000 USD | 1.00% |
| 3 | Elite | 10+ | Uncapped | 0.50% |

Tiers are computed from on-chain job history and cannot be transferred or spoofed. The SBT is non-transferable (ERC-721 soulbound).

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
- Pinata account for IPFS uploads (free at https://app.pinata.cloud)

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
# Required for contract deployment only
ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_WITHOUT_0x
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
ARBITRATOR_ADDRESS=YOUR_ARBITRATOR_WALLET_ADDRESS

# Required for frontend
VITE_ESCROW_ADDRESS=0x005413203a49105B57c124C327Ae275B33BA86A0
VITE_DISPUTE_ADDRESS=0x9Fb3c076dDCA4Ef17CF552C2AD52D11606595C8A
VITE_PRICEFEED_ADDRESS=0x1AA8818DA24CbB18b8BB4D7e56643C47447f9Da6
VITE_SBT_ADDRESS=0x3B8784D847d9Fa037f4ff3FF0768A06aE31c2698
VITE_PINATA_JWT=YOUR_PINATA_JWT_TOKEN
VITE_IPFS_GATEWAY=https://ipfs.io/ipfs/
VITE_CHAIN_ID=11155111
```

> Get a free Alchemy API key at https://alchemy.com
> Get a free Etherscan API key at https://etherscan.io/myapikey

### Getting your Pinata JWT

Job and milestone metadata (title, description) are uploaded to IPFS via Pinata when creating a job. This is required for `CreateJob` to work.

1. Go to https://app.pinata.cloud and sign up for free
2. Navigate to **API Keys** → **New Key**
3. Enable **pinJSONToIPFS**
4. Copy the **JWT** token and paste it as `VITE_PINATA_JWT` in your `.env`

> **Note for frontend-only setup (e.g. demo recording):** You only need the `VITE_` variables above. The `ALCHEMY_SEPOLIA_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, and `ARBITRATOR_ADDRESS` are only required if you are deploying or verifying contracts.

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

  90 passing
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
npx hardhat verify --network sepolia <SBT_ADDRESS>

npx hardhat verify --network sepolia <ESCROW_ADDRESS> \
  "0x694AA1769357215DE4FAC081bf1f309aDC325306" \
  "<SBT_ADDRESS>"

npx hardhat verify --network sepolia <DISPUTE_ADDRESS> \
  "<ESCROW_ADDRESS>" \
  "<ARBITRATOR_ADDRESS>"
```

After deploying, seed demo wallet tiers:
```bash
npx hardhat run scripts/seedTiers.js --network sepolia
```

---

## Project Structure
```
contracts/
  ChainlinkPriceFeed.sol     — Chainlink ETH/USD feed wrapper
  EscrowContract.sol         — Escrow logic, USD-denominated milestones
  DisputeResolver.sol        — Arbitrator role and dispute resolution
  ReputationSBT.sol          — Non-transferable reputation NFT (SBT)
  interfaces/
    IReputationSBT.sol       — Interface for SBT contract
  mocks/
    MockPriceFeed.sol        — Mock Chainlink feed for testing only
    MockReputationSBT.sol    — Mock SBT for testing only
scripts/
  deploy.js                  — Deployment script
  seedTiers.js               — Seeds demo wallet tiers on ReputationSBT
test/
  ChainlinkPriceFeed.test.js — Chainlink feed wrapper tests
  DisputeResolver.test.js    — Dispute resolution tests
  EscrowContract.test.js     — Escrow workflow tests
  ReputationSBT.test.js      — Reputation SBT tests
frontend/                    — React frontend
.env.example                 — Environment variable template
hardhat.config.js            — Hardhat configuration
```

---

## Smart Contract Architecture

- **ReputationSBT** mints a non-transferable ERC-721 token per wallet on first interaction. Computes tier 0–3 from on-chain job history. Tier is read directly by EscrowContract to enforce escrow caps and slippage buffers. Implements a dispute-time freeze mechanism that prevents tier reads during active disputes.
- **EscrowContract** holds ETH in escrow per milestone. Uses Chainlink ETH/USD feed to convert USD milestone values to ETH at funding time. Reads the freelancer's SBT tier to apply the correct slippage buffer and enforce the escrow cap via `require()`. Implements Chainlink Automation (`checkUpkeep` / `performUpkeep`) for automatic deadline-based refunds.
- **DisputeResolver** holds the `ARBITRATOR_ROLE`. Calls `resolveFromDispute()` on EscrowContract to release or refund funds. Unfreezes the freelancer's SBT tier after resolution and updates reputation for both parties.
- **ChainlinkPriceFeed** wraps the Chainlink AggregatorV3 ETH/USD feed with staleness validation (1 hour threshold) and USD-to-ETH conversion logic.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Ethereum Sepolia |
| Smart contracts | Solidity ^0.8.20 |
| Security libraries | OpenZeppelin v5 |
| Oracle | Chainlink ETH/USD + Automation |
| Development | Hardhat v2 |
| Testing | Mocha + Chai |
| Frontend | React + ethers.js v6 |
| Wallet | MetaMask |
| Off-chain storage | IPFS / Pinata |
