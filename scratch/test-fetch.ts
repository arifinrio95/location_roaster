import fetch from "node-fetch";

async function testFetch() {
  const urls = [
    "https://www.detik.com",
    "https://www.kompas.com",
    "https://news.detik.com/berita/d-7112345/banjir-jakarta",
    "https://regional.kompas.com/read/2024/01/01/123456/banjir-ciputat"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      console.log(`HEAD ${url} -> status: ${res.status}`);
    } catch (e: any) {
      console.log(`HEAD ${url} -> error: ${e.message}`);
    }

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      console.log(`GET ${url} -> status: ${res.status}`);
    } catch (e: any) {
      console.log(`GET ${url} -> error: ${e.message}`);
    }
  }
}

testFetch();
