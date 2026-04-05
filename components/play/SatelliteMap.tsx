'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { Map as LeafletMap, Marker, TileLayer } from 'leaflet'
import type { ActiveRound, ActiveHole } from '@/types'
import type { PlayStep } from './PlayClient'

// Fix Leaflet's broken default icon paths in Next.js
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
  onMapTap: (lat: number, lng: number) => void
  onSetFlag: (lat: number, lng: number) => void
}

export default function SatelliteMap({
  center, zoom, satellite, step,
  pendingStart, pendingEnd, activeRound,
  onMapTap, onSetFlag,
}: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<LeafletMap | null>(null)
  const satelliteRef   = useRef<TileLayer | null>(null)
  const labelsRef      = useRef<TileLayer | null>(null)
  const osmRef         = useRef<TileLayer | null>(null)
  const startMarkerRef = useRef<Marker | null>(null)
  const endMarkerRef   = useRef<Marker | null>(null)
  const flagMarkerRef  = useRef<Marker | null>(null)
  const shotMarkersRef = useRef<Marker[]>([])

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const init = async () => {
      await fixLeafletIcons()
      const L = (await import('leaflet')).default

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
      })

      // ESRI satellite layer
      const satLayer = L.tileLayer(ESRI_SATELLITE, {
        maxZoom: 20,
        attribution: 'Tiles &copy; Esri',
      })

      // ESRI label overlay (roads/names on satellite)
      const labelLayer = L.tileLayer(ESRI_LABELS, {
        maxZoom: 20,
        opacity: 0.7,
      })

      // OSM fallback
      const osmLayer = L.tileLayer(OSM_STANDARD, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      })

      satLayer.addTo(map)
      labelLayer.addTo(map)

      satelliteRef.current = satLayer
      labelsRef.current    = labelLayer
      osmRef.current       = osmLayer
      mapRef.current       = map

      // Tap handler
      map.on('click', (e) => {
        onMapTap(e.latlng.lat, e.latlng.lng)
      })
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update center/zoom when course changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setView(center, zoom, { animate: true })
  }, [center, zoom])

  // Toggle satellite / map layer
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

  // Update pending start marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const init = async () => {
      const L = (await import('leaflet')).default

      if (startMarkerRef.current) {
        map.removeLayer(startMarkerRef.current)
        startMarkerRef.current = null
      }

      if (pendingStart) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:#ffffff;border:3px solid #4ade80;
            box-shadow:0 0 0 3px rgba(74,222,128,0.3)
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        startMarkerRef.current = L.marker(pendingStart, { icon, interactive: false }).addTo(map)
      }
    }
    init()
  }, [pendingStart])

  // Update pending end marker (pulsing blue)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const init = async () => {
      const L = (await import('leaflet')).default

      if (endMarkerRef.current) {
        map.removeLayer(endMarkerRef.current)
        endMarkerRef.current = null
      }

      if (pendingEnd) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;width:20px;height:20px">
            <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.4;animation:ping-slow 1.5s infinite"></div>
            <div style="position:absolute;inset:3px;border-radius:50%;background:#3b82f6"></div>
          </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
        endMarkerRef.current = L.marker(pendingEnd, { icon, interactive: false }).addTo(map)
      }
    }
    init()
  }, [pendingEnd])

  // Draw saved shots for current hole
  useEffect(() => {
    const map = mapRef.current
    if (!map || !activeRound) return

    const init = async () => {
      const L = (await import('leaflet')).default

      // Clear old shot markers
      shotMarkersRef.current.forEach(m => map.removeLayer(m))
      shotMarkersRef.current = []

      const hole = activeRound.holes[activeRound.currentHole - 1]
      hole.shots.forEach((shot, i) => {
        if (shot.startLat && shot.startLng) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              width:18px;height:18px;border-radius:50%;
              background:#f59e0b;border:2px solid #fff;
              display:flex;align-items:center;justify-content:center;
              font-size:9px;font-weight:700;color:#07100a
            ">${i + 1}</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })
          const m = L.marker([shot.startLat, shot.startLng], { icon, interactive: false }).addTo(map)
          shotMarkersRef.current.push(m)
        }

        // Draw shot line
        if (shot.startLat && shot.startLng && shot.endLat && shot.endLng) {
          const line = L.polyline(
            [[shot.startLat, shot.startLng], [shot.endLat, shot.endLng]],
            { color: '#f59e0b', weight: 2, opacity: 0.7, dashArray: '4 4' }
          ).addTo(map)
          // @ts-expect-error
          shotMarkersRef.current.push(line)
        }
      })

      // Flag marker
      if (flagMarkerRef.current) map.removeLayer(flagMarkerRef.current)
      if (hole.flagLat && hole.flagLng) {
        const flagIcon = L.divIcon({
          className: '',
          html: `<div style="font-size:22px;line-height:1">🚩</div>`,
          iconSize: [22, 22],
          iconAnchor: [4, 22],
        })
        flagMarkerRef.current = L.marker([hole.flagLat, hole.flagLng], {
          icon: flagIcon, interactive: false,
        }).addTo(map)
      }
    }
    init()
  }, [activeRound])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ cursor: step === 'idle' ? 'default' : 'crosshair' }}
    />
  )
}
