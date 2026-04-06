'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, TileLayer, Marker, Polyline } from 'leaflet'
import type { CoursePolygon } from '@/lib/course-polygons'

const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS    = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

const POLY_STYLE: Record<string, { color: string; fillOpacity: number }> = {
  fairway:      { color: '#4ade80', fillOpacity: 0.30 },
  bunker:       { color: '#fbbf24', fillOpacity: 0.55 },
  water_hazard: { color: '#60a5fa', fillOpacity: 0.55 },
  rough:        { color: '#166534', fillOpacity: 0.28 },
  green:        { color: '#86efac', fillOpacity: 0.42 },
  tee:          { color: '#d1d5db', fillOpacity: 0.38 },
}

export interface PlanShot {
  shotNum: number
  startPos: [number, number]
  endPos: [number, number]
  distYards: number
  sg: number
}

function haversineYds(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180
  const dp = (b[0] - a[0]) * Math.PI / 180, dl = (b[1] - a[1]) * Math.PI / 180
  const aa = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)) * 1.09361)
}

function fmtYds(y: number) { return y < 30 ? `${Math.round(y * 3)}ft` : `${y}y` }

interface Props {
  center:         [number, number]
  polygons:       CoursePolygon[]
  flagLat:        number | null
  flagLng:        number | null
  flyToLocation:  [number, number] | null
  planStep:       'set-start' | 'set-landing'
  planStart:      [number, number] | null
  plannedShots:   PlanShot[]
  onCenterChange: (lat: number, lng: number) => void
}

