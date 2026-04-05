// ============================================================
// calcStats — derive DashboardStats from an array of rounds
// TODO: Verify formula details match the HTML file's calcStats()
// ============================================================

import type { Round, DashboardStats } from '@/types'

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (!valid.length) return null
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

function pct(made: (number | null)[], total: (number | null)[]): number | null {
  let m = 0, t = 0
  for (let i = 0; i < made.length; i++) {
    if (made[i] !== null && total[i] !== null) {
      m += made[i] as number
      t += total[i] as number
    }
  }
  if (!t) return null
  return +((m / t) * 100).toFixed(1)
}

export function calcStats(rounds: Round[]): DashboardStats {
  if (!rounds.length) {
    return {
      scoringAvg: null, bestScore: null, girPct: null, firPct: null,
      puttsPerRound: null, scramblingPct: null, threePuttAvg: null,
      penaltiesAvg: null, sgOtt: null, sgApp: null, sgArg: null,
      sgPutt: null, roundsPlayed: 0,
    }
  }

  const scores = rounds.map(r => r.score)

  return {
    scoringAvg:    avg(scores) !== null ? +avg(scores)!.toFixed(1) : null,
    bestScore:     Math.min(...scores.filter((s): s is number => s !== null)),
    girPct:        pct(rounds.map(r => r.gir), rounds.map(r => r.par ? 18 : null)),
    firPct:        pct(rounds.map(r => r.fir_made), rounds.map(r => r.fir_total)),
    puttsPerRound: avg(rounds.map(r => r.putts)),
    scramblingPct: null, // TODO: requires per-hole data (missed GIR + par or better)
    threePuttAvg:  avg(rounds.map(r => r.three_putts)),
    penaltiesAvg:  avg(rounds.map(r => r.penalties)),
    sgOtt:         avg(rounds.map(r => r.sg_ott)),
    sgApp:         avg(rounds.map(r => r.sg_app)),
    sgArg:         avg(rounds.map(r => r.sg_arg)),
    sgPutt:        avg(rounds.map(r => r.sg_putt)),
    roundsPlayed:  rounds.length,
  }
}

export function scoreDelta(score: number | null, par: number): string {
  if (score === null) return '—'
  const d = score - par
  if (d === 0) return 'E'
  return d > 0 ? `+${d}` : `${d}`
}

export function sgColor(val: number | null): string {
  if (val === null) return 'text-text-dim'
  if (val > 0.5) return 'text-accent'
  if (val > 0) return 'text-accent-dim'
  if (val > -0.5) return 'text-gold'
  return 'text-red-stat'
}

export function fmt(val: number | null, decimals = 1): string {
  if (val === null) return '—'
  return val.toFixed(decimals)
}

export function fmtSG(val: number | null): string {
  if (val === null) return '—'
  const s = val.toFixed(2)
  return val >= 0 ? `+${s}` : s
}
