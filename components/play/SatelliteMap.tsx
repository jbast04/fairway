'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, Marker, TileLayer, Polyline } from 'leaflet'
import type { ActiveRound } from '@/types'
import type { PlayStep } from './PlayClient'

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
  const liveLineRef     = useRef<Polyline | null>(null)
  const userMarkerRef   = useRef<Marker | null>(null)

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

  // Update center/zoom when course changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
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

  // Live shot line: from pendingStart to map center while step=set-end
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const updateLine = async () => {
      const L = (await import('leaflet')).default

      if (step === 'set-end' && pendingStart) {
        const c = map.getCenter()
        if (liveLineRef.current) {
          liveLineRef.current.setLatLngs([pendingStart, [c.lat, c.lng]])
        } else {
          liveLineRef.current = L.polyline([pendingStart, [c.lat, c.lng]], {
            color: '#ffffff',
            weight: 2,
            opacity: 0.85,
            dashArray: '6 4',
          }).addTo(map)
        }
      } else {
        if (liveLineRef.current) {
          map.removeLayer(liveLineRef.current)
          liveLineRef.current = null
        }
      }
    }

    updateLine()

    // Update line on every map move
    const handler = () => updateLine()
    map.on('move', handler)
    return () => { map.off('move', handler) }
  }, [step, pendingStart])

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

  // Draw saved shots + flag for current hole
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

      if (flagMarkerRef.current) map.removeLayer(flagMarkerRef.current)
      if (hole.flagLat && hole.flagLng) {
        const flagIcon = L.divIcon({
          className: '',
          html: `<div style="font-size:22px;line-height:1">🚩</div>`,
          iconSize: [22, 22], iconAnchor: [4, 22],
        })
        flagMarkerRef.current = L.marker([hole.flagLat, hole.flagLng], { icon: flagIcon, interactive: false }).addTo(map)
      }
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