export default function PreviewMap({
  center, polygons, flagLat, flagLng, flyToLocation,
  planStep, planStart, plannedShots, onCenterChange,
}: Props) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const mapRef          = useRef<LeafletMap | null>(null)
  const satRef          = useRef<TileLayer | null>(null)
  const labelsRef       = useRef<TileLayer | null>(null)
  const polyLayersRef   = useRef<any[]>([])
  const flagRef         = useRef<Marker | null>(null)
  const startMarkerRef  = useRef<Marker | null>(null)
  const shotLineRef     = useRef<Polyline | null>(null)
  const shotLabelRef    = useRef<Marker | null>(null)
  const pinLineRef      = useRef<Polyline | null>(null)
  const pinLabelRef     = useRef<Marker | null>(null)
  const confirmedRef    = useRef<any[]>([])

  // ── Init map ─────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const init = async () => {
      const L = (await import('leaflet')).default
      // @ts-expect-error
      L.Browser.touch   = false
      // @ts-expect-error
      L.Browser.pointer = false

      const map = L.map(containerRef.current!, {
        center, zoom: 17,
        zoomControl: false, attributionControl: false,
        dragging: true, scrollWheelZoom: true,
        doubleClickZoom: true, touchZoom: false, boxZoom: false,
        maxZoom: 22,
      })
      const sat    = L.tileLayer(ESRI_SATELLITE, { maxZoom: 22, maxNativeZoom: 19 })
      const labels = L.tileLayer(ESRI_LABELS,    { maxZoom: 22, maxNativeZoom: 19, opacity: 0.7 })
      sat.addTo(map); labels.addTo(map)
      satRef.current = sat; labelsRef.current = labels; mapRef.current = map

      map.on('move', () => { const c = map.getCenter(); onCenterChange(c.lat, c.lng) })
      onCenterChange(center[0], center[1])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── flyTo + panBy ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToLocation) return
    map.flyTo(flyToLocation, 19, { animate: true, duration: 1.2 })
    const t = setTimeout(() => {
      map.panBy([0, Math.round(map.getSize().y / 3)], { animate: true })
    }, 1400)
    return () => clearTimeout(t)
  }, [flyToLocation])

  // ── Polygon overlays ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = async () => {
      const L = (await import('leaflet')).default
      polyLayersRef.current.forEach(l => map.removeLayer(l))
      polyLayersRef.current = []
      for (const poly of polygons) {
        const s = POLY_STYLE[poly.type] ?? { color: '#fff', fillOpacity: 0.2 }
        const l = L.polygon(poly.coords as any, {
          color: s.color, weight: 1.5, opacity: 0.85,
          fillColor: s.color, fillOpacity: s.fillOpacity, interactive: false,
        })
        l.addTo(map); polyLayersRef.current.push(l)
      }
    }
    draw()
  }, [polygons])

  // ── Flag marker ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = async () => {
      const L = (await import('leaflet')).default
      if (flagRef.current) { map.removeLayer(flagRef.current); flagRef.current = null }
      if (flagLat && flagLng) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center">
            <div style="background:#ef4444;color:#fff;font-weight:700;font-size:10px;padding:2px 6px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.6)">⛳ PIN</div>
            <div style="width:2px;height:10px;background:#ef4444"></div>
          </div>`,
          iconSize: [44, 28], iconAnchor: [22, 28],
        })
        flagRef.current = L.marker([flagLat, flagLng], { icon, interactive: false, zIndexOffset: 1000 }).addTo(map)
      }
    }
    draw()
  }, [flagLat, flagLng])

  // ── Start marker ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = async () => {
      const L = (await import('leaflet')).default
      if (startMarkerRef.current) { map.removeLayer(startMarkerRef.current); startMarkerRef.current = null }
      if (planStart && planStep === 'set-landing') {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #4ade80;box-shadow:0 0 0 3px rgba(74,222,128,0.35)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        })
        startMarkerRef.current = L.marker(planStart, { icon, interactive: false, zIndexOffset: 800 }).addTo(map)
      }
    }
    draw()
  }, [planStart, planStep])

  // ── Live shot line + pin line (updates on every map move) ─────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const update = async () => {
      const L = (await import('leaflet')).default
      const c = map.getCenter()

      const clearLines = () => {
        if (shotLineRef.current)  { map.removeLayer(shotLineRef.current);  shotLineRef.current  = null }
        if (shotLabelRef.current) { map.removeLayer(shotLabelRef.current); shotLabelRef.current = null }
        if (pinLineRef.current)   { map.removeLayer(pinLineRef.current);   pinLineRef.current   = null }
        if (pinLabelRef.current)  { map.removeLayer(pinLabelRef.current);  pinLabelRef.current  = null }
      }

      if (planStep === 'set-landing' && planStart) {
        // ── White dashed: start → crosshair (shot distance) ──
        const shotYds = haversineYds(planStart, [c.lat, c.lng])
        const mid     = [(planStart[0] + c.lat) / 2, (planStart[1] + c.lng) / 2] as [number, number]

        if (shotLineRef.current) {
          shotLineRef.current.setLatLngs([planStart, [c.lat, c.lng]])
        } else {
          shotLineRef.current = L.polyline([planStart, [c.lat, c.lng]], {
            color: '#fff', weight: 2.5, opacity: 0.9, dashArray: '6 4', interactive: false,
          }).addTo(map)
        }

        const shotHtml = `<div style="background:rgba(0,0,0,.8);color:#fff;font-weight:700;font-size:13px;padding:2px 7px;border-radius:6px;white-space:nowrap">${fmtYds(shotYds)}</div>`
        const shotIcon = L.divIcon({ className: '', html: shotHtml, iconSize: [60, 22], iconAnchor: [30, 11] })
        if (shotLabelRef.current) {
          shotLabelRef.current.setLatLng(mid); shotLabelRef.current.setIcon(shotIcon)
        } else {
          shotLabelRef.current = L.marker(mid, { icon: shotIcon, interactive: false, zIndexOffset: 500 }).addTo(map)
        }

        // ── Red dashed: crosshair → pin (distance to flag) ──
        if (flagLat && flagLng) {
          const pinYds   = haversineYds([c.lat, c.lng], [flagLat, flagLng])
          const pinMid   = [(c.lat + flagLat) / 2, (c.lng + flagLng) / 2] as [number, number]

          if (pinLineRef.current) {
            pinLineRef.current.setLatLngs([[c.lat, c.lng], [flagLat, flagLng]])
          } else {
            pinLineRef.current = L.polyline([[c.lat, c.lng], [flagLat, flagLng]], {
              color: '#f87171', weight: 1.5, opacity: 0.8, dashArray: '4 6', interactive: false,
            }).addTo(map)
          }

          const pinHtml = `<div style="background:rgba(0,0,0,.78);color:#f87171;font-weight:700;font-size:11px;padding:2px 6px;border-radius:5px;white-space:nowrap">${fmtYds(pinYds)} to pin</div>`
          const pinIcon = L.divIcon({ className: '', html: pinHtml, iconSize: [85, 18], iconAnchor: [42, 9] })
          if (pinLabelRef.current) {
            pinLabelRef.current.setLatLng(pinMid); pinLabelRef.current.setIcon(pinIcon)
          } else {
            pinLabelRef.current = L.marker(pinMid, { icon: pinIcon, interactive: false, zIndexOffset: 490 }).addTo(map)
          }
        }

      } else if (planStep === 'set-start' && flagLat && flagLng) {
        // ── During set-start, just show red line to pin ──
        const pinYds = haversineYds([c.lat, c.lng], [flagLat, flagLng])
        const pinMid = [(c.lat + flagLat) / 2, (c.lng + flagLng) / 2] as [number, number]

        if (pinLineRef.current) {
          pinLineRef.current.setLatLngs([[c.lat, c.lng], [flagLat, flagLng]])
        } else {
          pinLineRef.current = L.polyline([[c.lat, c.lng], [flagLat, flagLng]], {
            color: '#f87171', weight: 1.5, opacity: 0.8, dashArray: '4 6', interactive: false,
          }).addTo(map)
        }

        const pinHtml = `<div style="background:rgba(0,0,0,.78);color:#f87171;font-weight:700;font-size:11px;padding:2px 6px;border-radius:5px;white-space:nowrap">${fmtYds(pinYds)} to pin</div>`
        const pinIcon = L.divIcon({ className: '', html: pinHtml, iconSize: [85, 18], iconAnchor: [42, 9] })
        if (pinLabelRef.current) {
          pinLabelRef.current.setLatLng(pinMid); pinLabelRef.current.setIcon(pinIcon)
        } else {
          pinLabelRef.current = L.marker(pinMid, { icon: pinIcon, interactive: false, zIndexOffset: 490 }).addTo(map)
        }

        if (shotLineRef.current)  { map.removeLayer(shotLineRef.current);  shotLineRef.current  = null }
        if (shotLabelRef.current) { map.removeLayer(shotLabelRef.current); shotLabelRef.current = null }

      } else {
        clearLines()
      }
    }

    update()
    map.on('move', update)
    return () => { map.off('move', update) }
  }, [planStep, planStart, flagLat, flagLng])

  // ── Draw confirmed shot paths ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = async () => {
      const L = (await import('leaflet')).default
      confirmedRef.current.forEach(l => map.removeLayer(l))
      confirmedRef.current = []

      for (const shot of plannedShots) {
        // Shot line (amber dashed)
        const line = L.polyline([shot.startPos, shot.endPos], {
          color: '#f59e0b', weight: 2.5, opacity: 0.85, dashArray: '5 4', interactive: false,
        }).addTo(map)
        confirmedRef.current.push(line)

        // Landing marker with shot number + SG
        const sgStr  = (shot.sg >= 0 ? '+' : '') + shot.sg.toFixed(2)
        const sgClr  = shot.sg >= 0 ? '#4ade80' : '#f87171'
        const lIcon  = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="background:rgba(0,0,0,.82);border:2px solid #f59e0b;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;color:#f59e0b">${shot.shotNum}</div>
            <div style="background:rgba(0,0,0,.82);color:${sgClr};font-weight:700;font-size:10px;padding:1px 5px;border-radius:4px;white-space:nowrap">${sgStr}</div>
          </div>`,
          iconSize: [40, 36], iconAnchor: [20, 20],
        })
        const marker = L.marker(shot.endPos, { icon: lIcon, interactive: false, zIndexOffset: 700 }).addTo(map)
        confirmedRef.current.push(marker)
      }
    }
    draw()
  }, [plannedShots])

  return (
    <div ref={containerRef} className="absolute inset-0 z-0" style={{ touchAction: 'none' }} />
  )
}
