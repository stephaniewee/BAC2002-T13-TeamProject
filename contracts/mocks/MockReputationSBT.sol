// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockReputationSBT {
    mapping(address => uint8) public tiers;

    function getTier(address wallet) external view returns (uint8) {
        return tiers[wallet];
    }

    function updateReputation(address wallet, bool success) external {
        if (success && tiers[wallet] < 3) {
            tiers[wallet]++;
        }
    }

    function setTier(address wallet, uint8 tier) external {
        tiers[wallet] = tier;
    }
}