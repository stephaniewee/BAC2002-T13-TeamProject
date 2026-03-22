// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockReputationSBT {
    mapping(address => uint8)  public tiers;
    mapping(address => bool)   private _frozen;

    event ReputationFrozen(address indexed wallet, bool frozen);

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

    // ── NEW: IReputationSBT freeze interface ─────────────────────────
    function setFrozen(address wallet, bool frozen) external {
        _frozen[wallet] = frozen;
        emit ReputationFrozen(wallet, frozen);
    }

    function isFrozen(address wallet) external view returns (bool) {
        return _frozen[wallet];
    }
}