const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainlinkPriceFeed", function () {
  let chainlinkFeed;
  let mockPriceFeed;
  let owner, stranger;

  // ETH price = $3,000.00 → Chainlink format = 3000 * 1e8
  const ETH_PRICE_USD = 3000n * 10n ** 8n;

  beforeEach(async function () {
    [owner, stranger] = await ethers.getSigners();

    // Deploy MockPriceFeed with $3000 ETH price
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy(ETH_PRICE_USD);
    await mockPriceFeed.waitForDeployment();

    // Deploy ChainlinkPriceFeed wrapper
    const ChainlinkPriceFeed = await ethers.getContractFactory("ChainlinkPriceFeed");
    chainlinkFeed = await ChainlinkPriceFeed.deploy(await mockPriceFeed.getAddress());
    await chainlinkFeed.waitForDeployment();
  });

  // ── Deployment ───────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set the correct price feed address", async function () {
      expect(await chainlinkFeed.priceFeed()).to.equal(await mockPriceFeed.getAddress());
    });

    it("should revert if zero address passed", async function () {
      const ChainlinkPriceFeed = await ethers.getContractFactory("ChainlinkPriceFeed");
      await expect(
        ChainlinkPriceFeed.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid feed address");
    });
  });

  // ── getLatestPrice ───────────────────────────────────────────────────
  describe("getLatestPrice", function () {
    it("should return the correct ETH/USD price", async function () {
      const [price] = await chainlinkFeed.getLatestPrice();
      expect(price).to.equal(ETH_PRICE_USD);
    });

    it("should revert on zero price", async function () {
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const zeroPriceFeed = await MockPriceFeed.deploy(0);
      const ChainlinkPriceFeed = await ethers.getContractFactory("ChainlinkPriceFeed");
      const feed = await ChainlinkPriceFeed.deploy(await zeroPriceFeed.getAddress());
      await expect(feed.getLatestPrice()).to.be.revertedWith("Chainlink: invalid price");
    });
  });

  // ── getCurrentETHPriceUSD ─────────────────────────────────────────────
  describe("getCurrentETHPriceUSD", function () {
    it("should return ETH price with 8 decimals", async function () {
      const price = await chainlinkFeed.getCurrentETHPriceUSD();
      expect(price).to.equal(ETH_PRICE_USD);
    });
  });

  // ── getETHPriceInDollars ──────────────────────────────────────────────
  describe("getETHPriceInDollars", function () {
    it("should return 3000 when ETH price is $3000", async function () {
      const dollars = await chainlinkFeed.getETHPriceInDollars();
      expect(dollars).to.equal(3000n);
    });
  });

  // ── getETHAmount ──────────────────────────────────────────────────────
  describe("getETHAmount", function () {
    // $500 in Chainlink 8-decimal format
    const USD_500 = 500n * 10n ** 8n;

    it("should convert $500 USD → correct ETH at $3000/ETH with 0% buffer", async function () {
      // $500 / $3000 = 0.1667 ETH = 166666666666666666 wei (approx)
      const ethAmount = await chainlinkFeed.getETHAmount(USD_500, 0);
      const expected = (USD_500 * 10n ** 18n) / ETH_PRICE_USD;
      expect(ethAmount).to.equal(expected);
    });

    it("should apply 2% buffer (200 BPS) correctly", async function () {
      const ethAmount = await chainlinkFeed.getETHAmount(USD_500, 200);
      const base = (USD_500 * 10n ** 18n) / ETH_PRICE_USD;
      const expected = base + (base * 200n / 10000n);
      expect(ethAmount).to.equal(expected);
    });

    it("should apply 0.5% buffer (50 BPS) correctly", async function () {
      const ethAmount = await chainlinkFeed.getETHAmount(USD_500, 50);
      const base = (USD_500 * 10n ** 18n) / ETH_PRICE_USD;
      const expected = base + (base * 50n / 10000n);
      expect(ethAmount).to.equal(expected);
    });

    it("higher buffer should return more ETH than lower buffer", async function () {
      const highBuffer = await chainlinkFeed.getETHAmount(USD_500, 200);
      const lowBuffer  = await chainlinkFeed.getETHAmount(USD_500, 50);
      expect(highBuffer).to.be.greaterThan(lowBuffer);
    });

    it("should return more ETH for larger USD amounts", async function () {
      const USD_1000 = 1000n * 10n ** 8n;
      const eth500  = await chainlinkFeed.getETHAmount(USD_500,  0);
      const eth1000 = await chainlinkFeed.getETHAmount(USD_1000, 0);
      expect(eth1000).to.be.greaterThan(eth500);
    });
  });
});
