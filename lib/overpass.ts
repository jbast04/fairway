/**
 * Fetch putting-green coordinates from OpenStreetMap (Overpass API).
 *
 * Strategy:
 *  1. Find the specific golf course polygon at the given lat/lng (300 m radius,
 *     map_to_area so we never bleed into adjacent courses like Cypress Point).
 *  2. Query BOTH:
 *       a) way["golf"="green"] — the actual putting-green polygons (most accurate)
 *       b) way["golf"="hole"]  — fallback for courses without mapped greens
 *  3. For each hole number, prefer the green-polygon centroid; fall back to the
 *     hole-way centroid if no green polygon is found for that number.
 *
 * This avoids the "which end is the green?" ambiguity of hole ways, which are
 * drawn in both directions by different OSM contributors.
 *
 * Falls back to an empty array on any error or if the course isn't in OSM.
 */

export interface HoleCoords {
  holeNumber: number
  lat: number
  lng: number
}

export async function fetchHoleCoords(
  courseLat: number,
  courseLng: number,
): Promise<HoleCoords[]> {
  // Fetch green polygons (accurate) AND hole ways (fallback) in one request
  const query = `[out:json][timeout:30];
relation["leisure"="golf_course"](around:300,${courseLat},${courseLng})->.r;
.r map_to_area ->.a;
(
  way["golf"="green"]["ref"](area.a);
  way["golf"="hole"](area.a);
);
out center tags;`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(35000),
    })
    if (!res.ok) return []

    const text = await res.text()
    if (!text.trim().startsWith('{')) return []

    const data = JSON.parse(text)

    // Separate greens (accurate) from hole ways (fallback)
    const greenCoords = new Map<number, HoleCoords>()
    const holeCoords  = new Map<number, HoleCoords>()

    for (const el of data.elements ?? []) {
      const holeNum = parseInt(el.tags?.ref ?? '', 10)
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) continue
      const lat = el.center?.lat
      const lng = el.center?.lon
      if (lat == null || lng == null) continue

      if (el.tags?.golf === 'green' && !greenCoords.has(holeNum)) {
        greenCoords.set(holeNum, { holeNumber: holeNum, lat, lng })
      } else if (el.tags?.golf === 'hole' && !holeCoords.has(holeNum)) {
        holeCoords.set(holeNum, { holeNumber: holeNum, lat, lng })
      }
    }

    // Merge: prefer green polygon; fall back to hole way center
    const result: HoleCoords[] = []
    for (let i = 1; i <= 18; i++) {
      const coord = greenCoords.get(i) ?? holeCoords.get(i)
      if (coord) result.push(coord)
    }

    return result
  } catch {
    return []
  }
}
