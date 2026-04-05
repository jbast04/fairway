'use client'

import type { TeeColor } from '@/types'

// Tee options with rating/slope offsets from the HTML's openTeeModal()
const TEE_OFFSETS: { color: TeeColor; label: string; ratingDelta: number; slopeDelta: number; dot: string }[] = [
  { color: 'Black', label: 'Black / Tips',   ratingDelta: +2.5, slopeDelta: +8,  dot: 'bg-gray-900 border border-gray-600' },
  { color: 'Blue',  label: 'Blue / Back',    ratingDelta: +1.0, slopeDelta: +4,  dot: 'bg-blue-500' },
  { color: 'White', label: 'White / Middle', ratingDelta:  0.0, slopeDelta:  0,  dot: 'bg-white' },
  { color: 'Gold',  label: 'Gold / Senior',  ratingDelta: -1.5, slopeDelta: -5,  dot: 'bg-yellow-500' },
  { color: 'Red',   label: 'Red / Forward',  ratingDelta: -3.0, slopeDelta: -10, dot: 'bg-red-500' },
]

interface Props {
  courseName: string
  baseRating: number
  baseSlope: number
  onSelect: (tee: TeeColor, rating: number, slope: number, label: string) => void
  onClose: () => void
}

export default function TeePickerModal({ courseName, baseRating, baseSlope, onSelect, onClose }: Props) {
  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-end bg-black/60">
      <div className="animate-slide-up w-full rounded-t-2xl border-t border-border bg-surface p-5">
        {/* Handle */}
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <h2 className="mb-1 text-base font-bold text-text">Select Tees</h2>
        <p className="mb-4 text-xs text-text-dim">{courseName}</p>

        <div className="space-y-2">
          {TEE_OFFSETS.map(t => {
            const rating = parseFloat((baseRating + t.ratingDelta).toFixed(1))
            const slope  = Math.round(Math.min(155, Math.max(55, baseSlope + t.slopeDelta)))
            return (
              <button
                key={t.color}
                onClick={() => onSelect(t.color, rating, slope, t.label)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 p-3.5 text-left transition-colors active:border-accent"
              >
                <div className={`h-5 w-5 shrink-0 rounded-full ${t.dot}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text">{t.label}</p>
                  <p className="text-xs text-text-dim">
                    Rating {rating} · Slope {slope}
                  </p>
                </div>
                <span className="text-text-dim">›</span>
              </button>
            )
          })}
        </div>

        <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-text-dim">
          Cancel
        </button>
      </div>
    </div>
  )
}
