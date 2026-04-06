/**
 * Fetch green-center coordinates for each hole from OpenStreetMap (Overpass API).
 * Returns an array of { holeNumber, lat, lng } sorted by hole number.
 * Returns an empty array if the course isn't in OSM or the request fails.
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
  // Search for golf greens within 3 km of the course center.
  // OSM greens usually have a `ref` tag equal to the hole number (1–18).
  const query = `[out:json][timeout:25];
(
  way["golf"="green"](around:3000,${courseLat},${courseLng});
  node["golf"="green"](around:3000,${courseLat},${courseLng});
);
out center tags;`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const coords: HoleCoords[] = []

    for (const el of data.elements ?? []) {
      // Hole number comes from the `ref` tag
      const holeNum = parseInt(el.tags?.ref ?? '', 10)
      if (isNaN(holeNum) || holeNum < 1 || holeNum > 18) continue

      // Nodes have lat/lon directly; ways have a center object after `out center`
      const lat = el.type === 'node' ? el.lat : el.center?.lat
      const lng = el.type === 'node' ? el.lon  : el.center?.lon
      if (lat == null || lng == null) continue

      // Avoid duplicates — keep the first one found for each hole
      if (!coords.find(c => c.holeNumber === holeNum)) {
        coords.push({ holeNumber: holeNum, lat, lng })
      }
    }

    return coords.sort((a, b) => a.holeNumber - b.holeNumber)
  } catch {
    return []
  }
}
