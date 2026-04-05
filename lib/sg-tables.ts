// ============================================================
// Strokes Gained Baseline Tables — ported exactly from HTML source
//
// HTML format: {distance: expected_strokes} objects
// Converted to sorted [distance, strokes] tuples for TypeScript.
//
// Key notes from the HTML's expStrokes():
//   - Green distance arrives in YARDS; internally multiplied by 3 → feet
//   - calcShotSG always uses SG_FW for the "after" lie (Fairway fallback)
//   - Penalty shots return SG = -1 fixed
// ============================================================

import type { Lie, SGCategory } from '@/types'

// From the tee (and any unrecognised lie) — yards
export const SG_TEE: [number, number][] = [
  [10,1.75],[25,1.87],[50,1.97],[75,2.05],[100,2.12],[125,2.20],
  [150,2.28],[175,2.36],[200,2.43],[225,2.50],[250,2.58],[275,2.65],
  [300,2.73],[325,2.80],[350,2.87],[375,2.94],[400,3.00],[425,3.06],
  [450,3.12],[500,3.25],[550,3.38],[600,3.50],
]

// From fairway — yards
export const SG_FW: [number, number][] = [
  [10,1.70],[25,1.82],[50,1.93],[75,2.00],[100,2.07],[125,2.15],
  [150,2.23],[175,2.31],[200,2.39],[225,2.46],[250,2.53],[275,2.60],
  [300,2.67],[350,2.80],[400,2.93],[450,3.07],[500,3.20],
]

// From rough / recovery — yards
export const SG_ROUGH: [number, number][] = [
  [10,1.80],[25,1.93],[50,2.05],[75,2.15],[100,2.23],[125,2.31],
  [150,2.39],[175,2.47],[200,2.55],[225,2.62],[250,2.69],[275,2.76],
  [300,2.83],[350,2.96],[400,3.09],[450,3.22],[500,3.35],
]

// From sand / bunker — yards
export const SG_SAND: [number, number][] = [
  [5,1.70],[10,1.85],[20,2.00],[30,2.10],[50,2.22],[75,2.35],
  [100,2.46],[125,2.55],[150,2.64],[175,2.72],[200,2.80],
]

// On the green — FEET (the HTML stores feet directly in this table)
export const SG_GREEN: [number, number][] = [
  [1,1.01],[2,1.03],[3,1.08],[4,1.14],[5,1.20],[6,1.26],
  [8,1.33],[10,1.38],[12,1.44],[15,1.51],[20,1.58],[25,1.65],
  [30,1.72],[40,1.80],[50,1.87],[60,1.93],[80,2.02],[100,2.10],
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
