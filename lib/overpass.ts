/**
 * Fetch putting-green coordinates from OpenStreetMap (Overpass API).
 *
 * Strategy:
 *  1. Find the specific golf course polygon (map_to_area, 300 m radius).
 *  2. Fetch full geometry for both:
 *       a) way["golf"="green"] — actual putting-green polygons
 *       b) way["golf"="hole"]  — hole lines (tee → green or green → tee)
 *  3. Compute each green polygon's centroid from its node list.
 *  4. For each golf=hole way:
 *       - If a golf=green with a matching ref tag exists → use its centroid.
 *       - Otherwise examine BOTH endpoints of the hole way and pick whichever
 *         is nearest to ANY green polygon centroid — that end is the green.
 *  5. Fall back to hole-way centroid only if no greens exist at all.
 *
 * This works even when green polygons have no ref tag (like Pebble Beach).
 */

export interface HoleCoords {
  holeNumber: number
  lat: number
  lng: number
}

// Haversine distance in metres (fast, no imports needed here)
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Average lat/lng of a node list
function centroid(nodes: { lat: number; lon: number }[]): { lat: number; lng: number } | null {
  if (!nodes.length) return null
  const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length
  const lng = nodes.reduce((s, n) => s + n.lon, 0) / nodes.length
  return { lat, lng }
}

// Multiple public Overpass mirrors — tried in parallel, first success wins
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.karte.io/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

async function overpassFetch(query: string): Promise<string | null> {
  const body = 'data=' + encodeURIComponent(query)
  const tries = OVERPASS_MIRRORS.map(url =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(25000),
    })
      .then(r => r.text())
      .then(t => t.trim().startsWith('{') ? t : null)
      .catch(() => null)
  )
  // Return whichever mirror responds first with valid JSON
  return new Promise(resolve => {
    let settled = 0
    tries.forEach(p =>
      p.then(result => {
        if (result) { resolve(result); return }
        if (++settled === tries.length) resolve(null)
      })
    )
  })
}

export async function fetchHoleCoords(
  courseLat: number,
  courseLng: number,
): Promise<HoleCoords[]> {
  // ── localStorage cache — avoid re-fetching for the same course ──────────
  const cacheKey = `fw_holes_${courseLat.toFixed(4)}_${courseLng.toFixed(4)}`
  try {
    const cached = typeof window !== 'undefined' && localStorage.getItem(cacheKey)
    if (cached) {
      const parsed: HoleCoords[] = JSON.parse(cached)
      if (parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }

  // Use a simple around-radius query — no map_to_area needed and much faster.
  // 1000 m covers all 18 holes of most courses without bleeding into neighbours.
  const query = `[out:json][timeout:30];
(
  way["golf"="green"](around:3000,${courseLat},${courseLng});
  way["golf"="hole"](around:3000,${courseLat},${courseLng});
);
out geom tags;`

  try {
    const text = await overpassFetch(query)
    if (!text) return []
    const data = JSON.parse(text)

    // --- Separate greens and holes ---
    type GreenInfo = { ref: number | null; lat: number; lng: number }
    const greenList: GreenInfo[] = []

    type HoleInfo = {
      holeNumber: number
      nodes: { lat: number; lon: number }[]
    }
    const holeList: HoleInfo[] = []

    for (const el of data.elements ?? []) {
      const nodes: { lat: number; lon: number }[] = el.geometry ?? []
      if (!nodes.length) continue

      if (el.tags?.golf === 'green') {
        const c = centroid(nodes)
        if (!c) continue
        const ref = parseInt(el.tags?.ref ?? '', 10)
        greenList.push({ ref: isNaN(ref) ? null : ref, lat: c.lat, lng: c.lng })

      } else if (el.tags?.golf === 'hole') {
        const holeNum = parseInt(el.tags?.ref ?? '', 10)
        if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) continue
        holeList.push({ holeNumber: holeNum, nodes })
      }
    }

    // --- Resolve green coordinates for each hole ---
    const result: HoleCoords[] = []

    for (const hole of holeList) {
      // Already found this hole number?
      if (result.find(r => r.holeNumber === hole.holeNumber)) continue

      // 1) Exact ref match on a green polygon
      const exactGreen = greenList.find(g => g.ref === hole.holeNumber)
      if (exactGreen) {
        result.push({ holeNumber: hole.holeNumber, lat: exactGreen.lat, lng: exactGreen.lng })
        continue
      }

      // 2) Match by proximity: check both endpoints of the hole way against all greens
      if (greenList.length > 0) {
        const first = hole.nodes[0]
        const last  = hole.nodes[hole.nodes.length - 1]

        let bestEndpoint = first
        let bestDist = Infinity

        for (const g of greenList) {
          const dFirst = distM(first.lat, first.lon, g.lat, g.lng)
          const dLast  = distM(last.lat,  last.lon,  g.lat, g.lng)
          if (dFirst < bestDist) { bestDist = dFirst; bestEndpoint = first }
          if (dLast  < bestDist) { bestDist = dLast;  bestEndpoint = last  }
        }

        result.push({ holeNumber: hole.holeNumber, lat: bestEndpoint.lat, lng: bestEndpoint.lon })
        continue
      }

      // 3) No green polygons at all — fall back to hole way centroid
      const c = centroid(hole.nodes)
      if (c) result.push({ holeNumber: hole.holeNumber, lat: c.lat, lng: c.lng })
    }

    const sorted = result.sort((a, b) => a.holeNumber - b.holeNumber)

    // Cache for next time — avoids hitting Overpass on every round at this course
    try {
      if (typeof window !== 'undefined' && sorted.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(sorted))
      }
    } catch { /* ignore quota errors */ }

    return sorted
  } catch {
    return []
  }
}
