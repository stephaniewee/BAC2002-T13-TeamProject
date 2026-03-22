// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// Note: Requires OpenZeppelin ^5.x which needs solc 0.8.24+
// In hardhat.config.js add version "0.8.24" to the compilers array

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationSBT
 * @notice Soulbound Token (non-transferable ERC-721) that records on-chain
 *         reputation for freelancers and clients on FreelanceChain.
 *
 * Tier system (read by EscrowContract to adjust escrow terms):
 *   Tier 0 — New        ( 0 jobs)         → strictest terms
 *   Tier 1 — Established( 1–4 jobs)       → standard terms
 *   Tier 2 — Trusted    ( 5–9 jobs)       → relaxed terms
 *   Tier 3 — Elite      (10+ jobs)        → most relaxed terms
 *
 * Only addresses granted ESCROW_ROLE can call updateReputation().
 * Tokens cannot be transferred or burned — they are permanently
 * attached to the wallet that earned them.
 */
contract ReputationSBT is ERC721, AccessControl {

    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    // ── Per-wallet reputation record ─────────────────────────────────
    struct Reputation {
        uint256 jobsCompleted;      // total successful jobs
        uint256 jobsFailed;         // jobs lost to dispute
        uint256 disputesRaised;     // times this wallet raised a dispute
        uint256 milestonesSuccess;  // milestones approved without dispute
        uint256 lastUpdated;        // block.timestamp of last update
    }

    mapping(address => Reputation) public reputations;
    mapping(address => uint256)    public tokenOf;      // wallet → tokenId (0 = none)
    mapping(address => bool)       public hasSBT;       // quick existence check
    // ── NEW: dispute freeze mapping ───────────────────────────────────
    mapping(address => bool) private _frozen;

    uint256 private _nextTokenId = 1;

    // ── Events ────────────────────────────────────────────────────────
    event SBTMinted(address indexed wallet, uint256 tokenId);
    event ReputationUpdated(address indexed wallet, bool success, uint8 newTier);
    // ── NEW: freeze event for auditability ───────────────────────────
    event ReputationFrozen(address indexed wallet, bool frozen);

    // ── Constructor ───────────────────────────────────────────────────
    constructor() ERC721("FreelanceChain Reputation", "FCREP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ── Grant escrow contract permission to update reputations ────────
    function grantEscrowRole(address escrowContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ESCROW_ROLE, escrowContract);
    }

    // ── NEW: modifier — blocks getTier reads during active dispute ────
    modifier notFrozen(address wallet) {
        require(!_frozen[wallet], "Reputation frozen: active dispute");
        _;
    }

    // ── Called by EscrowContract after milestone completion/resolution ─
    /**
     * @param wallet  The freelancer or client whose record is updated
     * @param success true  = milestone completed / dispute won
     *                false = dispute lost / deadline missed
     */
    function updateReputation(address wallet, bool success) external onlyRole(ESCROW_ROLE) {
        // Mint SBT on first interaction
        if (!hasSBT[wallet]) {
            _mintSBT(wallet);
        }

        Reputation storage rep = reputations[wallet];

        if (success) {
            rep.jobsCompleted++;
            rep.milestonesSuccess++;
        } else {
            rep.jobsFailed++;
            rep.disputesRaised++;
        }

        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(wallet, success, getTier(wallet));
    }

    // ── (MODIFIED: notFrozen modifier added) Returns tier 0-3 based on completed jobs ──────────────────────
    function getTier(address wallet) public view notFrozen(wallet) returns (uint8) {
        if (!hasSBT[wallet]) return 0;
        uint256 jobs = reputations[wallet].jobsCompleted;
        if (jobs >= 10) return 3;   // Elite
        if (jobs >= 5)  return 2;   // Trusted
        if (jobs >= 1)  return 1;   // Established
        return 0;                   // New
    }

    // ── NEW: freeze / unfreeze — only callable by EscrowContract ─────
    function setFrozen(address wallet, bool frozen) external onlyRole(ESCROW_ROLE) {
        _frozen[wallet] = frozen;
        emit ReputationFrozen(wallet, frozen);
    }

    // ── NEW: public view so frontend can show freeze status ──────────
    function isFrozen(address wallet) external view returns (bool) {
        return _frozen[wallet];
    }

    // ── Returns full reputation record ────────────────────────────────
    function getReputation(address wallet) external view returns (
        uint256 jobsCompleted,
        uint256 jobsFailed,
        uint256 disputesRaised,
        uint256 milestonesSuccess,
        uint256 lastUpdated,
        uint8   tier
    ) {
        Reputation storage rep = reputations[wallet]; // ← Bug 1 fix: declare rep first

        // Bypasses notFrozen — frontend can always display reputation data
        uint8 computedTier;
        if (!hasSBT[wallet]) {
            computedTier = 0;
        } else {
            uint256 jobs = rep.jobsCompleted;
            if (jobs >= 10)     computedTier = 3;
            else if (jobs >= 5) computedTier = 2;
            else if (jobs >= 1) computedTier = 1;
            else                computedTier = 0;
        }

        return (
            rep.jobsCompleted,
            rep.jobsFailed,
            rep.disputesRaised,
            rep.milestonesSuccess,
            rep.lastUpdated,
            computedTier  // ← Bug 2 fix: use computedTier, not getTier(wallet)
        );
    }

    // ── Internal mint ─────────────────────────────────────────────────
    function _mintSBT(address wallet) internal {
        uint256 tokenId = _nextTokenId++;
        _safeMint(wallet, tokenId);
        tokenOf[wallet] = tokenId;
        hasSBT[wallet]  = true;
        emit SBTMinted(wallet, tokenId);
    }

    // ── Block all transfers — this makes it Soulbound ─────────────────
    function transferFrom(address, address, uint256) public pure override {
        revert("SBT: non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("SBT: non-transferable");
    }

    // ── Required override for AccessControl + ERC721 ──────────────────
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
