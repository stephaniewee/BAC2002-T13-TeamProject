// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "./interfaces/IReputationSBT.sol";

contract EscrowContract is ReentrancyGuard, AccessControl {
    bytes32 public constant DISPUTE_ROLE = keccak256("DISPUTE_ROLE");

    AggregatorV3Interface public immutable priceFeed;
    IReputationSBT public immutable reputationSBT;

    enum MilestoneState {
        CREATED,
        FUNDED,
        IN_PROGRESS,
        PENDING_REVIEW,
        COMPLETED,
        DISPUTED,
        RESOLVED
    }

    struct Milestone {
        address client;
        address freelancer;
        uint256 amountUSD; // 8 decimals — Chainlink format e.g. 500e8 = $500
        uint256 lockedETH; // actual ETH locked at funding time
        MilestoneState state;
        uint256 deadline; // unix timestamp
        bytes32 metadataHash; // keccak256 digest of metadata CID
        string metadataCID; // IPFS CID for milestone/job metadata JSON
        bytes32 deliverableHash; // IPFS hash stored on-chain
    }

    mapping(uint256 => Milestone) public milestones;
    uint256 public milestoneCount;

    // Slippage buffers per SBT tier (basis points: 200 = 2%, 50 = 0.5%)
    uint256[4] public slippageBufferBPS = [200, 150, 100, 50];

    // Max escrow value per SBT tier (in USD, 8 decimals — Chainlink format)
    // Tier 0: $500, Tier 1: $2000, Tier 2: $10000, Tier 3: unlimited (type(uint256).max)
    uint256[4] public maxEscrowUSD = [
        500e8,
        2000e8,
        10000e8,
        type(uint256).max
    ];

    event MilestoneCreated(
        uint256 indexed id,
        address client,
        address freelancer,
        uint256 amountUSD,
        bytes32 metadataHash,
        string metadataCID
    );
    event MilestoneFunded(
        uint256 indexed id,
        uint256 ethLocked,
        uint256 ethRequired
    );
    event WorkSubmitted(uint256 indexed id, bytes32 deliverableHash);
    event MilestoneApproved(uint256 indexed id);
    event DisputeRaised(uint256 indexed id);
    event FundsReleased(uint256 indexed id, address indexed to, uint256 amount);

    constructor(address _priceFeed, address _reputationSBT) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        reputationSBT = IReputationSBT(_reputationSBT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ── 1. Create milestone ──────────────────────────────────────────
    function createMilestone(
        address freelancer,
        uint256 amountUSD,
        uint256 deadline,
        bytes32 metadataHash,
        string calldata metadataCID
    ) external returns (uint256) {
        require(freelancer != address(0), "Invalid freelancer");
        require(amountUSD > 0, "Amount must be > 0");
        require(deadline > block.timestamp, "Deadline must be future");

        // NEW: enforce escrow cap based on freelancer's SBT tier
        uint8 tier = reputationSBT.getTier(freelancer);
        require(
            amountUSD <= maxEscrowUSD[tier],
            "Escrow value exceeds tier cap"
        );

        uint256 id = milestoneCount++;
        milestones[id] = Milestone({
            client: msg.sender,
            freelancer: freelancer,
            amountUSD: amountUSD,
            lockedETH: 0,
            state: MilestoneState.CREATED,
            deadline: deadline,
            metadataHash: metadataHash,
            metadataCID: metadataCID,
            deliverableHash: bytes32(0)
        });
        emit MilestoneCreated(
            id,
            msg.sender,
            freelancer,
            amountUSD,
            metadataHash,
            metadataCID
        );
        return id;
    }

    // ── 2. Get required ETH via Chainlink ────────────────────────────
    function getRequiredETH(uint256 milestoneId) public view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid oracle price");
        require(block.timestamp - updatedAt < 3600, "Stale oracle data");

        uint256 ethPrice = uint256(price); // 8 decimals
        Milestone storage m = milestones[milestoneId];

        // requiredETH = (amountUSD / ethPrice) * 1e18
        // amountUSD is 8 decimals, ethPrice is 8 decimals — they cancel out
        uint256 baseETH = (m.amountUSD * 1e18) / ethPrice;

        // Apply slippage buffer based on freelancer SBT tier
        uint8 tier = reputationSBT.getTier(m.freelancer);
        uint256 buffer = slippageBufferBPS[tier];

        return baseETH + ((baseETH * buffer) / 10000);
    }

    // ── 3. Fund milestone ────────────────────────────────────────────
    function fundMilestone(uint256 id) external payable nonReentrant {
        Milestone storage m = milestones[id];
        require(m.state == MilestoneState.CREATED, "Not in CREATED state");
        require(msg.sender == m.client, "Only client can fund");

        uint256 required = getRequiredETH(id);
        require(msg.value >= required, "Insufficient ETH for USD value");

        m.lockedETH = msg.value;
        m.state = MilestoneState.FUNDED;

        // Refund overpayment
        if (msg.value > required) {
            (bool sent, ) = payable(msg.sender).call{
                value: msg.value - required
            }("");
            require(sent, "Refund failed");
        }

        emit MilestoneFunded(id, m.lockedETH, required);
    }

    // ── 4. Submit work ───────────────────────────────────────────────
    function submitWork(uint256 id, bytes32 ipfsHash) external {
        Milestone storage m = milestones[id];
        require(msg.sender == m.freelancer, "Only freelancer");
        require(
            m.state == MilestoneState.FUNDED ||
                m.state == MilestoneState.IN_PROGRESS,
            "Invalid state"
        );
        require(block.timestamp <= m.deadline, "Deadline passed");

        m.deliverableHash = ipfsHash;
        m.state = MilestoneState.PENDING_REVIEW;

        emit WorkSubmitted(id, ipfsHash);
    }

    // ── 5. Approve and release ───────────────────────────────────────
    function approveMilestone(uint256 id) external nonReentrant {
        Milestone storage m = milestones[id];
        require(msg.sender == m.client, "Only client");
        require(m.state == MilestoneState.PENDING_REVIEW, "Not pending review");

        m.state = MilestoneState.COMPLETED;
        uint256 amount = m.lockedETH;
        m.lockedETH = 0;

        // Update reputation on-chain
        reputationSBT.updateReputation(m.freelancer, true);
        reputationSBT.updateReputation(m.client, true);

        (bool sent, ) = payable(m.freelancer).call{value: amount}("");
        require(sent, "Transfer failed");

        emit MilestoneApproved(id);
        emit FundsReleased(id, m.freelancer, amount);
    }

    // ── 6. Raise dispute ─────────────────────────────────────────────
    function raiseDispute(uint256 id) external {
        Milestone storage m = milestones[id];
        require(
            msg.sender == m.client || msg.sender == m.freelancer,
            "Not a party"
        );
        require(m.state == MilestoneState.PENDING_REVIEW, "Cannot dispute now");

        // NEW: freeze SBT tier reads during active dispute
        reputationSBT.setFrozen(m.freelancer, true);

        m.state = MilestoneState.DISPUTED;
        emit DisputeRaised(id);
    }

    // ── 7. Resolve from dispute (only DisputeResolver) ───────────────
    function resolveFromDispute(
        uint256 id,
        bool releaseToFreelancer
    ) external nonReentrant onlyRole(DISPUTE_ROLE) {
        Milestone storage m = milestones[id];
        require(m.state == MilestoneState.DISPUTED, "Not disputed");
        m.state = MilestoneState.RESOLVED;
        uint256 amount = m.lockedETH;
        m.lockedETH = 0;
        address recipient = releaseToFreelancer ? m.freelancer : m.client;

        // NEW: unfreeze before updating reputation
        reputationSBT.setFrozen(m.freelancer, false);

        reputationSBT.updateReputation(m.freelancer, releaseToFreelancer);
        reputationSBT.updateReputation(m.client, !releaseToFreelancer);

        (bool sent, ) = payable(recipient).call{value: amount}("");
        require(sent, "Transfer failed");
        emit FundsReleased(id, recipient, amount);
    }

    // ── 8. Auto-release on deadline (Chainlink Automation) ───────────
    function checkUpkeep(
        bytes calldata
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 0; i < milestoneCount; i++) {
            Milestone storage m = milestones[i];
            if (
                m.state == MilestoneState.FUNDED && block.timestamp > m.deadline
            ) {
                return (true, abi.encode(i));
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external nonReentrant {
        uint256 id = abi.decode(performData, (uint256));
        Milestone storage m = milestones[id];
        require(m.state == MilestoneState.FUNDED, "Invalid state");
        require(block.timestamp > m.deadline, "Deadline not passed");

        m.state = MilestoneState.RESOLVED;
        uint256 amount = m.lockedETH;
        m.lockedETH = 0;

        // Deadline passed with no submission — refund client
        reputationSBT.updateReputation(m.freelancer, false);

        (bool sent, ) = payable(m.client).call{value: amount}("");
        require(sent, "Refund failed");

        emit FundsReleased(id, m.client, amount);
    }

    // ── 9. Emergency admin withdrawal ───────────────────────────────────
    // Safety valve: allows admin to recover ETH if a milestone is permanently stuck
    // (e.g. both parties unreachable, contract bug). Requires DEFAULT_ADMIN_ROLE.
    // Cannot drain an active milestone — only callable on RESOLVED/COMPLETED states.
    function emergencyWithdraw(
        uint256 id
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Milestone storage m = milestones[id];
        require(
            m.state == MilestoneState.RESOLVED ||
                m.state == MilestoneState.COMPLETED,
            "Milestone still active"
        );
        require(address(this).balance > 0, "Nothing to withdraw");
        uint256 amount = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdrawal failed");
    }

    receive() external payable {}
}
