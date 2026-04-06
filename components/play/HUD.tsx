'use client'

import type { ActiveRound, ActiveHole } from '@/types'
import type { PlayStep } from './PlayClient'
import { haversineYards } from '@/lib/sg-tables'

interface Props {
  round: ActiveRound
  hole: ActiveHole
  step: PlayStep
  pendingStart: [number, number] | null
  pendingTarget: [number, number] | null
  mapCenter: [number, number]
  onPrevHole: () => void
  onNextHole: () => void
  onConfirm: () => void
}

const STEP_LABELS: Record<PlayStep, string> = {
  idle:         '',
  'set-flag':   'Pan to flag, confirm ✓',
  'set-start':  'Pan to tee / ball, confirm ✓',
  'set-target': 'Pan to target, confirm ✓',
  'set-result': 'Pan to result, confirm ✓',
  'log-shot':   'Log this shot',
}

/** Show feet when < 30 yards (putts/chips); otherwise yards. */
function fmt(yards: number): { value: number; unit: string } {
  if (yards < 30) return { value: Math.round(yards * 3), unit: 'ft' }
  return { value: Math.round(yards), unit: 'y' }
}

export default function HUD({
  round, hole, step, pendingStart, pendingTarget, mapCenter,
  onPrevHole, onNextHole, onConfirm,
}: Props) {
  // Distance to flag from pending start (shown in top-left badge)
  let distToFlag: number | null = null
  if (pendingStart && hole.flagLat && hole.flagLng) {
    distToFlag = Math.round(haversineYards(pendingStart[0], pendingStart[1], hole.flagLat, hole.flagLng))
  }

  // Live distance from crosshair, depends on step
  let liveYards: number | null = null
  let liveLabel = ''
  let missYards: number | null = null  // distance from target → crosshair (during set-result)

  if (step === 'set-start' && hole.flagLat && hole.flagLng) {
    // Show distance from crosshair to pin while picking start
    liveYards = haversineYards(mapCenter[0], mapCenter[1], hole.flagLat, hole.flagLng)
    liveLabel = 'to pin'
  } else if (step === 'set-target' && pendingStart) {
    // Show intended shot distance
    liveYards = haversineYards(pendingStart[0], pendingStart[1], mapCenter[0], mapCenter[1])
    liveLabel = 'to target'
  } else if (step === 'set-result' && pendingStart) {
    // Show actual shot distance
    liveYards = haversineYards(pendingStart[0], pendingStart[1], mapCenter[0], mapCenter[1])
    liveLabel = 'actual'
    // Show miss from target
    if (pendingTarget) {
      missYards = haversineYards(pendingTarget[0], pendingTarget[1], mapCenter[0], mapCenter[1])
    }
  }

  const showConfirm = step === 'set-flag' || step === 'set-start' || step === 'set-target' || step === 'set-result'

  const liveFmt = liveYards !== null ? fmt(liveYards) : null
  const missFmt = missYards !== null ? fmt(missYards) : null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3">
      <div className="flex items-start justify-between gap-2">

        {/* Distance to flag badge */}
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/90 px-3 py-1.5 backdrop-blur">
          <p className="text-[10px] text-text-dim">To Hole</p>
          <p className="text-xl font-bold text-accent">
            {distToFlag !== null ? `${fmt(distToFlag).value}${fmt(distToFlag).unit}` : '—'}
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

      {/* Large live distance */}
      {liveFmt !== null && liveFmt.value > 0 && (
        <div className="mt-3 flex flex-col items-center">
          <p className="text-6xl font-bold text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
            {liveFmt.value}
          </p>
          <p className="text-sm font-semibold text-white/80" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
            {liveFmt.unit} {liveLabel}
          </p>

          {/* Miss distance during set-result */}
          {missFmt !== null && (
            <div className="mt-1 rounded-lg bg-black/60 px-3 py-1">
              <p className="text-center text-sm font-semibold text-orange-400">
                {missFmt.value}{missFmt.unit} from target
              </p>
            </div>
          )}
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
