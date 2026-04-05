'use client'

import { useEffect, useRef } from 'react'
import type { Shot } from '@/types'

interface Props {
  shots: Shot[]
}

export default function ReplayMap({ shots }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const validShots = shots.filter(s => s.start_lat && s.start_lng)
    if (!validShots.length) return

    const init = async () => {
      const L = (await import('leaflet')).default

      // Center on first shot
      const first = validShots[0]
      const map = L.map(containerRef.current!, {
        center: [first.start_lat!, first.start_lng!],
        zoom: 17,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20 }
      ).addTo(map)

      // Draw shots
      validShots.forEach((shot, i) => {
        const color = shot.sg !== null && shot.sg >= 0 ? '#4ade80' : '#f87171'

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:18px;height:18px;border-radius:50%;
            background:${color};border:2px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:700;color:#07100a
          ">${i + 1}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        })

        L.marker([shot.start_lat!, shot.start_lng!], { icon })
          .bindPopup(`Shot ${shot.shot_number} · H${shot.hole_number}<br>Club: ${shot.club ?? '—'}<br>SG: ${shot.sg?.toFixed(2) ?? '—'}`)
          .addTo(map)

        if (shot.end_lat && shot.end_lng) {
          L.polyline(
            [[shot.start_lat!, shot.start_lng!], [shot.end_lat, shot.end_lng]],
            { color, weight: 2, opacity: 0.8, dashArray: '4 4' }
          ).addTo(map)
        }
      })

      // Fit bounds
      const allPoints = validShots.flatMap(s => {
        const pts: [number, number][] = [[s.start_lat!, s.start_lng!]]
        if (s.end_lat && s.end_lng) pts.push([s.end_lat, s.end_lng])
        return pts
      })
      map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20] })
      mapRef.current = map
    }

    init()
  }, [shots])

  return <div ref={containerRef} className="h-full w-full" />
}
