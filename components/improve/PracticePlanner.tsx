'use client'

import { useState } from 'react'
import type { Round, BenchmarkKey } from '@/types'
import { BENCHES } from '@/lib/benchmarks'

interface Props {
  rounds: Round[]
}

const BENCH_KEYS: BenchmarkKey[] = ['scratch', '5hcp', '10hcp', '15hcp', '20hcp']

export default function PracticePlanner({ rounds }: Props) {
  const [benchmark, setBenchmark] = useState<BenchmarkKey>('10hcp')
  const [plan, setPlan]           = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function generatePlan() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/practice-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmark }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data.plan)
    } catch {
      setError('Unable to generate plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-text">AI Practice Planner</h2>
        <p className="mt-0.5 text-xs text-text-dim">
          Get a personalized 60-minute session based on your SG gaps.
        </p>
      </div>

      {/* Benchmark */}
      <div>
        <p className="mb-2 text-xs font-medium text-text-dim">Compare vs</p>
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
      </div>

      <button
        onClick={generatePlan}
        disabled={loading || rounds.length === 0}
        className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-bg disabled:opacity-40"
      >
        {loading ? 'Building your plan…' : rounds.length === 0 ? 'Play rounds to unlock' : '🎯 Generate Practice Plan'}
      </button>

      {error && <p className="text-xs text-red-stat">{error}</p>}

      {plan && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold text-text-dim">Your 60-min Session</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{plan}</p>
          <button
            onClick={() => setPlan(null)}
            className="mt-3 text-xs text-text-dim underline"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  )
}
