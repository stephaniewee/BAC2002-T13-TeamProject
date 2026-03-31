const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Seeding with account:", deployer.address);

  const SBT_ADDRESS = "0x3B8784D847d9Fa037f4ff3FF0768A06aE31c2698";
  const ReputationSBT = await ethers.getContractAt("ReputationSBT", SBT_ADDRESS);

  // Demo wallets
  const walletNew         = "0x583b3751029FE94d35AB15ace4Fd55A9E6fE55fA"; // Tier 0 — do nothing
  const walletEstablished = "0x5A82286B96D9Db6dba922Cc8f42D10C6774D57F0"; // Tier 1 — 1 job
  const walletTrusted     = "0x6cC70ddC67554B0eb939Bf45e7aA84EAC8498649"; // Tier 2 — 5 jobs
  const walletElite       = "0x0AAB17e5a3E6B07Ac33588C1Cb46403A116cd608"; // Tier 3 — 10 jobs

  const ESCROW_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ESCROW_ROLE"));

  // Grant deployer ESCROW_ROLE temporarily
  console.log("\nGranting ESCROW_ROLE to deployer temporarily...");
  await (await ReputationSBT.grantEscrowRole(deployer.address)).wait();
  console.log("Granted.");

  // Wallet A — New, do nothing
  console.log("\nWallet A (New) — no seeding needed, stays Tier 0.");

  // Wallet B — Established (1 job)
  console.log("\nSeeding Wallet B → Established (1 job)...");
  await (await ReputationSBT.updateReputation(walletEstablished, true)).wait();
  console.log("Done — Wallet B is Tier 1 Established.");

  // Wallet C — Trusted (5 jobs)
  console.log("\nSeeding Wallet C → Trusted (5 jobs)...");
  for (let i = 0; i < 5; i++) {
    await (await ReputationSBT.updateReputation(walletTrusted, true)).wait();
    console.log(`  ${i + 1}/5`);
  }
  console.log("Done — Wallet C is Tier 2 Trusted.");

  // Wallet D — Elite (10 jobs)
  console.log("\nSeeding Wallet D → Elite (10 jobs)...");
  for (let i = 0; i < 10; i++) {
    await (await ReputationSBT.updateReputation(walletElite, true)).wait();
    console.log(`  ${i + 1}/10`);
  }
  console.log("Done — Wallet D is Tier 3 Elite.");

  // Revoke ESCROW_ROLE from deployer
  console.log("\nRevoking ESCROW_ROLE from deployer...");
  await (await ReputationSBT.revokeRole(ESCROW_ROLE, deployer.address)).wait();
  console.log("Revoked.");

  console.log("\n=== SEEDING COMPLETE ===");
  console.log("Wallet A (New):        ", walletNew);
  console.log("Wallet B (Established):", walletEstablished);
  console.log("Wallet C (Trusted):    ", walletTrusted);
  console.log("Wallet D (Elite):      ", walletElite);
}

main().catch(console.error);