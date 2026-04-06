'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { ActiveRound, ActiveHole, TeeColor, ActiveShot } from '@/types'
import { fetchHoleCoords, type HoleCoords } from '@/lib/overpass'
import { haversineYards } from '@/lib/sg-tables'
import { createClient } from '@/lib/supabase/client'
import CourseSearchModal from './CourseSearchModal'
import TeePickerModal from './TeePickerModal'
import ShotPanel from './ShotPanel'
import HUD from './HUD'
import LiveStatsStrip from './LiveStatsStrip'

const SatelliteMap = dynamic(() => import('./SatelliteMap'), { ssr: false })

export type PlayStep = 'idle' | 'set-flag' | 'set-start' | 'set-target' | 'set-result' | 'log-shot'

interface CompletedRoundStats {
  totalScore: number
  totalPar: number
  scoreToPar: number
  totalPutts: number
  girMade: number
  firMade: number
  firTotal: number
  onePutts: number
  threePutts: number
  sandSaves: number
  penalties: number
  scrambles: number
  scrambleOpps: number
  sgOtt: number
  sgApp: number
  sgArg: number
  sgPutt: number
  handicapDiff: number
  savedRoundId: string | null
}

interface FullCourse {
  id: string
  name: string
  lat: number
  lng: number
  city?: string
  state?: string
  par: number[]
  rating: number
  slope: number
}

