'use client'

import type { ActiveRound, ActiveHole } from '@/types'

interface Props {
  round: ActiveRound
  hole: ActiveHole
}

export default function LiveStatsStrip({ round, hole }: Props) {
  const shots = hole.shots
  const score = shots.filter(s => !s.isHoled).length + (shots.some(s => s.isHoled) ? 1 : 0) || shots.length
  const sgTotal = shots.reduce((s, sh) => s + (sh.sg ?? 0), 0)

  // Count completed holes
  const completedHoles = round.holes.filter(h => h.shots.some(s => s.isHoled))
  const totalScore = completedHoles.reduce((sum, h) => sum + h.shots.length, 0)
  const totalPar   = completedHoles.reduce((sum, h) => sum + h.par, 0)

  const stats = [
    { label: 'Shot',   value: (shots.length + 1).toString() },
    { label: 'Score',  value: completedHoles.length ? `${totalScore - totalPar >= 0 ? '+' : ''}${totalScore - totalPar}` : 'E' },
    { label: 'Hole SG', value: sgTotal !== 0 ? (sgTotal >= 0 ? '+' : '') + sgTotal.toFixed(1) : '—' },
    { label: 'Holes',  value: `${completedHoles.length}/18` },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 overflow-x-auto border-t border-border bg-surface/90 backdrop-blur">
      <div className="flex h-10 items-center gap-6 px-4">
        {stats.map(s => (
          <div key={s.label} className="flex shrink-0 items-center gap-1.5">
            <span className="text-[10px] text-text-dim">{s.label}</span>
            <span className="text-xs font-bold text-text">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
