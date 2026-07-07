import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { BrowserProvider, type Signer } from 'ethers'

interface WalletContextType {
  account: string | null
  signer: Signer | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  truncatedAddress: string
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [signer, setSigner] = useState<Signer | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const truncatedAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : ''

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (accounts.length > 0) {
        const provider = new BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()

        setAccount(accounts[0])
        setSigner(signer)
        setChainId(Number(network.chainId))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(message)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setAccount(null)
    setSigner(null)
    setChainId(null)
    setError(null)
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      if (accounts.length === 0) {
        disconnectWallet()
      } else {
        setAccount(accounts[0])
      }
    }

    const handleChainChanged = () => {
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [disconnectWallet])

  return (
    <WalletContext.Provider
      value={{
        account,
        signer,
        chainId,
        isConnecting,
        error,
        connectWallet,
        disconnectWallet,
        truncatedAddress,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}
