import { useState, useCallback, useEffect } from 'react'
import { useContract } from '../context/ContractContext'
import { CONTRACT_ADDRESS } from '../lib/contract'

interface CandidateResult {
  id: number
  name: string
  votes: number
  color: string
}

const BAR_COLORS = [
  'from-primary-500 to-primary-400',
  'from-accent-500 to-accent-400',
  'from-amber-500 to-amber-400',
  'from-rose-500 to-rose-400',
  'from-violet-500 to-violet-400',
  'from-cyan-500 to-cyan-400',
  'from-pink-500 to-pink-400',
  'from-teal-500 to-teal-400',
]

export default function PublicResults() {
  const { contract, electionActive, totalVotesCast } = useContract()

  const [results, setResults] = useState<CandidateResult[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchResults = useCallback(async () => {
    if (!contract) {
      setLoading(false)
      return
    }

    try {
      const count = Number(await contract.candidateCount())
      const fetched: CandidateResult[] = []
      let colorIdx = 0

      for (let i = 1; i <= count + 10 && fetched.length < count; i++) {
        try {
          const votes = Number(await contract.getResults(i))
          const [cName] = await contract.getCandidate(i)
          fetched.push({
            id: i,
            name: cName as string,
            votes,
            color: BAR_COLORS[colorIdx % BAR_COLORS.length],
          })
          colorIdx++
        } catch {
          // skip non-existent IDs
        }
      }

      setResults(fetched)
      setLastRefresh(new Date())
    } catch {
      // contract not deployed
    } finally {
      setLoading(false)
    }
  }, [contract])

  useEffect(() => {
    fetchResults()
  }, [fetchResults])

  // Auto-refresh every 15s when election is active
  useEffect(() => {
    if (!electionActive) return
    const interval = setInterval(fetchResults, 15000)
    return () => clearInterval(interval)
  }, [electionActive, fetchResults])

  const sorted = [...results].sort((a, b) => b.votes - a.votes)
  const maxVotes = sorted[0]?.votes || 1
  const totalVotes = results.reduce((sum, c) => sum + c.votes, 0)

  return (
    <div className="page-container bg-mesh min-h-[calc(100vh-4rem)]">
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-xl">📊</div>
          <div>
            <h1 className="section-title">Election Results</h1>
            <p className="section-subtitle">Live vote counts fetched directly from the smart contract</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-slide-up">
        {[
          { label: 'Total Votes', value: (totalVotes || totalVotesCast).toLocaleString(), icon: '🗳️' },
          { label: 'Candidates', value: results.length, icon: '👥' },
          { label: 'Leading', value: sorted[0]?.name.split(' ')[0] ?? '—', icon: '🏆' },
          { label: 'Status', value: electionActive ? 'Active' : 'Closed', icon: electionActive ? '🟢' : '🔴' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 text-center">
            <span className="text-xl mb-1 block">{stat.icon}</span>
            <p className="text-xl font-bold text-dark-100">{stat.value}</p>
            <p className="text-xs text-dark-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-dark-500 animate-fade-in">
          <span className="text-4xl mb-4 block animate-spin">⏳</span>
          <p className="text-sm">Loading results from blockchain…</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20 text-dark-500 animate-fade-in">
          <span className="text-4xl mb-4 block">📋</span>
          <p className="text-sm">No candidates found on-chain.</p>
          <p className="text-xs text-dark-600 mt-1">Ensure the contract is deployed and candidates are registered.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
                <span className="text-primary-400">📈</span> Vote Distribution
              </h2>
              <button onClick={fetchResults} className="text-xs text-dark-500 hover:text-primary-400 transition-colors flex items-center gap-1" title="Refresh results">
                🔄 Refresh
              </button>
            </div>
            <div className="space-y-5">
              {sorted.map((c, idx) => {
                const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0'
                const barWidth = maxVotes > 0 ? (c.votes / maxVotes) * 100 : 0
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <span className="text-sm">🥇</span>}
                        {idx === 1 && <span className="text-sm">🥈</span>}
                        {idx === 2 && <span className="text-sm">🥉</span>}
                        <span className="text-sm font-medium text-dark-200">{c.name}</span>
                      </div>
                      <span className="text-sm font-mono text-dark-400">{pct}%</span>
                    </div>
                    <div className="w-full h-3 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${c.color} transition-all duration-1000 ease-out`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-dark-500 mt-1">{c.votes.toLocaleString()} votes · Candidate #{c.id}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-lg font-semibold text-dark-100 mb-6 flex items-center gap-2">
              <span className="text-accent-400">🏆</span> Leaderboard
            </h2>
            <div className="space-y-3">
              {sorted.map((c, idx) => {
                const pct = totalVotes > 0 ? ((c.votes / totalVotes) * 100).toFixed(1) : '0.0'
                return (
                  <div key={c.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    idx === 0 ? 'bg-primary-500/10 border-primary-500/30' : 'bg-dark-900/40 border-dark-700/30'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                        idx === 0 ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-800 text-dark-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-dark-100">{c.name}</p>
                        <p className="text-xs text-dark-500">Candidate #{c.id}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-dark-100">{c.votes.toLocaleString()}</p>
                      <p className="text-xs text-dark-500">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Blockchain Info */}
            <div className="mt-6 p-4 rounded-xl bg-dark-900/60 border border-dark-700/40">
              <p className="text-xs text-dark-500 flex items-center gap-1.5">
                🔗 <span>All votes are permanently recorded on the Ethereum blockchain</span>
              </p>
              <p className="text-xs font-mono text-dark-600 mt-1">
                Contract: {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </p>
              {lastRefresh && (
                <p className="text-xs text-dark-600 mt-0.5">
                  Last refreshed: {lastRefresh.toLocaleTimeString()}
                  {electionActive && ' · Auto-refreshing every 15s'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
