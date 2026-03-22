// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IReputationSBT {
    function getTier(address wallet) external view returns (uint8);
    function updateReputation(address wallet, bool success) external;
    
    // NEW: dispute freeze — prevents tier reads mid-dispute
    function setFrozen(address wallet, bool frozen) external;
    function isFrozen(address wallet) external view returns (bool);
}