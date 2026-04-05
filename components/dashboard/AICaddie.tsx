'use client'

import { useState } from 'react'
import type { BenchmarkKey } from '@/types'

interface Props {
  benchmark: BenchmarkKey
  hasRounds: boolean
}

export default function AICaddie({ benchmark, hasRounds }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-caddie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmark }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (e) {
      setError('Unable to get analysis. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <h2 className="text-sm font-semibold text-text">AI Caddie</h2>
      </div>

      {!analysis && !loading && (
        <button
          onClick={getAnalysis}
          disabled={!hasRounds}
          className="w-full rounded-lg bg-accent/15 py-3 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
        >
          {hasRounds ? 'Get Coaching Insights' : 'Play rounds to unlock'}
        </button>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-text-dim">Analyzing your game…</span>
        </div>
      )}

      {analysis && !loading && (
        <div>
          <p className="text-sm leading-relaxed text-text">{analysis}</p>
          <button
            onClick={() => setAnalysis(null)}
            className="mt-3 text-xs text-text-dim underline"
          >
            Refresh
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-stat">{error}</p>}
    </section>
  )
}
