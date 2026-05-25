import fetch from "node-fetch";

async function run() {
  const lat = -6.2;
  const lng = 106.8;
  const query = `
    [out:json][timeout:25];
    (
      way["highway"~"primary|secondary|motorway"](around:1000, ${lat}, ${lng});
      way["highway"~"residential|tertiary"](around:500, ${lat}, ${lng});
      node["highway"~"bus_stop|platform"](around:1500, ${lat}, ${lng});
      node["railway"="station"](around:3000, ${lat}, ${lng});
      way["railway"~"rail|narrow_gauge"](around:1000, ${lat}, ${lng});
      node["power"~"tower|substation"](around:1500, ${lat}, ${lng});
      node["man_made"~"tower|storage_tank|works"](around:1500, ${lat}, ${lng});
      nwr["landuse"~"cemetery|landfill|industrial"](around:1500, ${lat}, ${lng});
      nwr["amenity"~"grave_yard|waste_transfer_station|waste_disposal|marketplace"](around:1500, ${lat}, ${lng});
      node["amenity"~"hospital|clinic|pharmacy|police|fire_station|school|university|restaurant|cafe|bank|atm"](around:1500, ${lat}, ${lng});
      node["shop"~"mall|supermarket|convenience"](around:2000, ${lat}, ${lng});
      way["waterway"~"river|canal|stream|drain"](around:1000, ${lat}, ${lng});
      nwr["natural"="water"](around:1000, ${lat}, ${lng});
      nwr["leisure"~"park|garden"](around:1500, ${lat}, ${lng});
    );
    out center;
  `;
  const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
    method: "POST",
    headers: {
       "User-Agent": "RoasterApplet/1.0"
    },
    body: `data=${encodeURIComponent(query)}`
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text.substring(0, 300));
}

run();