export default function PlayClient() {
  const [showCourseSearch, setShowCourseSearch] = useState(false)
  const [showTeePicker, setShowTeePicker]       = useState(false)
  const [selectedCourse, setSelectedCourse]     = useState<FullCourse | null>(null)
  const [activeRound, setActiveRound]           = useState<ActiveRound | null>(null)
  const [step, setStep]                         = useState<PlayStep>('idle')
  const [layerSatellite, setLayerSatellite]     = useState(true)
  const [pendingStart, setPendingStart]         = useState<[number, number] | null>(null)
  const [pendingTarget, setPendingTarget]       = useState<[number, number] | null>(null)
  const [pendingEnd, setPendingEnd]             = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter]               = useState<[number, number]>([39.5, -98.35])
  const [flyToLocation, setFlyToLocation]       = useState<[number, number] | null>(null)
  const [locating, setLocating]                 = useState(false)
  const [holeCoords, setHoleCoords]             = useState<HoleCoords[]>([])
  const [saving, setSaving]                     = useState(false)
  const [completedRound, setCompletedRound]     = useState<CompletedRoundStats | null>(null)

  const handleCourseSelect = useCallback((course: FullCourse) => {
    setSelectedCourse(course)
    setShowCourseSearch(false)
    setShowTeePicker(true)
  }, [])

  const handleTeeSelect = useCallback((
    tee: TeeColor, rating: number, slope: number, teeLabel: string,
  ) => {
    if (!selectedCourse) return
    const round: ActiveRound = {
      courseId:     selectedCourse.id,
      courseName:   selectedCourse.name,
      tees:         tee,
      courseRating: rating,
      slopeRating:  slope,
      date: new Date().toISOString().split('T')[0],
      holes: selectedCourse.par.slice(0, 18).map((par, i) => ({
        holeNumber: i + 1,
        par,
        flagLat: null,
        flagLng: null,
        shots: [],
      })),
      currentHole:  1,
      savedRoundId: null,
    }
    setActiveRound(round)
    setShowTeePicker(false)
    setStep('set-flag') // Start by placing the flag on hole 1

    // ── Load previously saved flags from localStorage (instant, no network) ──
    // Every time the user places a flag it is saved keyed by courseId+holeNumber.
    // On subsequent rounds at the same course these load immediately so the map
    // flies to the correct green before Overpass even responds.
    setFlyToLocation(null)
    const savedCoords: import('@/lib/overpass').HoleCoords[] = []
    try {
      for (let h = 1; h <= 18; h++) {
        const raw = localStorage.getItem(`fw_flag_${selectedCourse.id}_${h}`)
        if (raw) {
          const { lat, lng } = JSON.parse(raw)
          savedCoords.push({ holeNumber: h, lat, lng })
        }
      }
    } catch { /* ignore */ }

    if (savedCoords.length > 0) {
      setHoleCoords(savedCoords)
      const h1 = savedCoords.find(c => c.holeNumber === 1)
      if (h1) setFlyToLocation([h1.lat, h1.lng])
    } else {
      setHoleCoords([])
    }

    // Also fetch from Overpass in background — fills in any holes not yet saved
    fetchHoleCoords(selectedCourse.lat, selectedCourse.lng).then(coords => {
      if (coords.length > 0) {
        // Merge: prefer saved user flags over OSM data (more accurate)
        setHoleCoords(prev => {
          const merged = [...coords]
          prev.forEach(s => {
            if (!merged.find(m => m.holeNumber === s.holeNumber)) merged.push(s)
          })
          return merged.sort((a, b) => a.holeNumber - b.holeNumber)
        })
        if (savedCoords.length === 0) {
          const h1 = coords.find(c => c.holeNumber === 1)
          if (h1) setFlyToLocation([h1.lat, h1.lng])
        }
      }
    })
  }, [selectedCourse])

  const handleMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyToLocation([pos.coords.latitude, pos.coords.longitude])
        setLocating(false)
      },
      () => { setLocating(false); alert('Location access denied. Please allow location in your browser settings.') },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  // ── Complete Round ────────────────────────────────────────────────────────
  const completeRound = useCallback(async () => {
    if (!activeRound) return
    setSaving(true)
    const holes = activeRound.holes

    // Hole scores
    const holeScores = holes.map(h => h.shots.length)
    const totalScore = holeScores.reduce((s, v) => s + v, 0)
    const totalPar   = holes.reduce((s, h) => s + h.par, 0)

    // GIR — reached green within par-2 shots
    function calcGIR(hole: ActiveHole): boolean {
      const limit = hole.par - 2
      for (let i = 0; i < limit; i++) {
        const s = hole.shots[i]
        if (!s) return false
        if (s.isHoled || s.endLie === 'green') return true
      }
      return false
    }
    const girByHole = holes.map(calcGIR)
    const girMade   = girByHole.filter(Boolean).length

    // FIR — par 4/5 only; first shot ends in fairway
    const firHoles = holes.filter(h => h.par >= 4)
    const firMade  = firHoles.filter(h => h.shots[0]?.endLie === 'fairway').length
    const firTotal = firHoles.length

    // Putts
    const puttsByHole  = holes.map(h => h.shots.filter(s => s.startLie === 'green').length)
    const totalPutts   = puttsByHole.reduce((s, v) => s + v, 0)
    const onePutts     = puttsByHole.filter(p => p === 1).length
    const threePutts   = puttsByHole.filter(p => p >= 3).length

    // Penalties & sand saves
    const totalPenalties = holes.flatMap(h => h.shots).filter(s => s.startLie === 'penalty').length
    const sandSaves = holes.filter(h => {
      if (!h.shots.some(s => s.startLie === 'sand')) return false
      return h.shots.length <= h.par
    }).length

    // Scrambling — missed GIR but still made par or better
    let scrambles = 0, scrambleOpps = 0
    holes.forEach((h, i) => {
      if (!girByHole[i]) {
        scrambleOpps++
        if (holeScores[i] <= h.par) scrambles++
      }
    })

    // SG by category
    const allShots = holes.flatMap(h => h.shots)
    const sumSG = (cat: ActiveShot['sgCategory']) =>
      allShots.filter(s => s.sgCategory === cat && s.sg !== null).reduce((a, s) => a + s.sg!, 0)
    const sgOtt  = +sumSG('ott').toFixed(3)
    const sgApp  = +sumSG('app').toFixed(3)
    const sgArg  = +sumSG('arg').toFixed(3)
    const sgPutt = +sumSG('putt').toFixed(3)

    // Handicap differential
    const handicapDiff = +((totalScore - activeRound.courseRating) * 113 / activeRound.slopeRating).toFixed(1)

    const stats: CompletedRoundStats = {
      totalScore, totalPar, scoreToPar: totalScore - totalPar,
      totalPutts, girMade, firMade, firTotal,
      onePutts, threePutts, sandSaves, penalties: totalPenalties,
      scrambles, scrambleOpps, sgOtt, sgApp, sgArg, sgPutt, handicapDiff,
      savedRoundId: null,
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Insert round row
        const { data: savedRound, error: roundErr } = await supabase
          .from('rounds')
          .insert({
            user_id:      user.id,
            date:         activeRound.date,
            course_name:  activeRound.courseName,
            tees:         activeRound.tees,
            score:        totalScore,
            par:          totalPar,
            putts:        totalPutts,
            gir:          girMade,
            fir_made:     firMade,
            fir_total:    firTotal,
            sg_ott:       sgOtt,
            sg_app:       sgApp,
            sg_arg:       sgArg,
            sg_putt:      sgPutt,
            penalties:    totalPenalties,
            sand_saves:   sandSaves,
            three_putts:  threePutts,
            one_putts:    onePutts,
            course_rating: activeRound.courseRating,
            slope_rating:  activeRound.slopeRating,
            handicap_diff: handicapDiff,
          })
          .select()
          .single()

        if (!roundErr && savedRound) {
          const roundId = savedRound.id
          stats.savedRoundId = roundId

          // Insert per-hole rows
          await supabase.from('holes').insert(
            holes.map((h, i) => ({
              round_id:    roundId,
              hole_number: h.holeNumber,
              par:         h.par,
              score:       holeScores[i],
              putts:       puttsByHole[i],
              gir:         girByHole[i],
              fir:         h.par >= 4 ? (h.shots[0]?.endLie === 'fairway') : null,
              sg_total:    +h.shots.reduce((a, s) => a + (s.sg ?? 0), 0).toFixed(3),
            }))
          )

          // Insert per-shot rows
          await supabase.from('shots').insert(
            holes.flatMap(h =>
              h.shots.map(s => ({
                round_id:           roundId,
                hole_number:        h.holeNumber,
                shot_number:        s.shotNumber,
                club:               s.club,
                start_lie:          s.startLie,
                end_lie:            s.endLie,
                start_lat:          s.startLat,
                start_lng:          s.startLng,
                end_lat:            s.endLat,
                end_lng:            s.endLng,
                dist_yards:         s.endLat && s.endLng
                  ? haversineYards(s.startLat, s.startLng, s.endLat, s.endLng)
                  : null,
                dist_to_flag_before: s.distToFlagBefore,
                dist_to_flag_after:  s.distToFlagAfter,
                sg:                  s.sg,
                sg_category:         s.sgCategory,
                is_holed:            s.isHoled,
              }))
            )
          )
        }
      }
    } catch (_) {
      // Save failed — still show local stats
    }

    setCompletedRound(stats)
    setActiveRound(null)
    setStep('idle')
    setPendingStart(null); setPendingTarget(null); setPendingEnd(null)
    setSaving(false)
  }, [activeRound])

  // ── Dev: Simulate a completed round for UI preview ────────────────────────
  const simulateRound = useCallback(() => {
    // A realistic ~15-handicap round at Pebble Beach
    const mockStats: CompletedRoundStats = {
      totalScore:   88,
      totalPar:     72,
      scoreToPar:   16,
      totalPutts:   34,
      girMade:       6,
      firMade:       7,
      firTotal:     14,
      onePutts:      5,
      threePutts:    2,
      sandSaves:     1,
      penalties:     2,
      scrambles:     3,
      scrambleOpps: 12,
      sgOtt:  -0.82,
      sgApp:  -2.14,
      sgArg:  -0.64,
      sgPutt: -0.31,
      handicapDiff: 13.6,
      savedRoundId: null,   // no DB save in simulation
    }
    setCompletedRound(mockStats)
  }, [])

  // Place a point at given coords — used by both map tap and confirm button
  const placePoint = useCallback((lat: number, lng: number) => {
    if (step === 'set-flag') {
      if (!activeRound) return
      const updated = { ...activeRound }
      updated.holes = [...activeRound.holes]
      updated.holes[activeRound.currentHole - 1] = {
        ...updated.holes[activeRound.currentHole - 1],
        flagLat: lat,
        flagLng: lng,
      }
      setActiveRound(updated)

      // Persist this flag so future rounds at the same course auto-fly correctly
      try {
        const key = `fw_flag_${activeRound.courseId}_${activeRound.currentHole}`
        localStorage.setItem(key, JSON.stringify({ lat, lng }))
      } catch { /* ignore */ }

      setStep('set-start')
    } else if (step === 'set-start') {
      setPendingStart([lat, lng])
      // Within 90 feet of the hole → auto-target the flag, skip set-target
      const hole = activeRound?.holes[(activeRound?.currentHole ?? 1) - 1]
      if (hole?.flagLat && hole?.flagLng &&
          haversineYards(lat, lng, hole.flagLat, hole.flagLng) < 30) {
        setPendingTarget([hole.flagLat, hole.flagLng])
        setStep('set-result')
        return
      }
      setStep('set-target')
    } else if (step === 'set-target') {
      setPendingTarget([lat, lng])
      setStep('set-result')
    } else if (step === 'set-result') {
      setPendingEnd([lat, lng])
      setStep('log-shot')
    }
  }, [step, activeRound])

  const handleConfirm = useCallback(() => {
    placePoint(mapCenter[0], mapCenter[1])
  }, [placePoint, mapCenter])

  const currentHole: ActiveHole | null = activeRound
    ? activeRound.holes[activeRound.currentHole - 1]
    : null

  // Stable references so SatelliteMap's center/zoom effect doesn't fire on every render
  const courseCenter = useMemo<[number, number]>(
    () => selectedCourse ? [selectedCourse.lat, selectedCourse.lng] : [39.5, -98.35],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCourse?.lat, selectedCourse?.lng],
  )
  const courseZoom = useMemo(
    () => (activeRound ? 19 : selectedCourse ? 17 : 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!activeRound, !!selectedCourse],
  )

  // Auto-fly to the green when hole changes and OSM coords are available
  useEffect(() => {
    if (!activeRound || holeCoords.length === 0) return
    const coords = holeCoords.find(h => h.holeNumber === activeRound.currentHole)
    if (coords) setFlyToLocation([coords.lat, coords.lng])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRound?.currentHole, holeCoords])

  return (
    <div className="relative" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* Full-screen map */}
      <SatelliteMap
        center={courseCenter}
        zoom={courseZoom}
        satellite={layerSatellite}
        step={step}
        pendingStart={pendingStart}
        pendingTarget={pendingTarget}
        pendingEnd={pendingEnd}
        activeRound={activeRound}
        flyToLocation={flyToLocation}
        onCenterChange={(lat, lng) => setMapCenter([lat, lng])}
        onMapTap={placePoint}
      />

      {/* Crosshair — shown when placing flag, tee, or target */}
      {(step === 'set-flag' || step === 'set-start' || step === 'set-target' || step === 'set-result') && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-px w-20 bg-white opacity-90" style={{ boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
            <div className="absolute h-20 w-px bg-white opacity-90" style={{ boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
            <div className="absolute h-4 w-4 rounded-full border-2 border-white bg-transparent" style={{ boxShadow: '0 0 4px rgba(0,0,0,0.8)' }} />
          </div>
        </div>
      )}

      {/* HUD overlay */}
      {activeRound && currentHole && (
        <HUD
          round={activeRound}
          hole={currentHole}
          step={step}
          pendingStart={pendingStart}
          pendingTarget={pendingTarget}
          mapCenter={mapCenter}
          onConfirm={handleConfirm}
          onPrevHole={() => {
            if (activeRound.currentHole > 1) {
              setActiveRound(r => r ? { ...r, currentHole: r.currentHole - 1 } : r)
              setPendingStart(null); setPendingTarget(null); setPendingEnd(null)
              setStep('set-flag')
            }
          }}
          onNextHole={() => {
            if (activeRound.currentHole < activeRound.holes.length) {
              setActiveRound(r => r ? { ...r, currentHole: r.currentHole + 1 } : r)
              setPendingStart(null); setPendingTarget(null); setPendingEnd(null)
              setStep('set-flag')
            }
          }}
        />
      )}

      {/* Left floating buttons */}
      <div className="absolute left-3 top-[70px] z-30 flex flex-col gap-2">
        <FloatBtn title="Course" onClick={() => setShowCourseSearch(true)}>
          ⛳ <span className="text-[10px]">{activeRound ? activeRound.courseName.split(' ').slice(0, 2).join(' ') : 'Course'}</span>
        </FloatBtn>
        <FloatBtn title={layerSatellite ? 'Street Map' : 'Satellite'} onClick={() => setLayerSatellite(l => !l)}>
          {layerSatellite ? '🗺' : '🛰'}
        </FloatBtn>
        <FloatBtn title="My Location" onClick={handleMyLocation}>
          {locating ? '⏳' : '📍'}
        </FloatBtn>
        {activeRound && (
          <FloatBtn title="Finish Round" onClick={completeRound}>
            {saving ? '⏳' : '🏁'} <span className="text-[10px]">Finish</span>
          </FloatBtn>
        )}
      </div>

      {/* Live stats strip */}
      {activeRound && currentHole && (
        <LiveStatsStrip hole={currentHole} round={activeRound} />
      )}

      {/* Shot panel slides up when step = log-shot */}
      {step === 'log-shot' && pendingStart && pendingTarget && pendingEnd && activeRound && currentHole && (
        <ShotPanel
          round={activeRound}
          hole={currentHole}
          startCoords={pendingStart}
          targetCoords={pendingTarget}
          endCoords={pendingEnd}
          onSave={(shot) => {
            const updated = { ...activeRound }
            updated.holes = [...activeRound.holes]
            updated.holes[activeRound.currentHole - 1] = {
              ...currentHole,
              shots: [...currentHole.shots, shot],
            }

            if (shot.isHoled) {
              // Advance to next hole automatically
              if (activeRound.currentHole < activeRound.holes.length) {
                updated.currentHole = activeRound.currentHole + 1
                setActiveRound(updated)
                setPendingStart(null)
                setPendingEnd(null)
                setStep('set-flag') // Start next hole with flag placement
              } else {
                setActiveRound(updated)
                setStep('idle') // Round complete
              }
            } else {
              setActiveRound(updated)
              const newStart = pendingEnd!
              // Within 90 feet of hole → auto-target the flag for the next shot too
              const autoTarget = currentHole.flagLat && currentHole.flagLng &&
                haversineYards(newStart[0], newStart[1], currentHole.flagLat, currentHole.flagLng) < 30
              setPendingStart(newStart)
              setPendingEnd(null)
              if (autoTarget) {
                setPendingTarget([currentHole.flagLat!, currentHole.flagLng!])
                setStep('set-result')
              } else {
                setPendingTarget(null)
                setStep('set-target')
              }
            }
          }}
          onCancel={() => {
            setPendingEnd(null)
            setStep('set-result')
          }}
        />
      )}

      {/* No active round — start screen */}
      {!activeRound && !showCourseSearch && !showTeePicker && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-4xl">⛳</p>
            <h2 className="mt-2 text-lg font-bold text-text">Ready to play?</h2>
            <p className="mt-1 text-sm text-text-dim">Find your course to start tracking</p>
            <button
              onClick={() => setShowCourseSearch(true)}
              className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-bg"
            >
              Find Course
            </button>
            <button
              onClick={simulateRound}
              className="mt-2 w-full rounded-xl border border-border py-2.5 text-xs text-text-dim"
            >
              🧪 Preview completed round
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCourseSearch && (
        <CourseSearchModal
          onSelect={handleCourseSelect}
          onClose={() => setShowCourseSearch(false)}
        />
      )}
      {showTeePicker && selectedCourse && (
        <TeePickerModal
          courseName={selectedCourse.name}
          baseRating={selectedCourse.rating}
          baseSlope={selectedCourse.slope}
          onSelect={handleTeeSelect}
          onClose={() => setShowTeePicker(false)}
        />
      )}

      {/* Round completion modal */}
      {completedRound && (
        <RoundCompleteModal
          stats={completedRound}
          onClose={() => setCompletedRound(null)}
        />
      )}
    </div>
  )
}

