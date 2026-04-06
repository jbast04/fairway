'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Lie, BenchmarkKey } from '@/types'
import type { CoursePolygon } from '@/lib/course-polygons'
import type { HoleCoords } from '@/lib/overpass'
import { fetchCoursePolygons, detectLie } from '@/lib/course-polygons'
import { fetchHoleCoords } from '@/lib/overpass'
import { haversineYards, calcShotSG, sgCategory, expectedStrokes } from '@/lib/sg-tables'
import CourseSearchModal from '@/components/play/CourseSearchModal'
import type { PlanShot } from './PreviewMap'

const PreviewMap = dynamic(() => import('./PreviewMap'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────
interface FullCourse {
  id: string; name: string; lat: number; lng: number
  city?: string; state?: string
  par: number[]; rating: number; slope: number
}

// ── Display helpers ───────────────────────────────────────────
const BENCH_LABELS: Record<BenchmarkKey, string> = {
  scratch: 'Scratch', '5hcp': '5 HCP', '10hcp': '10 HCP', '15hcp': '15 HCP', '20hcp': '20 HCP',
}

const LIE_LABEL: Record<Lie, string> = {
  tee: 'Teebox', fairway: 'Fairway', rough: 'Rough',
  sand: 'Bunker', green: 'Green', recovery: 'Recovery', penalty: 'Penalty',
}

const LIE_EMOJI: Record<Lie, string> = {
  tee: '🏌️', fairway: '🟢', rough: '🌿', sand: '🏖', green: '⛳', recovery: '🌲', penalty: '🔴',
}

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

function sgColor(sg: number) {
  if (sg >= 0.2) return 'text-emerald-400'
  if (sg >= 0)   return 'text-green-400'
  if (sg >= -0.2) return 'text-amber-400'
  return 'text-red-400'
}

// ── Component ─────────────────────────────────────────────────
export default function PreviewClient() {
  const [showSearch,      setShowSearch]      = useState(false)
  const [course,          setCourse]          = useState<FullCourse | null>(null)
  const [polygons,        setPolygons]        = useState<CoursePolygon[]>([])
  const [holeCoords,      setHoleCoords]      = useState<HoleCoords[]>([])
  const [holeIdx,         setHoleIdx]         = useState(0)
  const [mapCenter,       setMapCenter]       = useState<[number, number]>([39.5, -98.35])
  const [flyToLocation,   setFlyToLocation]   = useState<[number, number] | null>(null)
  const [loadingData,     setLoadingData]     = useState(false)
  const [polygonError,    setPolygonError]    = useState<string | null>(null)
  const [detectedLie,     setDetectedLie]     = useState<Lie>('fairway')
  const [benchmark,       setBenchmark]       = useState<BenchmarkKey>('10hcp')

  // ── Shot planning state ───────────────────────────────────────
  // Two-step per shot: first confirm where you're hitting FROM, then where it lands
  const [planStep,      setPlanStep]      = useState<'set-start' | 'set-landing'>('set-start')
  const [planStart,     setPlanStart]     = useState<[number, number] | null>(null)
  const [planStartLie,  setPlanStartLie]  = useState<Lie>('tee')
  const [plannedShots,  setPlannedShots]  = useState<PlanShot[]>([])

  // Load saved benchmark on mount
  useEffect(() => {
    try {
      const b = localStorage.getItem('fw_benchmark') as BenchmarkKey | null
      if (b) setBenchmark(b)
    } catch { /* ignore */ }
  }, [])

  // ── Derived values ────────────────────────────────────────────
  const totalHoles = course?.par.length ?? 18
  const holeNum    = holeIdx + 1
  const holePar    = course?.par[holeIdx] ?? 4
  const holeCoord  = holeCoords[holeIdx] ?? null
  const flagLat    = holeCoord?.lat ?? null
  const flagLng    = holeCoord?.lng ?? null
  const shotNum    = plannedShots.length + 1

  // Live distances
  const distToFlag = (flagLat && flagLng)
    ? haversineYards(mapCenter[0], mapCenter[1], flagLat, flagLng)
    : null

  const distToFlagFromStart = (planStart && flagLat && flagLng)
    ? haversineYards(planStart[0], planStart[1], flagLat, flagLng)
    : null

  const shotDist = planStart
    ? haversineYards(planStart[0], planStart[1], mapCenter[0], mapCenter[1])
    : null

  // Live SG — only meaningful during set-landing
  const liveSG = (planStep === 'set-landing' && distToFlagFromStart !== null && distToFlag !== null)
    ? calcShotSG(distToFlagFromStart, distToFlag, planStartLie, detectedLie, benchmark)
    : null

  const liveCat = sgCategory(planStartLie, shotNum, holePar)

  // Update detected lie whenever crosshair moves or polygons load
  useEffect(() => {
    setDetectedLie(polygons.length > 0
      ? detectLie(mapCenter[0], mapCenter[1], polygons)
      : 'fairway')
  }, [mapCenter, polygons])

  // ── Course selection ──────────────────────────────────────────
  const handleCourseSelect = useCallback(async (c: FullCourse) => {
    setCourse(c)
    setShowSearch(false)
    setHoleIdx(0)
    setPolygons([])
    setPolygonError(null)
    setLoadingData(true)
    resetHolePlan()

    const [coordsRes, polysRes] = await Promise.allSettled([
      fetchHoleCoords(c.lat, c.lng),
      fetchCoursePolygons(c.lat, c.lng),
    ])

    if (coordsRes.status === 'fulfilled' && coordsRes.value.length > 0) {
      setHoleCoords(coordsRes.value)
      const h0 = coordsRes.value[0]
      if (h0) setFlyToLocation([h0.lat, h0.lng])
    } else {
      setHoleCoords([])
      setFlyToLocation([c.lat, c.lng])
    }

    if (polysRes.status === 'fulfilled') {
      setPolygons(polysRes.value)
      if (polysRes.value.length === 0) {
        setPolygonError('No detailed hazard data found for this course on OpenStreetMap. Lie is shown as Fairway by default — you can still plan shots using distances and expected strokes.')
      }
    } else {
      setPolygonError('Could not load course hazard data. Check your connection and try again.')
    }

    setLoadingData(false)
  }, [])

  // ── Hole navigation ───────────────────────────────────────────
  const goToHole = useCallback((idx: number) => {
    if (!course) return
    const clamped = Math.max(0, Math.min(totalHoles - 1, idx))
    setHoleIdx(clamped)
    resetHolePlan()
    const coord = holeCoords[clamped]
    if (coord) setFlyToLocation([coord.lat, coord.lng])
  }, [course, holeCoords, totalHoles])

  function resetHolePlan() {
    setPlanStep('set-start')
    setPlanStart(null)
    setPlanStartLie('tee')
    setPlannedShots([])
  }

  // ── Planning actions ──────────────────────────────────────────
  function handleConfirmStart() {
    setPlanStart([mapCenter[0], mapCenter[1]])
    setPlanStartLie(shotNum === 1 ? 'tee' : detectedLie)
    setPlanStep('set-landing')
  }

  function handleConfirmLanding() {
    if (!planStart || distToFlagFromStart === null || distToFlag === null) return

    const shot: PlanShot = {
      shotNum,
      startPos: planStart,
      endPos:   [mapCenter[0], mapCenter[1]],
      distYards: shotDist ?? 0,
      sg: liveSG ?? 0,
    }
    setPlannedShots(prev => [...prev, shot])

    // Next shot starts where this one ended
    setPlanStart([mapCenter[0], mapCenter[1]])
    setPlanStartLie(detectedLie)
  }

  // Hole out — snap landing to the exact pin position (distAfter = 0)
  function handleHoleOut() {
    if (!planStart || distToFlagFromStart === null || !flagLat || !flagLng) return

    const sgHoled = calcShotSG(distToFlagFromStart, 0, planStartLie, 'green', benchmark)
    const dist    = haversineYards(planStart[0], planStart[1], flagLat, flagLng)

    const shot: PlanShot = {
      shotNum,
      startPos: planStart,
      endPos:   [flagLat, flagLng],
      distYards: dist,
      sg: sgHoled,
    }
    setPlannedShots(prev => [...prev, shot])

    // Round is done — go back to set-start so user can review or move to next hole
    setPlanStart(null)
    setPlanStep('set-start')
    setPlanStartLie('tee')
  }

  function handleUndoShot() {
    if (planStep === 'set-landing' && plannedShots.length === 0) {
      // Undo the start confirmation
      setPlanStart(null)
      setPlanStep('set-start')
    } else if (plannedShots.length > 0) {
      const prev = plannedShots[plannedShots.length - 1]
      setPlannedShots(ps => ps.slice(0, -1))
      setPlanStart(prev.startPos)
      setPlanStartLie(prev.startPos === prev.startPos ? planStartLie : 'tee') // restore
    }
  }

  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setMapCenter([lat, lng])
  }, [])

  // ── Total SG for this hole's plan ─────────────────────────────
  const totalSG = plannedShots.reduce((sum, s) => sum + s.sg, 0)
  const expFromHere = distToFlag !== null
    ? expectedStrokes(distToFlag, detectedLie, benchmark)
    : null

  // ── Welcome screen ────────────────────────────────────────────
  if (!course) {
    return (
      <>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 pb-24">
          <div className="text-center">
            <p className="text-6xl">🔭</p>
            <h1 className="mt-3 text-2xl font-bold text-text">Course Preview</h1>
            <p className="mt-2 max-w-xs text-sm text-text-dim leading-relaxed">
              Plan your strategy hole by hole before you play. Confirm your start position, aim for a landing spot, and see the exact strokes gained or lost for each shot.
            </p>
          </div>
          <button onClick={() => setShowSearch(true)}
            className="w-full max-w-xs rounded-xl bg-accent py-3.5 text-sm font-bold text-bg shadow-lg">
            Select a Course
          </button>
          <Link href="/play" className="text-xs text-text-dim underline underline-offset-2">← Back to Play</Link>

          <div className="mt-2 w-full max-w-xs rounded-xl border border-border bg-surface p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">How to plan a hole</p>
            {[
              ['1️⃣', 'Move crosshair to your tee position → Confirm Start'],
              ['2️⃣', 'Move crosshair to intended drive landing → Confirm Shot (see SG)'],
              ['3️⃣', 'Crosshair auto-moves to approach start → aim next shot → Confirm'],
              ['4️⃣', 'Repeat until the green — see your full hole strategy & total SG'],
            ].map(([num, text]) => (
              <div key={num} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{num}</span>
                <p className="text-xs text-text-dim leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
        {showSearch && <CourseSearchModal onSelect={handleCourseSelect} onClose={() => setShowSearch(false)} />}
      </>
    )
  }

  // ── Map view ──────────────────────────────────────────────────
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">

      {/* Map */}
      <PreviewMap
        center={mapCenter}
        polygons={polygons}
        flagLat={flagLat}
        flagLng={flagLng}
        flyToLocation={flyToLocation}
        planStep={planStep}
        planStart={planStart}
        plannedShots={plannedShots}
        onCenterChange={handleCenterChange}
      />

      {/* Crosshair */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-10 w-10">
          <div className="absolute top-1/2 inset-x-0 h-px -translate-y-1/2 bg-white/90" />
          <div className="absolute left-1/2 inset-y-0 w-px -translate-x-1/2 bg-white/90" />
          <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center gap-2 bg-black/65 px-3 py-2.5 backdrop-blur-sm">
        <Link href="/play" className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-text">
          ← Back
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold text-text">{course.name}</p>
          <p className="text-xs text-text-dim">
            Hole {holeNum} of {totalHoles} &nbsp;·&nbsp; Par {holePar}
            {!holeCoord && ' · No pin data'}
          </p>
        </div>
        <button onClick={() => setShowSearch(true)}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-text-dim">
          Change
        </button>
      </div>

      {/* Benchmark badge */}
      <div className="absolute right-3 top-16 z-20">
        <div className="rounded-lg bg-black/70 px-2.5 py-1.5 text-center backdrop-blur-sm">
          <p className="text-[10px] text-text-dim">Benchmark</p>
          <p className="text-xs font-bold text-accent">{BENCH_LABELS[benchmark]}</p>
        </div>
      </div>

      {/* Planned shots summary — chips below top bar */}
      {plannedShots.length > 0 && (
        <div className="absolute left-0 right-0 top-14 z-20 flex items-center gap-2 overflow-x-auto px-3 py-1.5">
          {plannedShots.map(s => (
            <div key={s.shotNum}
              className="flex shrink-0 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 backdrop-blur-sm">
              <span className="text-xs font-semibold text-amber-400">#{s.shotNum}</span>
              <span className={`text-xs font-bold ${sgColor(s.sg)}`}>
                {s.sg >= 0 ? '+' : ''}{s.sg.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 backdrop-blur-sm border border-white/20">
            <span className="text-[10px] text-text-dim">Total</span>
            <span className={`text-xs font-bold ${sgColor(totalSG)}`}>
              {totalSG >= 0 ? '+' : ''}{totalSG.toFixed(2)} SG
            </span>
          </div>
        </div>
      )}

      {/* Hole nav */}
      <div className="absolute left-3 top-1/2 z-20 -translate-y-1/2">
        <button onClick={() => goToHole(holeIdx - 1)} disabled={holeIdx === 0}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl font-bold text-white backdrop-blur-sm disabled:opacity-25">
          ‹
        </button>
      </div>
      <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2">
        <button onClick={() => goToHole(holeIdx + 1)} disabled={holeIdx >= totalHoles - 1}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl font-bold text-white backdrop-blur-sm disabled:opacity-25">
          ›
        </button>
      </div>

      {/* Hole dot strip */}
      <div className="absolute left-1/2 z-20 -translate-x-1/2" style={{ bottom: '246px' }}>
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          {Array.from({ length: totalHoles }, (_, i) => (
            <button key={i} onClick={() => goToHole(i)}
              className={`rounded-full transition-all ${i === holeIdx ? 'h-2.5 w-2.5 bg-accent' : 'h-1.5 w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {loadingData && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl bg-surface px-8 py-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-text">Loading course data…</p>
            <p className="mt-1 text-xs text-text-dim">Fetching hole positions & hazard boundaries</p>
          </div>
        </div>
      )}

      {/* Bottom control panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/85 pb-20 backdrop-blur-sm">

        {/* Polygon error notice */}
        {polygonError && (
          <div className="border-b border-white/10 px-4 py-2">
            <p className="text-xs text-amber-400 leading-snug">⚠️ {polygonError}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 overflow-x-auto border-b border-white/10 px-4 py-2">
          {LEGEND.map(item => (
            <div key={item.label} className="flex shrink-0 items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color, opacity: 0.85 }} />
              <span className="text-xs text-text-dim">{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── set-start panel ── */}
        {planStep === 'set-start' && (
          <>
            <div className="grid grid-cols-2 divide-x divide-white/10 py-3">
              <div className="px-4 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-dim">To Flag</p>
                <p className="mt-0.5 text-xl font-bold text-text">
                  {distToFlag !== null ? fmtDist(distToFlag) : '—'}
                </p>
              </div>
              <div className="px-4 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-dim">Exp. Strokes</p>
                <p className="mt-0.5 text-xl font-bold text-text">
                  {expFromHere !== null ? expFromHere.toFixed(1) : '—'}
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 px-4 pb-3 pt-2">
              <p className="mb-2 text-center text-xs text-text-dim">
                {shotNum === 1
                  ? 'Move crosshair to the tee box, then confirm your starting position'
                  : `Move crosshair to where shot ${shotNum} starts, then confirm`}
              </p>
              <button
                onClick={handleConfirmStart}
                className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-bg"
              >
                ✓ Confirm Start Position
              </button>
            </div>
          </>
        )}

        {/* ── set-landing panel ── */}
        {planStep === 'set-landing' && (
          <>
            {/* Live stats row */}
            <div className="grid grid-cols-3 divide-x divide-white/10 py-3">
              <div className="px-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-dim">Shot</p>
                <p className="mt-0.5 text-xl font-bold text-text">
                  {shotDist !== null ? fmtDist(shotDist) : '—'}
                </p>
              </div>
              <div className="px-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-dim">To Flag</p>
                <p className="mt-0.5 text-xl font-bold text-text">
                  {distToFlag !== null ? fmtDist(distToFlag) : '—'}
                </p>
              </div>
              <div className="px-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-text-dim">Landing</p>
                <p className="mt-0.5 text-sm font-bold">
                  <span>{LIE_EMOJI[detectedLie]} </span>
                  <span className="text-text">{LIE_LABEL[detectedLie]}</span>
                </p>
              </div>
            </div>

            {/* SG display */}
            <div className="border-t border-white/10 px-4 pb-1 pt-2 text-center">
              {liveSG !== null ? (
                <div className="flex items-center justify-center gap-2">
                  <span className={`text-2xl font-bold ${sgColor(liveSG)}`}>
                    {liveSG >= 0 ? '+' : ''}{liveSG.toFixed(2)} SG
                  </span>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs uppercase text-text-dim">
                    {liveCat}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-text-dim">Set pin position to calculate SG</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 px-4 pt-2">
              <button
                onClick={handleUndoShot}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-text-dim"
              >
                ↩ Undo
              </button>
              <button
                onClick={handleConfirmLanding}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-bg"
              >
                ✓ Confirm Shot #{shotNum}
              </button>
              <button
                onClick={resetHolePlan}
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-semibold text-text-dim"
              >
                🔄
              </button>
            </div>

            {/* Hole out shortcut */}
            {flagLat && flagLng && (
              <div className="px-4 pb-3 pt-2">
                <button
                  onClick={handleHoleOut}
                  className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400"
                >
                  ⛳ Hole Out — snap to pin
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showSearch && <CourseSearchModal onSelect={handleCourseSelect} onClose={() => setShowSearch(false)} />}
    </div>
  )
}
