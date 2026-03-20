// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ChainlinkPriceFeed
 * @notice Wrapper around the Chainlink ETH/USD AggregatorV3 price feed.
 *
 * Responsibilities:
 *   1. Fetch the latest ETH/USD price from Chainlink
 *   2. Validate the price is fresh (not stale) and positive
 *   3. Convert a USD amount (8 decimals) → ETH amount (18 decimals)
 *   4. Apply a slippage buffer so the escrow always locks enough ETH
 *
 * Sepolia testnet feed address: 0x694AA1769357215DE4FAC081bf1f309aDC325306
 *
 * Pipeline (visible in your report diagram):
 *   Off-chain market price
 *       → Chainlink oracle nodes aggregate it
 *       → AggregatorV3Interface.latestRoundData() returns on-chain price
 *       → This contract converts USD → ETH with staleness check
 *       → EscrowContract calls getETHAmount() to know how much to lock
 */
contract ChainlinkPriceFeed is Ownable {

    AggregatorV3Interface public immutable priceFeed;

    // Maximum age of a price update before it is considered stale (1 hour)
    uint256 public constant STALENESS_THRESHOLD = 3600;

    // Events
    event PriceFetched(int256 price, uint256 updatedAt);

    constructor(address _priceFeed) Ownable(msg.sender) {
        require(_priceFeed != address(0), "Invalid feed address");
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // ── 1. Get raw ETH/USD price from Chainlink ───────────────────────
    /**
     * @return price     Current ETH price in USD (8 decimals, e.g. 300000000000 = $3000.00)
     * @return updatedAt Timestamp of the last price update
     */
    function getLatestPrice() public view returns (int256 price, uint256 updatedAt) {
        (
            /* uint80 roundId */,
            int256 _price,
            /* uint256 startedAt */,
            uint256 _updatedAt,
            /* uint80 answeredInRound */
        ) = priceFeed.latestRoundData();

        require(_price > 0,                                     "Chainlink: invalid price");
        require(block.timestamp - _updatedAt < STALENESS_THRESHOLD, "Chainlink: stale price");

        return (_price, _updatedAt);
    }

    // ── 2. Convert USD amount → required ETH (wei) ────────────────────
    /**
     * @param usdAmount   Amount in USD with 8 decimals (e.g. 50000000000 = $500.00)
     * @param bufferBPS   Slippage buffer in basis points (e.g. 200 = 2%)
     * @return ethAmount  ETH in wei (18 decimals) needed to cover usdAmount + buffer
     *
     * Maths:
     *   ethAmount = (usdAmount / ethPriceUSD) * 1e18
     *   Both usdAmount and ethPriceUSD are in 8 decimals → they cancel out
     *   So: ethAmount = usdAmount * 1e18 / ethPriceUSD
     */
    function getETHAmount(
        uint256 usdAmount,
        uint256 bufferBPS
    ) external view returns (uint256 ethAmount) {
        (int256 price, ) = getLatestPrice();
        uint256 ethPrice = uint256(price); // 8 decimals

        // Base conversion: usdAmount * 1e18 / ethPrice
        uint256 baseETH = (usdAmount * 1e18) / ethPrice;

        // Add slippage buffer: baseETH + (baseETH * bufferBPS / 10000)
        ethAmount = baseETH + (baseETH * bufferBPS / 10_000);
    }

    // ── 3. Convenience: get current ETH price in USD (human readable) ─
    /**
     * @return price in USD with 8 decimals
     *         e.g. 300000000000 means $3,000.00
     */
    function getCurrentETHPriceUSD() external view returns (int256) {
        (int256 price, ) = getLatestPrice();
        return price;
    }

    // ── 4. Decode a raw Chainlink price to human-readable dollars ─────
    /**
     * @return dollars  The price in whole USD (no decimals)
     *                  e.g. if latestRoundData returns 300000000000 → returns 3000
     */
    function getETHPriceInDollars() external view returns (uint256 dollars) {
        (int256 price, ) = getLatestPrice();
        dollars = uint256(price) / 1e8;
    }
}
