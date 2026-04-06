/**
 * Fetch hole-center coordinates from OpenStreetMap (Overpass API).
 *
 * Strategy:
 *  1. Find the specific golf course polygon at the given lat/lng using map_to_area.
 *  2. Query for `golf=hole` ways INSIDE that polygon — these always carry a `ref`
 *     tag (hole number 1–18) and are guaranteed to belong to this course only.
 *  3. Return the center of each hole way, sorted by hole number.
 *
 * The center of a `golf=hole` way sits roughly mid-fairway between tee and green,
 * which is close enough for auto-zooming — the green is always within view.
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
  // Step 1: find the golf-course relation at these coordinates (tight 300 m radius
  //         so we never bleed into an adjacent course like Cypress Point).
  // Step 2: convert that relation to an Overpass area.
  // Step 3: find all golf=hole ways inside that area — they carry `ref` = hole number.
  const query = `[out:json][timeout:30];
relation["leisure"="golf_course"](around:300,${courseLat},${courseLng})->.r;
.r map_to_area ->.a;
way["golf"="hole"](area.a);
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
    // Overpass sometimes returns an HTML error page instead of JSON
    if (!text.trim().startsWith('{')) return []

    const data = JSON.parse(text)
    const coords: HoleCoords[] = []

    for (const el of data.elements ?? []) {
      const holeNum = parseInt(el.tags?.ref ?? '', 10)
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) continue

      // `out center` gives us the centroid of each way
      const lat = el.center?.lat
      const lng = el.center?.lon
      if (lat == null || lng == null) continue

      // Deduplicate — keep first match per hole number
      if (!coords.find(c => c.holeNumber === holeNum)) {
        coords.push({ holeNumber: holeNum, lat, lng })
      }
    }

    return coords.sort((a, b) => a.holeNumber - b.holeNumber)
  } catch {
    return []
  }
}
