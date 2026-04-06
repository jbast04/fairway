'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker, TileLayer, Polyline } from 'leaflet'
import type { ActiveRound } from '@/types'
import type { PlayStep } from './PlayClient'

function haversineYards(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.09361)
}

const fixLeafletIcons = async () => {
  const L = (await import('leaflet')).default
  // @ts-expect-error
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS    = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const OSM_STANDARD   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

interface Props {
  center: [number, number]
  zoom: number
  satellite: boolean
  step: PlayStep
  pendingStart: [number, number] | null
  pendingEnd: [number, number] | null
  activeRound: ActiveRound | null
  flyToLocation: [number, number] | null
  onCenterChange: (lat: number, lng: number) => void
  onMapTap: (lat: number, lng: number) => void
}

export default function SatelliteMap({
  center, zoom, satellite, step,
  pendingStart, pendingEnd, activeRound,
  flyToLocation, onCenterChange, onMapTap,
}: Props) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<LeafletMap | null>(null)
  const satelliteRef    = useRef<TileLayer | null>(null)
  const labelsRef       = useRef<TileLayer | null>(null)
  const osmRef          = useRef<TileLayer | null>(null)
  const startMarkerRef  = useRef<Marker | null>(null)
  const endMarkerRef    = useRef<Marker | null>(null)
  const flagMarkerRef   = useRef<Marker | null>(null)
  const shotMarkersRef  = useRef<any[]>([])
  const liveLineRef          = useRef<Polyline | null>(null)
  const liveLineFlagRef      = useRef<Polyline | null>(null)
  const liveYardageLabelRef  = useRef<Marker | null>(null)
  const userMarkerRef        = useRef<Marker | null>(null)

  // Derived flag coordinates for current hole
  const currentHoleData = activeRound?.holes[(activeRound?.currentHole ?? 1) - 1]
  const flagLat = currentHoleData?.flagLat ?? null
  const flagLng = currentHoleData?.flagLng ?? null

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const init = async () => {
      await fixLeafletIcons()
      const L = (await import('leaflet')).default

      // Force Leaflet into mouse-event mode so drag/zoom work on desktop browsers.
      // Leaflet detects PointerEvent support and sets Browser.pointer = true, which
      // causes it to use the touch drag handler — that handler breaks regular mouse drag.
      // @ts-expect-error
      L.Browser.touch   = false
      // @ts-expect-error
      L.Browser.pointer = false

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: false,
        tap: false,
        boxZoom: false,
      })

      const satLayer   = L.tileLayer(ESRI_SATELLITE, { maxZoom: 20 })
      const labelLayer = L.tileLayer(ESRI_LABELS,    { maxZoom: 20, opacity: 0.7 })
      const osmLayer   = L.tileLayer(OSM_STANDARD,   { maxZoom: 19 })

      satLayer.addTo(map)
      labelLayer.addTo(map)

      satelliteRef.current = satLayer
      labelsRef.current    = labelLayer
      osmRef.current       = osmLayer
      mapRef.current       = map

      map.on('move', () => {
        const c = map.getCenter()
        onCenterChange(c.lat, c.lng)
      })
      map.on('click', (e) => {
        onMapTap(e.latlng.lat, e.latlng.lng)
      })
      onCenterChange(center[0], center[1])
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly to GPS location when requested
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToLocation) return
    map.flyTo(flyToLocation, 19, { animate: true, duration: 1.2 })
  }, [flyToLocation])

  // Update center/zoom when course changes (never interrupt an active drag)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // @ts-expect-error
    if (map.dragging._draggable?._moving) return
    map.setView(center, zoom, { animate: true })
  }, [center, zoom])

  // Toggle satellite / street layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || !satelliteRef.current || !labelsRef.current || !osmRef.current) return
    if (satellite) {
      if (!map.hasLayer(satelliteRef.current)) satelliteRef.current.addTo(map)
      if (!map.hasLayer(labelsRef.current))    labelsRef.current.addTo(map)
      if (map.hasLayer(osmRef.current))        map.removeLayer(osmRef.current)
    } else {
      if (map.hasLayer(satelliteRef.current))  map.removeLayer(satelliteRef.current)
      if (map.hasLayer(labelsRef.current))     map.removeLayer(labelsRef.current)
      if (!map.hasLayer(osmRef.current))       osmRef.current.addTo(map)
    }
  }, [satellite])

  // Live line + yardage label: shot line during set-end, flag line during set-start
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateLine = async () => {
      const L = (await import('leaflet')).default
      const c = map.getCenter()

      // Helper: create or update a yardage label marker
      const setLabel = (yards: number, midLat: number, midLng: number, color: string, suffix: string) => {
        const html = `<div style="background:rgba(0,0,0,0.78);color:${color};font-weight:700;font-size:13px;padding:2px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.6)">${yards}y${suffix}</div>`
        const icon = L.divIcon({ className: '', html, iconSize: [70, 22], iconAnchor: [35, 11] })
        if (liveYardageLabelRef.current) {
          liveYardageLabelRef.current.setLatLng([midLat, midLng])
          liveYardageLabelRef.current.setIcon(icon)
        } else {
          liveYardageLabelRef.current = L.marker([midLat, midLng], { icon, interactive: false, zIndexOffset: 500 }).addTo(map)
        }
      }

      if (step === 'set-end' && pendingStart) {
        // White dashed line: tee/start → crosshair
        const yards = haversineYards(pendingStart[0], pendingStart[1], c.lat, c.lng)
        if (liveLineRef.current) {
          liveLineRef.current.setLatLngs([pendingStart, [c.lat, c.lng]])
        } else {
          liveLineRef.current = L.polyline([pendingStart, [c.lat, c.lng]], {
            color: '#ffffff', weight: 2.5, opacity: 0.9, dashArray: '6 4',
          }).addTo(map)
        }
        setLabel(yards, (pendingStart[0] + c.lat) / 2, (pendingStart[1] + c.lng) / 2, '#ffffff', '')
        // Remove flag line if leftover
        if (liveLineFlagRef.current) { map.removeLayer(liveLineFlagRef.current); liveLineFlagRef.current = null }

      } else if (step === 'set-start' && flagLat && flagLng) {
        // Red dashed line: crosshair → pin (distance to flag from where you're standing)
        const yards = haversineYards(c.lat, c.lng, flagLat, flagLng)
        if (liveLineFlagRef.current) {
          liveLineFlagRef.current.setLatLngs([[c.lat, c.lng], [flagLat, flagLng]])
        } else {
          liveLineFlagRef.current = L.polyline([[c.lat, c.lng], [flagLat, flagLng]], {
            color: '#f87171', weight: 2, opacity: 0.8, dashArray: '4 6',
          }).addTo(map)
        }
        setLabel(yards, (c.lat + flagLat) / 2, (c.lng + flagLng) / 2, '#f87171', ' to pin')
        if (liveLineRef.current) { map.removeLayer(liveLineRef.current); liveLineRef.current = null }

      } else {
        // Clean up all lines
        if (liveLineRef.current) { map.removeLayer(liveLineRef.current); liveLineRef.current = null }
        if (liveLineFlagRef.current) { map.removeLayer(liveLineFlagRef.current); liveLineFlagRef.current = null }
        if (liveYardageLabelRef.current) { map.removeLayer(liveYardageLabelRef.current); liveYardageLabelRef.current = null }
      }
    }

    updateLine()
    map.on('move', updateLine)
    return () => { map.off('move', updateLine) }
  }, [step, pendingStart, flagLat, flagLng])

  // Start marker (green dot)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const init = async () => {
      const L = (await import('leaflet')).default
      if (startMarkerRef.current) { map.removeLayer(startMarkerRef.current); startMarkerRef.current = null }
      if (pendingStart) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#ffffff;border:3px solid #4ade80;box-shadow:0 0 0 3px rgba(74,222,128,0.3)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        })
        startMarkerRef.current = L.marker(pendingStart, { icon, interactive: false }).addTo(map)
      }
    }
    init()
  }, [pendingStart])

  // End marker (pulsing blue)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const init = async () => {
      const L = (await import('leaflet')).default
      if (endMarkerRef.current) { map.removeLayer(endMarkerRef.current); endMarkerRef.current = null }
      if (pendingEnd) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:20px;height:20px">
            <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.4;animation:ping-slow 1.5s infinite"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6"></div>
          </div>`,
          iconSize: [20, 20], iconAnchor: [10, 10],
        })
        endMarkerRef.current = L.marker(pendingEnd, { icon, interactive: false }).addTo(map)
      }
    }
    init()
  }, [pendingEnd])

  // Flag marker — stable, only redraws when hole number or flag coords change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const init = async () => {
      const L = (await import('leaflet')).default
      if (flagMarkerRef.current) { map.removeLayer(flagMarkerRef.current); flagMarkerRef.current = null }
      if (flagLat && flagLng) {
        const flagIcon = L.divIcon({
          className: '',
          html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center">
            <div style="background:#ef4444;color:#fff;font-weight:700;font-size:10px;padding:2px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.6)">⛳ PIN</div>
            <div style="width:2px;height:10px;background:#ef4444;margin:0 auto"></div>
          </div>`,
          iconSize: [40, 30], iconAnchor: [20, 30],
        })
        flagMarkerRef.current = L.marker([flagLat, flagLng], { icon: flagIcon, interactive: false, zIndexOffset: 1000 }).addTo(map)
      }
    }
    init()
  }, [flagLat, flagLng])

  // Draw saved shots for current hole
  useEffect(() => {
    const map = mapRef.current
    if (!map || !activeRound) return
    const init = async () => {
      const L = (await import('leaflet')).default
      shotMarkersRef.current.forEach(m => map.removeLayer(m))
      shotMarkersRef.current = []

      const hole = activeRound.holes[activeRound.currentHole - 1]
      hole.shots.forEach((shot, i) => {
        if (shot.startLat && shot.startLng) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#07100a">${i + 1}</div>`,
            iconSize: [18, 18], iconAnchor: [9, 9],
          })
          shotMarkersRef.current.push(L.marker([shot.startLat, shot.startLng], { icon, interactive: false }).addTo(map))
        }
        if (shot.startLat && shot.startLng && shot.endLat && shot.endLng) {
          shotMarkersRef.current.push(
            L.polyline([[shot.startLat, shot.startLng], [shot.endLat, shot.endLng]], { color: '#f59e0b', weight: 2, opacity: 0.7, dashArray: '4 4' }).addTo(map)
          )
        }
      })
    }
    init()
  }, [activeRound])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ cursor: step === 'idle' ? 'default' : 'grab', touchAction: 'none' }}
    />
  )
}
