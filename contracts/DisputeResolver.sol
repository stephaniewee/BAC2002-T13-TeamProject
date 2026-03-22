// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IEscrowContract {
    function resolveFromDispute(uint256 milestoneId, bool releaseToFreelancer) external;
}

contract DisputeResolver is AccessControl {

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    IEscrowContract public immutable escrow;

    event DisputeResolved(uint256 indexed milestoneId, address indexed arbitrator, bool releasedToFreelancer, uint256 timestamp);
    event ArbitratorAdded(address indexed arbitrator);
    event ArbitratorRemoved(address indexed arbitrator);

    constructor(address _escrow, address _arbitrator) {
        require(_escrow != address(0), "Invalid escrow address");
        require(_arbitrator != address(0), "Invalid arbitrator address");

        escrow = IEscrowContract(_escrow);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITRATOR_ROLE, _arbitrator);

        emit ArbitratorAdded(_arbitrator);
    }

    // ── Resolve a disputed milestone ────────────────────────────────
    function resolveDispute(
        uint256 milestoneId,
        bool releaseToFreelancer
    ) external onlyRole(ARBITRATOR_ROLE) {
        escrow.resolveFromDispute(milestoneId, releaseToFreelancer);
        emit DisputeResolved(milestoneId, msg.sender, releaseToFreelancer, block.timestamp);
    }

    // ── Manage arbitrators ───────────────────────────────────────────
    function addArbitrator(address arbitrator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(arbitrator != address(0), "Invalid address");
        _grantRole(ARBITRATOR_ROLE, arbitrator);
        emit ArbitratorAdded(arbitrator);
    }

    function removeArbitrator(address arbitrator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ARBITRATOR_ROLE, arbitrator);
        emit ArbitratorRemoved(arbitrator);
    }

    function isArbitrator(address account) external view returns (bool) {
        return hasRole(ARBITRATOR_ROLE, account);
    }
}