// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LocalVoting — On-chain voting with pseudonymous voter hashes
/// @author ChainBioPoll
/// @notice A transparent, tamper-proof election contract where the Election
///         Commission (deployer) registers candidates and voters, controls the
///         election lifecycle, and voters cast exactly one vote each.
contract LocalVoting {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    struct Candidate {
        string name;
        uint256 voteCount;
        bool exists;
    }

    enum VoterStatus {
        NotRegistered, // 0 — default, unknown hash
        Eligible,      // 1 — registered but has not voted
        Voted          // 2 — has already cast a vote
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    /// @notice The Election Commission address (contract deployer).
    address public immutable commission;

    /// @notice Whether the election is currently accepting votes.
    bool public electionActive;

    /// @notice Total number of registered candidates.
    uint256 public candidateCount;

    /// @notice Total votes cast across all candidates.
    uint256 public totalVotesCast;

    /// @dev candidateId → Candidate data.
    mapping(uint256 => Candidate) private candidates;

    /// @dev voterHash → current status (NotRegistered | Eligible | Voted).
    mapping(bytes32 => VoterStatus) private voters;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event CandidateRegistered(uint256 indexed candidateId, string name);
    event VoterRegistered(bytes32 indexed voterHash);
    event VoteCast(bytes32 indexed voterHash, uint256 indexed candidateId);
    event ElectionStarted();
    event ElectionEnded();

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error OnlyCommission();
    error ElectionNotActive();
    error ElectionAlreadyActive();
    error ElectionAlreadyEnded();
    error CandidateAlreadyExists(uint256 candidateId);
    error CandidateDoesNotExist(uint256 candidateId);
    error VoterAlreadyRegistered(bytes32 voterHash);
    error VoterNotEligible(bytes32 voterHash);
    error VoterAlreadyVoted(bytes32 voterHash);
    error InvalidVoterHash();
    error InvalidCandidateName();

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    /// @notice Restricts a function to the Election Commission (deployer).
    modifier onlyCommission() {
        if (msg.sender != commission) revert OnlyCommission();
        _;
    }

    /// @notice Ensures the election is currently active.
    modifier whenActive() {
        if (!electionActive) revert ElectionNotActive();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() {
        commission = msg.sender;
    }

    // ──────────────────────────────────────────────
    //  Admin — Candidate Management
    // ──────────────────────────────────────────────

    /// @notice Register a new candidate for the election.
    /// @param _name         Human-readable candidate name.
    /// @param _candidateId  Unique numeric identifier for this candidate.
    function registerCandidate(string memory _name, uint256 _candidateId) external onlyCommission {
        if (bytes(_name).length == 0) revert InvalidCandidateName();
        if (candidates[_candidateId].exists) revert CandidateAlreadyExists(_candidateId);

        candidates[_candidateId] = Candidate({
            name: _name,
            voteCount: 0,
            exists: true
        });
        candidateCount++;

        emit CandidateRegistered(_candidateId, _name);
    }

    // ──────────────────────────────────────────────
    //  Admin — Voter Management
    // ──────────────────────────────────────────────

    /// @notice Register a pseudonymous voter hash as eligible.
    /// @param _voterHash  keccak256 hash derived from voter identity (NOT raw NID).
    function registerVoter(bytes32 _voterHash) external onlyCommission {
        if (_voterHash == bytes32(0)) revert InvalidVoterHash();
        if (voters[_voterHash] != VoterStatus.NotRegistered) {
            revert VoterAlreadyRegistered(_voterHash);
        }

        voters[_voterHash] = VoterStatus.Eligible;

        emit VoterRegistered(_voterHash);
    }

    // ──────────────────────────────────────────────
    //  Admin — Election Lifecycle
    // ──────────────────────────────────────────────

    /// @notice Start the election, enabling vote casting.
    function startElection() external onlyCommission {
        if (electionActive) revert ElectionAlreadyActive();
        electionActive = true;
        emit ElectionStarted();
    }

    /// @notice End the election, preventing further votes.
    function endElection() external onlyCommission {
        if (!electionActive) revert ElectionAlreadyEnded();
        electionActive = false;
        emit ElectionEnded();
    }

    // ──────────────────────────────────────────────
    //  Voting
    // ──────────────────────────────────────────────

    /// @notice Cast a vote for a candidate.
    /// @param _candidateId  The candidate to vote for.
    /// @param _voterHash    The pseudonymous hash identifying this voter.
    /// @dev Requires: election active, voter eligible, voter hasn't voted,
    ///      and candidate exists.
    function castVote(uint256 _candidateId, bytes32 _voterHash) external whenActive {
        // Validate voter
        if (voters[_voterHash] == VoterStatus.NotRegistered) {
            revert VoterNotEligible(_voterHash);
        }
        if (voters[_voterHash] == VoterStatus.Voted) {
            revert VoterAlreadyVoted(_voterHash);
        }

        // Validate candidate
        if (!candidates[_candidateId].exists) {
            revert CandidateDoesNotExist(_candidateId);
        }

        // Record vote
        voters[_voterHash] = VoterStatus.Voted;
        candidates[_candidateId].voteCount++;
        totalVotesCast++;

        emit VoteCast(_voterHash, _candidateId);
    }

    // ──────────────────────────────────────────────
    //  View / Query
    // ──────────────────────────────────────────────

    /// @notice Get the current vote count for a candidate.
    /// @param _candidateId  The candidate to query.
    /// @return votes  Current number of votes received.
    function getResults(uint256 _candidateId) external view returns (uint256 votes) {
        if (!candidates[_candidateId].exists) {
            revert CandidateDoesNotExist(_candidateId);
        }
        return candidates[_candidateId].voteCount;
    }

    /// @notice Get full candidate info.
    /// @param _candidateId  The candidate to query.
    /// @return name       Candidate name.
    /// @return voteCount  Current vote tally.
    function getCandidate(uint256 _candidateId) external view returns (string memory name, uint256 voteCount) {
        if (!candidates[_candidateId].exists) {
            revert CandidateDoesNotExist(_candidateId);
        }
        Candidate storage c = candidates[_candidateId];
        return (c.name, c.voteCount);
    }

    /// @notice Check a voter's current status.
    /// @param _voterHash  The pseudonymous voter hash.
    /// @return status  0 = NotRegistered, 1 = Eligible, 2 = Voted.
    function getVoterStatus(bytes32 _voterHash) external view returns (VoterStatus status) {
        return voters[_voterHash];
    }
}
