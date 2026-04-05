// ============================================================
// Benchmark values — exact port of HTML's BENCHES object
// ============================================================

import type { BenchmarkKey, BenchmarkValues } from '@/types'

export const BENCHES: Record<BenchmarkKey, BenchmarkValues> = {
  scratch: {
    label: 'Scratch',
    sg_ott:  0,
    sg_app:  0,
    sg_arg:  0,
    sg_putt: 0,
    scoringAvg: 72.0,
    gir: 67,
    fir: 62,
    puttsPerRound: 30.5,
  },
  '5hcp': {
    label: '5 HCP',
    sg_ott:  -0.4,
    sg_app:  -1.2,
    sg_arg:  -0.5,
    sg_putt: -0.3,
    scoringAvg: 77.0,
    gir: 55,
    fir: 55,
    puttsPerRound: 32,
  },
  '10hcp': {
    label: '10 HCP',
    sg_ott:  -0.8,
    sg_app:  -2.0,
    sg_arg:  -0.9,
    sg_putt: -0.5,
    scoringAvg: 82.0,
    gir: 44,
    fir: 48,
    puttsPerRound: 33,
  },
  '15hcp': {
    label: '15 HCP',
    sg_ott:  -1.2,
    sg_app:  -2.8,
    sg_arg:  -1.3,
    sg_putt: -0.7,
    scoringAvg: 87.0,
    gir: 33,
    fir: 42,
    puttsPerRound: 34,
  },
  '20hcp': {
    label: '20 HCP',
    sg_ott:  -1.7,
    sg_app:  -3.5,
    sg_arg:  -1.7,
    sg_putt: -1.0,
    scoringAvg: 92.0,
    gir: 23,
    fir: 36,
    puttsPerRound: 35,
  },
}
