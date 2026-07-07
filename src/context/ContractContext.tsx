import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Contract } from 'ethers'
import { useWallet } from './WalletContext'
import { getContract, switchToLocalNetwork, LOCAL_CHAIN_ID, parseContractError } from '../lib/contract'

interface ContractContextType {
  contract: Contract | null
  isCommission: boolean
  electionActive: boolean
  candidateCount: number
  totalVotesCast: number
  isCorrectChain: boolean
  switchNetwork: () => Promise<void>
  refreshElectionState: () => Promise<void>
}

const ContractContext = createContext<ContractContextType | undefined>(undefined)

export function ContractProvider({ children }: { children: ReactNode }) {
  const { signer, account, chainId } = useWallet()

  const [contract, setContract] = useState<Contract | null>(null)
  const [isCommission, setIsCommission] = useState(false)
  const [electionActive, setElectionActive] = useState(false)
  const [candidateCount, setCandidateCount] = useState(0)
  const [totalVotesCast, setTotalVotesCast] = useState(0)

  const isCorrectChain = chainId === LOCAL_CHAIN_ID

  // Initialize contract when signer changes
  useEffect(() => {
    if (signer && isCorrectChain) {
      const instance = getContract(signer)
      setContract(instance)
    } else {
      setContract(null)
    }
  }, [signer, isCorrectChain])

  // Refresh election state from the contract
  const refreshElectionState = useCallback(async () => {
    if (!contract) return

    try {
      const [active, count, votes, commissionAddr] = await Promise.all([
        contract.electionActive(),
        contract.candidateCount(),
        contract.totalVotesCast(),
        contract.commission(),
      ])

      setElectionActive(active as boolean)
      setCandidateCount(Number(count))
      setTotalVotesCast(Number(votes))
      setIsCommission(
        account?.toLowerCase() === (commissionAddr as string).toLowerCase()
      )
    } catch {
      // Contract may not be deployed yet — silently ignore
    }
  }, [contract, account])

  // Auto-refresh on mount and when contract changes
  useEffect(() => {
    refreshElectionState()
  }, [refreshElectionState])

  const switchNetwork = useCallback(async () => {
    try {
      await switchToLocalNetwork()
    } catch (err) {
      console.error('Failed to switch network:', parseContractError(err))
    }
  }, [])

  return (
    <ContractContext.Provider
      value={{
        contract,
        isCommission,
        electionActive,
        candidateCount,
        totalVotesCast,
        isCorrectChain,
        switchNetwork,
        refreshElectionState,
      }}
    >
      {children}
    </ContractContext.Provider>
  )
}

export function useContract() {
  const context = useContext(ContractContext)
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider')
  }
  return context
}
