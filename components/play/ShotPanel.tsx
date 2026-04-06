'use client'

import { useState } from 'react'
import type { ActiveRound, ActiveHole, ActiveShot, Lie } from '@/types'
import { calcShotSG, sgCategory, haversineYards } from '@/lib/sg-tables'

const CLUBS = [
  'Driver', '3-wood', '5-wood', '3-hybrid',
  '4-iron', '5-iron', '6-iron', '7-iron',
  '8-iron', '9-iron', 'PW', 'GW',
  'SW', 'LW', '60°', 'Putter',
]

const LIES: { key: Lie; label: string; emoji: string }[] = [
  { key: 'fairway',  label: 'Fairway',  emoji: '🟢' },
  { key: 'rough',    label: 'Rough',    emoji: '🌿' },
  { key: 'sand',     label: 'Sand',     emoji: '🏖' },
  { key: 'green',    label: 'Green',    emoji: '⛳' },
  { key: 'recovery', label: 'Recovery', emoji: '🌲' },
  { key: 'penalty',  label: 'Penalty',  emoji: '🔴' },
]

interface Props {
  round: ActiveRound
  hole: ActiveHole
  startCoords: [number, number]
  targetCoords: [number, number]   // where the player aimed
  endCoords: [number, number]      // where the ball actually landed
  onSave: (shot: ActiveShot) => void
  onCancel: () => void
}

export default function ShotPanel({ round, hole, startCoords, targetCoords, endCoords, onSave, onCancel }: Props) {
  const shotNumber = hole.shots.length + 1

  // Determine start lie from previous shot or default
  const prevShot = hole.shots[hole.shots.length - 1]
  const defaultStartLie: Lie = shotNumber === 1
    ? 'tee'
    : (prevShot?.endLie ?? 'fairway')

  const [club, setClub]         = useState<string | null>(null)
  const [startLie, setStartLie] = useState<Lie>(defaultStartLie)
  const [endLie, setEndLie]     = useState<Lie>('fairway')
  const [isHoled, setIsHoled]   = useState(false)

  // Compute distances
  const distYards = haversineYards(startCoords[0], startCoords[1], endCoords[0], endCoords[1])
  const targetYards = haversineYards(startCoords[0], startCoords[1], targetCoords[0], targetCoords[1])
  const dispersionYards = haversineYards(targetCoords[0], targetCoords[1], endCoords[0], endCoords[1])

  // Format: feet when < 30 yards, otherwise yards
  const fmtDist = (y: number) => y < 30 ? `${Math.round(y * 3)}ft` : `${Math.round(y)}y`
  const distToFlagBefore = hole.flagLat && hole.flagLng
    ? haversineYards(startCoords[0], startCoords[1], hole.flagLat, hole.flagLng)
    : null
  const distToFlagAfter = isHoled ? 0 : (hole.flagLat && hole.flagLng
    ? haversineYards(endCoords[0], endCoords[1], hole.flagLat, hole.flagLng)
    : null)

  // SG calculation
  let sg: number | null = null
  if (distToFlagBefore !== null) {
    const afterDist = isHoled ? 0 : (distToFlagAfter ?? 0)
    const afterLie: Lie | null = isHoled ? null : (endLie === 'green' ? 'green' : endLie)
    sg = calcShotSG(distToFlagBefore, afterDist, startLie, afterLie)
  }

  const category = sgCategory(startLie, shotNumber, hole.par)

  function handleSave() {
    const shot: ActiveShot = {
      shotNumber,
      club,
      startLie,
      endLie: isHoled ? null : endLie,
      startLat: startCoords[0],
      startLng: startCoords[1],
      targetLat: targetCoords[0],
      targetLng: targetCoords[1],
      endLat: endCoords[0],
      endLng: endCoords[1],
      distToFlagBefore,
      distToFlagAfter: isHoled ? 0 : distToFlagAfter,
      dispersionYards,
      sg,
      sgCategory: category,
      isHoled,
    }
    onSave(shot)
  }

  return (
    <div className="animate-slide-up absolute inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface shadow-2xl">
      {/* Drag handle */}
      <div className="flex justify-center pt-2">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>

      <div className="p-4 space-y-4">
        {/* Shot info row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-dim">Shot {shotNumber} · Hole {hole.holeNumber}</p>
            <p className="text-sm font-semibold text-text">{fmtDist(distYards)} actual</p>
            <p className="text-xs text-text-dim">{fmtDist(targetYards)} target · <span className="text-orange-400">{fmtDist(dispersionYards)} miss</span></p>
          </div>
          {sg !== null && (
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-1 text-center">
              <p className="text-[10px] text-text-dim">SG</p>
              <p className={`text-base font-bold ${sg >= 0 ? 'text-accent' : 'text-red-stat'}`}>
                {sg >= 0 ? '+' : ''}{sg.toFixed(2)}
              </p>
            </div>
          )}
          <button onClick={onCancel} className="text-text-dim">✕</button>
        </div>

        {/* Start lie (read-only for context) */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-dim">Starting from</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {LIES.map(l => (
              <button
                key={l.key}
                onClick={() => setStartLie(l.key)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  startLie === l.key
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-text-dim'
                }`}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Club grid */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-dim">Club</p>
          <div className="grid grid-cols-4 gap-1.5">
            {CLUBS.map(c => (
              <button
                key={c}
                onClick={() => setClub(club === c ? null : c)}
                className={`rounded-lg border py-2.5 text-xs font-semibold transition-colors ${
                  club === c
                    ? 'border-accent bg-accent text-bg'
                    : 'border-border text-text-dim'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* End lie */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-text-dim">Ball ended in</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setIsHoled(h => !h)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                isHoled ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-dim'
              }`}
            >
              🏁 Holed
            </button>
            {!isHoled && LIES.map(l => (
              <button
                key={l.key}
                onClick={() => setEndLie(l.key)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  endLie === l.key
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border text-text-dim'
                }`}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-bg"
        >
          Save Shot
        </button>
      </div>
    </div>
  )
}
