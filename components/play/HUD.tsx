'use client'

import type { ActiveRound, ActiveHole } from '@/types'
import type { PlayStep } from './PlayClient'
import { haversineYards } from '@/lib/sg-tables'

interface Props {
  round: ActiveRound
  hole: ActiveHole
  step: PlayStep
  pendingStart: [number, number] | null
  mapCenter: [number, number]
  onPrevHole: () => void
  onNextHole: () => void
  onConfirm: () => void
}

const STEP_LABELS: Record<PlayStep, string> = {
  idle:       '',
  'set-flag': 'Pan to flag, confirm ✓',
  'set-start':'Pan to tee, confirm ✓',
  'set-end':  'Pan to target, confirm ✓',
  'log-shot': 'Log this shot',
}

export default function HUD({
  round, hole, step, pendingStart, mapCenter,
  onPrevHole, onNextHole, onConfirm,
}: Props) {
  // Distance to flag from pending start
  let distToFlag: number | null = null
  if (pendingStart && hole.flagLat && hole.flagLng) {
    distToFlag = Math.round(haversineYards(pendingStart[0], pendingStart[1], hole.flagLat, hole.flagLng))
  }

  // Live shot distance: from pendingStart to current map center (while choosing target)
  let liveDistance: number | null = null
  if (step === 'set-end' && pendingStart) {
    liveDistance = Math.round(haversineYards(pendingStart[0], pendingStart[1], mapCenter[0], mapCenter[1]))
  }

  // Live flag distance: from map center to nothing yet (while placing flag or start)
  const showConfirm = step === 'set-flag' || step === 'set-start' || step === 'set-end'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Distance badge */}
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/90 px-3 py-1.5 backdrop-blur">
          <p className="text-[10px] text-text-dim">To Hole</p>
          <p className="text-xl font-bold text-accent">
            {distToFlag !== null ? `${distToFlag}y` : '—'}
          </p>
        </div>

        {/* Hole pill */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface/90 px-1 py-1 backdrop-blur">
          <button
            onClick={onPrevHole}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-dim active:bg-surface-2"
          >‹</button>

          <div className="min-w-[64px] text-center">
            <p className="text-xs text-text-dim">Hole</p>
            <p className="text-lg font-bold text-text">{hole.holeNumber}</p>
            <p className="text-[10px] text-text-dim">Par {hole.par}</p>
          </div>

          <button
            onClick={onNextHole}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-dim active:bg-surface-2"
          >›</button>
        </div>

        {/* Step label + confirm button */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {step !== 'idle' && step !== 'log-shot' && (
            <div className="rounded-xl border border-border bg-surface/90 px-3 py-1.5 backdrop-blur">
              <p className="text-xs text-text">{STEP_LABELS[step]}</p>
            </div>
          )}
          {showConfirm && (
            <button
              onClick={onConfirm}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-bold text-bg shadow-lg active:scale-95"
            >✓</button>
          )}
        </div>
      </div>

      {/* Large live distance while selecting target */}
      {liveDistance !== null && liveDistance > 0 && (
        <div className="mt-4 flex flex-col items-center">
          <p
            className="text-6xl font-bold text-white"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
          >
            {liveDistance}
          </p>
          <p className="text-sm font-semibold text-white/80" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            yards
          </p>
        </div>
      )}

      {/* Shot number badge */}
      <div className="mt-2 flex justify-center">
        <div className="rounded-full border border-border bg-surface/80 px-2.5 py-1 backdrop-blur">
          <p className="text-xs text-text-dim">
            Shot {hole.shots.length + 1} · {round.courseName}
          </p>
        </div>
      </div>
    </div>
  )
}
