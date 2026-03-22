const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationSBT", function () {
  let reputationSBT;
  let owner, escrow, freelancer, client, stranger;

  beforeEach(async function () {
    [owner, escrow, freelancer, client, stranger] = await ethers.getSigners();

    const ReputationSBT = await ethers.getContractFactory("ReputationSBT");
    reputationSBT = await ReputationSBT.deploy();
    await reputationSBT.waitForDeployment();

    // Grant escrow role to the mock escrow address
    await reputationSBT.grantEscrowRole(escrow.address);
  });

  // ── Deployment ───────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the deployer as DEFAULT_ADMIN", async function () {
      const ADMIN_ROLE = await reputationSBT.DEFAULT_ADMIN_ROLE();
      expect(await reputationSBT.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should have correct name and symbol", async function () {
      expect(await reputationSBT.name()).to.equal("FreelanceChain Reputation");
      expect(await reputationSBT.symbol()).to.equal("FCREP");
    });
  });

  // ── Access Control ───────────────────────────────────────────────────
  describe("Access Control", function () {
    it("should grant ESCROW_ROLE to escrow contract", async function () {
      const ESCROW_ROLE = await reputationSBT.ESCROW_ROLE();
      expect(await reputationSBT.hasRole(ESCROW_ROLE, escrow.address)).to.be.true;
    });

    it("should revert if non-escrow calls updateReputation", async function () {
      await expect(
        reputationSBT.connect(stranger).updateReputation(freelancer.address, true)
      ).to.be.reverted;
    });

    it("should revert if non-admin calls grantEscrowRole", async function () {
      await expect(
        reputationSBT.connect(stranger).grantEscrowRole(stranger.address)
      ).to.be.reverted;
    });
  });

  // ── SBT Minting ──────────────────────────────────────────────────────
  describe("SBT Minting", function () {
    it("should mint SBT on first updateReputation call", async function () {
      expect(await reputationSBT.hasSBT(freelancer.address)).to.be.false;

      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);

      expect(await reputationSBT.hasSBT(freelancer.address)).to.be.true;
    });

    it("should emit SBTMinted event on first interaction", async function () {
      await expect(
        reputationSBT.connect(escrow).updateReputation(freelancer.address, true)
      ).to.emit(reputationSBT, "SBTMinted").withArgs(freelancer.address, 1);
    });

    it("should NOT mint a second token on subsequent updates", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);

      // Should still only have token 1
      expect(await reputationSBT.tokenOf(freelancer.address)).to.equal(1);
      expect(await reputationSBT.balanceOf(freelancer.address)).to.equal(1);
    });

    it("should assign sequential token IDs to different wallets", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(client.address, true);

      expect(await reputationSBT.tokenOf(freelancer.address)).to.equal(1);
      expect(await reputationSBT.tokenOf(client.address)).to.equal(2);
    });
  });

  // ── Reputation Updates ───────────────────────────────────────────────
  describe("Reputation Updates", function () {
    it("should increment jobsCompleted on success", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      const rep = await reputationSBT.reputations(freelancer.address);
      expect(rep.jobsCompleted).to.equal(1);
    });

    it("should increment jobsFailed on failure", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, false);
      const rep = await reputationSBT.reputations(freelancer.address);
      expect(rep.jobsFailed).to.equal(1);
    });

    it("should track multiple updates correctly", async function () {
      // 3 successes, 1 failure
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, false);

      const rep = await reputationSBT.reputations(freelancer.address);
      expect(rep.jobsCompleted).to.equal(3);
      expect(rep.jobsFailed).to.equal(1);
    });

    it("should emit ReputationUpdated event", async function () {
      await expect(
        reputationSBT.connect(escrow).updateReputation(freelancer.address, true)
      ).to.emit(reputationSBT, "ReputationUpdated");
    });
  });

  // ── Tier System ──────────────────────────────────────────────────────
  describe("Tier System", function () {
    it("should return tier 0 for wallet with no SBT", async function () {
      expect(await reputationSBT.getTier(stranger.address)).to.equal(0);
    });

    it("should return tier 0 after 0 completed jobs", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, false);
      expect(await reputationSBT.getTier(freelancer.address)).to.equal(0);
    });

    it("should return tier 1 after 1 completed job", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      expect(await reputationSBT.getTier(freelancer.address)).to.equal(1);
    });

    it("should return tier 2 after 5 completed jobs", async function () {
      for (let i = 0; i < 5; i++) {
        await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      }
      expect(await reputationSBT.getTier(freelancer.address)).to.equal(2);
    });

    it("should return tier 3 after 10 completed jobs", async function () {
      for (let i = 0; i < 10; i++) {
        await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      }
      expect(await reputationSBT.getTier(freelancer.address)).to.equal(3);
    });
  });
  
  // ── Dispute Freeze ───────────────────────────────────────────────────
  describe("Dispute Freeze", function () {
    it("should not be frozen by default", async function () {
      expect(await reputationSBT.isFrozen(freelancer.address)).to.be.false;
    });

    it("should allow escrow to freeze a wallet", async function () {
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, true);
      expect(await reputationSBT.isFrozen(freelancer.address)).to.be.true;
    });

    it("should allow escrow to unfreeze a wallet", async function () {
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, true);
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, false);
      expect(await reputationSBT.isFrozen(freelancer.address)).to.be.false;
    });

    it("should revert getTier when wallet is frozen", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, true);

      await expect(
        reputationSBT.getTier(freelancer.address)
      ).to.be.revertedWith("Reputation frozen: active dispute");
    });

    it("should allow getTier again after unfreeze", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, true);
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, false);

      expect(await reputationSBT.getTier(freelancer.address)).to.equal(1);
    });

    it("should revert if non-escrow calls setFrozen", async function () {
      await expect(
        reputationSBT.connect(stranger).setFrozen(freelancer.address, true)
      ).to.be.reverted;
    });

    it("should emit ReputationFrozen event", async function () {
      await expect(
        reputationSBT.connect(escrow).setFrozen(freelancer.address, true)
      ).to.emit(reputationSBT, "ReputationFrozen")
      .withArgs(freelancer.address, true);
    });

    it("should still return getReputation when frozen", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).setFrozen(freelancer.address, true);

      // getReputation bypasses notFrozen — must not revert
      const [jobsCompleted, , , , , tier] =
        await reputationSBT.getReputation(freelancer.address);

      expect(jobsCompleted).to.equal(1);
      expect(tier).to.equal(1);
    });
  });

  // ── Soulbound (Non-transferable) ─────────────────────────────────────
  describe("Soulbound — Non-transferable", function () {
    beforeEach(async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
    });

    it("should revert on transferFrom", async function () {
      const tokenId = await reputationSBT.tokenOf(freelancer.address);
      await expect(
        reputationSBT.connect(freelancer).transferFrom(
          freelancer.address, stranger.address, tokenId
        )
      ).to.be.revertedWith("SBT: non-transferable");
    });

    it("should revert on safeTransferFrom", async function () {
      const tokenId = await reputationSBT.tokenOf(freelancer.address);
      await expect(
        reputationSBT.connect(freelancer)["safeTransferFrom(address,address,uint256,bytes)"](
          freelancer.address, stranger.address, tokenId, "0x"
        )
      ).to.be.revertedWith("SBT: non-transferable");
    });
  });

  // ── getReputation view ───────────────────────────────────────────────
  describe("getReputation", function () {
    it("should return full reputation record", async function () {
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, true);
      await reputationSBT.connect(escrow).updateReputation(freelancer.address, false);

      const [jobsCompleted, jobsFailed, disputesRaised, milestonesSuccess, , tier] =
        await reputationSBT.getReputation(freelancer.address);

      expect(jobsCompleted).to.equal(1);
      expect(jobsFailed).to.equal(1);
      expect(disputesRaised).to.equal(1);
      expect(milestonesSuccess).to.equal(1);
      expect(tier).to.equal(1); // 1 job completed → tier 1
    });
  });
});
