import { Link } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

export default function Home() {
  const { account, connectWallet, isConnecting } = useWallet()

  return (
    <div className="page-container flex-1 flex flex-col items-center justify-center text-center bg-mesh min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <div className="animate-fade-in max-w-3xl mx-auto">
        {/* Floating Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
          Powered by Ethereum Blockchain
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
          <span className="bg-gradient-to-r from-white via-dark-100 to-dark-300 bg-clip-text text-transparent">
            Decentralized Voting
          </span>
          <br />
          <span className="bg-gradient-to-r from-primary-400 via-primary-300 to-accent-400 bg-clip-text text-transparent">
            With Biometric Security
          </span>
        </h1>

        <p className="text-dark-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          ChainBioPoll brings transparent, tamper-proof elections to the blockchain.
          Every vote is verified with biometric authentication and permanently recorded on-chain.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          {!account ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="btn-primary text-base !px-8 !py-3 flex items-center gap-2 animate-glow"
              id="hero-connect-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
              Connect Wallet to Get Started
            </button>
          ) : (
            <Link to="/voter" className="btn-primary text-base !px-8 !py-3 flex items-center gap-2">
              🗳️ Go to Voting Dashboard
            </Link>
          )}
          <Link to="/results" className="btn-outline text-base !px-8 !py-3">
            View Live Results
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 animate-slide-up">
          <div className="glass-card p-6 text-left">
            <div className="w-12 h-12 rounded-xl bg-primary-500/15 flex items-center justify-center text-2xl mb-4">
              🔗
            </div>
            <h3 className="text-lg font-semibold text-dark-100 mb-2">On-Chain Transparency</h3>
            <p className="text-dark-400 text-sm leading-relaxed">
              Every vote is immutably recorded on the Ethereum blockchain, ensuring complete auditability.
            </p>
          </div>

          <div className="glass-card p-6 text-left">
            <div className="w-12 h-12 rounded-xl bg-accent-500/15 flex items-center justify-center text-2xl mb-4">
              🛡️
            </div>
            <h3 className="text-lg font-semibold text-dark-100 mb-2">Biometric Verification</h3>
            <p className="text-dark-400 text-sm leading-relaxed">
              Multi-factor identity checks prevent double voting and ensure one person, one vote.
            </p>
          </div>

          <div className="glass-card p-6 text-left">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-2xl mb-4">
              📊
            </div>
            <h3 className="text-lg font-semibold text-dark-100 mb-2">Real-Time Results</h3>
            <p className="text-dark-400 text-sm leading-relaxed">
              Watch the election unfold in real-time with live vote tallying and visual analytics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
