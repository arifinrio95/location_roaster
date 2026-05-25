import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { LocationResult, OsmAmenity, RoastResult, ReceiptData, VerifiedArticle } from "./src/types";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy for Nominatim to avoid CORS and 429 on client side
  app.get("/api/nominatim", async (req, res) => {
    const { q } = req.query;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q as string)}&format=json&polygon_geojson=1&countrycodes=id&limit=5&email=arifinrio95@gmail.com`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "LocationRoaster/1.0 (arifinrio95@gmail.com)",
          "Referer": "https://ais-dev-oa66dehby5nyn7qnjvn6ei-61645111465.asia-east1.run.app"
        }
      });
      
      if (response.status === 429) {
        return res.status(429).json({ error: "Too many requests to Nominatim" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Nominatim proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Nominatim" });
    }
  });

  // Reverse geocode: lat/lng → kelurahan/kecamatan name via Nominatim
  app.get("/api/reverse-geocode", async (req, res) => {
    const { lat, lng } = req.query;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`;
      const r = await fetch(url, {
        headers: { "User-Agent": "LocationRoaster/1.0 (arifinrio95@gmail.com)" }
      });
      if (!r.ok) return res.status(r.status).json({ error: "Nominatim error" });
      res.json(await r.json());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Proxy for Overpass API
  app.post("/api/overpass", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Missing query" });
      }
      
      let response;
      // 1. Try overpass-api.de first (best reliability/uptime)
      try {
        const ctrl1 = new AbortController();
        const t1 = setTimeout(() => ctrl1.abort(), 35000); // 35s timeout
        response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "User-Agent": "LocationRoasterApplet/1.0 (arifinrio95@gmail.com)",
            "Content-Type": "application/x-www-form-urlencoded"
          },
          signal: ctrl1.signal,
        });
        clearTimeout(t1);
      } catch (err) {
        console.warn("DE fetch failed completely", err);
      }
      
      // 2. Fallback to kumi.systems
      if (!response || !response.ok) {
         console.warn("overpass-api.de failed, falling back to overpass.kumi.systems");
         try {
            const ctrl2 = new AbortController();
            const t2 = setTimeout(() => ctrl2.abort(), 20000); // 20s timeout
            response = await fetch("https://overpass.kumi.systems/api/interpreter", {
               method: "POST",
               body: `data=${encodeURIComponent(query)}`,
               headers: {
                 "User-Agent": "LocationRoasterApplet/1.0 (arifinrio95@gmail.com)",
                 "Content-Type": "application/x-www-form-urlencoded"
               },
               signal: ctrl2.signal,
            });
            clearTimeout(t2);
         } catch (err) {
            console.warn("Kumi fetch failed completely", err);
         }
      }
      
      // 3. Fallback to openstreetmap.ru
      if (!response || !response.ok) {
         console.warn("overpass.kumi.systems failed, falling back to overpass.openstreetmap.ru");
         try {
            const ctrl3 = new AbortController();
            const t3 = setTimeout(() => ctrl3.abort(), 20000); // 20s timeout
            response = await fetch("https://overpass.openstreetmap.ru/api/interpreter", {
               method: "POST",
               body: `data=${encodeURIComponent(query)}`,
               headers: {
                 "User-Agent": "LocationRoasterApplet/1.0 (arifinrio95@gmail.com)",
                 "Content-Type": "application/x-www-form-urlencoded"
               },
               signal: ctrl3.signal,
            });
            clearTimeout(t3);
         } catch (err) {
            console.warn("RU fetch failed completely", err);
         }
      }
      
      if (!response) {
        return res.status(500).json({ error: "All Overpass endpoints failed to resolve." });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Overpass API error: ${response.status} ${response.statusText}`, errorText);
        return res.status(response.status).json({ error: "Overpass API failure", detail: errorText });
      }
      
      const responseText = await response.text();
      try {
        const data = JSON.parse(responseText);
        res.json(data);
      } catch (err: any) {
        console.error("Overpass JSON parse error. Raw response:", responseText.substring(0, 500));
        res.status(500).json({ error: "Invalid JSON from Overpass", detail: err.message, raw: responseText.substring(0, 200) });
      }
    } catch (error: any) {
      console.error("Overpass proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Overpass", detail: error.message, stack: error.stack });
    }
  });

  // Helper function for Brave Search
  async function executeSearch(query: string): Promise<any[]> {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      console.warn("BRAVE_API_KEY is missing from environment. Using empty results.");
      return [];
    }
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    try {
      const braveRes = await fetch(searchUrl, {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey
        }
      });
      if (!braveRes.ok) {
        console.error(`Brave search failed for "${query}": ${braveRes.status} ${braveRes.statusText}`);
        return [];
      }
      const data = await braveRes.json() as any;
      const results = data.web?.results ?? [];
      return results.slice(0, 3).map((r: any) => ({
        url: r.url,
        title: r.title ?? "",
        desc: r.description ?? ""
      }));
    } catch (err) {
      console.error(`Brave search failed for "${query}":`, err);
      return [];
    }
  }

  // Proxy for Brave Search / DuckDuckGo
  app.get("/api/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        console.warn("[API SEARCH] Missing search query");
        return res.status(400).json({ error: "Missing query" });
      }

      const hits = await executeSearch(q as string);
      if (hits.length > 0) {
        return res.json({ results: hits, url: hits[0].url, title: hits[0].title });
      }
      res.status(404).json({ error: "Not found" });
    } catch (e: any) {
      console.error("[API SEARCH] Unexpected error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Server-side link validation helper to verify HTTP 200
  async function validateUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const headRes = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
      });
      clearTimeout(timeout);
      
      console.log(`[validateUrl] HEAD ${url} -> status ${headRes.status}`);
      if (headRes.status >= 200 && headRes.status < 300) {
        return true;
      }
    } catch (e: any) {
      console.log(`[validateUrl] HEAD ${url} -> failed/timeout: ${e.message}`);
    }

    // Fallback to GET request
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);
      const getRes = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
      });
      clearTimeout(timeout2);
      const valid = getRes.status >= 200 && getRes.status < 300;
      console.log(`[validateUrl] GET fallback ${url} -> status ${getRes.status} -> valid: ${valid}`);
      return valid;
    } catch (e: any) {
      console.log(`[validateUrl] GET fallback ${url} -> failed/timeout: ${e.message}`);
      return false;
    }
  }

  // Server-side link validation to verify HTTP 200 and bypass CORS
  app.post("/api/validate-links", async (req, res) => {
    try {
      const { links } = req.body;
      if (!Array.isArray(links)) {
        console.warn("[API VALIDATOR] links parameter is not an array");
        return res.status(400).json({ error: "links must be an array" });
      }

      console.log(`[API VALIDATOR] Validating ${links.length} URLs...`);

      const results = await Promise.all(
        links.map(async (url: string) => {
          const valid = await validateUrl(url);
          return { url, valid };
        })
      );
      res.json(results);
    } catch (e: any) {
      console.error("[API VALIDATOR] Unexpected error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Concurrency Task Queue Manager (concurrency = 1)
  class TaskQueue {
    private queue: (() => Promise<void>)[] = [];
    private running = false;

    async add<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
        this.next();
      });
    }

    private async next() {
      if (this.running || this.queue.length === 0) return;
      this.running = true;
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (err) {
          console.error("[TaskQueue] Error running task:", err);
        }
      }
      this.running = false;
      this.next();
    }
  }

  const roastQueue = new TaskQueue();

  // Location Roasting Pipeline Types & Helper Functions
  interface AreaDetails {
    smallest: string;
    kelurahan: string;
    kecamatan: string;
    full: string;
    searchBase: string;
  }

  let aiClient: GoogleGenAI | null = null;
  function getGenAI(): GoogleGenAI {
    if (!aiClient) {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing");
      }
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return aiClient;
  }

  async function getAreaDetails(lat: number, lng: number, locationDisplayName: string): Promise<AreaDetails> {
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
      console.warn("Reverse geocode failed, falling back to locationDisplayName:", err);
    }

    const parts = displayName.split(",").map((p: string) => p.trim()).filter(Boolean);
    const smallest = parts[0] || addr.residential || addr.neighbourhood || addr.allotments || addr.road || "";
    const kelurahan = parts[1] || addr.suburb || addr.quarter || addr.village || addr.hamlet || "";
    const kecamatan = addr.city_district || addr.subdistrict || addr.town || addr.municipality || parts[3] || parts[2] || "";
    const full = parts.slice(0, 5).join(", ");
    
    let subdistrictIndex = -1;
    const kecamatanLower = kecamatan.toLowerCase().trim();
    if (kecamatanLower) {
      subdistrictIndex = parts.findIndex(p => {
        const pl = p.toLowerCase().trim();
        return pl.includes(kecamatanLower) || kecamatanLower.includes(pl);
      });
    }
    
    if (subdistrictIndex === -1) {
      const city = addr.city || addr.county || addr.state || "";
      const cityLower = city.toLowerCase().trim();
      if (cityLower) {
        const cityIndex = parts.findIndex(p => {
          const pl = p.toLowerCase().trim();
          return pl.includes(cityLower) || cityLower.includes(pl);
        });
        if (cityIndex > 0) {
          subdistrictIndex = cityIndex - 1;
        }
      }
    }

    if (subdistrictIndex === -1) {
      subdistrictIndex = Math.min(parts.length - 1, 3);
    }

    const searchBase = parts.slice(0, subdistrictIndex + 1).join(", ");
    
    return { smallest, kelurahan, kecamatan, full, searchBase };
  }

  async function extractKelurahanKecamatan(locationDisplayName: string): Promise<string> {
    const genAI = getGenAI();
    const prompt = `Ekstrak nama Kelurahan dan Kecamatan dari alamat berikut di Indonesia.
Format output wajib: "NamaKelurahan, NamaKecamatan" saja (contoh: "Maruga, Ciputat"). Jangan ada penjelasan lain, jangan ada kata pembuka atau penutup. Jika kelurahan atau kecamatan tidak dapat diidentifikasi secara pasti dari teks, tebak berdasarkan kemiripan nama daerah yang ada di teks alamat tersebut.

Alamat: ${locationDisplayName}`;

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
      });
      return response.text?.trim() || "";
    } catch (err) {
      console.error("Failed to extract Kelurahan/Kecamatan using LLM:", err);
      const parts = locationDisplayName.split(',').map(p => p.trim());
      return `${parts[1] || ""}, ${parts[2] || ""}`;
    }
  }

  function generateSearchQueries(kelurahanKecamatan: string): string[] {
    const topics = ["banjir", "bencana", "kriminal"];
    return topics.map((topic) => `${kelurahanKecamatan} ${topic}`);
  }

  interface BraveHit {
    url: string;
    title: string;
    desc: string;
  }
  interface SearchResult {
    query: string;
    hits: BraveHit[];
  }

  async function searchAllQueries(queries: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const q of queries) {
      try {
        const hits = await executeSearch(q);
        results.push({ query: q, hits });
      } catch (err) {
        console.error(`Search for query "${q}" failed:`, err);
      }
      // Add a 1000ms delay to respect Brave Search rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return results.filter((r) => r.hits.length > 0);
  }

  function getPoiTag(tags: Record<string, string>): string {
    const primaryKeys = ["amenity", "shop", "highway", "power", "landuse", "waterway", "leisure", "man_made", "railway"];
    for (const k of primaryKeys) {
      if (tags[k]) {
        return `${k}=${tags[k]}`;
      }
    }
    return "misc";
  }

  function deduplicatePOIs(amenities: OsmAmenity[]): OsmAmenity[] {
    const seen = new Set<string>();
    const result: OsmAmenity[] = [];
    
    const sorted = [...amenities].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    for (const a of sorted) {
      const name = a.tags?.name || "Unnamed";
      const tag = getPoiTag(a.tags || {});
      const key = `${name.toLowerCase()}|${tag.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(a);
      }
    }
    return result;
  }

  function filterPOIs(amenities: OsmAmenity[]): OsmAmenity[] {
    return amenities.filter((p) => {
      const t = p.tags || {};
      const dist = p.distance ?? 99999;
      
      if (t.railway==='station' || t.amenity==='bus_station' || t.highway==='bus_stop' || t.highway==='platform') {
        return true;
      }
      if (t.amenity==='hospital' || t.amenity==='school' || t.amenity==='university' || t.amenity==='clinic' || t.amenity==='pharmacy') {
        return dist < 3000;
      }
      if (t.shop || t.amenity==='restaurant' || t.amenity==='cafe' || t.amenity==='mall' || t.amenity==='food_court' || t.amenity==='bank' || t.amenity==='atm' || t.amenity==='marketplace') {
        return dist < 3000;
      }
      if (t.power==='tower' || t.power==='substation' || t.man_made==='tower' || t.amenity==='waste_transfer_station' || t.landuse==='landfill' || t.amenity==='waste_disposal' || t.railway==='rail' || t.railway==='narrow_gauge' || t.landuse==='industrial' || t.man_made==='works' || t.waterway || t.landuse==='cemetery' || t.amenity==='grave_yard') {
        if (t.landuse==='cemetery' || t.amenity==='grave_yard') {
          return dist <= 1000;
        }
        return dist < 3000;
      }
      if (t.natural==='water' || t.leisure==='park' || t.leisure==='garden') {
        return dist < 3000;
      }
      if (t.highway) {
        return t.highway === 'primary';
      }
      return false;
    });
  }

  async function runMainAnalysis(
    genAI: GoogleGenAI,
    location: LocationResult,
    areaDetails: AreaDetails,
    osmContext: string,
    searchResults: SearchResult[]
  ): Promise<RoastResult> {
    const articleLines: string[] = [];
    let idx = 1;
    const articleMap: Record<number, BraveHit> = {};

    for (const sr of searchResults) {
      for (const hit of sr.hits) {
        articleLines.push(
          `[${idx}] TITLE: ${hit.title}\n    URL: ${hit.url}\n    SNIPPET: ${hit.desc}`
        );
        articleMap[idx] = hit;
        idx++;
      }
    }

    const articlesBlock =
      articleLines.length > 0
        ? articleLines.join("\n\n")
        : "Tidak ada artikel berita yang ditemukan dari pencarian.";

    const targetLocal = areaDetails.smallest || areaDetails.kelurahan || location.displayName.split(',')[0].trim();
    const targetKelurahan = areaDetails.kelurahan || "tidak terdeteksi";
    const targetKecamatan = areaDetails.kecamatan || "tidak terdeteksi";

    const prompt = `Kamu adalah 'Location Roaster', AI yang mengevaluasi lokasi properti di Indonesia secara sarkas, jujur, elitis, namun tetap objektif dan gaul ala anak Jaksel. Analisis lokasi ini:

Nama area (full): ${areaDetails.full || location.displayName}
Lokasi Spesifik Terkecil (Perumahan/Cluster/Jalan/Kelurahan): ${targetLocal}
Kelurahan: ${targetKelurahan}
Kecamatan: ${targetKecamatan}
Koordinat: ${location.lat}, ${location.lng}

=== DATA GEOSPASIAL (OSM) ===
${osmContext}

=== ARTIKEL BERITA NYATA (dari Brave Search) ===
${articlesBlock}

=== INSTRUKSI ===
BAHASA (MUTLAK): Semua teks narasi (roastParagraph, prosParagraph, sabda) WAJIB ditulis dalam Bahasa Indonesia yang santai, kocak, sarkastik, dengan campuran slang bahasa Inggris ala anak Jakarta Selatan (Jaksel slang seperti 'which is', 'literally', 'vibes', 'prefer', 'worth it', 'tbh', 'mentally', 'socially', 'anxiety', 'aesthetic', dll.). DILARANG KERAS menulis narasi dalam Bahasa Inggris penuh (NO FULL ENGLISH AT ALL). Tulis narasi seolah-olah kamu adalah anak Jaksel gaul dan elit yang sedang menertawakan pilihan perumahan tersebut tapi tetap menyajikan data spasial secara cerdas.


PENTING:
- Narasi untuk roastParagraph dan prosParagraph HARUS dibuat sangat panjang, komprehensif, mendalam, dan detail sedetail-detailnya. DILARANG menggunakan kalimat pendek atau ringkasan sederhana; jabarkan setiap aspek lingkungan secara mendalam dan detail sedetail-detailnya.
- Fokuskan narasi ngeroast (roastParagraph) dan kelebihan (prosParagraph) secara spesifik pada level lokasi spesifik terkecil yaitu '${targetLocal}'. BUKAN pada level Kecamatan ('${targetKecamatan}'), kota, atau area di atas level Kelurahan (seperti 'BSD City'). Sebutkan nama lokasi terkecil '${targetLocal}' secara spesifik beberapa kali dalam narasi agar terasa personal, sangat akurat, dan super lokal.
- JANGAN PERNAH menyamakan atau mencampuradukkan '${targetLocal}' dengan area yang lebih luas seperti 'BSD City' atau 'Serpong' di dalam narasi utama. Kamu dilarang membahas BSD City/Serpong secara umum seolah-olah itu adalah nama cluster/kelurahan yang sedang dibahas. Gunakan nama '${targetLocal}' (misalnya "The Savia" atau "Maruga") sebagai subjek utama di setiap paragraf narasi Anda.
- Di bagian kelebihan (prosParagraph), kamu WAJIB mengutamakan pembahasan pada fasilitas/POI yang paling bagus, populer, prestisius, atau menarik (seperti Mall besar, cafe/restoran terkenal, stasiun/transportasi penting, sekolah/universitas ternama, atau taman yang bagus) yang tertera pada data geospasial OSM di atas. JANGAN hanya menyebutkan POI yang secara fisik paling dekat jika POI tersebut kurang penting atau kurang bernilai (misalnya, lebih baik membahas mall besar/cafe hits yang berjarak 1km daripada sekadar warung kelontong/toko kecil yang berjarak 100m). Highlight nilai tambah dan kualitas dari POI terbaik tersebut.
- Kamu WAJIB menganalisis dan menyebutkan keberadaan Makam/Pemakaman (cemetery/grave_yard) jika jaraknya kurang dari atau sama dengan 1 km (1000m) dari lokasi, serta fasilitas pengelolaan sampah (waste_disposal/landfill/waste_transfer_station) jika terdeteksi di atas sebagai bahan ngeroast utama. Jika makam berjarak lebih dari 1 km, abaikan saja dan tidak usah dibahas karena terlalu jauh.
- Kamu WAJIB menyebutkan nama Jalan Raya Utama/Tol (highway=primary) terdekat beserta jaraknya di dalam narasi (misal di bagian ngeroast terkait kebisingan/polusi, atau di bagian pros terkait kemudahan aksesibilitas).
- Kamu WAJIB menyebutkan secara spesifik jumlah fasilitas (ada berapa banyak) dan jarak terdekatnya (dalam meter atau km) ke: Mall/Supermarket (shop=mall/supermarket), Rumah Sakit/Klinik (amenity=hospital/clinic), Sekolah/Universitas (amenity=school/university), serta tempat nongkrong/Cafe/Restoran (amenity=cafe/restaurant/food_court) terdekat yang tertera pada data geospasial OSM di atas. Gunakan nama, tag, dan data jarak kuantitatif ini di dalam roastParagraph dan prosParagraph untuk memperkuat analisis Anda.

NARASI:
- roastParagraph: 4-5 paragraf yang sangat panjang, detail abis, dan mendalam sedetail-detailnya yang meroast secara sarkas habis-habisan kekurangan/sisi negatif dari lokasi '${targetLocal}' ini. Setiap paragraf harus panjang, berisi argumen yang tajam dan detail terperinci berdasarkan data OSM serta artikel berita di atas. Jangan ragu untuk mendeskripsikan setiap permasalahan secara panjang lebar dan detail sedetail-detailnya.
- prosParagraph: 2-3 paragraf yang sangat panjang, detail abis, dan mendalam sedetail-detailnya yang menjabarkan kelebihan, kemudahan hidup, kenyamanan akses, tempat nongkrong, atau poin positif ('silver lining') dari lokasi '${targetLocal}' ini (misal dekat KRL, mall, cafe-cafe hits, sekolah bagus, atau taman hijau terdekat) berdasarkan data OSM yang ada. Setiap paragraf harus dikembangkan secara detail sedetail-detailnya agar analisis seimbang dan informatif.
- sabda: 1 kalimat pembuka yang pedas, sinis, elitis, dan sangat Jaksel.

SCORE:
- score: 0–100 (livability, 0=neraka, 100=surga)
- dimensions: skor 0–100 per dimensi BERDASARKAN data OSM yang diberikan

RECEIPTS (KRITIS):
- Untuk setiap receipt, WAJIB memilih salah satu URL dari daftar artikel di atas [1], [2], dst.
- Salin title dan URL PERSIS seperti yang tertulis di atas — JANGAN ubah atau karang URL baru.
- Pilih artikel yang paling relevan dengan category-nya.
- Jika tidak ada artikel yang cocok untuk suatu category, jangan buat receipt untuk itu.
- Maksimal 6 receipts, hanya dari artikel yang benar-benar relevan.

Return JSON sesuai schema.`;

    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Livability score 0–100" },
            dimensions: {
              type: Type.OBJECT,
              properties: {
                banjir:        { type: Type.NUMBER, description: "Flood safety 0–100" },
                kriminal:      { type: Type.NUMBER, description: "Crime safety 0–100" },
                macet:         { type: Type.NUMBER, description: "Traffic ease 0–100" },
                akses_transit: { type: Type.NUMBER, description: "Transit access 0–100" },
                polusi_gaib:   { type: Type.NUMBER, description: "Hazard/pollution safety 0–100" },
              },
              required: ["banjir", "kriminal", "macet", "akses_transit", "polusi_gaib"],
            },
            roastParagraph: { type: Type.STRING },
            prosParagraph:  { type: Type.STRING },
            sabda:          { type: Type.STRING },
            receipts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING, description: "banjir|begal|macet|sutet|krl|kuburan|sampah" },
                  title:    { type: Type.STRING, description: "Copy exact title from the article list above" },
                  source:   { type: Type.STRING, description: "News source name, e.g. Detik, Kompas" },
                  link:     { type: Type.STRING, description: "Copy exact URL from the article list above — no modifications" },
                  lat:      { type: Type.NUMBER },
                  lng:      { type: Type.NUMBER },
                },
                required: ["category", "title", "source", "link", "lat", "lng"],
              },
            },
          },
          required: ["score", "dimensions", "roastParagraph", "prosParagraph", "sabda", "receipts"],
        },
      },
    });

    const text = response.text || "{}";
    let result: RoastResult;
    try {
      result = JSON.parse(text) as RoastResult;
    } catch {
      console.error("Failed to parse Gemini output:", text);
      throw new Error("Unable to parse analysis result.");
    }

    const verifiedReceipts = (result.receipts || []).map((r) => {
      if (!r.link || !r.link.startsWith("http")) {
        console.warn("Dropping non-http or empty receipt:", r.link);
        return null;
      }
      
      let matched = Object.values(articleMap).find(h => h.url === r.link);
      
      if (!matched) {
        try {
          const rUrl = new URL(r.link);
          const rClean = rUrl.hostname + rUrl.pathname.replace(/\/$/, "");
          matched = Object.values(articleMap).find(h => {
            try {
              const hUrl = new URL(h.url);
              const hClean = hUrl.hostname + hUrl.pathname.replace(/\/$/, "");
              return rClean === hClean;
            } catch {
              return false;
            }
          });
        } catch {}
      }
      
      if (!matched && r.title) {
        const rTitle = r.title.toLowerCase().trim();
        matched = Object.values(articleMap).find(h => h.title.toLowerCase().trim() === rTitle);
      }

      if (matched) {
        return {
          ...r,
          title: matched.title,
          link: matched.url,
        };
      }
      
      console.warn("Dropping hallucinated receipt:", r.link, r.title);
      return null;
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    result.receipts = verifiedReceipts;

    return result;
  }

  async function executeRoastPipeline(
    location: LocationResult,
    amenities: OsmAmenity[]
  ): Promise<RoastResult> {
    const genAI = getGenAI();

    const filteredPOIs = filterPOIs(amenities);
    const distinctPOIs = deduplicatePOIs(filteredPOIs);
    const osmContext = distinctPOIs.map((a) => {
      const name = a.tags?.name || "Unnamed";
      const dist = a.distance !== undefined ? `${a.distance.toFixed(0)}m` : "unknown distance";
      return `- ${name} (${dist})`;
    }).join("\n");

    const areaDetails = await getAreaDetails(location.lat, location.lng, location.displayName);
    console.log("[Pipeline] Area details:", areaDetails);

    const kelurahanKecamatan = await extractKelurahanKecamatan(areaDetails.full);
    console.log("[Pipeline] Extracted Kelurahan/Kecamatan:", kelurahanKecamatan);

    const queries = generateSearchQueries(kelurahanKecamatan);
    console.log("[Pipeline] Search queries:", queries);

    const searchResults = await searchAllQueries(queries);
    
    const allUrls: string[] = [];
    searchResults.forEach(sr => {
      sr.hits.forEach(hit => {
        if (hit.url && !allUrls.includes(hit.url)) {
          allUrls.push(hit.url);
        }
      });
    });

    const validUrls = new Set<string>();
    if (allUrls.length > 0) {
      try {
        const validationResults = await Promise.all(
          allUrls.map(async (url) => {
            const valid = await validateUrl(url);
            return { url, valid };
          })
        );
        validationResults.forEach((item) => {
          if (item.valid) {
            validUrls.add(item.url);
          }
        });
      } catch (err) {
        console.warn("[Pipeline] Link validation failed, falling back to all links:", err);
        allUrls.forEach(u => validUrls.add(u));
      }
    }

    const validatedSearchResults = searchResults.map(sr => ({
      ...sr,
      hits: sr.hits.filter(hit => validUrls.has(hit.url))
    })).filter(sr => sr.hits.length > 0);

    const totalHits = validatedSearchResults.reduce((s, r) => s + r.hits.length, 0);
    console.log(`[Pipeline] Verified ${totalHits} valid HTTP 200 articles across ${validatedSearchResults.length} queries`);

    const verifiedArticles: Array<{ title: string; source: string; link: string; category: string }> = [];
    validatedSearchResults.forEach((sr) => {
      let category = "bencana";
      if (sr.query.toLowerCase().includes("banjir")) category = "banjir";
      else if (sr.query.toLowerCase().includes("kriminal")) category = "kriminal";
      else if (sr.query.toLowerCase().includes("bencana")) category = "bencana";

      sr.hits.forEach((hit) => {
        let source = "News";
        try {
          const hostname = new URL(hit.url).hostname.replace("www.", "");
          const firstPart = hostname.split(".")[0];
          source = firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
        } catch {}

        if (!verifiedArticles.some(a => a.link === hit.url)) {
          verifiedArticles.push({
            title: hit.title,
            source,
            link: hit.url,
            category
          });
        }
      });
    });

    const analysisResult = await runMainAnalysis(genAI, location, areaDetails, osmContext, validatedSearchResults);
    analysisResult.verifiedArticles = verifiedArticles;
    return analysisResult;
  }

  // POST endpoint to handle the queueing and roasting pipeline
  app.post("/api/roast", async (req, res) => {
    try {
      const { location, amenities } = req.body;
      if (!location || !amenities) {
        return res.status(400).json({ error: "Missing location or amenities" });
      }
      
      console.log(`[API ROAST] Queueing request for: ${location.displayName}`);
      
      const result = await roastQueue.add(async () => {
        console.log(`[API ROAST] Starting execution for: ${location.displayName}`);
        return await executeRoastPipeline(location, amenities);
      });
      
      console.log(`[API ROAST] Successfully completed: ${location.displayName}`);
      res.json(result);
    } catch (e: any) {
      console.error("[API ROAST] Error executing pipeline:", e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