function FloatBtn({
  children, onClick, title,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-surface/90 px-3 text-xs font-medium text-white shadow-lg backdrop-blur transition-transform active:scale-95"
    >
      {children}
    </button>
  )
}

// ── Round Complete Modal ──────────────────────────────────────────────────────
function RoundCompleteModal({
  stats, onClose,
}: {
  stats: CompletedRoundStats
  onClose: () => void
}) {
  const scoreTxt = stats.scoreToPar === 0 ? 'E'
    : stats.scoreToPar > 0 ? `+${stats.scoreToPar}` : `${stats.scoreToPar}`
  const scoreColor = stats.scoreToPar < 0 ? 'text-accent' : stats.scoreToPar === 0 ? 'text-text' : 'text-red-stat'
  const sgTotal = +(stats.sgOtt + stats.sgApp + stats.sgArg + stats.sgPutt).toFixed(2)

  const fmtSG = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))
  const sgColor = (v: number) => v >= 0 ? 'text-accent' : 'text-red-stat'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="p-5 text-center border-b border-border">
          <p className="text-4xl">🏁</p>
          <h2 className="mt-2 text-xl font-bold text-text">Round Complete!</h2>
          <p className="mt-1 text-sm text-text-dim">
            {stats.savedRoundId ? 'Saved to your history ✓' : 'Stats calculated (not signed in)'}
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Score */}
          <div className="rounded-xl border border-border bg-surface-2 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-dim">Score</p>
              <p className="text-3xl font-black text-text">{stats.totalScore}</p>
              <p className="text-sm text-text-dim">Par {stats.totalPar}</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-black ${scoreColor}`}>{scoreTxt}</p>
              <p className="text-xs text-text-dim mt-1">Hdcp Diff: {stats.handicapDiff}</p>
            </div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Putts', value: stats.totalPutts },
              { label: 'GIR', value: `${stats.girMade}/18` },
              { label: 'FIR', value: stats.firTotal > 0 ? `${stats.firMade}/${stats.firTotal}` : '—' },
              { label: '1-Putts', value: stats.onePutts },
              { label: '3-Putts', value: stats.threePutts },
              { label: 'Penalties', value: stats.penalties },
              { label: 'Sand Saves', value: stats.sandSaves },
              {
                label: 'Scrambling',
                value: stats.scrambleOpps > 0
                  ? `${stats.scrambles}/${stats.scrambleOpps}`
                  : '—',
              },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border bg-surface-2 p-2.5 text-center">
                <p className="text-[10px] text-text-dim">{s.label}</p>
                <p className="text-base font-bold text-text">{s.value}</p>
              </div>
            ))}
          </div>

          {/* SG breakdown */}
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <p className="text-xs font-semibold text-text-dim mb-2">Strokes Gained</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Off Tee',  value: stats.sgOtt },
                { label: 'Approach', value: stats.sgApp },
                { label: 'Arg',      value: stats.sgArg },
                { label: 'Putting',  value: stats.sgPutt },
              ].map(sg => (
                <div key={sg.label} className="flex justify-between items-center rounded-lg border border-border px-3 py-1.5">
                  <span className="text-xs text-text-dim">{sg.label}</span>
                  <span className={`text-sm font-bold ${sgColor(sg.value)}`}>{fmtSG(sg.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between items-center border-t border-border pt-2">
              <span className="text-xs font-semibold text-text-dim">Total SG</span>
              <span className={`text-base font-black ${sgColor(sgTotal)}`}>{fmtSG(sgTotal)}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-bg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
