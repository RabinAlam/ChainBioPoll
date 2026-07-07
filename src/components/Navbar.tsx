import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { useContract } from '../context/ContractContext'

export default function Navbar() {
  const { account, isConnecting, error, connectWallet, disconnectWallet, truncatedAddress } = useWallet()
  const { isCorrectChain, switchNetwork } = useContract()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/admin', label: 'Admin', icon: '⚙️' },
    { to: '/voter', label: 'Vote', icon: '🗳️' },
    { to: '/results', label: 'Results', icon: '📊' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="sticky top-0 z-50 glass border-b border-dark-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow duration-300">
              CB
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent hidden sm:block">
              ChainBioPoll
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/60'
                }`}
              >
                <span className="mr-1.5">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-3">
            {error && (
              <span className="hidden lg:block text-xs text-red-400 max-w-[200px] truncate">
                {error}
              </span>
            )}

            {account ? (
              <div className="flex items-center gap-2">
                {!isCorrectChain && (
                  <button
                    onClick={switchNetwork}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                    id="navbar-switch-network"
                  >
                    ⚠️ Wrong Network
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/20">
                  <span className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-accent-400' : 'bg-amber-400'} animate-pulse`} />
                  <span className="text-sm font-mono text-accent-400">
                    {truncatedAddress}
                  </span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-dark-400 hover:text-red-400 hover:bg-red-500/10 border border-dark-700/50 hover:border-red-500/30 transition-all duration-200"
                  id="disconnect-wallet-btn"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="btn-primary text-sm !px-4 !py-2 flex items-center gap-2"
                id="connect-wallet-btn"
              >
                {isConnecting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                    </svg>
                    Connect MetaMask
                  </>
                )}
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800/60 transition-colors"
              id="mobile-menu-toggle"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden animate-slide-down border-t border-dark-700/50">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-primary-500/15 text-primary-400'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/60'
                }`}
              >
                <span className="mr-2">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            {account && (
              <div className="sm:hidden pt-2 border-t border-dark-700/50 mt-2">
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
                  <span className="text-sm font-mono text-accent-400">
                    {truncatedAddress}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
