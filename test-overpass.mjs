import fetch from "node-fetch";

const lat = -6.2;
const lng = 106.8;

const query = `
    [out:json][timeout:25];
    (
      way["highway"~"primary|motorway"](around:1000, ${lat}, ${lng});
      node["highway"~"bus_stop|platform"](around:5000, ${lat}, ${lng});
      node["railway"="station"](around:10000, ${lat}, ${lng});
      way["railway"~"rail|narrow_gauge"](around:5000, ${lat}, ${lng});
      node["power"~"tower|substation"](around:5000, ${lat}, ${lng});
      node["man_made"~"tower|storage_tank|works"](around:5000, ${lat}, ${lng});
      nwr["landuse"~"cemetery|landfill|industrial"](around:5000, ${lat}, ${lng});
      nwr["amenity"~"grave_yard|waste_transfer_station|waste_disposal|marketplace"](around:5000, ${lat}, ${lng});
      node["amenity"~"hospital|clinic|pharmacy|police|fire_station|school|university"](around:5000, ${lat}, ${lng});
      node["amenity"~"restaurant|cafe|bank|atm"]["name"](around:5000, ${lat}, ${lng});
      node["shop"~"mall|supermarket"](around:5000, ${lat}, ${lng});
      node["shop"="convenience"]["name"](around:5000, ${lat}, ${lng});
      way["waterway"~"river|canal|stream|drain"](around:5000, ${lat}, ${lng});
      nwr["natural"="water"](around:5000, ${lat}, ${lng});
      nwr["leisure"~"park|garden"](around:5000, ${lat}, ${lng});
    );
    out center;
  `;

async function run() {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "User-Agent": "LocationRoaster/1.0 (arifinrio95@gmail.com)",
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Response:", text.substring(0, 1000));
}

run();
