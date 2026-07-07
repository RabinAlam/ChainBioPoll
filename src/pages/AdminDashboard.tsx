import { useState, useCallback, useEffect } from 'react'
import { useContract } from '../context/ContractContext'
import { useWallet } from '../context/WalletContext'
import { useToast } from '../components/Toast'
import { parseContractError } from '../lib/contract'
import { apiRegisterVoter, apiGetVoters, apiMarkVoterRegistered, type VoterRecord } from '../lib/api'

interface CandidateRow {
  id: number
  name: string
  votes: number
}

export default function AdminDashboard() {
  const { contract, isCommission, electionActive, isCorrectChain, switchNetwork, refreshElectionState } = useContract()
  const { account } = useWallet()
  const { addToast, updateToast } = useToast()

  // ── Candidate state ──
  const [candName, setCandName] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const [candidates, setCandidates] = useState<CandidateRow[]>([])

  // ── Voter registration state ──
  const [voterNid, setVoterNid] = useState('')
  const [voterName, setVoterName] = useState('')
  const [registeredVoters, setRegisteredVoters] = useState<VoterRecord[]>([])

  // ── UI state ──
  const [txPending, setTxPending] = useState(false)

  // ═══════════════════════════════════════════════
  //  Fetch candidates from chain
  // ═══════════════════════════════════════════════
  const fetchCandidates = useCallback(async () => {
    if (!contract) return
    try {
      const count = Number(await contract.candidateCount())
      const fetched: CandidateRow[] = []
      for (let i = 1; i <= count + 10 && fetched.length < count; i++) {
        try {
          const [cName, cVotes] = await contract.getCandidate(i)
          fetched.push({ id: i, name: cName as string, votes: Number(cVotes) })
        } catch { /* skip */ }
      }
      setCandidates(fetched)
    } catch { /* not deployed */ }
  }, [contract])

  // ═══════════════════════════════════════════════
  //  Fetch registered voters from backend
  // ═══════════════════════════════════════════════
  const fetchVoters = useCallback(async () => {
    try {
      const res = await apiGetVoters()
      if (res.success) setRegisteredVoters(res.data)
    } catch { /* backend may be down */ }
  }, [])

  useEffect(() => {
    fetchCandidates()
    fetchVoters()
  }, [fetchCandidates, fetchVoters])

  // ═══════════════════════════════════════════════
  //  Register Candidate on-chain
  // ═══════════════════════════════════════════════
  const handleRegisterCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !candName.trim() || !candidateId.trim()) return

    const id = parseInt(candidateId, 10)
    if (isNaN(id) || id <= 0) {
      addToast({ type: 'error', title: 'Invalid ID', message: 'Candidate ID must be a positive number.' })
      return
    }

    setTxPending(true)
    const toastId = addToast({ type: 'loading', title: 'Registering Candidate…', message: `Sending tx for "${candName.trim()}"` })

    try {
      const tx = await contract.registerCandidate(candName.trim(), id)
      await tx.wait()
      updateToast(toastId, { type: 'success', title: 'Candidate Registered!', message: `${candName.trim()} (ID: ${id}) added on-chain.` })
      setCandName('')
      setCandidateId('')
      await fetchCandidates()
      await refreshElectionState()
    } catch (err) {
      updateToast(toastId, { type: 'error', title: 'Registration Failed', message: parseContractError(err) })
    } finally {
      setTxPending(false)
    }
  }

  // ═══════════════════════════════════════════════
  //  Register Voter: Backend (/api/register) → On-Chain (registerVoter)
  // ═══════════════════════════════════════════════
  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contract || !voterNid.trim() || !voterName.trim()) return

    setTxPending(true)
    const toastId = addToast({ type: 'loading', title: '① Registering Off-Chain…', message: 'Sending voter data to backend' })

    try {
      // ── Step 1: Register in backend (generates salt + voterHash) ──
      const backendRes = await apiRegisterVoter({
        nid: voterNid.trim(),
        name: voterName.trim(),
      })

      if (!backendRes.success || !backendRes.data) {
        updateToast(toastId, { type: 'error', title: 'Off-Chain Registration Failed', message: backendRes.error || 'Unknown error' })
        setTxPending(false)
        return
      }

      const { voterHash, truncatedHash } = backendRes.data

      updateToast(toastId, {
        type: 'loading',
        title: '② Registering On-Chain…',
        message: `Hash: ${truncatedHash} — Confirm in MetaMask`,
      })

      // ── Step 2: Register the hash on the smart contract ──
      const tx = await contract.registerVoter(voterHash)
      await tx.wait()

      // ── Step 3: Mark as registered on-chain in the backend ──
      await apiMarkVoterRegistered(voterNid.trim())

      updateToast(toastId, {
        type: 'success',
        title: 'Voter Registered Off-Chain & On-Chain! ✅',
        message: `${voterName.trim()} — Hash: ${truncatedHash}`,
      })

      setVoterNid('')
      setVoterName('')
      await fetchVoters()
      await refreshElectionState()
    } catch (err) {
      // Distinguish backend errors from contract errors
      const isContractError = (err as { code?: string })?.code === 'ACTION_REJECTED' || (err as { reason?: string })?.reason
      updateToast(toastId, {
        type: 'error',
        title: isContractError ? 'On-Chain Registration Failed' : 'Registration Failed',
        message: isContractError ? parseContractError(err) : (err instanceof Error ? err.message : 'Unknown error'),
      })
    } finally {
      setTxPending(false)
    }
  }

  // ═══════════════════════════════════════════════
  //  Start / End Election
  // ═══════════════════════════════════════════════
  const handleToggleElection = async () => {
    if (!contract) return
    setTxPending(true)
    const action = electionActive ? 'Ending' : 'Starting'
    const toastId = addToast({ type: 'loading', title: `${action} Election…` })

    try {
      const tx = electionActive ? await contract.endElection() : await contract.startElection()
      await tx.wait()
      updateToast(toastId, {
        type: 'success',
        title: `Election ${electionActive ? 'Ended' : 'Started'}!`,
        message: electionActive ? 'Voting is now closed.' : 'Voters can now cast their votes.',
      })
      await refreshElectionState()
    } catch (err) {
      updateToast(toastId, { type: 'error', title: `${action} Failed`, message: parseContractError(err) })
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
          <span className="text-5xl mb-4 block">🔐</span>
          <h2 className="text-xl font-bold text-dark-100 mb-2">Wallet Not Connected</h2>
          <p className="text-dark-400 text-sm">Connect your MetaMask wallet to access the Admin Dashboard.</p>
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
          <p className="text-dark-400 text-sm mb-6">Please switch to the local testnet (Chain ID 31337).</p>
          <button onClick={switchNetwork} className="btn-primary" id="switch-network-btn">Switch to Local Network</button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════
  return (
    <div className="page-container bg-mesh min-h-[calc(100vh-4rem)]">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center text-xl">⚙️</div>
          <div>
            <h1 className="section-title">Admin Dashboard</h1>
            <p className="section-subtitle">
              {isCommission ? 'You are the Election Commission' : 'View-only — you are not the admin'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ════════════ Left Panel ════════════ */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Register Candidate ── */}
          <div className="glass-card p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-dark-100 mb-1 flex items-center gap-2">
              <span className="text-primary-400">➕</span> Register Candidate
            </h2>
            <p className="text-dark-500 text-sm mb-5">Add a new candidate to the election ballot (on-chain).</p>
            <form onSubmit={handleRegisterCandidate} className="space-y-4">
              <div>
                <label htmlFor="cand-name" className="block text-sm font-medium text-dark-300 mb-1.5">Full Name</label>
                <input type="text" id="cand-name" value={candName} onChange={(e) => setCandName(e.target.value)} placeholder="e.g. Alice Rahman" className="input-field" required disabled={!isCommission || txPending} />
              </div>
              <div>
                <label htmlFor="cand-id" className="block text-sm font-medium text-dark-300 mb-1.5">Candidate ID</label>
                <input type="number" id="cand-id" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} placeholder="e.g. 1" className="input-field" required min="1" disabled={!isCommission || txPending} />
              </div>
              <button type="submit" className="btn-primary w-full" id="register-candidate-btn" disabled={!isCommission || txPending || electionActive}>
                {txPending ? 'Submitting…' : electionActive ? 'Registration Closed' : 'Register Candidate On-Chain'}
              </button>
            </form>
          </div>

          {/* ── Register Voter (Backend + On-Chain) ── */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '50ms' }}>
            <h2 className="text-lg font-semibold text-dark-100 mb-1 flex items-center gap-2">
              <span className="text-accent-400">🛡️</span> Register Voter
            </h2>
            <p className="text-dark-500 text-sm mb-1">Two-step registration:</p>
            <ol className="text-dark-500 text-xs mb-5 list-decimal list-inside space-y-0.5">
              <li>Backend generates salt + pseudonymous hash</li>
              <li>Hash is registered on the smart contract</li>
            </ol>
            <form onSubmit={handleRegisterVoter} className="space-y-4">
              <div>
                <label htmlFor="voter-nid" className="block text-sm font-medium text-dark-300 mb-1.5">National ID (NID)</label>
                <input type="text" id="voter-nid" value={voterNid} onChange={(e) => setVoterNid(e.target.value)} placeholder="e.g. 1990-12345678" className="input-field" required disabled={!isCommission || txPending} />
              </div>
              <div>
                <label htmlFor="voter-name" className="block text-sm font-medium text-dark-300 mb-1.5">Voter Name</label>
                <input type="text" id="voter-name" value={voterName} onChange={(e) => setVoterName(e.target.value)} placeholder="e.g. Alice Rahman" className="input-field" required disabled={!isCommission || txPending} />
              </div>
              <button type="submit" className="btn-accent w-full" id="register-voter-btn" disabled={!isCommission || txPending}>
                {txPending ? 'Processing…' : '🛡️ Register Voter (Backend → Blockchain)'}
              </button>
            </form>
          </div>

          {/* ── Election Control ── */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-semibold text-dark-100 mb-1 flex items-center gap-2">
              <span className="text-accent-400">🚀</span> Election Control
            </h2>
            <p className="text-dark-500 text-sm mb-5">
              {electionActive ? 'The election is currently active.' : `${candidates.length} candidate(s) · ${registeredVoters.length} voter(s) registered.`}
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${electionActive ? 'bg-accent-400 animate-pulse' : 'bg-dark-600'}`} />
              <span className={`text-sm font-medium ${electionActive ? 'text-accent-400' : 'text-dark-400'}`}>
                {electionActive ? 'Election Active' : 'Election Not Started'}
              </span>
            </div>
            <button onClick={handleToggleElection} className={electionActive ? 'btn-danger w-full' : 'btn-accent w-full'} id={electionActive ? 'end-election-btn' : 'start-election-btn'} disabled={!isCommission || txPending}>
              {txPending ? 'Submitting…' : electionActive ? '⏹ End Election' : '🚀 Start Election'}
            </button>
          </div>
        </div>

        {/* ════════════ Right Panel ════════════ */}
        <div className="lg:col-span-3 space-y-6">
          {/* ── Candidates Table ── */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                <span className="text-primary-400">👥</span> Candidates
              </h2>
              <div className="flex items-center gap-2">
                <span className="badge-primary">{candidates.length} On-Chain</span>
                <button onClick={fetchCandidates} className="text-xs text-dark-500 hover:text-primary-400 transition-colors" title="Refresh">🔄</button>
              </div>
            </div>
            {candidates.length === 0 ? (
              <div className="text-center py-8 text-dark-500">
                <span className="text-3xl mb-2 block">📋</span>
                <p className="text-sm">No candidates registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700/50">
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">ID</th>
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">Name</th>
                      <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-dark-500 font-mono">{c.id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-dark-100">{c.name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-dark-400 text-right">{c.votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Registered Voters Table ── */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                <span className="text-accent-400">🛡️</span> Registered Voters
              </h2>
              <div className="flex items-center gap-2">
                <span className="badge-accent">{registeredVoters.length} Total</span>
                <button onClick={fetchVoters} className="text-xs text-dark-500 hover:text-accent-400 transition-colors" title="Refresh">🔄</button>
              </div>
            </div>
            {registeredVoters.length === 0 ? (
              <div className="text-center py-8 text-dark-500">
                <span className="text-3xl mb-2 block">👤</span>
                <p className="text-sm">No voters registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700/50">
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">Name</th>
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">NID</th>
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">Hash</th>
                      <th className="text-center text-xs font-semibold text-dark-400 uppercase tracking-wider px-4 py-3">On-Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredVoters.map((v) => (
                      <tr key={v._id} className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-dark-100">{v.name}</td>
                        <td className="px-4 py-3 text-sm font-mono text-dark-400">{v.nid}</td>
                        <td className="px-4 py-3 text-xs font-mono text-primary-400">{v.truncatedHash}</td>
                        <td className="px-4 py-3 text-center">
                          {v.isRegistered
                            ? <span className="text-accent-400 text-xs">✅ Yes</span>
                            : <span className="text-dark-600 text-xs">⏳ Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
