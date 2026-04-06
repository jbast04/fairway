'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Lie, BenchmarkKey } from '@/types'
import type { CoursePolygon } from '@/lib/course-polygons'
import type { HoleCoords } from '@/lib/overpass'
import { fetchCoursePolygons, detectLie } from '@/lib/course-polygons'
import { fetchHoleCoords } from '@/lib/overpass'
import { haversineYards, expectedStrokes } from '@/lib/sg-tables'
import CourseSearchModal from '@/components/play/CourseSearchModal'

const PreviewMap = dynamic(() => import('./PreviewMap'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────
interface FullCourse {
  id: string; name: string; lat: number; lng: number
  city?: string; state?: string
  par: number[]; rating: number; slope: number
}

// ── Display helpers ────────────────────────────────────────────
const BENCH_LABELS: Record<BenchmarkKey, string> = {
  scratch: 'Scratch', '5hcp': '5 HCP', '10hcp': '10 HCP', '15hcp': '15 HCP', '20hcp': '20 HCP',
}

const LIE_LABEL: Record<Lie, string> = {
  tee: 'Teebox', fairway: 'Fairway', rough: 'Rough',
  sand: 'Bunker', green: 'Green', recovery: 'Recovery', penalty: 'Penalty Area',
}

const LIE_COLOR: Record<Lie, string> = {
  fairway:  'text-emerald-400',
  rough:    'text-lime-600',
  sand:     'text-amber-400',
  green:    'text-teal-300',
  penalty:  'text-blue-400',
  tee:      'text-gray-300',
  recovery: 'text-orange-400',
}

// Polygon legend items
const LEGEND = [
  { color: '#4ade80', label: 'Fairway' },
  { color: '#86efac', label: 'Green'   },
  { color: '#fbbf24', label: 'Bunker'  },
  { color: '#60a5fa', label: 'Penalty' },
  { color: '#166534', label: 'Rough'   },
]

function fmtDist(yards: number) {
  return yards < 30 ? `${Math.round(yards * 3)}ft` : `${yards}y`
}

// ── Component ──────────────────────────────────────────────────
export default function PreviewClient() {
  const [showSearch,      setShowSearch]      = useState(false)
  const [course,          setCourse]          = useState<FullCourse | null>(null)
  const [polygons,        setPolygons]        = useState<CoursePolygon[]>([])
  const [holeCoords,      setHoleCoords]      = useState<HoleCoords[]>([])
  const [holeIdx,         setHoleIdx]         = useState(0)
  const [mapCenter,       setMapCenter]       = useState<[number, number]>([39.5, -98.35])
  const [flyToLocation,   setFlyToLocation]   = useState<[number, number] | null>(null)
  const [loadingPolygons, setLoadingPolygons] = useState(false)
  const [polygonError,    setPolygonError]    = useState<string | null>(null)
  const [detectedLie,     setDetectedLie]     = useState<Lie>('fairway')
  const [benchmark,       setBenchmark]       = useState<BenchmarkKey>('10hcp')

  // Load saved benchmark on mount
  useEffect(() => {
    try {
      const b = localStorage.getItem('fw_benchmark') as BenchmarkKey | null
      if (b) setBenchmark(b)
    } catch { /* ignore */ }
  }, [])

  // Current hole info
  const totalHoles = course?.par.length ?? 18
  const holeNum    = holeIdx + 1
  const holePar    = course?.par[holeIdx] ?? 4
  const holeCoord  = holeCoords[holeIdx] ?? null
  const flagLat    = holeCoord?.lat ?? null
  const flagLng    = holeCoord?.lng ?? null

  // Distance from crosshair to flag
  const distToFlag = (flagLat && flagLng)
    ? haversineYards(mapCenter[0], mapCenter[1], flagLat, flagLng)
    : null

  // Expected strokes from crosshair position
  const expFromHere = distToFlag !== null
    ? expectedStrokes(distToFlag, detectedLie, benchmark)
    : null

  // How much this lie costs vs fairway at the same distance
  const expFairway = distToFlag !== null
    ? expectedStrokes(distToFlag, 'fairway', benchmark)
    : null
  const lieVsFairway = (expFromHere !== null && expFairway !== null && detectedLie !== 'fairway')
    ? parseFloat((expFairway - expFromHere).toFixed(2))   // negative = worse than fairway
    : null

  // Re-detect lie whenever crosshair moves (or polygons load)
  useEffect(() => {
    if (polygons.length > 0) {
      setDetectedLie(detectLie(mapCenter[0], mapCenter[1], polygons))
    } else {
      setDetectedLie('fairway')
    }
  }, [mapCenter, polygons])

  // ── Course selection ─────────────────────────────────────────
  const handleCourseSelect = useCallback(async (c: FullCourse) => {
    setCourse(c)
    setShowSearch(false)
    setHoleIdx(0)
    setPolygons([])
    setPolygonError(null)
    setLoadingPolygons(true)

    const [coordsResult, polysResult] = await Promise.allSettled([
      fetchHoleCoords(c.lat, c.lng),
      fetchCoursePolygons(c.lat, c.lng),
    ])

    // Fly to hole 1 green (or course center as fallback)
    if (coordsResult.status === 'fulfilled' && coordsResult.value[0]) {
      setHoleCoords(coordsResult.value)
      setFlyToLocation([coordsResult.value[0].lat, coordsResult.value[0].lng])
    } else {
      setHoleCoords([])
      setFlyToLocation([c.lat, c.lng])
    }

    if (polysResult.status === 'fulfilled') {
      setPolygons(polysResult.value)
      if (polysResult.value.length === 0) {
        setPolygonError('No detailed map data found for this course. Lie detection unavailable — distance and expected strokes still work.')
      }
    } else {
      setPolygonError('Could not load course map data. Check your connection — distance and expected strokes still work.')
    }

    setLoadingPolygons(false)
  }, [])

  // ── Hole navigation ──────────────────────────────────────────
  const goToHole = useCallback((idx: number) => {
    if (!course) return
    const clamped = Math.max(0, Math.min(totalHoles - 1, idx))
    setHoleIdx(clamped)
    const coord = holeCoords[clamped]
    if (coord) setFlyToLocation([coord.lat, coord.lng])
  }, [course, holeCoords, totalHoles])

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setMapCenter([lat, lng])
  }, [])

  // ── No course selected — welcome screen ───────────────────────
  if (!course) {
    return (
      <>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 pb-24">
          <div className="text-center">
            <p className="text-6xl">🔭</p>
            <h1 className="mt-3 text-2xl font-bold text-text">Course Preview</h1>
            <p className="mt-2 max-w-xs text-sm text-text-dim leading-relaxed">
              Study a course before you play. Move the crosshair to any landing spot to see the terrain type and expected strokes from that position — so you can plan your game strategy hole by hole.
            </p>
          </div>

          <button
            onClick={() => setShowSearch(true)}
            className="w-full max-w-xs rounded-xl bg-accent py-3.5 text-center text-sm font-bold text-bg shadow-lg"
          >
            Select a Course
          </button>

          <Link href="/play" className="text-xs text-text-dim underline underline-offset-2">
            ← Back to Play
          </Link>

          {/* How it works */}
          <div className="mt-2 w-full max-w-xs rounded-xl border border-border bg-surface p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">How it works</p>
            {[
              ['🗺', 'Select a course — hazard boundaries load automatically from OpenStreetMap'],
              ['✛', 'Drag the map so the crosshair lands on any target area'],
              ['📊', 'See the auto-detected lie, distance to flag, and expected strokes from that spot'],
              ['🏌️', 'Compare fairway vs rough vs bunker targets to plan the smartest lines'],
            ].map(([emoji, text]) => (
              <div key={emoji} className="flex items-start gap-2">
                <span className="mt-0.5 text-base">{emoji}</span>
                <p className="text-xs text-text-dim leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {showSearch && (
          <CourseSearchModal onSelect={handleCourseSelect} onClose={() => setShowSearch(false)} />
        )}
      </>
    )
  }

  // ── Map view ─────────────────────────────────────────────────
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">

      {/* ── Map ── */}
      <PreviewMap
        center={mapCenter}
        polygons={polygons}
        flagLat={flagLat}
        flagLng={flagLng}
        flyToLocation={flyToLocation}
        onCenterChange={handleCenterChange}
      />

      {/* ── Crosshair ── */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-10 w-10">
          <div className="absolute top-1/2 inset-x-0 h-px -translate-y-1/2 bg-white/90" />
          <div className="absolute left-1/2 inset-y-0 w-px -translate-x-1/2 bg-white/90" />
          <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
        </div>
      </div>

      {/* ── Top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-2 bg-black/65 px-3 py-2.5 backdrop-blur-sm">
        <Link href="/play" className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-text">
          ← Back
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold text-text">{course.name}</p>
          <p className="text-xs text-text-dim">
            Hole {holeNum} of {totalHoles} &nbsp;·&nbsp; Par {holePar}
            {holeCoord ? '' : ' · No pin data'}
          </p>
        </div>

        <button
          onClick={() => setShowSearch(true)}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-text-dim"
        >
          Change
        </button>
      </div>

      {/* ── Benchmark badge (top-right) ── */}
      <div className="absolute right-3 top-16 z-20">
        <div className="rounded-lg bg-black/70 px-3 py-1.5 text-center backdrop-blur-sm">
          <p className="text-[10px] text-text-dim">Benchmark</p>
          <p className="text-xs font-bold text-accent">{BENCH_LABELS[benchmark]}</p>
        </div>
      </div>

      {/* ── Hole navigation ── */}
      <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2">
        <button
          onClick={() => goToHole(holeIdx - 1)}
          disabled={holeIdx === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl font-bold text-white shadow-lg backdrop-blur-sm disabled:opacity-25"
        >
          ‹
        </button>
      </div>
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2">
        <button
          onClick={() => goToHole(holeIdx + 1)}
          disabled={holeIdx >= totalHoles - 1}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-xl font-bold text-white shadow-lg backdrop-blur-sm disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {/* Hole dot strip (bottom of nav area) */}
      <div className="absolute left-1/2 z-20 -translate-x-1/2" style={{ bottom: '230px' }}>
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          {Array.from({ length: totalHoles }, (_, i) => (
            <button
              key={i}
              onClick={() => goToHole(i)}
              className={`rounded-full transition-all ${
                i === holeIdx
                  ? 'h-2.5 w-2.5 bg-accent'
                  : 'h-1.5 w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Loading overlay ── */}
      {loadingPolygons && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl bg-surface px-8 py-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-text">Loading course map…</p>
            <p className="mt-1 text-xs text-text-dim">Fetching hazard data from OpenStreetMap</p>
          </div>
        </div>
      )}

      {/* ── Bottom stats panel ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/85 pb-20 backdrop-blur-sm">

        {/* Polygon error / warning */}
        {polygonError && (
          <div className="border-b border-white/10 px-4 py-2">
            <p className="text-xs text-amber-400 leading-relaxed">⚠️ {polygonError}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 overflow-x-auto border-b border-white/10 px-4 py-2">
          {LEGEND.map(item => (
            <div key={item.label} className="flex shrink-0 items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color, opacity: 0.85 }}
              />
              <span className="text-xs text-text-dim">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Live stat tiles */}
        <div className="grid grid-cols-3 divide-x divide-white/10 py-3">
          {/* To flag */}
          <div className="px-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">To Flag</p>
            <p className="mt-0.5 text-xl font-bold text-text">
              {distToFlag !== null ? fmtDist(distToFlag) : '—'}
            </p>
          </div>

          {/* Lie */}
          <div className="px-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">Lie</p>
            <p className={`mt-0.5 text-base font-bold ${LIE_COLOR[detectedLie]}`}>
              {LIE_LABEL[detectedLie]}
              {polygons.length === 0 && (
                <span className="ml-1 text-[10px] font-normal text-text-dim">*</span>
              )}
            </p>
          </div>

          {/* Expected strokes */}
          <div className="px-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">Exp. Strokes</p>
            <p className="mt-0.5 text-xl font-bold text-text">
              {expFromHere !== null ? expFromHere.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* Lie-vs-fairway delta row */}
        <div className="border-t border-white/10 px-4 py-2.5 text-center">
          {lieVsFairway !== null ? (
            <>
              <p className={`text-sm font-bold ${lieVsFairway < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {lieVsFairway >= 0 ? '+' : ''}{lieVsFairway.toFixed(2)} strokes vs fairway
              </p>
              <p className="mt-0.5 text-[10px] text-text-dim">
                {detectedLie === 'sand'
                  ? 'Bunker penalty — this target will cost you strokes'
                  : detectedLie === 'penalty'
                  ? 'Penalty area — significant stroke loss'
                  : detectedLie === 'rough'
                  ? 'Rough is harder — aim for the fairway if possible'
                  : detectedLie === 'green'
                  ? 'On the green — great position'
                  : 'Position value vs landing in fairway at the same distance'}
              </p>
            </>
          ) : (
            <p className="text-[10px] text-text-dim">
              {polygons.length === 0
                ? '* No hazard data for this course — move crosshair for distance & expected strokes'
                : 'Move the crosshair to any landing zone to compare its value vs the fairway'}
            </p>
          )}
        </div>
      </div>

      {showSearch && (
        <CourseSearchModal onSelect={handleCourseSelect} onClose={() => setShowSearch(false)} />
      )}
    </div>
  )
}
