import fetch from "node-fetch";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Mock location (e.g. The Savia, BSD)
const location = {
  lat: -6.3195,
  lng: 106.6835,
  displayName: "The Savia, Ciater, Serpong, Tangerang Selatan, Banten, Indonesia"
};

async function getAreaDetails(lat: number, lng: number, locationDisplayName: string) {
  let displayName = locationDisplayName || "";
  let addr: Record<string, string> = {};
  
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "LocationRoaster/1.0 (arifinrio95@gmail.com)" }
    });
    if (r.ok) {
      const data = await r.json() as any;
      addr = data.address || {};
      if (!displayName) {
        displayName = data.display_name || "";
      }
    }
  } catch (err) {
    console.warn("Reverse geocode failed:", err);
  }

  const parts = displayName.split(",").map((p: string) => p.trim()).filter(Boolean);
  const smallest = parts[0] || addr.residential || addr.neighbourhood || addr.allotments || addr.road || "";
  const kelurahan = parts[1] || addr.suburb || addr.quarter || addr.village || addr.hamlet || "";
  const kecamatan = addr.city_district || addr.subdistrict || addr.town || addr.municipality || parts[3] || parts[2] || "";
  const full = parts.slice(0, 5).join(", ");
  
  return { smallest, kelurahan, kecamatan, full };
}

async function extractKelurahanKecamatan(locationDisplayName: string) {
  const prompt = `Ekstrak nama Kelurahan dan Kecamatan dari alamat berikut di Indonesia.
Format output wajib: "NamaKelurahan, NamaKecamatan" saja (contoh: "Maruga, Ciputat"). Jangan ada penjelasan lain, jangan ada kata pembuka atau penutup. Jika kelurahan atau kecamatan tidak dapat diidentifikasi secara pasti dari teks, tebak berdasarkan kemiripan nama daerah yang ada di teks alamat tersebut.

Alamat: ${locationDisplayName}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: prompt,
  });
  return response.text?.trim() || "";
}

async function runTest() {
  console.log("1. Running geocoding details...");
  const areaDetails = await getAreaDetails(location.lat, location.lng, location.displayName);
  console.log("Area Details:", areaDetails);

  console.log("\n2. Extracting Kelurahan, Kecamatan via Gemini...");
  const kelurahanKecamatan = await extractKelurahanKecamatan(location.displayName);
  console.log("Extracted:", kelurahanKecamatan);

  console.log("\n3. Generating Search Queries...");
  const topics = ["banjir", "bencana", "kriminal"];
  const queries = topics.map((topic) => `${kelurahanKecamatan} ${topic}`);
  console.log("Queries:", queries);

  console.log("\n4. Running Brave Search queries...");
  const searchResults = [];
  for (const q of queries) {
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`;
    const braveRes = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_API_KEY || ""
      }
    });
    if (braveRes.ok) {
      const data = await braveRes.json() as any;
      const results = data.web?.results ?? [];
      const hits = results.slice(0, 3).map((r: any) => ({
        url: r.url,
        title: r.title ?? "",
        desc: r.description ?? ""
      }));
      searchResults.push({ query: q, hits });
      console.log(`Query "${q}" -> ${hits.length} hits`);
      hits.forEach(h => console.log(`  - [${h.title}] ${h.url}`));
    } else {
      console.error(`Query "${q}" failed:`, braveRes.status);
    }
  }

  // Validate links logic
  console.log("\n5. Validating links...");
  const allUrls: string[] = [];
  searchResults.forEach(sr => {
    sr.hits.forEach(hit => {
      if (hit.url && !allUrls.includes(hit.url)) {
        allUrls.push(hit.url);
      }
    });
  });

  console.log(`Unique URLs to validate:`, allUrls);

  const results = await Promise.all(
    allUrls.map(async (url: string) => {
      try {
        const headRes = await fetch(url, {
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        console.log(`HEAD ${url} -> status: ${headRes.status}`);
        
        if (headRes.status === 200) {
          return { url, valid: true };
        }

        if (headRes.status === 403 || headRes.status === 405 || headRes.status === 400) {
          const getRes = await fetch(url, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          });
          console.log(`GET ${url} -> status: ${getRes.status}`);
          return { url, valid: getRes.status === 200 };
        }
        return { url, valid: false };
      } catch (e: any) {
        console.log(`Error checking ${url}:`, e.message);
        return { url, valid: false };
      }
    })
  );

  console.log("\nValidation Results:", results);
}

runTest();
