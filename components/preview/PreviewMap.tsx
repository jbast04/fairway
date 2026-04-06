'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMap, TileLayer, Marker } from 'leaflet'
import type { CoursePolygon } from '@/lib/course-polygons'

const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS    = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

// Colour + opacity for each polygon type on the satellite base layer
const POLY_STYLE: Record<string, { color: string; fillOpacity: number }> = {
  fairway:      { color: '#4ade80', fillOpacity: 0.30 },
  bunker:       { color: '#fbbf24', fillOpacity: 0.55 },
  water_hazard: { color: '#60a5fa', fillOpacity: 0.55 },
  rough:        { color: '#166534', fillOpacity: 0.28 },
  green:        { color: '#86efac', fillOpacity: 0.42 },
  tee:          { color: '#d1d5db', fillOpacity: 0.38 },
}

interface Props {
  center:          [number, number]
  polygons:        CoursePolygon[]
  flagLat:         number | null
  flagLng:         number | null
  flyToLocation:   [number, number] | null
  onCenterChange:  (lat: number, lng: number) => void
}

export default function PreviewMap({
  center, polygons, flagLat, flagLng, flyToLocation, onCenterChange,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<LeafletMap | null>(null)
  const satRef        = useRef<TileLayer | null>(null)
  const labelsRef     = useRef<TileLayer | null>(null)
  const polyLayersRef = useRef<any[]>([])
  const flagRef       = useRef<Marker | null>(null)
  const lineRef       = useRef<any | null>(null)
  const lineLabelRef  = useRef<Marker | null>(null)

  // ── Init map ────────────────────────────────────────────────
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
      sat.addTo(map)
      labels.addTo(map)

      satRef.current    = sat
      labelsRef.current = labels
      mapRef.current    = map

      map.on('move', () => {
        const c = map.getCenter()
        onCenterChange(c.lat, c.lng)
      })
      onCenterChange(center[0], center[1])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── flyTo + panBy so green sits at top third ─────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToLocation) return
    map.flyTo(flyToLocation, 19, { animate: true, duration: 1.2 })
    const t = setTimeout(() => {
      const h = map.getSize().y
      map.panBy([0, Math.round(h / 3)], { animate: true })
    }, 1400)
    return () => clearTimeout(t)
  }, [flyToLocation])

  // ── Draw / redraw polygon overlays ───────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const draw = async () => {
      const L = (await import('leaflet')).default

      // Remove old layers
      polyLayersRef.current.forEach(l => map.removeLayer(l))
      polyLayersRef.current = []

      // Draw new polygons, lower z-index so they sit under markers
      for (const poly of polygons) {
        const style = POLY_STYLE[poly.type] ?? { color: '#ffffff', fillOpacity: 0.2 }
        const layer = L.polygon(poly.coords as any, {
          color: style.color, weight: 1.5, opacity: 0.85,
          fillColor: style.color, fillOpacity: style.fillOpacity,
          interactive: false,
        })
        layer.addTo(map)
        polyLayersRef.current.push(layer)
      }
    }
    draw()
  }, [polygons])

  // ── Flag marker ──────────────────────────────────────────────
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

  // ── Live line from crosshair to pin + distance label ─────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const fmtYards = (y: number) => y < 30 ? `${Math.round(y * 3)}ft` : `${Math.round(y)}y`

    const haversine = (a: [number, number], b: [number, number]) => {
      const R = 6371000
      const p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180
      const dp = (b[0] - a[0]) * Math.PI / 180, dl = (b[1] - a[1]) * Math.PI / 180
      const aa = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
      return Math.round(R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)) * 1.09361)
    }

    const update = async () => {
      const L = (await import('leaflet')).default
      const c = map.getCenter()

      if (flagLat && flagLng) {
        const yards = haversine([c.lat, c.lng], [flagLat, flagLng])
        const mid   = [(c.lat + flagLat) / 2, (c.lng + flagLng) / 2] as [number, number]

        if (lineRef.current) {
          lineRef.current.setLatLngs([[c.lat, c.lng], [flagLat, flagLng]])
        } else {
          lineRef.current = L.polyline([[c.lat, c.lng], [flagLat, flagLng]], {
            color: '#f87171', weight: 1.5, opacity: 0.75, dashArray: '5 6', interactive: false,
          }).addTo(map)
        }

        const html  = `<div style="background:rgba(0,0,0,.78);color:#f87171;font-weight:700;font-size:11px;padding:2px 6px;border-radius:5px;white-space:nowrap">${fmtYards(yards)} to pin</div>`
        const icon  = L.divIcon({ className: '', html, iconSize: [90, 18], iconAnchor: [45, 9] })
        if (lineLabelRef.current) {
          lineLabelRef.current.setLatLng(mid)
          lineLabelRef.current.setIcon(icon)
        } else {
          lineLabelRef.current = L.marker(mid, { icon, interactive: false, zIndexOffset: 500 }).addTo(map)
        }
      } else {
        if (lineRef.current)      { map.removeLayer(lineRef.current);      lineRef.current = null }
        if (lineLabelRef.current) { map.removeLayer(lineLabelRef.current); lineLabelRef.current = null }
      }
    }

    update()
    map.on('move', update)
    return () => { map.off('move', update) }
  }, [flagLat, flagLng])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ touchAction: 'none' }}
    />
  )
}
