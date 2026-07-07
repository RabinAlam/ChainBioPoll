// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LocalVoting.sol";

/// @title LocalVoting Test Suite
/// @notice Tests for candidate/voter registration, vote casting,
///         duplicate vote prevention, election lifecycle, and access control.
contract LocalVotingTest is Test {
    LocalVoting public voting;

    // Actors
    address public commission;    // deployer / admin
    address public alice;         // a regular voter caller
    address public bob;

    // Pseudonymous voter hashes (simulating keccak256 of off-chain NID data)
    bytes32 public voterHash1;
    bytes32 public voterHash2;
    bytes32 public voterHash3;

    // Candidate IDs
    uint256 constant CANDIDATE_A = 1;
    uint256 constant CANDIDATE_B = 2;

    // ──────────────────────────────────────────────
    //  Setup
    // ──────────────────────────────────────────────

    function setUp() public {
        commission = address(this);   // test contract is deployer
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        voterHash1 = keccak256(abi.encodePacked("NID-1990-12345678"));
        voterHash2 = keccak256(abi.encodePacked("NID-1988-87654321"));
        voterHash3 = keccak256(abi.encodePacked("NID-1995-11223344"));

        voting = new LocalVoting();

        // Register two candidates
        voting.registerCandidate("Alice Rahman", CANDIDATE_A);
        voting.registerCandidate("Bob Hossain", CANDIDATE_B);

        // Register two voters
        voting.registerVoter(voterHash1);
        voting.registerVoter(voterHash2);
    }

    // ──────────────────────────────────────────────
    //  Deployment
    // ──────────────────────────────────────────────

    function test_CommissionIsDeployer() public view {
        assertEq(voting.commission(), commission);
    }

    function test_ElectionStartsInactive() public view {
        assertFalse(voting.electionActive());
    }

    // ──────────────────────────────────────────────
    //  Candidate Registration
    // ──────────────────────────────────────────────

    function test_RegisterCandidate() public view {
        (string memory name, uint256 votes) = voting.getCandidate(CANDIDATE_A);
        assertEq(name, "Alice Rahman");
        assertEq(votes, 0);
        assertEq(voting.candidateCount(), 2);
    }

    function test_RevertRegisterDuplicateCandidate() public {
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.CandidateAlreadyExists.selector, CANDIDATE_A)
        );
        voting.registerCandidate("Duplicate", CANDIDATE_A);
    }

    function test_RevertRegisterCandidateEmptyName() public {
        vm.expectRevert(LocalVoting.InvalidCandidateName.selector);
        voting.registerCandidate("", 99);
    }

    function test_RevertRegisterCandidateNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert(LocalVoting.OnlyCommission.selector);
        voting.registerCandidate("Hacker", 99);
    }

    // ──────────────────────────────────────────────
    //  Voter Registration
    // ──────────────────────────────────────────────

    function test_RegisterVoter() public view {
        LocalVoting.VoterStatus status = voting.getVoterStatus(voterHash1);
        assertEq(uint256(status), uint256(LocalVoting.VoterStatus.Eligible));
    }

    function test_RevertRegisterDuplicateVoter() public {
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.VoterAlreadyRegistered.selector, voterHash1)
        );
        voting.registerVoter(voterHash1);
    }

    function test_RevertRegisterZeroHash() public {
        vm.expectRevert(LocalVoting.InvalidVoterHash.selector);
        voting.registerVoter(bytes32(0));
    }

    function test_RevertRegisterVoterNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert(LocalVoting.OnlyCommission.selector);
        voting.registerVoter(voterHash3);
    }

    // ──────────────────────────────────────────────
    //  Election Lifecycle
    // ──────────────────────────────────────────────

    function test_StartElection() public {
        voting.startElection();
        assertTrue(voting.electionActive());
    }

    function test_RevertStartElectionTwice() public {
        voting.startElection();
        vm.expectRevert(LocalVoting.ElectionAlreadyActive.selector);
        voting.startElection();
    }

    function test_EndElection() public {
        voting.startElection();
        voting.endElection();
        assertFalse(voting.electionActive());
    }

    function test_RevertEndElectionWhenNotActive() public {
        vm.expectRevert(LocalVoting.ElectionAlreadyEnded.selector);
        voting.endElection();
    }

    function test_RevertStartElectionNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert(LocalVoting.OnlyCommission.selector);
        voting.startElection();
    }

    function test_RevertEndElectionNonAdmin() public {
        voting.startElection();
        vm.prank(alice);
        vm.expectRevert(LocalVoting.OnlyCommission.selector);
        voting.endElection();
    }

    // ──────────────────────────────────────────────
    //  Vote Casting — Happy Path
    // ──────────────────────────────────────────────

    function test_CastVote() public {
        voting.startElection();

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        // Verify vote count incremented
        assertEq(voting.getResults(CANDIDATE_A), 1);
        assertEq(voting.totalVotesCast(), 1);

        // Verify voter marked as voted
        LocalVoting.VoterStatus status = voting.getVoterStatus(voterHash1);
        assertEq(uint256(status), uint256(LocalVoting.VoterStatus.Voted));
    }

    function test_CastMultipleVotersDifferentCandidates() public {
        voting.startElection();

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        vm.prank(bob);
        voting.castVote(CANDIDATE_B, voterHash2);

        assertEq(voting.getResults(CANDIDATE_A), 1);
        assertEq(voting.getResults(CANDIDATE_B), 1);
        assertEq(voting.totalVotesCast(), 2);
    }

    function test_CastMultipleVotersSameCandidate() public {
        voting.startElection();

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        vm.prank(bob);
        voting.castVote(CANDIDATE_A, voterHash2);

        assertEq(voting.getResults(CANDIDATE_A), 2);
        assertEq(voting.totalVotesCast(), 2);
    }

    // ──────────────────────────────────────────────
    //  Vote Casting — Duplicate Prevention
    // ──────────────────────────────────────────────

    function test_RevertDuplicateVote() public {
        voting.startElection();

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        // Same voter hash tries to vote again → must revert
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.VoterAlreadyVoted.selector, voterHash1)
        );
        voting.castVote(CANDIDATE_B, voterHash1);
    }

    function test_RevertDuplicateVoteSameCandidate() public {
        voting.startElection();

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        // Attempt to vote for same candidate again
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.VoterAlreadyVoted.selector, voterHash1)
        );
        voting.castVote(CANDIDATE_A, voterHash1);
    }

    // ──────────────────────────────────────────────
    //  Vote Casting — Validation Failures
    // ──────────────────────────────────────────────

    function test_RevertVoteWhenElectionInactive() public {
        // Election not started
        vm.prank(alice);
        vm.expectRevert(LocalVoting.ElectionNotActive.selector);
        voting.castVote(CANDIDATE_A, voterHash1);
    }

    function test_RevertVoteAfterElectionEnds() public {
        voting.startElection();
        voting.endElection();

        vm.prank(alice);
        vm.expectRevert(LocalVoting.ElectionNotActive.selector);
        voting.castVote(CANDIDATE_A, voterHash1);
    }

    function test_RevertVoteUnregisteredVoter() public {
        voting.startElection();

        bytes32 unregistered = keccak256(abi.encodePacked("unknown-nid"));
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.VoterNotEligible.selector, unregistered)
        );
        voting.castVote(CANDIDATE_A, unregistered);
    }

    function test_RevertVoteNonExistentCandidate() public {
        voting.startElection();

        uint256 fakeCandidateId = 999;
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.CandidateDoesNotExist.selector, fakeCandidateId)
        );
        voting.castVote(fakeCandidateId, voterHash1);
    }

    // ──────────────────────────────────────────────
    //  Results Queries
    // ──────────────────────────────────────────────

    function test_GetResultsZeroBeforeVoting() public view {
        assertEq(voting.getResults(CANDIDATE_A), 0);
    }

    function test_RevertGetResultsNonExistentCandidate() public {
        vm.expectRevert(
            abi.encodeWithSelector(LocalVoting.CandidateDoesNotExist.selector, uint256(999))
        );
        voting.getResults(999);
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    function test_EmitVoteCastEvent() public {
        voting.startElection();

        vm.expectEmit(true, true, false, false);
        emit LocalVoting.VoteCast(voterHash1, CANDIDATE_A);

        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);
    }

    function test_EmitCandidateRegisteredEvent() public {
        vm.expectEmit(true, false, false, true);
        emit LocalVoting.CandidateRegistered(42, "New Candidate");

        voting.registerCandidate("New Candidate", 42);
    }

    function test_EmitVoterRegisteredEvent() public {
        vm.expectEmit(true, false, false, false);
        emit LocalVoting.VoterRegistered(voterHash3);

        voting.registerVoter(voterHash3);
    }

    // ──────────────────────────────────────────────
    //  Integration — Full Election Flow
    // ──────────────────────────────────────────────

    function test_FullElectionFlow() public {
        // Register a third voter
        voting.registerVoter(voterHash3);

        // Start
        voting.startElection();
        assertTrue(voting.electionActive());

        // Three voters cast votes
        vm.prank(alice);
        voting.castVote(CANDIDATE_A, voterHash1);

        vm.prank(bob);
        voting.castVote(CANDIDATE_B, voterHash2);

        vm.prank(makeAddr("carol"));
        voting.castVote(CANDIDATE_A, voterHash3);

        // End
        voting.endElection();
        assertFalse(voting.electionActive());

        // Final results
        assertEq(voting.getResults(CANDIDATE_A), 2);
        assertEq(voting.getResults(CANDIDATE_B), 1);
        assertEq(voting.totalVotesCast(), 3);
        assertEq(voting.candidateCount(), 2);
    }
}
