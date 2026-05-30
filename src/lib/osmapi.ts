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

  const b = `(${s},${w},${n},${e})`;
  
  // Query for comprehensive POIs around the location. 
  // We use the 3km bbox for everything, except railway=station which gets a 10km radius.
  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"primary|motorway"]${b};
      node["highway"~"bus_stop|platform"]${b};
      node["railway"="station"](around:10000, ${lat}, ${lng});
      way["railway"~"rail|narrow_gauge"]${b};
      node["power"~"tower|substation"]${b};
      node["man_made"~"tower|storage_tank|works"]${b};
      nw["landuse"~"cemetery|landfill|industrial"]${b};
      nw["amenity"~"grave_yard|waste_transfer_station|waste_disposal|marketplace"]${b};
      node["amenity"~"hospital|clinic|pharmacy|police|fire_station|school|university"]${b};
      node["amenity"~"restaurant|cafe|bank|atm"]["name"]${b};
      node["shop"~"mall|supermarket|convenience"]["name"]${b};
      way["waterway"~"river|canal|stream|drain"]${b};
      nw["natural"="water"]${b};
      nw["leisure"~"park|garden"]${b};
    );
    out center;
  `;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://api.openstreetmap.fr/oapi/interpreter"
  ];

  let res: Response | null = null;
  let text = "";
  let success = false;

  for (const endpoint of endpoints) {
    for (let i = 0; i < 2; i++) { // Max 2 attempts per mirror
      try {
        console.log(`[OSM] Trying ${endpoint} (Attempt ${i+1})...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25s per attempt
        
        res = await fetch(endpoint, {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        if (res.ok) {
          text = await res.text();
          // Check if it's a valid JSON with elements
          try {
            const parsed = JSON.parse(text);
            if (!parsed.remark && parsed.elements) {
              success = true;
              break;
            }
          } catch (e) {
            // Not valid JSON
          }
        }
        
        console.warn(`[OSM] ${endpoint} failed (status ${res?.status})`);
      } catch (e) {
        console.warn(`[OSM] Fetch error on ${endpoint}:`, e);
      }
      if (success) break;
      await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
    }
    if (success) break;
  }

  if (!success || !text) {
      console.error("Failed to fetch OSM data from all public mirrors after retries.");
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
