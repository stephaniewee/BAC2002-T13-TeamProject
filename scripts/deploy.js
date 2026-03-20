const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Sepolia Chainlink ETH/USD price feed address
  const CHAINLINK_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  // ── 1. Deploy ReputationSBT ──────────────────────────────────────────
  console.log("\n1. Deploying ReputationSBT...");
  const ReputationSBT = await ethers.getContractFactory("ReputationSBT");
  const reputationSBT = await ReputationSBT.deploy();
  await reputationSBT.waitForDeployment();
  console.log("   ReputationSBT deployed to:", await reputationSBT.getAddress());

  // ── 2. Deploy ChainlinkPriceFeed ─────────────────────────────────────
  console.log("\n2. Deploying ChainlinkPriceFeed...");
  const ChainlinkPriceFeed = await ethers.getContractFactory("ChainlinkPriceFeed");
  const chainlinkFeed = await ChainlinkPriceFeed.deploy(CHAINLINK_SEPOLIA);
  await chainlinkFeed.waitForDeployment();
  console.log("   ChainlinkPriceFeed deployed to:", await chainlinkFeed.getAddress());

  // ── 3. Deploy EscrowContract ─────────────────────────────────────────
  console.log("\n3. Deploying EscrowContract...");
  const Escrow = await ethers.getContractFactory("EscrowContract");
  const escrow = await Escrow.deploy(
    CHAINLINK_SEPOLIA,
    await reputationSBT.getAddress()
  );
  await escrow.waitForDeployment();
  console.log("   EscrowContract deployed to:", await escrow.getAddress());

  // ── 4. Deploy DisputeResolver ────────────────────────────────────────
  const ARBITRATOR_ADDRESS = process.env.ARBITRATOR_ADDRESS || deployer.address;

  console.log("\n4. Deploying DisputeResolver...");
  const Dispute = await ethers.getContractFactory("DisputeResolver");
  const disputeResolver = await Dispute.deploy(
    await escrow.getAddress(),
    ARBITRATOR_ADDRESS
  );
  await disputeResolver.waitForDeployment();
  console.log("   DisputeResolver deployed to:", await disputeResolver.getAddress());

  // ── 5. Wire up roles ─────────────────────────────────────────────────
  console.log("\n5. Granting DISPUTE_ROLE to DisputeResolver...");
  const DISPUTE_ROLE = await escrow.DISPUTE_ROLE();
  const tx1 = await escrow.grantRole(DISPUTE_ROLE, await disputeResolver.getAddress());
  await tx1.wait();
  console.log("   DISPUTE_ROLE granted");

  console.log("\n6. Granting ESCROW_ROLE to EscrowContract on ReputationSBT...");
  const tx2 = await reputationSBT.grantEscrowRole(await escrow.getAddress());
  await tx2.wait();
  console.log("   ESCROW_ROLE granted");

  // ── 6. Print summary ─────────────────────────────────────────────────
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:             Sepolia");
  console.log("ReputationSBT:      ", await reputationSBT.getAddress());
  console.log("ChainlinkPriceFeed: ", await chainlinkFeed.getAddress());
  console.log("EscrowContract:     ", await escrow.getAddress());
  console.log("DisputeResolver:    ", await disputeResolver.getAddress());
  console.log("Chainlink feed:      0x694AA1769357215DE4FAC081bf1f309aDC325306");
  console.log("Arbitrator:         ", ARBITRATOR_ADDRESS);
  console.log("\nSave these addresses — you will need them for the frontend and README.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });