import { useState, useCallback, useEffect } from 'react'
import { useContract } from '../context/ContractContext'
import { useWallet } from '../context/WalletContext'
import { useToast } from '../components/Toast'
import { parseContractError } from '../lib/contract'
import { apiAuthenticateVoter } from '../lib/api'

interface Candidate {
  id: number
  name: string
  votes: number
}

export default function VoterDashboard() {
  const { contract, electionActive, isCorrectChain, switchNetwork, refreshElectionState } = useContract()
  const { account } = useWallet()
  const { addToast, updateToast } = useToast()

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [votedFor, setVotedFor] = useState<number | null>(null)

  // ── Biometric / Auth state ──
  const [biometricVerified, setBiometricVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationStep, setVerificationStep] = useState(0) // 0=none, 1=fingerprint, 2=face, 3=nid, 4=done
  const [authNid, setAuthNid] = useState('')
  const [authenticatedHash, setAuthenticatedHash] = useState<string | null>(null)
  const [authenticatedName, setAuthenticatedName] = useState<string | null>(null)
  const [biometricScore, setBiometricScore] = useState<number | null>(null)

  // ── UI state ──
  const [txPending, setTxPending] = useState(false)

  // ═══════════════════════════════════════════════
  //  Fetch candidates from chain
  // ═══════════════════════════════════════════════
  const fetchCandidates = useCallback(async () => {
    if (!contract) return
    try {
      const count = Number(await contract.candidateCount())
      const fetched: Candidate[] = []
      for (let i = 1; i <= count + 10 && fetched.length < count; i++) {
        try {
          const [cName, cVotes] = await contract.getCandidate(i)
          fetched.push({ id: i, name: cName as string, votes: Number(cVotes) })
        } catch { /* skip */ }
      }
      setCandidates(fetched)
    } catch { /* not deployed */ }
  }, [contract])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  // ═══════════════════════════════════════════════
  //  Biometric Verification via Backend
  // ═══════════════════════════════════════════════
  const handleBiometricVerify = async () => {
    if (!authNid.trim()) {
      addToast({ type: 'error', title: 'NID Required', message: 'Enter your National ID for biometric verification.' })
      return
    }

    setVerifying(true)
    setVerificationStep(1)

    // ── Simulate multi-step biometric scanning ──
    // Step 1: Fingerprint (500ms)
    await new Promise(r => setTimeout(r, 600))
    setVerificationStep(2)

    // Step 2: Face recognition (800ms)
    await new Promise(r => setTimeout(r, 800))
    setVerificationStep(3)

    // Step 3: NID verification — actual backend call
    const toastId = addToast({ type: 'loading', title: 'Verifying Identity…', message: 'Authenticating with IoT backend' })

    try {
      const res = await apiAuthenticateVoter({ nid: authNid.trim() })

      if (!res.success || !res.data) {
        setVerifying(false)
        setVerificationStep(0)
        updateToast(toastId, {
          type: 'error',
          title: 'Verification Failed',
          message: res.error || 'Identity could not be verified.',
        })
        return
      }

      // ── Success — store the voter hash for casting ──
      setAuthenticatedHash(res.data.voterHash)
      setAuthenticatedName(res.data.name)
      setBiometricScore(res.data.biometricScore)
      setVerificationStep(4)
      setBiometricVerified(true)
      setVerifying(false)

      updateToast(toastId, {
        type: 'success',
        title: 'Biometric Verified! ✅',
        message: `Welcome, ${res.data.name}. You can vote now.`,
      })
    } catch (err) {
      setVerifying(false)
      setVerificationStep(0)
      updateToast(toastId, {
        type: 'error',
        title: 'Backend Error',
        message: err instanceof Error ? err.message : 'Failed to reach authentication server.',
      })
    }
  }

  // ═══════════════════════════════════════════════
  //  Cast Vote on-chain using authenticated hash
  // ═══════════════════════════════════════════════
  const handleVote = async (candidateId: number) => {
    if (!contract || !authenticatedHash || !biometricVerified) return

    setTxPending(true)
    const candidateName = candidates.find(c => c.id === candidateId)?.name ?? `#${candidateId}`
    const toastId = addToast({ type: 'loading', title: 'Casting Vote…', message: `Voting for ${candidateName}` })

    try {
      const tx = await contract.castVote(candidateId, authenticatedHash)
      await tx.wait()

      setVotedFor(candidateId)
      updateToast(toastId, {
        type: 'success',
        title: 'Vote Cast Successfully! 🎉',
        message: `Your vote for ${candidateName} has been recorded on-chain.`,
      })
      await fetchCandidates()
      await refreshElectionState()
    } catch (err) {
      updateToast(toastId, { type: 'error', title: 'Vote Failed', message: parseContractError(err) })
    } finally {
      setTxPending(false)
    }
  }

  // ═══════════════════════════════════════════════
  //  Guard screens
  // ═══════════════════════════════════════════════
  if (!account) {
    return (
      <div className="page-container bg-mesh min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <span className="text-5xl mb-4 block">🗳️</span>
          <h2 className="text-xl font-bold text-dark-100 mb-2">Wallet Not Connected</h2>
          <p className="text-dark-400 text-sm">Connect your MetaMask wallet to vote.</p>
        </div>
      </div>
    )
  }

  if (!isCorrectChain) {
    return (
      <div className="page-container bg-mesh min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="glass-card p-10 text-center max-w-md">
          <span className="text-5xl mb-4 block">🔗</span>
          <h2 className="text-xl font-bold text-dark-100 mb-2">Wrong Network</h2>
          <p className="text-dark-400 text-sm mb-6">Switch to the local testnet to cast your vote.</p>
          <button onClick={switchNetwork} className="btn-primary">Switch to Local Network</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  //  Verification step labels
  // ═══════════════════════════════════════════════
  const steps = [
    { label: 'Fingerprint Scan', icon: '👆' },
    { label: 'Face Recognition', icon: '📸' },
    { label: 'NID Verification', icon: '🪪' },
  ]

  return (
    <div className="page-container bg-mesh min-h-[calc(100vh-4rem)]">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center text-xl">🗳️</div>
          <div>
            <h1 className="section-title">Voter Dashboard</h1>
            <p className="section-subtitle">Verify your identity via IoT biometrics and cast your vote on-chain</p>
          </div>
        </div>
      </div>

      {/* Election status banner */}
      {!electionActive && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2 animate-slide-down">
          ⚠️ The election is not currently active. Voting is disabled until the admin starts the election.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ════════════ Biometric Verification ════════════ */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-dark-100 mb-1 flex items-center gap-2">
              <span className="text-accent-400">🛡️</span> Biometric Verification
            </h2>
            <p className="text-dark-500 text-sm mb-6">Simulate IoT biometric auth via the backend.</p>

            <div className="flex flex-col items-center text-center">
              {/* Fingerprint visual */}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
                biometricVerified
                  ? 'bg-accent-500/20 border-2 border-accent-500/50 shadow-lg shadow-accent-500/20'
                  : verifying
                  ? 'bg-primary-500/20 border-2 border-primary-500/50 animate-pulse'
                  : 'bg-dark-800 border-2 border-dark-700'
              }`}>
                <span className="text-4xl">
                  {biometricVerified ? '✅' : verifying ? '🔄' : '👆'}
                </span>
              </div>

              <div className="mb-4">
                <span className={`text-sm font-medium ${biometricVerified ? 'text-accent-400' : 'text-dark-400'}`}>
                  {biometricVerified
                    ? `Verified as ${authenticatedName}`
                    : verifying
                    ? 'Scanning…'
                    : 'Not Verified'}
                </span>
                {biometricScore !== null && biometricVerified && (
                  <p className="text-xs text-dark-500 mt-0.5">Confidence: {(biometricScore * 100).toFixed(1)}%</p>
                )}
              </div>

              {/* Verification steps */}
              <div className="w-full space-y-2 mb-5">
                {steps.map((step, i) => {
                  const stepNum = i + 1
                  const completed = verificationStep > stepNum || biometricVerified
                  const active = verifying && verificationStep === stepNum
                  return (
                    <div key={step.label} className="flex items-center gap-2 text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                        completed
                          ? 'bg-accent-500/20 text-accent-400'
                          : active
                          ? 'bg-primary-500/20 text-primary-400 animate-pulse'
                          : 'bg-dark-800 text-dark-600'
                      }`}>
                        {completed ? '✓' : active ? '…' : step.icon}
                      </span>
                      <span className={completed ? 'text-dark-200' : active ? 'text-primary-400' : 'text-dark-500'}>
                        {step.label}
                        {active && <span className="ml-1 text-xs text-primary-500">(in progress)</span>}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* NID input + verify button */}
              {!biometricVerified && (
                <div className="w-full space-y-3">
                  <input
                    type="text"
                    value={authNid}
                    onChange={(e) => setAuthNid(e.target.value)}
                    placeholder="Enter your NID (e.g. 1990-12345678)"
                    className="input-field text-sm"
                    id="auth-nid-input"
                    disabled={verifying}
                  />
                  <button
                    onClick={handleBiometricVerify}
                    disabled={verifying || !authNid.trim()}
                    className="btn-accent w-full"
                    id="biometric-verify-btn"
                  >
                    {verifying ? 'Verifying…' : '🛡️ Verify Identity (Mock IoT)'}
                  </button>
                </div>
              )}

              {/* Authenticated hash display */}
              {biometricVerified && authenticatedHash && (
                <div className="w-full mt-3 p-3 rounded-lg bg-dark-900/60 border border-accent-500/20">
                  <p className="text-xs text-dark-500 mb-0.5">Your voter hash:</p>
                  <p className="text-xs font-mono text-accent-400 break-all">
                    {authenticatedHash.slice(0, 18)}…{authenticatedHash.slice(-10)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════════════ Candidates List ════════════ */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                <span className="text-primary-400">📋</span> Candidates
              </h2>
              <div className="flex items-center gap-2">
                {!biometricVerified && <span className="badge-warning">Verification Required</span>}
                {votedFor !== null && <span className="badge-accent">Vote Cast ✓</span>}
                <button onClick={fetchCandidates} className="text-xs text-dark-500 hover:text-primary-400 transition-colors" title="Refresh">🔄</button>
              </div>
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-12 text-dark-500">
                <span className="text-4xl mb-3 block">📋</span>
                <p className="text-sm">No candidates found on-chain.</p>
                <p className="text-xs mt-1 text-dark-600">Ensure the contract is deployed and candidates are registered.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((c) => (
                  <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    votedFor === c.id
                      ? 'bg-primary-500/10 border-primary-500/30'
                      : 'bg-dark-900/40 border-dark-700/30 hover:border-dark-600/50'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                        votedFor === c.id ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-800 text-dark-400'
                      }`}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-dark-100">{c.name}</p>
                        <p className="text-sm text-dark-500">Candidate #{c.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {votedFor === c.id && <span className="text-primary-400 text-sm font-medium">Your Vote</span>}
                      <button
                        onClick={() => handleVote(c.id)}
                        disabled={!biometricVerified || votedFor !== null || !electionActive || txPending}
                        className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          votedFor === c.id
                            ? 'bg-primary-500 text-white'
                            : !biometricVerified || votedFor !== null || !electionActive || txPending
                            ? 'bg-dark-800 text-dark-600 cursor-not-allowed'
                            : 'bg-primary-500/15 text-primary-400 border border-primary-500/30 hover:bg-primary-500 hover:text-white'
                        }`}
                        id={`vote-btn-${c.id}`}
                      >
                        {votedFor === c.id ? '✓ Voted' : txPending ? '⏳' : 'Vote'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {votedFor !== null && (
              <div className="mt-6 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20 text-accent-400 text-sm animate-slide-up">
                ✅ Your vote has been permanently recorded on the Ethereum blockchain. Thank you for participating!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
