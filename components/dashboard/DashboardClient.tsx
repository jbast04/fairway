'use client'

import { useState, useEffect } from 'react'
import type { Round, DashboardStats, Profile, BenchmarkKey } from '@/types'
import { BENCHES } from '@/lib/benchmarks'
import { fmt, fmtSG, sgColor } from '@/lib/stats'
import ScoreTrendChart from './ScoreTrendChart'
import SGCard from './SGCard'
import AICaddie from './AICaddie'

interface Props {
  stats: DashboardStats
  rounds: Round[]
  profile: Profile | null
}

const BENCH_KEYS: BenchmarkKey[] = ['scratch', '5hcp', '10hcp', '15hcp', '20hcp']

export default function DashboardClient({ stats, rounds, profile }: Props) {
  const [benchmark, setBenchmark] = useState<BenchmarkKey>('10hcp')

  // Load saved benchmark from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fw_benchmark') as BenchmarkKey | null
      if (saved && BENCH_KEYS.includes(saved)) setBenchmark(saved)
    } catch { /* ignore */ }
  }, [])

  // Persist benchmark selection so Play page can read it
  function handleBenchmarkChange(k: BenchmarkKey) {
    setBenchmark(k)
    try { localStorage.setItem('fw_benchmark', k) } catch { /* ignore */ }
  }

  const bench = BENCHES[benchmark]

  const sgCategories = [
    { key: 'sgOtt',  label: 'Off the Tee',     val: stats.sgOtt,  benchVal: bench.sg_ott },
    { key: 'sgApp',  label: 'Approach',         val: stats.sgApp,  benchVal: bench.sg_app },
    { key: 'sgArg',  label: 'Around Green',     val: stats.sgArg,  benchVal: bench.sg_arg },
    { key: 'sgPutt', label: 'Putting',          val: stats.sgPutt, benchVal: bench.sg_putt },
  ] as const

  // Find biggest leak and top strength
  const gaps = sgCategories.map(c => ({
    label: c.label,
    gap: (c.val ?? c.benchVal) - c.benchVal,
  }))
  const biggestLeak   = [...gaps].sort((a, b) => a.gap - b.gap)[0]
  const topStrength   = [...gaps].sort((a, b) => b.gap - a.gap)[0]

  // Par 3/5 averages from rounds
  const par3Avg  = rounds.length > 0 ? '—' : '—'  // TODO: requires per-hole data
  const par5Avg  = rounds.length > 0 ? '—' : '—'

  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-text">
              {profile?.display_name ? `Hey, ${profile.display_name.split(' ')[0]}` : 'Dashboard'}
            </h1>
            <p className="text-xs text-text-dim">{stats.roundsPlayed} rounds tracked</p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.handicap_index != null && (
              <div className="rounded-lg border border-border bg-surface px-3 py-1 text-center">
                <p className="text-xs text-text-dim">HCP</p>
                <p className="text-sm font-bold text-accent">{profile.handicap_index.toFixed(1)}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* Stats grid */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Overview</h2>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Scoring Avg"   value={fmt(stats.scoringAvg)}         />
            <StatCard label="Best Score"    value={stats.bestScore?.toString() ?? '—'} />
            <StatCard label="GIR %"         value={`${fmt(stats.girPct)}%`}        />
            <StatCard label="FIR %"         value={`${fmt(stats.firPct)}%`}        />
            <StatCard label="Putts / Round" value={fmt(stats.puttsPerRound)}       />
            <StatCard label="Scrambling %"  value={`${fmt(stats.scramblingPct)}%`} />
            <StatCard label="3-Putt Avg"    value={fmt(stats.threePuttAvg)}        />
            <StatCard label="Penalties Avg" value={fmt(stats.penaltiesAvg)}        />
          </div>
        </section>

        {/* Benchmark selector */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Benchmark</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {BENCH_KEYS.map(k => (
              <button
                key={k}
                onClick={() => handleBenchmarkChange(k)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  benchmark === k
                    ? 'bg-accent text-bg'
                    : 'border border-border text-text-dim'
                }`}
              >
                {BENCHES[k].label}
              </button>
            ))}
          </div>
        </section>

        {/* SG Cards */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Strokes Gained</h2>
          <div className="grid grid-cols-2 gap-2">
            {sgCategories.map(c => (
              <SGCard
                key={c.key}
                label={c.label}
                value={c.val}
                benchmarkValue={c.benchVal}
              />
            ))}
          </div>
        </section>

        {/* AI Caddie */}
        <AICaddie benchmark={benchmark} hasRounds={stats.roundsPlayed > 0} />

        {/* Score trend */}
        {rounds.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Score Trend</h2>
            <div className="rounded-xl border border-border bg-surface p-3">
              <ScoreTrendChart rounds={rounds} />
            </div>
          </section>
        )}

        {/* Insights */}
        {stats.roundsPlayed >= 3 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Insights</h2>
            <div className="space-y-2">
              <InsightRow
                icon="🔴"
                label="Biggest Leak"
                value={`${biggestLeak.label} (${biggestLeak.gap >= 0 ? '+' : ''}${biggestLeak.gap.toFixed(2)} SG)`}
              />
              <InsightRow
                icon="🟢"
                label="Top Strength"
                value={`${topStrength.label} (${topStrength.gap >= 0 ? '+' : ''}${topStrength.gap.toFixed(2)} SG)`}
              />
              <InsightRow icon="⛳" label="Par 3 Avg" value={par3Avg} />
              <InsightRow icon="🏌️" label="Par 5 Avg" value={par5Avg} />
            </div>
          </section>
        )}

        {/* Empty state */}
        {stats.roundsPlayed === 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-3xl">⛳</p>
            <p className="mt-2 text-sm font-medium text-text">No rounds yet</p>
            <p className="mt-1 text-xs text-text-dim">Head to Play to track your first round</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-text-dim">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-text">{value}</p>
    </div>
  )
}

function InsightRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-xs text-text-dim">{label}</span>
      </div>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  )
}
