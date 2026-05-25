import fetch from "node-fetch";

const urls = [
  "https://www.tangselpos.id/detail/14071/tangani-banjir-kali-ciater-segmen-laverde-serpong-park-dilebarkan-dan-dibangun-turap",
  "https://kabar6.com/banjir-di-tangsel-meluas-perumahan-bsd-terendam/",
  "https://www.hariantangsel.com/banjir-luas-tangerang-selatan-terdampak",
  "https://m.facebook.com/ciater.serpong.7/",
  "https://kampungkb.bkkbn.go.id/kampung/64186/ciater-serpong",
  "https://id.wikipedia.org/wiki/Ciater,_Serpong,_Tangerang_Selatan",
  "https://regional.kompas.com/read/2026/02/20/07021231/banjir-rendam-10-titik-di-tangsel-pada-jumat-pagi-645-kk-terdampak"
];

async function validateUrlRobustly(url: string): Promise<boolean> {
  // Try HEAD first
  let headWorked = false;
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
    
    console.log(`HEAD ${url} -> status: ${headRes.status}`);
    if (headRes.status >= 200 && headRes.status < 300) {
      return true;
    }
  } catch (err: any) {
    console.log(`HEAD ${url} -> threw error: ${err.message}`);
  }

  // Fallback to GET
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const getRes = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeout);
    console.log(`GET ${url} -> status: ${getRes.status}`);
    return getRes.status >= 200 && getRes.status < 300;
  } catch (err: any) {
    console.log(`GET ${url} -> threw error: ${err.message}`);
    return false;
  }
}

async function testAll() {
  for (const url of urls) {
    const valid = await validateUrlRobustly(url);
    console.log(`URL: ${url} -> VALID: ${valid}\n`);
  }
}

testAll();
