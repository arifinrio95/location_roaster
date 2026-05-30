export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export async function fetchOsmNearAmenities(latParam: number, lngParam: number) {
  const lat = Number(latParam);
  const lng = Number(lngParam);
  
  if (isNaN(lat) || isNaN(lng)) {
      console.error("fetchOsmNearAmenities called with invalid coordinates", latParam, lngParam);
      return [];
  }

  // Calculate 3000m bounding box
  const deltaLat = 3000 / 111000;
  const deltaLng = 3000 / (111000 * Math.cos(lat * Math.PI / 180));
  
  const s = lat - deltaLat;
  const n = lat + deltaLat;
  const w = lng - deltaLng;
  const e = lng + deltaLng;

  // Query for comprehensive POIs around the location using bounding box for performance
  const query = `
    [out:json][timeout:25][bbox:${s},${w},${n},${e}];
    (
      way["highway"~"primary|motorway"];
      node["highway"~"bus_stop|platform"];
      node["railway"="station"];
      way["railway"~"rail|narrow_gauge"];
      node["power"~"tower|substation"];
      node["man_made"~"tower|storage_tank|works"];
      nw["landuse"~"cemetery|landfill|industrial"];
      nw["amenity"~"grave_yard|waste_transfer_station|waste_disposal|marketplace"];
      node["amenity"~"hospital|clinic|pharmacy|police|fire_station|school|university"];
      node["amenity"~"restaurant|cafe|bank|atm"]["name"];
      node["shop"~"mall|supermarket|convenience"]["name"];
      way["waterway"~"river|canal|stream|drain"];
      nw["natural"="water"];
      nw["leisure"~"park|garden"];
    );
    out center;
  `;
  let res: Response | null = null;
  let text = "";
  for (let i = 0; i < 3; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s per attempt
      res = await fetch("/api/overpass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      text = await res.text();
      if (res.ok && !text.includes("Starting Server...")) {
         break;
      }
      // Any failure (HTTP error or "Starting Server...") — wait and retry
      const waitMs = text.includes("Starting Server...") ? 2000 : 1500 * (i + 1);
      console.warn(`Overpass attempt ${i+1} failed (status ${res?.status}), retrying in ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    } catch (e) {
      console.warn(`Fetch err on attempt ${i+1}:`, e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!res || !res.ok || text.includes("Starting Server...")) {
      console.error("Failed to fetch OSM data after retries:", text?.substring(0, 200));
      return [];
  }

  let data;
  try {
      data = JSON.parse(text);
  } catch (e: any) {
      console.error("OSM error parsing JSON. Response text:", text.substring(0, 500));
      return [];
  }

  if (!data || !data.elements) {
    console.error("OSM error: No elements in response", data);
    return [];
  }

  return data.elements
    .filter((e: any) => {
      // Skip elements with no usable coordinates
      const eLat = e.lat ?? e.center?.lat;
      const eLon = e.lon ?? e.center?.lon;
      return eLat !== undefined && eLon !== undefined && !isNaN(eLat) && !isNaN(eLon);
    })
    .map((e: any) => {
      const eLat = e.lat ?? e.center?.lat;
      const eLon = e.lon ?? e.center?.lon;
      return {
        ...e,
        lat: eLat,
        lng: eLon,
        distance: calculateDistance(lat, lng, eLat, eLon)
      };
    });
}

export async function searchNominatim(query: string) {
  try {
    const res = await fetch(`/api/nominatim?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Nominatim error", err);
    return [];
  }
}
