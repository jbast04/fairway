'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Round } from '@/types'
import { scoreDelta, fmtSG } from '@/lib/stats'

interface Props {
  rounds: Round[]
}

export default function HistoryClient({ rounds }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<'date' | 'score' | 'sg'>('date')
  const [sortAsc, setSortAsc] = useState(false)

  const years = useMemo(() => {
    const ys = [...new Set(rounds.map(r => r.date.slice(0, 4)))].sort().reverse()
    return ys
  }, [rounds])

  const filtered = useMemo(() => {
    let r = rounds
    if (search) r = r.filter(ro => ro.course_name.toLowerCase().includes(search.toLowerCase()))
    if (yearFilter !== 'all') r = r.filter(ro => ro.date.startsWith(yearFilter))

    return [...r].sort((a, b) => {
      let diff = 0
      if (sortKey === 'date') diff = new Date(a.date).getTime() - new Date(b.date).getTime()
      else if (sortKey === 'score') diff = (a.score ?? 999) - (b.score ?? 999)
      else {
        const sgA = (a.sg_ott ?? 0) + (a.sg_app ?? 0) + (a.sg_arg ?? 0) + (a.sg_putt ?? 0)
        const sgB = (b.sg_ott ?? 0) + (b.sg_app ?? 0) + (b.sg_arg ?? 0) + (b.sg_putt ?? 0)
        diff = sgA - sgB
      }
      return sortAsc ? diff : -diff
    })
  }, [rounds, search, yearFilter, sortKey, sortAsc])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-text">Round History</h1>
        <p className="text-xs text-text-dim">{rounds.length} rounds</p>
      </header>

      <div className="px-4 py-3 space-y-3">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by course…"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder-text-dim focus:border-accent focus:outline-none"
        />

        {/* Year filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={yearFilter === 'all'} onClick={() => setYearFilter('all')}>All</FilterChip>
          {years.map(y => (
            <FilterChip key={y} active={yearFilter === y} onClick={() => setYearFilter(y)}>{y}</FilterChip>
          ))}
        </div>

        {/* Sort buttons */}
        <div className="flex gap-2">
          {(['date', 'score', 'sg'] as const).map(k => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                sortKey === k ? 'border-accent text-accent' : 'border-border text-text-dim'
              }`}
            >
              {k === 'date' ? 'Date' : k === 'score' ? 'Score' : 'SG Total'}
              {sortKey === k && (sortAsc ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-4 pb-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-dim">No rounds found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const sgTotal = [r.sg_ott, r.sg_app, r.sg_arg, r.sg_putt]
                .filter((v): v is number => v !== null)
                .reduce((s, v) => s + v, 0)
              const hasSG = r.sg_ott !== null

              return (
                <button
                  key={r.id}
                  onClick={() => router.push(`/history/${r.id}`)}
                  className="w-full rounded-xl border border-border bg-surface p-3 text-left transition-colors active:bg-surface-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text">{r.course_name}</p>
                      <p className="text-xs text-text-dim">
                        {new Date(r.date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                        {r.tees && ` · ${r.tees}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-text">
                        {r.score ?? '—'}
                        <span className="ml-1 text-xs text-text-dim">
                          ({scoreDelta(r.score, r.par)})
                        </span>
                      </p>
                      {hasSG && (
                        <p className={`text-xs ${sgTotal >= 0 ? 'text-accent' : 'text-red-stat'}`}>
                          SG {sgTotal >= 0 ? '+' : ''}{sgTotal.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div className="mt-2 flex gap-3">
                    {r.gir !== null && (
                      <span className="text-xs text-text-dim">
                        GIR {Math.round((r.gir / 18) * 100)}%
                      </span>
                    )}
                    {r.putts !== null && (
                      <span className="text-xs text-text-dim">{r.putts} putts</span>
                    )}
                    {r.handicap_diff !== null && (
                      <span className="text-xs text-text-dim">Diff {r.handicap_diff}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-accent text-bg' : 'border border-border text-text-dim'
      }`}
    >
      {children}
    </button>
  )
}
