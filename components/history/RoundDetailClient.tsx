'use client'

import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Round, Shot, Hole } from '@/types'
import { scoreDelta, fmtSG } from '@/lib/stats'

const ReplayMap = dynamic(() => import('./ReplayMap'), { ssr: false })

interface Props {
  round: Round
  shots: Shot[]
  holes: Hole[]
}

export default function RoundDetailClient({ round, shots, holes }: Props) {
  const router = useRouter()

  const sgTotal = [round.sg_ott, round.sg_app, round.sg_arg, round.sg_putt]
    .filter((v): v is number => v !== null)
    .reduce((s, v) => s + v, 0)

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.back()} className="text-text-dim">‹</button>
        <div>
          <h1 className="text-base font-bold text-text">{round.course_name}</h1>
          <p className="text-xs text-text-dim">
            {new Date(round.date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
      </header>

      {/* Score hero */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-4xl font-black text-text">{round.score ?? '—'}</p>
            <p className="text-sm text-text-dim">
              {scoreDelta(round.score, round.par)} · Par {round.par}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
            {round.putts !== null && <StatPair label="Putts" value={round.putts} />}
            {round.gir  !== null && <StatPair label="GIR" value={`${round.gir}/18`} />}
            {round.fir_made !== null && (
              <StatPair label="FIR" value={`${round.fir_made}/${round.fir_total}`} />
            )}
            {round.penalties > 0 && <StatPair label="Penalties" value={round.penalties} />}
          </div>
        </div>
      </div>

      {/* SG breakdown */}
      {round.sg_ott !== null && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-dim">Strokes Gained</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'OTT', val: round.sg_ott },
              { label: 'APP', val: round.sg_app },
              { label: 'ARG', val: round.sg_arg },
              { label: 'PUTT', val: round.sg_putt },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg border border-border bg-surface p-2 text-center">
                <p className="text-[10px] text-text-dim">{label}</p>
                <p className={`text-sm font-bold ${val !== null && val >= 0 ? 'text-accent' : 'text-red-stat'}`}>
                  {fmtSG(val)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-right text-xs text-text-dim">
            Total SG: {fmtSG(sgTotal)}
          </p>
        </div>
      )}

      {/* Shot replay map */}
      {shots.length > 0 && (
        <div>
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-dim">Shot Replay</p>
          <div style={{ height: 300 }}>
            <ReplayMap shots={shots} />
          </div>
        </div>
      )}

      {/* Hole-by-hole */}
      {holes.length > 0 && (
        <div className="px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-dim">Scorecard</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-text-dim">
                  <th className="py-1.5 text-left">Hole</th>
                  <th className="py-1.5">Par</th>
                  <th className="py-1.5">Score</th>
                  <th className="py-1.5">Putts</th>
                  <th className="py-1.5">GIR</th>
                  <th className="py-1.5">FIR</th>
                </tr>
              </thead>
              <tbody>
                {holes.map(h => (
                  <tr key={h.hole_number} className="border-b border-border/40">
                    <td className="py-1.5 text-left font-medium text-text">{h.hole_number}</td>
                    <td className="py-1.5 text-center text-text-dim">{h.par}</td>
                    <td className="py-1.5 text-center">
                      <ScoreCell score={h.score} par={h.par} />
                    </td>
                    <td className="py-1.5 text-center text-text">{h.putts ?? '—'}</td>
                    <td className="py-1.5 text-center">{h.gir ? '✓' : '·'}</td>
                    <td className="py-1.5 text-center">
                      {h.fir === null ? '—' : h.fir ? '✓' : '·'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {round.notes && (
        <div className="px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-dim">Notes</p>
          <p className="text-sm text-text">{round.notes}</p>
        </div>
      )}
    </div>
  )
}

function StatPair({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-xs font-semibold text-text">{value}</p>
    </>
  )
}

function ScoreCell({ score, par }: { score: number | null; par: number }) {
  if (score === null) return <span className="text-text-dim">—</span>
  const diff = score - par
  const color = diff <= -2 ? 'text-accent' : diff === -1 ? 'text-accent-dim' : diff === 0 ? 'text-text' : diff === 1 ? 'text-gold' : 'text-red-stat'
  return <span className={`font-bold ${color}`}>{score}</span>
}
