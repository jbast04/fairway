'use client'

import { useState, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { ActiveRound, ActiveHole, TeeColor } from '@/types'
import CourseSearchModal from './CourseSearchModal'
import TeePickerModal from './TeePickerModal'
import ShotPanel from './ShotPanel'
import HUD from './HUD'
import LiveStatsStrip from './LiveStatsStrip'

const SatelliteMap = dynamic(() => import('./SatelliteMap'), { ssr: false })

export type PlayStep = 'idle' | 'set-flag' | 'set-start' | 'set-end' | 'log-shot'

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
  const [pendingEnd, setPendingEnd]             = useState<[number, number] | null>(null)
  const [mapCenter, setMapCenter]               = useState<[number, number]>([39.5, -98.35])
  const [flyToLocation, setFlyToLocation]       = useState<[number, number] | null>(null)
  const [locating, setLocating]                 = useState(false)

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
      setStep('set-start')
    } else if (step === 'set-start') {
      setPendingStart([lat, lng])
      setStep('set-end')
    } else if (step === 'set-end') {
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

  return (
    <div className="relative" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* Full-screen map */}
      <SatelliteMap
        center={courseCenter}
        zoom={courseZoom}
        satellite={layerSatellite}
        step={step}
        pendingStart={pendingStart}
        pendingEnd={pendingEnd}
        activeRound={activeRound}
        flyToLocation={flyToLocation}
        onCenterChange={(lat, lng) => setMapCenter([lat, lng])}
        onMapTap={placePoint}
      />

      {/* Crosshair — shown when placing flag, tee, or target */}
      {(step === 'set-flag' || step === 'set-start' || step === 'set-end') && (
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
          mapCenter={mapCenter}
          onConfirm={handleConfirm}
          onPrevHole={() => {
            if (activeRound.currentHole > 1) {
              setActiveRound(r => r ? { ...r, currentHole: r.currentHole - 1 } : r)
              setPendingStart(null); setPendingEnd(null)
              setStep('set-flag')
            }
          }}
          onNextHole={() => {
            if (activeRound.currentHole < activeRound.holes.length) {
              setActiveRound(r => r ? { ...r, currentHole: r.currentHole + 1 } : r)
              setPendingStart(null); setPendingEnd(null)
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
      </div>

      {/* Live stats strip */}
      {activeRound && currentHole && (
        <LiveStatsStrip hole={currentHole} round={activeRound} />
      )}

      {/* Shot panel slides up when step = log-shot */}
      {step === 'log-shot' && pendingStart && pendingEnd && activeRound && currentHole && (
        <ShotPanel
          round={activeRound}
          hole={currentHole}
          startCoords={pendingStart}
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
              // Auto-chain: next shot starts from previous landing
              setPendingStart(pendingEnd)
              setPendingEnd(null)
              setStep('set-end')
            }
          }}
          onCancel={() => {
            setPendingEnd(null)
            setStep('set-end')
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
