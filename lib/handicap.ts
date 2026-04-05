// ============================================================
// USGA Handicap Index calculation
// USGA spec: take the best N differentials from the last 20 rounds,
// multiply by 0.96, round to 1 decimal.
// ============================================================

import type { Round } from '@/types'

// Number of differentials to use based on rounds played
function diffCount(n: number): number {
  if (n <= 3) return 1
  if (n === 4) return 1
  if (n === 5) return 1
  if (n === 6) return 2
  if (n === 7) return 2
  if (n === 8) return 2
  if (n === 9) return 3
  if (n === 10) return 3
  if (n === 11) return 3
  if (n === 12) return 4
  if (n === 13) return 4
  if (n === 14) return 4
  if (n === 15) return 5
  if (n === 16) return 5
  if (n === 17) return 6
  if (n === 18) return 7
  if (n === 19) return 8
  return 8 // 20 rounds
}

export function calcHandicapDiff(round: Round): number | null {
  if (!round.score || !round.course_rating || !round.slope_rating) return null
  return +((round.score - round.course_rating) * (113 / round.slope_rating)).toFixed(1)
}

export function calcHandicapIndex(rounds: Round[]): number | null {
  // Only use rounds with valid differentials, last 20
  const diffs = rounds
    .filter(r => r.handicap_diff !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)
    .map(r => r.handicap_diff as number)

  if (diffs.length < 3) return null

  const n = diffCount(diffs.length)
  const best = [...diffs].sort((a, b) => a - b).slice(0, n)
  const avg = best.reduce((s, d) => s + d, 0) / best.length
  return +Math.min(avg * 0.96, 54).toFixed(1)
}
