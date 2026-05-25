import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

async function runTest() {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.error("BRAVE_API_KEY not found in .env");
    return;
  }

  const query = "Ciputat Timur, Tangerang Selatan banjir";
  console.log(`Searching Brave for: "${query}"...`);
  
  const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
  const braveRes = await fetch(searchUrl, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey
    }
  });

  if (!braveRes.ok) {
    console.error(`Brave search failed: ${braveRes.status} ${braveRes.statusText}`);
    return;
  }

  const data = await braveRes.json() as any;
  const results = data.web?.results ?? [];
  console.log(`Found ${results.length} results:`);

  const urls = results.map((r: any) => r.url);
  for (const url of urls) {
    console.log(`\nURL: ${url}`);
    
    // Test HEAD
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const headRes = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeout);
      console.log(`  HEAD status: ${headRes.status}`);
      
      if (headRes.status !== 200) {
        // Test GET
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 4000);
        const getRes = await fetch(url, {
          method: "GET",
          signal: controller2.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        clearTimeout(timeout2);
        console.log(`  GET status: ${getRes.status}`);
      }
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

runTest();
