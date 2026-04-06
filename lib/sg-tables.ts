// ============================================================
// Strokes Gained Baseline Tables — calibrated for ~10-handicap amateur golfer
//
// Previous tables used a scratch/elite baseline where a 350y hole expected
// only 2.87 strokes — that made every normal golfer's shots look negative.
// These tables are re-calibrated so that solid, average amateur shots
// produce SG near zero, below-average shots go negative, and great shots
// are genuinely positive.
//
// Calibration anchors (expected strokes to hole out):
//   Tee:     100y→2.9  150y→3.1  200y→3.3  250y→3.6  300y→3.9  400y→4.3  500y→4.8
//   Fairway: 50y→2.7   100y→3.0  150y→3.3  200y→3.6  300y→4.2
//   Rough:   penalty ~0.3 strokes vs fairway at same distance
//   Sand:    penalty ~0.4–0.6 strokes vs fairway
//   Green:   1ft→1.01  3ft→1.05  6ft→1.25  10ft→1.55  20ft→1.80  30ft→2.00
//
// Key notes:
//   - Green distance arrives in YARDS; internally multiplied by 3 → feet
//   - calcShotSG always uses SG_FW for the "after" lie (Fairway fallback)
//   - Penalty shots return SG = -1 fixed
// ============================================================

import type { Lie, SGCategory } from '@/types'

// From the tee (and any unrecognised lie) — yards
export const SG_TEE: [number, number][] = [
  [10,1.80],[25,2.00],[50,2.20],[75,2.45],[100,2.70],[125,2.82],
  [150,2.95],[175,3.08],[200,3.20],[225,3.35],[250,3.50],[275,3.62],
  [300,3.75],[325,3.87],[350,4.00],[375,4.10],[400,4.20],[425,4.32],
  [450,4.45],[500,4.65],[550,4.85],[600,5.05],
]

// From fairway — yards
export const SG_FW: [number, number][] = [
  [10,1.75],[25,1.95],[50,2.15],[75,2.45],[100,2.75],[125,2.95],
  [150,3.10],[175,3.25],[200,3.40],[225,3.52],[250,3.65],[275,3.80],
  [300,3.95],[350,4.20],[400,4.45],[450,4.70],[500,4.95],
]

// From rough / recovery — yards
export const SG_ROUGH: [number, number][] = [
  [10,1.90],[25,2.10],[50,2.35],[75,2.65],[100,2.95],[125,3.15],
  [150,3.30],[175,3.45],[200,3.60],[225,3.73],[250,3.85],[275,4.00],
  [300,4.15],[350,4.40],[400,4.65],[450,4.90],[500,5.15],
]

// From sand / bunker — yards
export const SG_SAND: [number, number][] = [
  [5,1.90],[10,2.10],[20,2.35],[30,2.55],[50,2.80],[75,3.10],
  [100,3.35],[125,3.55],[150,3.75],[175,3.95],[200,4.15],
]

// On the green — FEET (distYards is multiplied ×3 before lookup)
export const SG_GREEN: [number, number][] = [
  [1,1.01],[2,1.02],[3,1.05],[4,1.10],[5,1.17],[6,1.25],
  [8,1.37],[10,1.48],[12,1.57],[15,1.67],[20,1.80],[25,1.89],
  [30,1.97],[40,2.07],[50,2.14],[60,2.20],[80,2.28],[100,2.35],
]

// ============================================================
// lerpTable — same interpolation as HTML's lerpTable()
// ============================================================
function lerpTable(table: [number, number][], d: number): number {
  if (d <= table[0][0]) return table[0][1]
  if (d >= table[table.length - 1][0]) return table[table.length - 1][1]
  for (let i = 0; i < table.length - 1; i++) {
    const [d0, s0] = table[i]
    const [d1, s1] = table[i + 1]
    if (d >= d0 && d <= d1) {
      return s0 + ((d - d0) / (d1 - d0)) * (s1 - s0)
    }
  }
  return table[table.length - 1][1]
}

// ============================================================
// expStrokes — mirrors HTML's expStrokes(distYards, lie)
// lie values match the HTML: 'Green','Sand','Rough','Recovery','Fairway','Tee'
// For our TypeScript lowercase types, we normalise before calling.
// ============================================================
function expStrokes(distYards: number, lie: string): number {
  const l = lie.toLowerCase()
  if (l === 'green')  return lerpTable(SG_GREEN, distYards * 3)  // yards → feet (×3)
  if (l === 'sand')   return lerpTable(SG_SAND, distYards)
  if (l === 'rough' || l === 'recovery') return lerpTable(SG_ROUGH, distYards)
  if (l === 'fairway') return lerpTable(SG_FW, distYards)
  return lerpTable(SG_TEE, distYards)  // 'tee' + anything else
}

// ============================================================
// calcShotSG — exact port of HTML's calcShotSG()
//
// distBefore: yards to flag from shot start
// distAfter:  yards to flag from landing (0 if holed)
// lieStart:   lie at start of shot
//
// NOTE: The HTML always uses 'Fairway' for the "after" expected
// strokes (ignoring actual ending lie) — this matches the source.
// ============================================================
export function calcShotSG(
  distBefore: number,
  distAfter: number,
  lieStart: Lie,
): number {
  if (lieStart === 'penalty') return -1

  const before = expStrokes(distBefore, lieStart)
  const after  = distAfter <= 0 ? 0 : expStrokes(distAfter, 'Fairway')
  return parseFloat((before - after - 1).toFixed(3))
}

// ============================================================
// sgCategory — exact port of HTML's sgCategory()
// ============================================================
export function sgCategory(lie: Lie, shotNum: number, par: number): SGCategory {
  if (lie === 'green')  return 'putt'
  if (lie === 'sand' || lie === 'recovery') return 'arg'
  if (lie === 'tee' && par >= 4) return 'ott'
  return 'app'
}

// ============================================================
// haversineYards — exact port of HTML's haversine() + yds()
// ============================================================
export function haversineYards(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371e3
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a  = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  const metres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(metres * 1.09361)
}
