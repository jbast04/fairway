'use client'

import type { ActiveRound, ActiveHole } from '@/types'
import type { PlayStep } from './PlayClient'
import { haversineYards } from '@/lib/sg-tables'

interface Props {
  round: ActiveRound
  hole: ActiveHole
  step: PlayStep
  pendingStart: [number, number] | null
  pendingEnd: [number, number] | null
  onPrevHole: () => void
  onNextHole: () => void
  onConfirm: () => void
}

const STEP_LABELS: Record<PlayStep, string> = {
  idle: '',
  'set-start': 'Tap shot start',
  'set-end':   'Tap landing spot',
  'log-shot':  'Log this shot',
}

export default function HUD({
  round, hole, step, pendingStart, pendingEnd,
  onPrevHole, onNextHole, onConfirm,
}: Props) {
  // Distance to flag from pending start
  let distToFlag: number | null = null
  if (pendingStart && hole.flagLat && hole.flagLng) {
    distToFlag = haversineYards(pendingStart[0], pendingStart[1], hole.flagLat, hole.flagLng)
  }

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

        {/* Step label + confirm */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {step !== 'idle' && (
            <div className="rounded-xl border border-border bg-surface/90 px-3 py-1.5 backdrop-blur">
              <p className="text-xs text-text">{STEP_LABELS[step]}</p>
            </div>
          )}
          {step === 'set-end' && pendingStart && (
            <button
              onClick={onConfirm}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg text-bg shadow active:scale-95"
            >✓</button>
          )}
        </div>
      </div>

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
