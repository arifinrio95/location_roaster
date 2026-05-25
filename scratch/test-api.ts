import dotenv from "dotenv";

dotenv.config();

const location = {
  lat: -6.3195,
  lng: 106.6835,
  displayName: "The Savia, Ciater, Serpong, Tangerang Selatan, Banten, Indonesia"
};

const amenities = [
  {
    type: "node",
    lat: -6.3188,
    lng: 106.6820,
    tags: {
      name: "Stasiun Sudimara",
      railway: "station"
    },
    distance: 450
  },
  {
    type: "node",
    lat: -6.3210,
    lng: 106.6840,
    tags: {
      name: "Pasar Modern BSD",
      shop: "supermarket"
    },
    distance: 300
  },
  {
    type: "node",
    lat: -6.3190,
    lng: 106.6830,
    tags: {
      name: "Sutet Tower Ciater",
      power: "tower"
    },
    distance: 120
  }
];

async function run() {
  console.log("Sending request to /api/roast...");
  try {
    const res = await fetch("http://localhost:3000/api/roast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ location, amenities })
    });
    console.log("Status:", res.status);
    const data = await res.json() as any;
    console.log("Result keys:", Object.keys(data));
    console.log("Score:", data.score);
    console.log("Sabda:", data.sabda);
    console.log("Verified Articles Count:", data.verifiedArticles?.length || 0);
    console.log("Verified Articles:", data.verifiedArticles);
    console.log("Receipts:", data.receipts);
  } catch (err: any) {
    console.error("Request failed:", err.message);
  }
}

run();
