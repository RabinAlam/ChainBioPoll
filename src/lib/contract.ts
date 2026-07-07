import { Contract, keccak256, toUtf8Bytes, type InterfaceAbi } from 'ethers'
import type { Signer } from 'ethers'

// ──────────────────────────────────────────────────
//  Contract ABI (matches LocalVoting.sol)
// ──────────────────────────────────────────────────
export const LOCAL_VOTING_ABI: InterfaceAbi = [
  // Admin — Candidate
  'function registerCandidate(string memory _name, uint256 _candidateId) external',
  // Admin — Voter
  'function registerVoter(bytes32 _voterHash) external',
  // Admin — Election lifecycle
  'function startElection() external',
  'function endElection() external',
  // Voting
  'function castVote(uint256 _candidateId, bytes32 _voterHash) external',
  // View / Query
  'function getResults(uint256 _candidateId) external view returns (uint256 votes)',
  'function getCandidate(uint256 _candidateId) external view returns (string name, uint256 voteCount)',
  'function getVoterStatus(bytes32 _voterHash) external view returns (uint8 status)',
  // Public state
  'function commission() external view returns (address)',
  'function electionActive() external view returns (bool)',
  'function candidateCount() external view returns (uint256)',
  'function totalVotesCast() external view returns (uint256)',
  // Events
  'event CandidateRegistered(uint256 indexed candidateId, string name)',
  'event VoterRegistered(bytes32 indexed voterHash)',
  'event VoteCast(bytes32 indexed voterHash, uint256 indexed candidateId)',
  'event ElectionStarted()',
  'event ElectionEnded()',
]

// ──────────────────────────────────────────────────
//  Dummy contract address (replace after deployment)
// ──────────────────────────────────────────────────
export const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'

// ──────────────────────────────────────────────────
//  Local Anvil / Hardhat testnet config
// ──────────────────────────────────────────────────
export const LOCAL_CHAIN_ID = 31337
export const LOCAL_CHAIN_ID_HEX = '0x7A69'
export const LOCAL_RPC_URL = 'http://127.0.0.1:8545'

// ──────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────

/**
 * Create a contract instance connected to the given signer.
 */
export function getContract(signer: Signer): Contract {
  return new Contract(CONTRACT_ADDRESS, LOCAL_VOTING_ABI, signer)
}

/**
 * Switch MetaMask to the local Anvil/Hardhat network (chain 31337).
 * Adds the network if it doesn't exist yet.
 */
export async function switchToLocalNetwork(): Promise<void> {
  if (!window.ethereum) throw new Error('MetaMask not found')

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: LOCAL_CHAIN_ID_HEX }],
    })
  } catch (err: unknown) {
    // 4902 = chain not added yet
    const error = err as { code?: number }
    if (error.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: LOCAL_CHAIN_ID_HEX,
            chainName: 'Localhost 8545',
            rpcUrls: [LOCAL_RPC_URL],
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
      })
    } else {
      throw err
    }
  }
}

/**
 * Convert a plain string (e.g. an NID) into a bytes32 hash.
 * Uses keccak256, matching the contract's expected format.
 */
export function toVoterHash(input: string): string {
  return keccak256(toUtf8Bytes(input))
}

/**
 * Generate a random mock voter hash (for testing).
 */
export function generateMockVoterHash(): string {
  const random = `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return toVoterHash(random)
}

/**
 * Parse a user-friendly error message from a contract revert.
 */
export function parseContractError(err: unknown): string {
  const error = err as { reason?: string; code?: string; message?: string; info?: { error?: { message?: string } } }

  // User rejected the tx in MetaMask
  if (error.code === 'ACTION_REJECTED') {
    return 'Transaction rejected by user.'
  }

  // Contract revert reason
  if (error.reason) {
    // Map custom error names to human-friendly messages
    const reasonMap: Record<string, string> = {
      'OnlyCommission': 'Only the Election Commission can perform this action.',
      'ElectionNotActive': 'The election is not currently active.',
      'ElectionAlreadyActive': 'The election has already been started.',
      'ElectionAlreadyEnded': 'The election has already ended.',
      'CandidateAlreadyExists': 'A candidate with this ID already exists.',
      'CandidateDoesNotExist': 'This candidate does not exist.',
      'VoterAlreadyRegistered': 'This voter hash is already registered.',
      'VoterNotEligible': 'This voter hash is not registered or eligible.',
      'VoterAlreadyVoted': 'This voter has already cast a vote.',
      'InvalidVoterHash': 'Invalid voter hash provided.',
      'InvalidCandidateName': 'Candidate name cannot be empty.',
    }

    for (const [key, msg] of Object.entries(reasonMap)) {
      if (error.reason.includes(key)) return msg
    }

    return error.reason
  }

  // Nested error from provider
  if (error.info?.error?.message) {
    return error.info.error.message
  }

  return error.message ?? 'An unknown error occurred.'
}
