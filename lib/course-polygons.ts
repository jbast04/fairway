// ============================================================
// Course Polygon Fetcher + Lie Detector
//
// Fetches OSM golf polygon boundaries (fairway, bunker, water
// hazard, rough, green, tee) from the Overpass API and caches
// them in localStorage for 7 days.
//
// detectLie() runs a fast ray-casting point-in-polygon check
// against all cached polygons and returns the most specific
// lie type at a given lat/lng.
// ============================================================

import type { Lie } from '@/types'

// ============================================================
// Types
// ============================================================

export type PolygonType = 'fairway' | 'bunker' | 'water_hazard' | 'rough' | 'green' | 'tee'

export interface CoursePolygon {
  type: PolygonType
  ref: string | null          // OSM ref tag (hole number if present)
  coords: [number, number][]  // [lat, lng] pairs (closed ring)
}

// ============================================================
// Lie mapping + priority
// ============================================================

// When the crosshair is inside multiple overlapping polygons,
// the highest-priority type wins.
const LIE_PRIORITY: Record<PolygonType, number> = {
  tee:          1,
  rough:        2,
  fairway:      3,
  green:        4,
  water_hazard: 5,
  bunker:       6,   // bunker always wins — very specific
}

export function polygonTypeToLie(type: PolygonType): Lie {
  switch (type) {
    case 'bunker':       return 'sand'
    case 'water_hazard': return 'penalty'
    case 'green':        return 'green'
    case 'rough':        return 'rough'
    case 'tee':          return 'tee'
    default:             return 'fairway'
  }
}

// ============================================================
// Point-in-polygon — ray casting
// ============================================================

function pointInPolygon(lat: number, lng: number, coords: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [yi, xi] = coords[i]
    const [yj, xj] = coords[j]
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// ============================================================
// detectLie — returns the Lie at a given map position
// ============================================================

export function detectLie(lat: number, lng: number, polygons: CoursePolygon[]): Lie {
  let best: CoursePolygon | null = null
  let bestPriority = -1

  for (const poly of polygons) {
    if (poly.coords.length < 3) continue
    if (pointInPolygon(lat, lng, poly.coords)) {
      const priority = LIE_PRIORITY[poly.type]
      if (priority > bestPriority) {
        bestPriority = priority
        best = poly
      }
    }
  }

  // If outside all polygons, default to rough (off-course)
  return best ? polygonTypeToLie(best.type) : 'rough'
}

// ============================================================
// Overpass fetch helpers
// ============================================================

const OSM_GOLF_TAG_MAP: Record<string, PolygonType> = {
  fairway:      'fairway',
  bunker:       'bunker',
  water_hazard: 'water_hazard',
  rough:        'rough',
  green:        'green',
  tee:          'tee',
}

function buildQuery(lat: number, lng: number): string {
  return `
[out:json][timeout:30];
(
  way["golf"="fairway"](around:1500,${lat},${lng});
  way["golf"="bunker"](around:1500,${lat},${lng});
  way["golf"="water_hazard"](around:1500,${lat},${lng});
  way["golf"="rough"](around:1500,${lat},${lng});
  way["golf"="green"](around:1500,${lat},${lng});
  way["golf"="tee"](around:1500,${lat},${lng});
);
out geom;
  `.trim()
}

async function fetchFromMirror(url: string, query: string): Promise<CoursePolygon[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('Server returned HTML (busy)')

  const data: { elements: any[] } = JSON.parse(text)
  const polygons: CoursePolygon[] = []

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.geometry?.length) continue
    const golfTag = el.tags?.golf as string | undefined
    if (!golfTag || !OSM_GOLF_TAG_MAP[golfTag]) continue

    const coords: [number, number][] = el.geometry.map(
      (n: { lat: number; lon: number }) => [n.lat, n.lon] as [number, number]
    )
    if (coords.length < 3) continue

    polygons.push({
      type: OSM_GOLF_TAG_MAP[golfTag],
      ref:  el.tags?.ref ?? null,
      coords,
    })
  }

  return polygons
}

// ============================================================
// fetchCoursePolygons — main export
// ============================================================

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.karte.io/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000  // 7 days

function cacheKey(lat: number, lng: number): string {
  return `fw_polygons_${lat.toFixed(3)}_${lng.toFixed(3)}`
}

export async function fetchCoursePolygons(lat: number, lng: number): Promise<CoursePolygon[]> {
  // Try localStorage cache first
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng))
    if (raw) {
      const { data, ts } = JSON.parse(raw) as { data: CoursePolygon[]; ts: number }
      if (Date.now() - ts < CACHE_TTL) return data
    }
  } catch { /* ignore */ }

  const query = buildQuery(lat, lng)

  // Race all mirrors — use first successful response
  const results = await Promise.allSettled(
    MIRRORS.map(url => fetchFromMirror(url, query))
  )

  for (const r of results) {
    if (r.status === 'fulfilled') {
      try {
        localStorage.setItem(cacheKey(lat, lng), JSON.stringify({ data: r.value, ts: Date.now() }))
      } catch { /* ignore quota errors */ }
      return r.value
    }
  }

  // All mirrors failed — return empty (preview still shows distance/exp-strokes)
  return []
}
