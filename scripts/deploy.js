const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // ── 1. Deploy MockReputationSBT (placeholder until Kai Min deploys) ──
  console.log("\n1. Deploying MockReputationSBT...");
  const MockSBT = await ethers.getContractFactory("MockReputationSBT");
  const mockSBT = await MockSBT.deploy();
  await mockSBT.waitForDeployment();
  console.log("   MockReputationSBT deployed to:", await mockSBT.getAddress());

  // ── 2. Deploy EscrowContract ─────────────────────────────────────────
  // Sepolia Chainlink ETH/USD price feed address
  const CHAINLINK_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  console.log("\n2. Deploying EscrowContract...");
  const Escrow = await ethers.getContractFactory("EscrowContract");
  const escrow = await Escrow.deploy(
    CHAINLINK_SEPOLIA,
    await mockSBT.getAddress()
  );
  await escrow.waitForDeployment();
  console.log("   EscrowContract deployed to:", await escrow.getAddress());

  // ── 3. Deploy DisputeResolver ────────────────────────────────────────
  const ARBITRATOR_ADDRESS = process.env.ARBITRATOR_ADDRESS || deployer.address;

  console.log("\n3. Deploying DisputeResolver...");
  const Dispute = await ethers.getContractFactory("DisputeResolver");
  const disputeResolver = await Dispute.deploy(
    await escrow.getAddress(),
    ARBITRATOR_ADDRESS
  );
  await disputeResolver.waitForDeployment();
  console.log("   DisputeResolver deployed to:", await disputeResolver.getAddress());

  // ── 4. Grant DISPUTE_ROLE to DisputeResolver ─────────────────────────
  console.log("\n4. Granting DISPUTE_ROLE to DisputeResolver...");
  const DISPUTE_ROLE = await escrow.DISPUTE_ROLE();
  const tx = await escrow.grantRole(DISPUTE_ROLE, await disputeResolver.getAddress());
  await tx.wait();
  console.log("   DISPUTE_ROLE granted");

  // ── 5. Print summary ─────────────────────────────────────────────────
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:           Sepolia");
  console.log("MockReputationSBT:", await mockSBT.getAddress());
  console.log("EscrowContract:   ", await escrow.getAddress());
  console.log("DisputeResolver:  ", await disputeResolver.getAddress());
  console.log("Chainlink feed:    0x694AA1769357215DE4FAC081bf1f309aDC325306");
  console.log("Arbitrator:       ", ARBITRATOR_ADDRESS);
  console.log("\nSave these addresses — you will need them for the frontend and README.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });