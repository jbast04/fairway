'use client'

import { sgColor, fmtSG } from '@/lib/stats'

interface Props {
  label: string
  value: number | null
  benchmarkValue: number
}

export default function SGCard({ label, value, benchmarkValue }: Props) {
  const delta     = value !== null ? value - benchmarkValue : null
  const barWidth  = value !== null
    ? Math.min(100, Math.max(0, ((value - benchmarkValue + 2) / 4) * 100))
    : 50

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-text-dim">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${sgColor(value)}`}>
        {fmtSG(value)}
      </p>

      {/* Bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${value === null ? 'bg-border' : delta! >= 0 ? 'bg-accent' : 'bg-red-stat'}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Delta vs benchmark */}
      {delta !== null && (
        <p className={`mt-1.5 text-xs ${sgColor(delta)}`}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(2)} vs benchmark
        </p>
      )}
    </div>
  )
}
