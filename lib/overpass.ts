/**
 * Fetch green coordinates from OpenStreetMap (Overpass API).
 *
 * Strategy:
 *  1. Find the specific golf course polygon at the given lat/lng using map_to_area.
 *  2. Query for `golf=hole` ways INSIDE that polygon.
 *  3. Request full geometry (`out geom`) so we get every node of each way.
 *  4. OSM convention: hole ways are drawn tee → green, so the LAST node is the
 *     green end. We use that as the fly-to target so the map lands on the green,
 *     not mid-fairway.
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
  const query = `[out:json][timeout:30];
relation["leisure"="golf_course"](around:300,${courseLat},${courseLng})->.r;
.r map_to_area ->.a;
way["golf"="hole"](area.a);
out geom tags;`

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
    const coords: HoleCoords[] = []

    for (const el of data.elements ?? []) {
      const holeNum = parseInt(el.tags?.ref ?? '', 10)
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) continue

      // Full node list — last node is the green end (OSM tee→green convention)
      const nodes: { lat: number; lon: number }[] = el.geometry ?? []
      if (nodes.length === 0) continue
      const greenNode = nodes[nodes.length - 1]

      // Deduplicate — keep first match per hole number
      if (!coords.find(c => c.holeNumber === holeNum)) {
        coords.push({ holeNumber: holeNum, lat: greenNode.lat, lng: greenNode.lon })
      }
    }

    return coords.sort((a, b) => a.holeNumber - b.holeNumber)
  } catch {
    return []
  }
}
