'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
  BarChart, Bar,
} from 'recharts'
import type { Round, BenchmarkKey } from '@/types'
import { BENCHES } from '@/lib/benchmarks'
import { fmtSG } from '@/lib/stats'

interface Props {
  rounds: Round[]
}

const BENCH_KEYS: BenchmarkKey[] = ['scratch', '5hcp', '10hcp', '15hcp', '20hcp']

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x !== null)
  return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3) : null
}

export default function SGClient({ rounds }: Props) {
  const [benchmark, setBenchmark] = useState<BenchmarkKey>('10hcp')
  const bench = BENCHES[benchmark]

  const avgOtt  = avg(rounds.map(r => r.sg_ott))
  const avgApp  = avg(rounds.map(r => r.sg_app))
  const avgArg  = avg(rounds.map(r => r.sg_arg))
  const avgPutt = avg(rounds.map(r => r.sg_putt))

  // Trend data for multi-line chart
  const trendData = rounds.map(r => ({
    date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ott:  r.sg_ott,
    app:  r.sg_app,
    arg:  r.sg_arg,
    putt: r.sg_putt,
  }))

  // 3-putt trend
  const puttTrend = rounds.map(r => ({
    date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    three: r.three_putts,
    one: r.one_putts,
  }))

  const categories = [
    { key: 'ott',  label: 'Off the Tee',   val: avgOtt,  bench: bench.sg_ott },
    { key: 'app',  label: 'Approach',       val: avgApp,  bench: bench.sg_app },
    { key: 'arg',  label: 'Around Green',   val: avgArg,  bench: bench.sg_arg },
    { key: 'putt', label: 'Putting',        val: avgPutt, bench: bench.sg_putt },
  ]

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-text">SG Analytics</h1>
        <p className="text-xs text-text-dim">{rounds.length} rounds</p>
      </header>

      <div className="space-y-5 px-4 py-4">
        {/* Benchmark selector */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {BENCH_KEYS.map(k => (
            <button
              key={k}
              onClick={() => setBenchmark(k)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                benchmark === k ? 'bg-accent text-bg' : 'border border-border text-text-dim'
              }`}
            >
              {BENCHES[k].label}
            </button>
          ))}
        </div>

        {/* Per-category cards */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Category Averages</h2>
          <div className="space-y-2">
            {categories.map(c => {
              const delta = c.val !== null ? c.val - c.bench : null
              const barPct = c.val !== null
                ? Math.min(100, Math.max(0, ((c.val - c.bench + 3) / 6) * 100))
                : 50

              return (
                <div key={c.key} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-dim">{c.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-lg font-bold ${c.val === null ? 'text-text-dim' : delta! >= 0 ? 'text-accent' : 'text-red-stat'}`}>
                        {fmtSG(c.val)}
                      </p>
                      {delta !== null && (
                        <p className={`text-xs ${delta >= 0 ? 'text-accent' : 'text-red-stat'}`}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(2)} vs {bench.label}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${c.val === null ? 'bg-border' : delta! >= 0 ? 'bg-accent' : 'bg-red-stat'}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* SG Trend chart */}
        {rounds.length > 1 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">SG Trend</h2>
            <div className="rounded-xl border border-border bg-surface p-3">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1a0f', border: '1px solid #1f3324', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#8aaa92' }}
                  />
                  <ReferenceLine y={0} stroke="#1f3324" strokeDasharray="3 3" />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#8aaa92' }} />
                  <Line type="monotone" dataKey="ott"  stroke="#4ade80" strokeWidth={1.5} dot={false} name="OTT" connectNulls />
                  <Line type="monotone" dataKey="app"  stroke="#f59e0b" strokeWidth={1.5} dot={false} name="App" connectNulls />
                  <Line type="monotone" dataKey="arg"  stroke="#60a5fa" strokeWidth={1.5} dot={false} name="ARG" connectNulls />
                  <Line type="monotone" dataKey="putt" stroke="#c084fc" strokeWidth={1.5} dot={false} name="Putt" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* 3-putt trend */}
        {rounds.length > 1 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">Putting Trend</h2>
            <div className="rounded-xl border border-border bg-surface p-3">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={puttTrend} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0d1a0f', border: '1px solid #1f3324', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#8aaa92' }}
                  />
                  <Bar dataKey="three" fill="#f87171" name="3-Putts" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="one"   fill="#4ade80" name="1-Putts" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {rounds.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-text-dim">No rounds with SG data yet.</p>
            <p className="mt-1 text-xs text-text-dim">Track shots in Play to populate this page.</p>
          </div>
        )}
      </div>
    </div>
  )
}
