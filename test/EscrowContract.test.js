const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowContract", function () {
  let escrow, disputeResolver, mockSBT, mockPriceFeed;
  let owner, client, freelancer, arbitrator;

  // Deploy a mock price feed and mock SBT before each test
  beforeEach(async function () {
    [owner, client, freelancer, arbitrator] = await ethers.getSigners();

    // Deploy mock Chainlink price feed (ETH/USD = $2000)
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(2000e8); // $2000 with 8 decimals

    // Deploy mock ReputationSBT
    const MockSBT = await ethers.getContractFactory("MockReputationSBT");
    mockSBT = await MockSBT.deploy();

    // Deploy EscrowContract
    const Escrow = await ethers.getContractFactory("EscrowContract");
    escrow = await Escrow.deploy(
      await mockPriceFeed.getAddress(),
      await mockSBT.getAddress()
    );

    // Deploy DisputeResolver
    const Dispute = await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await Dispute.deploy(
      await escrow.getAddress(),
      arbitrator.address
    );

    // Grant DISPUTE_ROLE to DisputeResolver
    const DISPUTE_ROLE = await escrow.DISPUTE_ROLE();
    await escrow.grantRole(DISPUTE_ROLE, await disputeResolver.getAddress());
  });

  it("creates a milestone correctly", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(
      freelancer.address,
      500e8, // $500 USD
      deadline
    );
    const m = await escrow.milestones(0);
    expect(m.client).to.equal(client.address);
    expect(m.freelancer).to.equal(freelancer.address);
    expect(m.amountUSD).to.equal(500e8);
  });

  it("funds a milestone with correct ETH amount", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);

    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });

    const m = await escrow.milestones(0);
    expect(m.state).to.equal(1); // FUNDED
  });

  it("reverts if ETH sent is insufficient", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);

    await expect(
      escrow.connect(client).fundMilestone(0, { value: ethers.parseEther("0.0001") })
    ).to.be.revertedWith("Insufficient ETH for USD value");
  });

  it("completes full lifecycle: create → fund → submit → approve", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);

    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });

    const ipfsHash = ethers.encodeBytes32String("QmTestHash");
    await escrow.connect(freelancer).submitWork(0, ipfsHash);

    const balBefore = await ethers.provider.getBalance(freelancer.address);
    await escrow.connect(client).approveMilestone(0);
    const balAfter = await ethers.provider.getBalance(freelancer.address);

    expect(balAfter).to.be.gt(balBefore);
    const m = await escrow.milestones(0);
    expect(m.state).to.equal(4); // COMPLETED
  });

  it("handles dispute and arbitrator resolution", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);

    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });

    const ipfsHash = ethers.encodeBytes32String("QmTestHash");
    await escrow.connect(freelancer).submitWork(0, ipfsHash);

    await escrow.connect(client).raiseDispute(0);
    const m1 = await escrow.milestones(0);
    expect(m1.state).to.equal(5); // DISPUTED

    await disputeResolver.connect(arbitrator).resolveDispute(0, true);
    const m2 = await escrow.milestones(0);
    expect(m2.state).to.equal(6); // RESOLVED
  });
});