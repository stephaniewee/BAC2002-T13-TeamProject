// Script to grant arbitrator role
const hre = require("hardhat");

async function main() {
    const DISPUTE_RESOLVER_ADDRESS = "0xBC849c92bBC6f2978106E7bf317fbcF5e76faC09";
    const ARBITRATOR_ADDRESS = process.env.ARBITRATOR_ADDRESS; // Use .env or pass as argument

    if (!ARBITRATOR_ADDRESS) {
        throw new Error("ARBITRATOR_ADDRESS not set in .env file");
    }

    console.log(`Granting arbitrator role to: ${ARBITRATOR_ADDRESS}`);

    // Get the contract
    const disputeResolver = await hre.ethers.getContractAt(
        "DisputeResolver",
        DISPUTE_RESOLVER_ADDRESS
    );

    // Call addArbitrator
    console.log("Sending transaction...");
    const tx = await disputeResolver.addArbitrator(ARBITRATOR_ADDRESS);

    console.log(`Transaction hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    await tx.wait();

    console.log("✓ Arbitrator role granted successfully!");

    // Verify
    const isArbitrator = await disputeResolver.isArbitrator(ARBITRATOR_ADDRESS);
    console.log(`Verified: ${ARBITRATOR_ADDRESS} is arbitrator: ${isArbitrator}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
