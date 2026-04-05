'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Round, Profile } from '@/types'
import { calcHandicapDiff } from '@/lib/handicap'

interface Props {
  rounds: Round[]
  handicapIndex: number | null
  profile: Profile | null
}

export default function HandicapTracker({ rounds, handicapIndex, profile }: Props) {
  const diffs = rounds
    .filter(r => r.course_rating && r.slope_rating && r.score)
    .slice(0, 20)
    .map(r => ({
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      diff: r.handicap_diff ?? calcHandicapDiff(r),
      course: r.course_name,
    }))
    .reverse()

  const sorted = [...diffs].sort((a, b) => (a.diff ?? 999) - (b.diff ?? 999))
  const countForCalc = diffsUsed(diffs.length)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-text">Handicap Tracker</h2>
        <p className="mt-0.5 text-xs text-text-dim">USGA method · best {countForCalc} of last {diffs.length} differentials × 0.96</p>
      </div>

      {/* Current index */}
      <div className="rounded-xl border border-border bg-surface p-4 text-center">
        <p className="text-xs text-text-dim">Handicap Index</p>
        <p className="mt-1 text-5xl font-black text-accent">
          {handicapIndex !== null ? handicapIndex.toFixed(1) : '—'}
        </p>
        {diffs.length < 3 && (
          <p className="mt-2 text-xs text-text-dim">Need {3 - diffs.length} more valid rounds</p>
        )}
      </div>

      {/* Trend chart */}
      {diffs.length > 1 && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-text-dim">Differential Trend</p>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={diffs} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8aaa92', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0d1a0f', border: '1px solid #1f3324', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#8aaa92' }}
                formatter={(v: number) => [v?.toFixed(1), 'Differential']}
              />
              <Line
                type="monotone"
                dataKey="diff"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ r: 3, fill: '#4ade80' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Differentials list */}
      {diffs.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-text-dim">All Differentials (newest first)</p>
          <div className="space-y-1.5">
            {[...diffs].reverse().map((d, i) => {
              const isUsed = sorted.findIndex(s => s === d) < countForCalc
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    isUsed ? 'border border-accent/30 bg-accent/5' : 'border border-border bg-surface'
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-text">{d.course}</p>
                    <p className="text-[10px] text-text-dim">{d.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${d.diff !== null && d.diff <= 0 ? 'text-accent' : 'text-text'}`}>
                      {d.diff?.toFixed(1) ?? '—'}
                    </p>
                    {isUsed && <span className="text-[9px] font-semibold text-accent">USED</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {diffs.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-dim">
            Log rounds with course rating and slope to calculate your handicap index.
          </p>
        </div>
      )}
    </div>
  )
}

function diffsUsed(n: number): number {
  if (n < 3) return 0
  if (n <= 5) return 1
  if (n <= 8) return 2
  if (n <= 11) return 3
  if (n <= 14) return 4
  if (n <= 16) return 5
  if (n === 17) return 6
  if (n === 18) return 7
  if (n === 19) return 8
  return 8
}
