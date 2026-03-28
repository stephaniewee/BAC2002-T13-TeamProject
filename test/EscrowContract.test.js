const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowContract", function () {
  let escrow, disputeResolver, mockSBT, mockPriceFeed;
  let owner, client, freelancer, arbitrator;

  beforeEach(async function () {
    [owner, client, freelancer, arbitrator] = await ethers.getSigners();

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(2000e8);

    const MockSBT = await ethers.getContractFactory("MockReputationSBT");
    mockSBT = await MockSBT.deploy();

    const Escrow = await ethers.getContractFactory("EscrowContract");
    escrow = await Escrow.deploy(
      await mockPriceFeed.getAddress(),
      await mockSBT.getAddress()
    );

    const Dispute = await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await Dispute.deploy(
      await escrow.getAddress(),
      arbitrator.address
    );

    const DISPUTE_ROLE = await escrow.DISPUTE_ROLE();
    await escrow.grantRole(DISPUTE_ROLE, await disputeResolver.getAddress());
  });

  // ── Helper ───────────────────────────────────────────────────────────
  async function createAndFund(amountUSD = 500e8) {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, amountUSD, deadline, ethers.ZeroHash, "");
    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });
    return required;
  }

  // ── Original tests (unchanged) ───────────────────────────────────────
  it("creates a milestone correctly", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "");
    const m = await escrow.milestones(0);
    expect(m.client).to.equal(client.address);
    expect(m.freelancer).to.equal(freelancer.address);
    expect(m.amountUSD).to.equal(500e8);
    expect(m.metadataHash).to.equal(ethers.ZeroHash);
    expect(m.metadataCID).to.equal("");
  });

  it("funds a milestone with correct ETH amount", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "");
    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });
    const m = await escrow.milestones(0);
    expect(m.state).to.equal(1); // FUNDED
  });

  it("reverts if ETH sent is insufficient", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "");
    await expect(
      escrow.connect(client).fundMilestone(0, { value: ethers.parseEther("0.0001") })
    ).to.be.revertedWith("Insufficient ETH for USD value");
  });

  it("completes full lifecycle: create → fund → submit → approve", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "");
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
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "");
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

  // ── SBT Tier Cap (maxEscrowUSD) ──────────────────────────────────────
  describe("SBT tier escrow caps", function () {
    it("should allow tier 0 freelancer to create milestone at exactly $500", async function () {
      // MockSBT returns tier 0 by default
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline, ethers.ZeroHash, "")
      ).to.not.be.reverted;
    });

    it("should revert if tier 0 freelancer exceeds $500 cap", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 501e8, deadline, ethers.ZeroHash, "")
      ).to.be.revertedWith("Escrow value exceeds tier cap");
    });

    it("should allow tier 1 freelancer to create milestone at $2000", async function () {
      await mockSBT.setTier(freelancer.address, 1);
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 2000e8, deadline, ethers.ZeroHash, "")
      ).to.not.be.reverted;
    });

    it("should revert if tier 1 freelancer exceeds $2000 cap", async function () {
      await mockSBT.setTier(freelancer.address, 1);
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 2001e8, deadline, ethers.ZeroHash, "")
      ).to.be.revertedWith("Escrow value exceeds tier cap");
    });

    it("should allow tier 2 freelancer to create milestone at $10000", async function () {
      await mockSBT.setTier(freelancer.address, 2);
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 10000e8, deadline, ethers.ZeroHash, "")
      ).to.not.be.reverted;
    });

    it("should allow tier 3 freelancer to exceed $10000 (unlimited)", async function () {
      await mockSBT.setTier(freelancer.address, 3);
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await expect(
        escrow.connect(client).createMilestone(freelancer.address, 50000e8, deadline, ethers.ZeroHash, "")
      ).to.not.be.reverted;
    });
  });

  // ── Dispute Freeze Integration ───────────────────────────────────────
  describe("Dispute freeze integration", function () {
    it("should freeze freelancer SBT when dispute is raised", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).raiseDispute(0);
      expect(await mockSBT.isFrozen(freelancer.address)).to.be.true;
    });

    it("should unfreeze freelancer SBT after dispute is resolved", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).raiseDispute(0);
      await disputeResolver.connect(arbitrator).resolveDispute(0, true);
      expect(await mockSBT.isFrozen(freelancer.address)).to.be.false;
    });

    it("should emit ReputationFrozen via mockSBT on raiseDispute", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await expect(
        escrow.connect(client).raiseDispute(0)
      ).to.emit(mockSBT, "ReputationFrozen")
        .withArgs(freelancer.address, true);
    });
  });

  // ── Emergency Withdraw ───────────────────────────────────────────────
  describe("emergencyWithdraw", function () {
    it("should allow admin to withdraw after milestone is COMPLETED", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).approveMilestone(0);

      // Send some extra ETH directly to contract to simulate stuck funds
      await owner.sendTransaction({
        to: await escrow.getAddress(),
        value: ethers.parseEther("0.01")
      });

      const balBefore = await ethers.provider.getBalance(owner.address);
      await escrow.connect(owner).emergencyWithdraw(0);
      const balAfter = await ethers.provider.getBalance(owner.address);
      expect(balAfter).to.be.gt(balBefore);
    });

    it("should revert emergencyWithdraw on active milestone", async function () {
      await createAndFund();
      await expect(
        escrow.connect(owner).emergencyWithdraw(0)
      ).to.be.revertedWith("Milestone still active");
    });

    it("should revert if non-admin calls emergencyWithdraw", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).approveMilestone(0);
      await expect(
        escrow.connect(client).emergencyWithdraw(0)
      ).to.be.reverted;
    });
  });

  // ── DisputeResolved timestamp ────────────────────────────────────────
  describe("DisputeResolved event timestamp", function () {
    it("should emit DisputeResolved with a valid timestamp", async function () {
      await createAndFund();
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).raiseDispute(0);

      const tx = await disputeResolver.connect(arbitrator).resolveDispute(0, true);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(disputeResolver, "DisputeResolved")
        .withArgs(0, arbitrator.address, true, block.timestamp);
    });
  });
});