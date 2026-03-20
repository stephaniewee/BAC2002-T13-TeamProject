const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DisputeResolver", function () {
  let escrow, disputeResolver, mockSBT, mockPriceFeed;
  let owner, client, freelancer, arbitrator, stranger, newArbitrator;

  beforeEach(async function () {
    [owner, client, freelancer, arbitrator, stranger, newArbitrator] =
      await ethers.getSigners();

    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(2000e8); // $2000 with 8 decimals

    const MockSBT = await ethers.getContractFactory("MockReputationSBT");
    mockSBT = await MockSBT.deploy();

    const Escrow = await ethers.getContractFactory("EscrowContract");
    escrow = await Escrow.deploy(
      await mockPriceFeed.getAddress(),
      await mockSBT.getAddress()
    );

    const DisputeResolverFactory =
      await ethers.getContractFactory("DisputeResolver");
    disputeResolver = await DisputeResolverFactory.deploy(
      await escrow.getAddress(),
      arbitrator.address
    );

    // Grant DisputeResolver the right to call resolveFromDispute() on escrow
    const DISPUTE_ROLE = await escrow.DISPUTE_ROLE();
    await escrow.grantRole(DISPUTE_ROLE, await disputeResolver.getAddress());
  });

  // Helper: advances a milestone through create → fund → submit → raiseDispute
  // Returns the locked ETH amount so balance-change assertions can use it.
  async function setupDisputedMilestone() {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);
    const required = await escrow.getRequiredETH(0);
    await escrow.connect(client).fundMilestone(0, { value: required });
    const ipfsHash = ethers.encodeBytes32String("QmTestHash");
    await escrow.connect(freelancer).submitWork(0, ipfsHash);
    await escrow.connect(client).raiseDispute(0);
    return required; // equals lockedETH in the milestone
  }

  // ── Deployment ──────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set deployer as DEFAULT_ADMIN", async function () {
      const ADMIN_ROLE = await disputeResolver.DEFAULT_ADMIN_ROLE();
      expect(await disputeResolver.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should grant ARBITRATOR_ROLE to the initial arbitrator", async function () {
      const ARBITRATOR_ROLE = await disputeResolver.ARBITRATOR_ROLE();
      expect(
        await disputeResolver.hasRole(ARBITRATOR_ROLE, arbitrator.address)
      ).to.be.true;
    });

    it("should store the escrow address", async function () {
      expect(await disputeResolver.escrow()).to.equal(await escrow.getAddress());
    });

    it("should emit ArbitratorAdded for the initial arbitrator", async function () {
      const Factory = await ethers.getContractFactory("DisputeResolver");
      const deployed = await Factory.deploy(
        await escrow.getAddress(),
        arbitrator.address
      );
      await expect(deployed.deploymentTransaction())
        .to.emit(deployed, "ArbitratorAdded")
        .withArgs(arbitrator.address);
    });

    it("should revert with zero escrow address", async function () {
      const Factory = await ethers.getContractFactory("DisputeResolver");
      await expect(
        Factory.deploy(ethers.ZeroAddress, arbitrator.address)
      ).to.be.revertedWith("Invalid escrow address");
    });

    it("should revert with zero arbitrator address", async function () {
      const Factory = await ethers.getContractFactory("DisputeResolver");
      await expect(
        Factory.deploy(await escrow.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid arbitrator address");
    });
  });

  // ── Access Control ──────────────────────────────────────────────────
  describe("Access Control", function () {
    it("isArbitrator should return true for the initial arbitrator", async function () {
      expect(await disputeResolver.isArbitrator(arbitrator.address)).to.be.true;
    });

    it("isArbitrator should return false for a non-arbitrator", async function () {
      expect(await disputeResolver.isArbitrator(stranger.address)).to.be.false;
    });

    it("should revert when a stranger calls resolveDispute", async function () {
      await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(stranger).resolveDispute(0, true)
      ).to.be.reverted;
    });

    it("should revert when the admin (non-arbitrator) calls resolveDispute", async function () {
      await setupDisputedMilestone();
      // owner holds DEFAULT_ADMIN_ROLE but not ARBITRATOR_ROLE
      await expect(
        disputeResolver.connect(owner).resolveDispute(0, true)
      ).to.be.reverted;
    });
  });

  // ── resolveDispute — release to freelancer ──────────────────────────
  describe("resolveDispute — release to freelancer", function () {
    it("should move milestone to RESOLVED (state 6)", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(arbitrator).resolveDispute(0, true);
      const m = await escrow.milestones(0);
      expect(m.state).to.equal(6); // RESOLVED
    });

    it("should transfer locked ETH to the freelancer", async function () {
      const lockedETH = await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      ).to.changeEtherBalance(freelancer, lockedETH);
    });

    it("should zero out lockedETH in the milestone", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(arbitrator).resolveDispute(0, true);
      const m = await escrow.milestones(0);
      expect(m.lockedETH).to.equal(0);
    });

    it("should emit DisputeResolved with correct args", async function () {
      await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      )
        .to.emit(disputeResolver, "DisputeResolved")
        .withArgs(0, arbitrator.address, true);
    });

    it("should emit FundsReleased from escrow to freelancer", async function () {
      const lockedETH = await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      )
        .to.emit(escrow, "FundsReleased")
        .withArgs(0, freelancer.address, lockedETH);
    });
  });

  // ── resolveDispute — refund to client ───────────────────────────────
  describe("resolveDispute — refund to client", function () {
    it("should move milestone to RESOLVED (state 6)", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(arbitrator).resolveDispute(0, false);
      const m = await escrow.milestones(0);
      expect(m.state).to.equal(6); // RESOLVED
    });

    it("should refund locked ETH to the client", async function () {
      const lockedETH = await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, false)
      ).to.changeEtherBalance(client, lockedETH);
    });

    it("should zero out lockedETH in the milestone", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(arbitrator).resolveDispute(0, false);
      const m = await escrow.milestones(0);
      expect(m.lockedETH).to.equal(0);
    });

    it("should emit DisputeResolved with releaseToFreelancer = false", async function () {
      await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, false)
      )
        .to.emit(disputeResolver, "DisputeResolved")
        .withArgs(0, arbitrator.address, false);
    });

    it("should emit FundsReleased from escrow to client", async function () {
      const lockedETH = await setupDisputedMilestone();
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, false)
      )
        .to.emit(escrow, "FundsReleased")
        .withArgs(0, client.address, lockedETH);
    });
  });

  // ── addArbitrator ───────────────────────────────────────────────────
  describe("addArbitrator", function () {
    it("should grant ARBITRATOR_ROLE to a new address", async function () {
      await disputeResolver.connect(owner).addArbitrator(newArbitrator.address);
      expect(await disputeResolver.isArbitrator(newArbitrator.address)).to.be.true;
    });

    it("should emit ArbitratorAdded event", async function () {
      await expect(
        disputeResolver.connect(owner).addArbitrator(newArbitrator.address)
      )
        .to.emit(disputeResolver, "ArbitratorAdded")
        .withArgs(newArbitrator.address);
    });

    it("should allow a newly added arbitrator to resolve disputes", async function () {
      await disputeResolver.connect(owner).addArbitrator(newArbitrator.address);
      await setupDisputedMilestone();
      await disputeResolver.connect(newArbitrator).resolveDispute(0, true);
      const m = await escrow.milestones(0);
      expect(m.state).to.equal(6); // RESOLVED
    });

    it("should revert if a non-admin calls addArbitrator", async function () {
      await expect(
        disputeResolver.connect(stranger).addArbitrator(newArbitrator.address)
      ).to.be.reverted;
    });

    it("should revert if address(0) is passed", async function () {
      await expect(
        disputeResolver.connect(owner).addArbitrator(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  // ── removeArbitrator ────────────────────────────────────────────────
  describe("removeArbitrator", function () {
    it("should revoke ARBITRATOR_ROLE from the arbitrator", async function () {
      await disputeResolver.connect(owner).removeArbitrator(arbitrator.address);
      expect(await disputeResolver.isArbitrator(arbitrator.address)).to.be.false;
    });

    it("should emit ArbitratorRemoved event", async function () {
      await expect(
        disputeResolver.connect(owner).removeArbitrator(arbitrator.address)
      )
        .to.emit(disputeResolver, "ArbitratorRemoved")
        .withArgs(arbitrator.address);
    });

    it("should prevent the removed arbitrator from resolving disputes", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(owner).removeArbitrator(arbitrator.address);
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      ).to.be.reverted;
    });

    it("should revert if a non-admin calls removeArbitrator", async function () {
      await expect(
        disputeResolver.connect(stranger).removeArbitrator(arbitrator.address)
      ).to.be.reverted;
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────
  describe("Edge Cases", function () {
    it("should revert when milestone is not in DISPUTED state", async function () {
      // Milestone is FUNDED — dispute has not been raised yet
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);
      const required = await escrow.getRequiredETH(0);
      await escrow.connect(client).fundMilestone(0, { value: required });

      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      ).to.be.revertedWith("Not disputed");
    });

    it("should revert when resolving an already-resolved milestone", async function () {
      await setupDisputedMilestone();
      await disputeResolver.connect(arbitrator).resolveDispute(0, true);
      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      ).to.be.revertedWith("Not disputed");
    });

    it("should revert when resolving a COMPLETED (non-disputed) milestone", async function () {
      // Full happy-path — milestone ends COMPLETED, not DISPUTED
      const deadline = Math.floor(Date.now() / 1000) + 86400;
      await escrow.connect(client).createMilestone(freelancer.address, 500e8, deadline);
      const required = await escrow.getRequiredETH(0);
      await escrow.connect(client).fundMilestone(0, { value: required });
      const ipfsHash = ethers.encodeBytes32String("QmTestHash");
      await escrow.connect(freelancer).submitWork(0, ipfsHash);
      await escrow.connect(client).approveMilestone(0); // COMPLETED — no dispute

      await expect(
        disputeResolver.connect(arbitrator).resolveDispute(0, true)
      ).to.be.revertedWith("Not disputed");
    });
  });
});
