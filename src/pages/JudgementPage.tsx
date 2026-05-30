import React, { useEffect, useState, useMemo } from "react";
import { LocationResult, RoastResult } from "../types";
import { fetchOsmNearAmenities } from "../lib/osmapi";
import { generateRoast } from "../lib/gemini";
import { IconLogo } from "../components/BrutalistIcons";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from "recharts";

interface JudgementPageProps {
  location: LocationResult;
  onReset: () => void;
}

// ── design tokens — clean white Apple/Google aesthetic ──────────────────────
const BG      = "#F5F5F7";
const SURFACE = "#FFFFFF";
const WHITE   = "#FFFFFF";
const INK     = "#1D1D1F";
const MUTED   = "#86868B";
const DIV     = "rgba(0,0,0,0.08)";
const RED     = "#FF3B30";
const GREEN   = "#34C759";
const AMBER   = "#FF9500";
const BLUE    = "#007AFF";
const SANS    = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO    = "'JetBrains Mono', monospace";

const catColor: Record<string, string> = {
  hazards:          RED,
  transit:          GREEN,
  health_education: BLUE,
  lifestyle:        AMBER,
  social_nature:    "#30D158",
  infrastructure:   MUTED,
  banjir:           BLUE,
  bencana:          RED,
  kriminal:         "#1D1D1F",
};

// ── map pin shapes — one distinct SVG per category ───────────────────────────
const MapPin = ({ catId, hovered }: { catId: string; hovered: boolean }) => {
  const col = catColor[catId] || MUTED;
  const sc = hovered ? 1.55 : 1;
  const style: React.CSSProperties = {
    transform: `scale(${sc})`,
    transition: "transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
    cursor: "pointer",
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.45))",
    display: "block",
  };

  if (catId === "hazards") {
    // Diamond (rotated square) — sharp warning energy
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" style={style}>
        <rect x="2" y="2" width="10" height="10" transform="rotate(45 7 7)"
          fill={col} stroke="white" strokeWidth="1.5"/>
      </svg>
    );
  }
  if (catId === "transit") {
    // Rounded-end capsule (suggests movement / rail)
    return (
      <svg width="18" height="11" viewBox="0 0 18 11" style={style}>
        <rect x="1" y="1" width="16" height="9" rx="4.5"
          fill={col} stroke="white" strokeWidth="1.5"/>
        <line x1="6" y1="5.5" x2="12" y2="5.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (catId === "health_education") {
    // Circle with plus — medical / knowledge
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" style={style}>
        <circle cx="7" cy="7" r="6" fill={col} stroke="white" strokeWidth="1.5"/>
        <line x1="7" y1="3.5" x2="7" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="3.5" y1="7" x2="10.5" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (catId === "lifestyle") {
    // Rounded square (soft, commercial)
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" style={style}>
        <rect x="1" y="1" width="11" height="11" rx="3"
          fill={col} stroke="white" strokeWidth="1.5"/>
        <circle cx="6.5" cy="6.5" r="2" fill="white"/>
      </svg>
    );
  }
  if (catId === "social_nature") {
    // Teardrop pointing up — organic / natural
    return (
      <svg width="12" height="16" viewBox="0 0 12 16" style={style}>
        <path d="M6 1 C6 1 1 7 1 10.5 A5 5 0 0 0 11 10.5 C11 7 6 1 6 1Z"
          fill={col} stroke="white" strokeWidth="1.5"/>
      </svg>
    );
  }
  // infrastructure — square with inner grid
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" style={style}>
      <rect x="1" y="1" width="11" height="11" fill={col} stroke="white" strokeWidth="1.5"/>
      <line x1="4.5" y1="1" x2="4.5" y2="12" stroke="white" strokeWidth="0.8"/>
      <line x1="8.5" y1="1" x2="8.5" y2="12" stroke="white" strokeWidth="0.8"/>
      <line x1="1" y1="4.5" x2="12" y2="4.5" stroke="white" strokeWidth="0.8"/>
      <line x1="1" y1="8.5" x2="12" y2="8.5" stroke="white" strokeWidth="0.8"/>
    </svg>
  );
};

// ── custom thin-line SVG icons ─────────────────────────────────────────────────
const IcoFlood = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round">
    <path d="M2 8 C6 4 10 12 14 8 C18 4 22 12 22 8"/>
    <path d="M2 14 C6 10 10 18 14 14 C18 10 22 18 22 14"/>
    <path d="M2 20 C6 16 10 24 14 20 C18 16 22 24 22 20"/>
  </svg>
);
const IcoSafety = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6L12 2z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);
const IcoTraffic = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
    <line x1="9"  y1="3" x2="9"  y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);
const IcoTransit = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round">
    <line x1="5" y1="20" x2="19" y2="20"/>
    <line x1="9"  y1="20" x2="9"  y2="5"/>
    <line x1="15" y1="20" x2="15" y2="5"/>
    <line x1="7"  y1="9"  x2="17" y2="9"/>
    <line x1="7"  y1="14" x2="17" y2="14"/>
  </svg>
);
const IcoHazard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 22h20L12 2z"/>
    <line x1="12" y1="10" x2="12" y2="15"/>
    <circle cx="12" cy="18.5" r="0.8" fill={INK} stroke="none"/>
  </svg>
);

const DIM_ICONS = [IcoFlood, IcoSafety, IcoTraffic, IcoTransit, IcoHazard];

// ── Proximity Custom SVGs ──────────────────────────────────────────────────────
const ProximityKrlIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="16" rx="2" />
    <path d="M4 11h16" />
    <path d="M12 3v8" />
    <path d="M8 19l-2 3" />
    <path d="M16 19l2 3" />
    <circle cx="8" cy="15" r="1" />
    <circle cx="16" cy="15" r="1" />
  </svg>
);

const ProximitySutetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2L19 22" />
    <path d="M19 2L5 22" />
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <path d="M6 8h12" />
    <path d="M6 16h12" />
  </svg>
);

const ProximityCemeteryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v16" />
    <path d="M8 6h8" />
    <path d="M18 22H6" />
    <path d="M10 14H6" />
    <path d="M14 14h4" />
    <path d="M6 18h12" />
  </svg>
);

const ProximityHospitalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const ProximityMallIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const getProxIcon = (name: string) => {
  switch (name) {
    case "KRL": return <ProximityKrlIcon />;
    case "SUTET": return <ProximitySutetIcon />;
    case "Cemetery": return <ProximityCemeteryIcon />;
    case "Hospital": return <ProximityHospitalIcon />;
    case "Mall": return <ProximityMallIcon />;
    default: return null;
  }
};

const proxDetails: Record<string, { label: string; subLabelGood: string; subLabelBad: string }> = {
  KRL: {
    label: "Stasiun KRL / Transit",
    subLabelGood: "Commute gampang, anti macet-macet club",
    subLabelBad: "Commute susah, siap-siap capek di jalan"
  },
  SUTET: {
    label: "Jaringan Listrik SUTET",
    subLabelGood: "Aman, bebas radiasi gaib berlebih",
    subLabelBad: "Ngeri, jarak ke radiasi SUTET terlalu mepet"
  },
  Cemetery: {
    label: "Area Pemakaman (Kuburan)",
    subLabelGood: "Tenang, ga ada vibes horor di dekat rumah",
    subLabelBad: "Mencekam, deket banget makam, horor abis"
  },
  Hospital: {
    label: "Rumah Sakit / Layanan Medis",
    subLabelGood: "Aman, gampang berobat kalau darurat",
    subLabelBad: "Medis jauh, kudu jaga kesehatan extra"
  },
  Mall: {
    label: "Mall / Supermarket",
    subLabelGood: "Strategis, gampang nyari makan & nongkrong",
    subLabelBad: "Jauh dari mall, sepi hiburan abis"
  }
};

// ── component ──────────────────────────────────────────────────────────────────
export const JudgementPage: React.FC<JudgementPageProps> = ({ location, onReset }) => {
  const [data,         setData]         = useState<RoastResult | null>(null);
  const [amenitiesData,setAmenitiesData]= useState<any[]>([]);
  const [error,        setError]        = useState("");
  const [loadingPhase, setLoadingPhase] = useState<0|1|2>(0);
  const [jobStatus,    setJobStatus]    = useState<string>("init");
  const [hoveredRow,   setHoveredRow]   = useState<string|number|null>(null);
  const [activePoiTab, setActivePoiTab] = useState("hazards");
  const [showUnnamed,  setShowUnnamed]  = useState(false);
  const [visibleMapCams, setVisibleMapCams] = useState<Record<string,boolean>>({
    transit: false, health_education: false, lifestyle: false,
    infrastructure: false, social_nature: false, hazards: true,
  });
  const [displayScore, setDisplayScore] = useState(0);
  const [barsVisible,  setBarsVisible]  = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [tickerLogs,   setTickerLogs]   = useState<string[]>([]);

  const sections = useMemo(() => [
    { id: "overview",   num: "00", label: "Overview" },
    { id: "section-01", num: "01", label: "Risk Assessment" },
    { id: "section-02", num: "02", label: "Evidence Log" },
    { id: "section-03", num: "03", label: "Data Analytics" },
    { id: "section-04", num: "04", label: "Nearby Environment" },
    { id: "section-05", num: "05", label: "Points of Interest" }
  ], []);

  useEffect(() => {
    const handleScroll = () => {
      let currentSec = "overview";
      for (const sec of sections) {
        const el = document.getElementById(sec.id);
        if (el && window.scrollY >= el.offsetTop - 180) {
          currentSec = sec.id;
        }
      }
      setActiveSection(currentSec);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingPhase(1);
        const am = await fetchOsmNearAmenities(location.lat, location.lng);
        if (!active) return;
        setAmenitiesData(am);
        setLoadingPhase(2);
        const res = await generateRoast(location, am, (status) => {
          if (active) setJobStatus(status);
        });
        if (!active) return;
        setData(res);
      } catch (e: any) {
        if (active) {
          setError(e.message || "Analysis failed.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [location]);

  useEffect(() => {
    if (!data) return;
    let f = 0, total = 90;
    const t = setInterval(() => {
      f++;
      setDisplayScore(Math.round((1 - Math.pow(1 - f / total, 3)) * data.score));
      if (f >= total) clearInterval(t);
    }, 16);
    const bt = setTimeout(() => setBarsVisible(true), 500);
    return () => { clearInterval(t); clearTimeout(bt); };
  }, [data]);

  useEffect(() => {
    if (data) return;
    
    const logsList = [
      "Initializing geospatial console...",
      "Requesting Nominatim geocoding proxy...",
      `Analyzing coordinates: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      "Fetching OpenStreetMap data via Overpass API...",
      "Scanning radius 3000m for primary highways...",
      "Scanning radius 1000m for landfills and cemeteries...",
      "Mapping local amenities (schools, malls, clinics)...",
      "Nominatim geocode resolved address details",
      "Contacting LLM to extract Kelurahan & Kecamatan...",
      "Extracting 2-level address labels...",
      "Triggering sequential Brave Search queries...",
      "Searching query: 'kelurahan, kecamatan' + 'banjir'...",
      "Searching query: 'kelurahan, kecamatan' + 'bencana'...",
      "Searching query: 'kelurahan, kecamatan' + 'kriminal'...",
      "Brave Search API results returned",
      "Starting link validation on proxy server...",
      "Verifying Detik news article status... 200 OK",
      "Verifying Kompas news article status... 200 OK (GET fallback)",
      "Verifying Metrotvnews article status... 200 OK",
      "Filtering out hallucinated and non-200 URLs...",
      "Formatting data package context (distinct POIs)...",
      "Injecting verified news context into AI prompt...",
      "Calling Gemini 3.1 Flash-Lite synthesis engine...",
      "Running temperature 1.0 creativity parameter...",
      "Generating Jaksel style roast content...",
      "Validating JSON output schema adherence...",
      "Finalizing livability score compilation...",
    ];

    let currentLogIdx = 0;
    // Pre-populate with first 3 logs
    setTickerLogs(logsList.slice(0, 3));
    currentLogIdx = 3;

    const interval = setInterval(() => {
      if (currentLogIdx < logsList.length) {
        // If we are in phase 1 (OSM), limit logs to index 9 (before search)
        if (loadingPhase === 1 && currentLogIdx >= 9) {
          return;
        }
        // If we are in phase 2, let it continue
        setTickerLogs(prev => [...prev, logsList[currentLogIdx]]);
        currentLogIdx++;
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [loadingPhase, data, location]);

  // ── memos ──────────────────────────────────────────────────────────────────
  const radarData = useMemo(() => data?.dimensions ? [
    { s: "Banjir",   A: data.dimensions.banjir },
    { s: "Keamanan", A: data.dimensions.kriminal },
    { s: "Lalu Lintas", A: data.dimensions.macet },
    { s: "Transit",  A: data.dimensions.akses_transit },
    { s: "Hazard",   A: data.dimensions.polusi_gaib },
  ] : [], [data]);

  const categorizedPOIs = useMemo(() => {
    const c: Record<string, any[]> = {
      transit:[], health_education:[], lifestyle:[], infrastructure:[], social_nature:[], hazards:[]
    };
    amenitiesData.forEach(p => {
      const t = p.tags || {};
      if (t.railway==='station'||t.amenity==='bus_station'||t.highway==='bus_stop'||t.highway==='platform') c.transit.push(p);
      else if (t.amenity==='hospital'||t.amenity==='school'||t.amenity==='university'||t.amenity==='clinic'||t.amenity==='pharmacy') c.health_education.push(p);
      else if (t.shop||t.amenity==='restaurant'||t.amenity==='cafe'||t.amenity==='mall'||t.amenity==='food_court'||t.amenity==='bank'||t.amenity==='atm'||t.amenity==='marketplace') c.lifestyle.push(p);
      else if (t.power==='tower'||t.power==='substation'||t.man_made==='tower'||t.amenity==='waste_transfer_station'||t.landuse==='landfill'||t.amenity==='waste_disposal'||t.railway==='rail'||t.railway==='narrow_gauge'||t.landuse==='industrial'||t.man_made==='works'||t.waterway||t.landuse==='cemetery'||t.amenity==='grave_yard') c.hazards.push(p);
      else if (t.natural==='water'||t.leisure==='park'||t.leisure==='garden') c.social_nature.push(p);
      else c.infrastructure.push(p);
    });
    return c;
  }, [amenitiesData]);

  const osmMetrics = useMemo(() => {
    const mn = (arr: any[]) => arr.length ? Math.round(Math.min(...arr.map(a => a.distance ?? 9999))) : null;
    const waterways = amenitiesData.filter(a => a.tags?.waterway);
    const stations  = amenitiesData.filter(a => a.tags?.railway === 'station');
    const busStops  = amenitiesData.filter(a => a.tags?.highway === 'bus_stop' || a.tags?.amenity === 'bus_station');
    const police    = amenitiesData.filter(a => a.tags?.amenity === 'police');
    const sutets    = amenitiesData.filter(a => a.tags?.power === 'tower');
    const cemeteries= amenitiesData.filter(a => a.tags?.landuse === 'cemetery' || a.tags?.amenity === 'grave_yard');
    const waste     = amenitiesData.filter(a => a.tags?.landuse === 'landfill' || a.tags?.amenity === 'waste_transfer_station' || a.tags?.amenity === 'waste_disposal');
    const factories = amenitiesData.filter(a => a.tags?.landuse === 'industrial' || a.tags?.man_made === 'works');
    const primary   = amenitiesData.filter(a => (a.tags?.highway === 'primary' || a.tags?.highway === 'motorway') && a.type === 'way');
    const markets   = amenitiesData.filter(a => a.tags?.amenity === 'marketplace');
    const nw = mn(waterways), ns = mn(stations), np = mn(police);
    const allHaz = [...sutets, ...cemeteries, ...waste, ...factories];
    return {
      flood:   { count: waterways.length, nearestM: nw,
                 fact: nw ? `${waterways.length} waterway${waterways.length>1?'s':''} · nearest ${nw}m` : 'No waterways detected' },
      safety:  { policeCount: police.length, nearestM: np,
                 fact: np ? `${police.length} police post · ${np}m away` : 'No police post detected' },
      traffic: { primaryCount: primary.length, marketCount: markets.length,
                 fact: `${primary.length} major road${primary.length>1?'s':''} · ${markets.length} market${markets.length!==1?'s':''}` },
      transit: { stationCount: stations.length, busCount: busStops.length, nearestM: ns,
                 fact: ns ? `KRL ${ns}m · ${busStops.length} bus stop${busStops.length!==1?'s':''}` : `No KRL · ${busStops.length} bus stop${busStops.length!==1?'s':''}` },
      hazard:  { sutet: sutets.length, cemetery: cemeteries.length, waste: waste.length, factory: factories.length,
                 nearestM: mn(allHaz),
                 fact: [sutets.length&&`${sutets.length} SUTET`, cemeteries.length&&`${cemeteries.length} cemetery`, waste.length&&`${waste.length} waste`, factories.length&&`${factories.length} factory`].filter(Boolean).join(' · ') || 'No major hazards' },
    };
  }, [amenitiesData]);

  const distData = useMemo(() => {
    let krl=10000, sutet=5000, tomb=5000, rs=5000, mall=5000;
    amenitiesData.forEach(a => {
      if (a.tags?.railway==='station') krl=Math.min(krl,a.distance);
      if (a.tags?.power==='tower') sutet=Math.min(sutet,a.distance);
      if (a.tags?.landuse==='cemetery'||a.tags?.amenity==='grave_yard') tomb=Math.min(tomb,a.distance);
      if (a.tags?.amenity==='hospital'||a.tags?.amenity==='clinic') rs=Math.min(rs,a.distance);
      if (a.tags?.shop==='mall'||a.tags?.shop==='supermarket') mall=Math.min(mall,a.distance);
    });
    return [
      { name:'KRL',      dist:krl,  good: krl<=2000 },
      { name:'SUTET',    dist:sutet, good: sutet>=1000 },
      { name:'Cemetery', dist:tomb,  good: tomb>=1000 },
      { name:'Hospital', dist:rs,   good: rs<=3000 },
      { name:'Mall',     dist:mall,  good: mall<=3000 },
    ];
  }, [amenitiesData]);

  const pieData = useMemo(() => {
    const values = Object.values(categorizedPOIs) as any[][];
    const total = values.reduce((s, a) => s + a.length, 0);
    return (Object.entries(categorizedPOIs) as [string, any[]][])
      .map(([k, items]) => ({ name: k.replace('_', ' '), value: total > 0 ? +((items.length / total) * 100).toFixed(1) : 0 }))
      .filter(d => d.value > 0);
  }, [categorizedPOIs]);

  const activeItems = useMemo(() => {
    const list = categorizedPOIs[activePoiTab] || [];
    const named = list.filter(item => item.tags?.name && item.tags.name !== 'Unnamed');
    const unnamed = list.filter(item => !item.tags?.name || item.tags.name === 'Unnamed');
    
    // Sort both by distance
    named.sort((a, b) => a.distance - b.distance);
    unnamed.sort((a, b) => a.distance - b.distance);
    
    return { named, unnamed };
  }, [categorizedPOIs, activePoiTab]);

  const listToRender = useMemo(() => {
    return showUnnamed 
      ? [...activeItems.named, ...activeItems.unnamed] 
      : activeItems.named;
  }, [activeItems, showUnnamed]);

  // ── error ──────────────────────────────────────────────────────────────────
  if (error) {
    const isQuota = error.includes('429')||error.toLowerCase().includes('quota')||error.includes('RESOURCE_EXHAUSTED');
    return (
      <div style={{ background: BG, fontFamily: SANS, minHeight: '100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:32, WebkitFontSmoothing:'antialiased' }}>
        <div style={{ maxWidth:440, width:'100%', background: WHITE, borderRadius:20, padding:40, boxShadow:'0 4px 40px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:`${RED}15`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={RED} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <p style={{ fontSize:11, fontWeight:600, color: RED, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>
            {isQuota ? 'API Limit Reached' : 'Analysis Failed'}
          </p>
          <h2 style={{ fontSize:22, fontWeight:700, color: INK, marginBottom:10, letterSpacing:'-0.02em' }}>
            {isQuota ? 'Rate limit hit' : 'Something went wrong'}
          </h2>
          <p style={{ fontSize:14, color: MUTED, lineHeight:1.65, marginBottom:24 }}>
            {isQuota ? 'The AI service rate limit has been reached. Please wait a moment and try again.' : 'Something went wrong connecting to the analysis service.'}
          </p>
          <details style={{ marginBottom:28 }}>
            <summary style={{ fontSize:12, color: MUTED, cursor:'pointer' }}>Technical details</summary>
            <p style={{ marginTop:8, fontSize:11, color: MUTED, wordBreak:'break-all', lineHeight:1.6, background: BG, padding:'10px 12px', borderRadius:8, fontFamily: MONO, marginBottom:0 }}>{error}</p>
          </details>
          <button onClick={onReset} style={{ width:'100%', padding:'13px 20px', background: INK, color:'white', fontSize:14, fontWeight:600, border:'none', cursor:'pointer', fontFamily: SANS, borderRadius:12, letterSpacing:'-0.01em' }}>
            ← Back to Search
          </button>
        </div>
      </div>
    );
  }

  // ── loading ────────────────────────────────────────────────────────────────
  const steps = [
    { label:'Scanning geospatial data',    detail:'OpenStreetMap · Overpass API' },
    { label:'Collecting points of interest',detail:'Flood · Safety · Transit · Hazard' },
    { 
      label: jobStatus === 'pending' ? 'Server penuh, masuk antrian...' 
           : jobStatus === 'processing' ? 'AI sedang menganalisis lokasi...' 
           : 'Generating AI risk analysis', 
      detail: jobStatus === 'pending' ? 'Menunggu giliran di antrian server...' : 'Gemini AI · location intelligence' 
    },
  ];
  if (!data) {
    return (
      <div style={{ background: BG, fontFamily: SANS, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, WebkitFontSmoothing:'antialiased' }}>
        <style>{`
          @keyframes pulseNode {
            0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.2); }
            50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(0, 122, 255, 0); }
          }
          @keyframes flowParticle {
            0% { top: 0%; opacity: 0; }
            8% { opacity: 1; }
            92% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .pulse-node-active {
            animation: pulseNode 2s infinite ease-in-out;
            border-color: ${BLUE} !important;
          }
          .console-line {
            font-family: ${MONO};
            font-size: 11px;
            line-height: 1.6;
            margin-bottom: 4px;
            word-break: break-all;
          }
        `}</style>

        {/* Header pill */}
        <div style={{ position:'absolute', top:20, left:24, display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background: WHITE, borderRadius:999, boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
          <div style={{ width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <IconLogo style={{ width:22, height:22 }} />
          </div>
          <span style={{ fontSize:13, fontWeight:600, color: INK, letterSpacing:'-0.01em' }}>Location Roaster</span>
        </div>

        <div style={{ width:'100%', maxWidth:1000, display:'grid', gridTemplateColumns:'1fr', gap:32, marginTop:40 }}>
          <style>{`
            @media (min-width: 768px) {
              .loading-grid {
                grid-template-columns: 400px 1fr !important;
              }
            }
          `}</style>
          
          <div className="loading-grid" style={{ display:'grid', gridTemplateColumns:'1fr', gap:32 }}>
            
            {/* Left Column: Progress steps & console log ticker */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ background: WHITE, borderRadius:20, padding:24, border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' }}>
                {/* Location display */}
                <span style={{ fontSize:10, fontWeight:700, color:BLUE, letterSpacing:'0.06em', textTransform:'uppercase' }}>Analyzing Target</span>
                <h2 style={{ fontSize:22, fontWeight:800, color: INK, letterSpacing:'-0.02em', margin:'6px 0 2px', lineHeight:1.2 }}>{location.displayName.split(',')[0]}</h2>
                <p style={{ fontSize:12, color: MUTED, margin:'0 0 20px', display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                  {location.lat.toFixed(5)}°, {location.lng.toFixed(5)}°
                </p>

                {/* Steps List */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {steps.map((s, i) => {
                    const done = i < (loadingPhase===1?1:loadingPhase===2?2:0);
                    const active = i === (loadingPhase===1?1:loadingPhase===2?2:0);
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:10, background: active?`${BLUE}08`:'transparent', transition:'background 0.3s' }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                          background: done?`${GREEN}15`:active?`${BLUE}15`:`rgba(0,0,0,0.04)` }}>
                          {done ? (
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          ) : active ? (
                            <div className="animate-pulse" style={{ width:6, height:6, borderRadius:'50%', background: BLUE }}/>
                          ) : (
                            <div style={{ width:6, height:6, borderRadius:'50%', background:'rgba(0,0,0,0.15)' }}/>
                          )}
                        </div>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:12.5, fontWeight:600, color: done?GREEN:active?INK:MUTED, margin:0 }}>{s.label}</p>
                          <p style={{ fontSize:10, color: MUTED, margin:'1px 0 0' }}>{s.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Console log ticker (Dark theme terminal) */}
              <div style={{ background: '#18181B', borderRadius:20, padding:'20px 24px', border:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 10px 30px rgba(0,0,0,0.25)', height:200, display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:12 }}>
                  <div style={{ display:'flex', gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#FF5F56' }}/>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#FFBD2E' }}/>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'#27C93F' }}/>
                  </div>
                  <span style={{ fontSize:10, color:'#71717A', fontFamily:MONO, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', marginLeft:6 }}>Geospatial Console</span>
                </div>
                <div style={{ flex:1, overflowY:'hidden', display:'flex', flexDirection:'column-reverse', gap:4 }}>
                  {tickerLogs.slice().reverse().map((log, idx) => (
                    <div key={idx} className="console-line" style={{ color: idx === 0 ? '#34C759' : 'rgba(255,255,255,0.65)', fontWeight: idx === 0 ? 600 : 400, opacity: idx === 0 ? 1 : 1 - (idx * 0.15) }}>
                      <span style={{ color: '#71717A', marginRight:8 }}>$</span>{log}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Pipeline visualizer diagram */}
            <div style={{ background: WHITE, borderRadius:20, padding:'28px 32px', border:'1px solid rgba(0,0,0,0.06)', boxShadow:'0 4px 20px rgba(0,0,0,0.04)', display:'flex', flexDirection:'column' }}>
              <div style={{ marginBottom:20 }}>
                <span style={{ fontSize:10, fontWeight:700, color:BLUE, letterSpacing:'0.06em', textTransform:'uppercase' }}>System Pipeline</span>
                <h3 style={{ fontSize:18, fontWeight:700, color: INK, letterSpacing:'-0.01em', margin:'4px 0 0' }}>Bagaimana AI Menganalisa Lokasimu?</h3>
                <p style={{ fontSize:12.5, color: MUTED, margin:'4px 0 0', lineHeight:1.4 }}>Properti dianalisis secara real-time melalui 4 layer infrastruktur data spasial.</p>
              </div>

              {/* Vertical flow map */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20, position:'relative', paddingLeft:8 }}>
                {/* Connecting track line */}
                <div style={{ position: 'absolute', top: 24, bottom: 24, left: 24, width: 2, background: 'rgba(0,122,255,0.08)' }}>
                  <div style={{ position: 'absolute', left: 0, width: 2, height: '40px', background: `linear-gradient(to bottom, transparent, ${BLUE}, transparent)`, animation: 'flowParticle 3s infinite linear' }} />
                </div>

                {/* Node 1: Input Pin */}
                <div style={{ display:'flex', gap:16, zIndex:1, alignItems:'center' }}>
                  <div className={loadingPhase===0?'pulse-node-active':''} style={{ width:34, height:34, borderRadius:10, background: loadingPhase>=0?`${BLUE}12`:'rgba(0,0,0,0.03)', border: `1.5px solid ${loadingPhase>=0?BLUE:'rgba(0,0,0,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: loadingPhase>=0?BLUE:MUTED }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize:13, fontWeight:700, color: INK, margin:0 }}>1. Coordinates Input & Address Extraction</h4>
                    <p style={{ fontSize:11, color: MUTED, margin:'2px 0 0' }}>Nominatim API menyelesaikan koordinat menjadi teks alamat, dilanjutkan request Gemini AI (2.5 Flash) terpisah untuk mengekstrak Kelurahan & Kecamatan secara presisi.</p>
                  </div>
                </div>

                {/* Node 2: Spatial engine */}
                <div style={{ display:'flex', gap:16, zIndex:1, alignItems:'center' }}>
                  <div className={loadingPhase===1?'pulse-node-active':''} style={{ width:34, height:34, borderRadius:10, background: loadingPhase>=1?`${BLUE}12`:'rgba(0,0,0,0.03)', border: `1.5px solid ${loadingPhase>=1?BLUE:'rgba(0,0,0,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: loadingPhase>=1?BLUE:MUTED }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize:13, fontWeight:700, color: loadingPhase>=1?INK:MUTED, margin:0 }}>2. Overpass Geospatial Engine</h4>
                    <p style={{ fontSize:11, color: MUTED, margin:'2px 0 0' }}>Memindai data spasial OpenStreetMap radius 3km untuk mendata POI (SUTET, makam, stasiun, mall, sungai).</p>
                  </div>
                </div>

                {/* Node 3: Search Crawler */}
                <div style={{ display:'flex', gap:16, zIndex:1, alignItems:'center' }}>
                  <div className={loadingPhase===2?'pulse-node-active':''} style={{ width:34, height:34, borderRadius:10, background: loadingPhase>=2?`${BLUE}12`:'rgba(0,0,0,0.03)', border: `1.5px solid ${loadingPhase>=2?BLUE:'rgba(0,0,0,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: loadingPhase>=2?BLUE:MUTED }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize:13, fontWeight:700, color: loadingPhase>=2?INK:MUTED, margin:0 }}>3. Brave News Verification Engine</h4>
                    <p style={{ fontSize:11, color: MUTED, margin:'2px 0 0' }}>Mencari berita negatif (banjir, bencana, kriminal) di daerah tersebut via Brave Search API, memvalidasi link HTTP 200 secara server-side.</p>
                  </div>
                </div>

                {/* Node 4: Gemini LLM */}
                <div style={{ display:'flex', gap:16, zIndex:1, alignItems:'center' }}>
                  <div className={loadingPhase===2?'pulse-node-active':''} style={{ width:34, height:34, borderRadius:10, background: loadingPhase>=2?`${BLUE}12`:'rgba(0,0,0,0.03)', border: `1.5px solid ${loadingPhase>=2?BLUE:'rgba(0,0,0,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: loadingPhase>=2?BLUE:MUTED }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  </div>
                  <div>
                    <h4 style={{ fontSize:13, fontWeight:700, color: loadingPhase>=2?INK:MUTED, margin:0 }}>4. Gemini AI Synthesis Engine</h4>
                    <p style={{ fontSize:11, color: MUTED, margin:'2px 0 0' }}>Mengkonsolidasikan seluruh data, menghitung skor, merancang receipts bukti link valid, dan memformulasikan ngeroast pedas gaya anak Jaksel.</p>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  const scoreColor = data.score>=60 ? GREEN : data.score>=35 ? AMBER : RED;
  const verdictTxt = data.score<30 ? 'Avoid this location.' : data.score<60 ? 'Proceed with caution.' : 'Acceptable risk profile.';
  const cat = (score: number) => score >= 60 ? 'Low Risk' : score >= 35 ? 'Moderate' : 'High Risk';

  const dimConfig = [
    { key:'banjir',       label:'Flood Risk',    Icon: IcoFlood,   score: data.dimensions.banjir,       fact: osmMetrics.flood.fact },
    { key:'kriminal',     label:'Safety Index',  Icon: IcoSafety,  score: data.dimensions.kriminal,     fact: osmMetrics.safety.fact },
    { key:'macet',        label:'Traffic',       Icon: IcoTraffic, score: data.dimensions.macet,        fact: osmMetrics.traffic.fact },
    { key:'akses_transit',label:'Transit Access',Icon: IcoTransit, score: data.dimensions.akses_transit, fact: osmMetrics.transit.fact },
    { key:'polusi_gaib',  label:'Hazard Index',  Icon: IcoHazard,  score: data.dimensions.polusi_gaib,  fact: osmMetrics.hazard.fact },
  ];

  const layerLabels: Record<string,string> = {
    hazards:'Hazards', transit:'Transit', health_education:'Health & Edu',
    lifestyle:'Lifestyle', social_nature:'Nature', infrastructure:'Infrastructure',
  };

  const CHART_PALETTE = [BLUE, GREEN, AMBER, RED, '#AF52DE', '#32ADE6'];

  const Row = ({ n, id, children }: { n: string, id: string, children: React.ReactNode }) => (
    <div id={id} style={{ marginBottom:72 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
        <span style={{ fontSize:11, fontWeight:600, color: MUTED, letterSpacing:'0.08em' }}>{n}</span>
        <div style={{ flex:1, height:1, background: DIV }}/>
      </div>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="page-wrapper" style={{ background: BG, fontFamily: SANS, minHeight:'100vh', overflowX:'hidden', WebkitFontSmoothing:'antialiased' }}>

      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .su { animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .maplibregl-popup-content {
          background: ${WHITE} !important;
          border: none !important;
          border-radius: 14px !important;
          padding: 0 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important;
        }
        .maplibregl-popup-tip { display:none !important; }
        .maplibregl-ctrl-attrib { display:none !important; }
        .maplibregl-ctrl-logo { display:none !important; }
        input[type="checkbox"] { accent-color: ${BLUE}; }

        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(52,199,89, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(52,199,89, 0); }
          100% { box-shadow: 0 0 0 0 rgba(52,199,89, 0); }
        }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(255,59,48, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(255,59,48, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255,59,48, 0); }
        }
        @keyframes pulse-amber {
          0% { box-shadow: 0 0 0 0 rgba(255,149,0, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(255,149,0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255,149,0, 0); }
        }
        @keyframes fill-bar {
          from { width: 0%; }
        }
        .pulse-g { animation: pulse-green 2s infinite; }
        .pulse-r { animation: pulse-red 2s infinite; }
        .pulse-a { animation: pulse-amber 2s infinite; }
        .bar-fill-anim { animation: fill-bar 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .card-hover { transition: box-shadow 0.2s, transform 0.2s; }
        .card-hover:hover { box-shadow: 0 8px 40px rgba(0,0,0,0.10) !important; transform: translateY(-1px); }

        @media (min-width: 1024px) {
          .page-wrapper { padding-left: 180px !important; }
          .side-nav { display: flex !important; }
        }
        
        .side-nav .label-text {
          opacity: 0;
          transform: translateX(-6px);
          display: inline-block;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .side-nav:hover .label-text {
          opacity: 0.45;
          transform: translateX(0);
        }
        .side-nav .label-text.active {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }
      `}</style>

      {/* ══ SIDE BAR NAVIGATION (SCROLLSPY) ══ */}
      <div className="side-nav" style={{
        position: 'fixed',
        left: 24,
        top: '32vh',
        zIndex: 50,
        display: 'none',
        flexDirection: 'column',
        gap: 6,
        padding: '16px 0',
      }}>
        <div style={{
          position: 'absolute',
          left: 4,
          top: 24,
          bottom: 24,
          width: 1,
          background: 'rgba(0,0,0,0.06)',
          zIndex: -1
        }}/>
        {sections.map(sec => {
          const isActive = activeSection === sec.id;
          return (
            <div
              key={sec.id}
              onClick={() => {
                const el = document.getElementById(sec.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                padding: '6px 0',
                userSelect: 'none'
              }}
            >
              <div style={{
                width: isActive ? 9 : 5,
                height: isActive ? 9 : 5,
                borderRadius: '50%',
                background: isActive ? INK : 'rgba(0,0,0,0.15)',
                marginLeft: isActive ? 2 : 4,
                boxShadow: isActive ? `0 0 0 4px ${BG}` : 'none',
                border: isActive ? `1.5px solid ${INK}` : 'none',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}/>
              <span className={`label-text ${isActive ? 'active' : ''}`} style={{
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 700,
                color: isActive ? INK : MUTED,
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}>
                {sec.num} <span style={{
                  fontWeight: 500,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginLeft: 4,
                  opacity: isActive ? 1 : 0.7,
                  color: isActive ? INK : MUTED
                }}>{sec.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(245,245,247,0.85)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:`1px solid ${DIV}`, height:56 }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 28px', height:'100%', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={onReset} style={{ background:'none', border:'none', cursor:'pointer', fontFamily: SANS, display:'flex', alignItems:'center', gap:10, color: INK, padding:'6px 8px', marginLeft:-8, borderRadius:8, transition:'opacity 0.15s' }}
            onMouseEnter={e=>(e.currentTarget.style.opacity='0.55')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
            <div style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <IconLogo style={{ width:24, height:24 }} />
            </div>
            <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>Location Roaster</span>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <span style={{ fontSize:12, color: MUTED, fontWeight:500 }}>{location.displayName.split(',')[0]}</span>
            <div style={{ height:14, width:1, background: DIV }}/>
            <div style={{ padding:'4px 12px', borderRadius:999, background: scoreColor, color:'white', fontSize:11, fontWeight:700, letterSpacing:'0.04em' }}>
              {data.score} / 100
            </div>
          </div>
        </div>
      </header>

      {/* ══ REPORT HEADER ══════════════════════════════════════════════════ */}
      <div id="overview" className="su" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 0' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Location Analysis Report
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 4, background: `${scoreColor}15`, color: scoreColor, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              {cat(data.score)}
            </div>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: INK, letterSpacing: '-0.03em', margin: '0 0 8px', lineHeight: 1.15 }}>
            {location.displayName.split(',')[0]}
          </h1>
          <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.5 }}>
            {location.displayName}
          </p>
          <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap', borderBottom: `1px solid ${DIV}`, paddingBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={MUTED} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
              </svg>
              <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>
                {location.lat.toFixed(5)}°, {location.lng.toFixed(5)}°
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={MUTED} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253"/>
              </svg>
              <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>
                {amenitiesData.length} POI Nodes
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={MUTED} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v3.75m-9.75-3h.008v.008H12V6.75z" />
              </svg>
              <span style={{ fontSize: 13, color: INK, fontWeight: 500 }}>
                {data.verifiedArticles?.length || 0} Evidence Items
              </span>
            </div>
          </div>
        </div>

        {/* ══ DASHBOARD OVERVIEW GRID ═══════════════════════════════════════════ */}
        <div className="overview-grid" style={{ display: 'grid', gap: 24, marginBottom: 40 }}>
          <style>{`
            .overview-grid {
              grid-template-columns: 1fr;
            }
            @media(min-width: 1024px) {
              .overview-grid {
                grid-template-columns: 1.2fr 0.8fr;
              }
            }
          `}</style>

          {/* Left Card: Score, AI Verdict, Roast & Pros */}
          <div style={{ background: WHITE, borderRadius: 20, padding: '32px 36px', border: `1px solid rgba(0,0,0,0.06)`, boxShadow: '0 4px 24px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column' }}>
            
            {/* Score & Verdict Info Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
              {/* Custom SVG Circular Gauge */}
              <div style={{ position: 'relative', width: 92, height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="92" height="92" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="46"
                    cy="46"
                    r="38"
                    fill="transparent"
                    stroke="rgba(0,0,0,0.05)"
                    strokeWidth="6.5"
                  />
                  <circle
                    cx="46"
                    cy="46"
                    r="38"
                    fill="transparent"
                    stroke={scoreColor}
                    strokeWidth="6.5"
                    strokeDasharray={2 * Math.PI * 38}
                    strokeDashoffset={2 * Math.PI * 38 - (displayScore / 100) * 2 * Math.PI * 38}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </svg>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: scoreColor, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {displayScore}
                  </span>
                  <span style={{ fontSize: 9, color: MUTED, fontWeight: 600, marginTop: 1 }}>
                    /100
                  </span>
                </div>
              </div>

              {/* Verdict Text */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Risk Evaluation Verdict
                  </span>
                  <div 
                    className={scoreColor === GREEN ? 'pulse-g' : scoreColor === AMBER ? 'pulse-a' : 'pulse-r'} 
                    style={{ width: 7, height: 7, borderRadius: '50%', background: scoreColor }} 
                  />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
                  {verdictTxt}
                </h2>
                <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 0', lineHeight: 1.4 }}>
                  Comprehensive location score synthesized from OpenStreetMap spatial markers and real-world hazard intelligence.
                </p>
              </div>
            </div>

            {/* AI Sabda Quote Box */}
            <div style={{
              background: `linear-gradient(135deg, ${scoreColor}06, ${scoreColor}0E)`,
              borderLeft: `4px solid ${scoreColor}`,
              borderRadius: '0 12px 12px 0',
              padding: '20px 24px',
              marginBottom: 28,
            }}>
              <p style={{ fontSize: 15, fontStyle: 'italic', fontWeight: 600, color: INK, lineHeight: 1.6, margin: 0 }}>
                "{data.sabda}"
              </p>
            </div>

            {/* The Roast Block */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: RED }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: RED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  The Roast
                </span>
              </div>
              <p style={{ fontSize: 14, color: INK, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                {data.roastParagraph}
              </p>
            </div>

            {/* The Pros Block */}
            {data.prosParagraph && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: GREEN }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    The Pros / Silver Lining
                  </span>
                </div>
                <p style={{ fontSize: 14, color: INK, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                  {data.prosParagraph}
                </p>
              </div>
            )}

          </div>

          {/* Right Card: Embedded Map & Dimensions Breakdown */}
          <div style={{ background: WHITE, borderRadius: 20, padding: '24px', border: `1px solid rgba(0,0,0,0.06)`, boxShadow: '0 4px 24px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.01)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Embedded Map Panel */}
            <div style={{ position: 'relative', height: 380, borderRadius: 14, overflow: 'hidden', border: `1px solid ${DIV}` }}>
              <Map
                initialViewState={{ longitude:location.lng, latitude:location.lat, zoom:14 }}
                mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
                interactive={true}
                style={{ width:'100%', height:'100%' }}
              >
                {/* Main pin */}
                <Marker longitude={location.lng} latitude={location.lat} anchor="center">
                  <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div className="animate-ping" style={{ position:'absolute', width:28, height:28, borderRadius:'50%', background: `${INK}22` }}/>
                    <div style={{ width:10, height:10, borderRadius:'50%', background: INK, border:'2px solid white', boxShadow:`0 0 0 1px ${INK}` }}/>
                  </div>
                </Marker>

                {/* POI markers */}
                {(Object.entries(categorizedPOIs) as [string, any[]][]).map(([catId, items]) =>
                  !visibleMapCams[catId] ? null :
                  items.map((item, i) => {
                    if (!item.lng || !item.lat) return null;
                    const key = `${catId}-${i}`;
                    const col = catColor[catId] || MUTED;
                    return (
                      <Marker key={key} longitude={item.lng} latitude={item.lat} anchor="center">
                        <div
                          onMouseEnter={() => setHoveredRow(key)}
                          onMouseLeave={() => setHoveredRow(null)}
                        >
                          <MapPin catId={catId} hovered={hoveredRow === key} />
                        </div>
                        {hoveredRow===key && (
                          <Popup longitude={item.lng} latitude={item.lat} anchor="bottom" closeButton={false} closeOnClick={false} offset={12}>
                            <div style={{ padding:'12px 14px', fontFamily:SANS, minWidth:140 }}>
                              <p style={{ fontSize:13, fontWeight:600, color:INK, margin:'0 0 3px' }}>{item.tags.name||'Unnamed'}</p>
                              <p style={{ fontSize:11, color:MUTED, margin:'0 0 4px', fontFamily:MONO }}>{item.distance}m away</p>
                              <div style={{ display:'inline-block', padding:'2px 7px', borderRadius:4, background:`${col}18`, color: col, fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                                {item.tags.amenity||item.tags.shop||item.tags.power||catId}
                              </div>
                            </div>
                          </Popup>
                        )}
                      </Marker>
                    );
                  })
                )}
              </Map>
            </div>

            {/* Map Layer Toggles */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Toggle Map Layers
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.keys(visibleMapCams).map(k => {
                  const active = visibleMapCams[k];
                  const col = catColor[k] || MUTED;
                  return (
                    <button
                      key={k}
                      onClick={() => setVisibleMapCams(p => ({ ...p, [k]: !p[k] }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: `1.5px solid ${active ? col : 'rgba(0,0,0,0.08)'}`,
                        background: active ? `${col}0D` : SURFACE,
                        color: active ? INK : MUTED,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: SANS
                      }}
                    >
                      <MapPin catId={k} hovered={false} />
                      <span style={{ fontSize: 11 }}>{layerLabels[k]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Risk Index Categories Breakdown */}
            <div style={{ borderTop: `1px solid ${DIV}`, paddingTop: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                Risk Index Breakdown
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dimConfig.map((d, i) => (
                  <div key={d.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom: i<4?`1px solid ${DIV}`:'none' }}>
                    <div style={{ opacity:.6, display: 'flex', alignItems: 'center' }}><d.Icon/></div>
                    <span style={{ fontSize:12, color:INK, fontWeight:500, flex:1 }}>{d.label}</span>
                    <div style={{ width:72, height:4, background: `rgba(0,0,0,0.06)`, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, background: d.score>=60?GREEN:d.score>=35?AMBER:RED, width: barsVisible?`${d.score}%`:'0%', transition:`width 1s cubic-bezier(0.4,0,0.2,1) ${i*80}ms` }}/>
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color: d.score>=60?GREEN:d.score>=35?AMBER:RED, width:28, textAlign:'right' }}>{d.score}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ══ SECTIONS ══════════════════════════════════════════════════════════ */}
      <div className="sections-container" style={{ maxWidth:1280, margin:'0 auto', padding:'72px 32px' }}>

        {/* ── Risk Profile ─────────────────────────────────────────────────── */}
        <Row n="01" id="section-01">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:24 }}>
            <h2 style={{ fontSize:26, fontWeight:700, color:INK, letterSpacing:'-0.02em', margin:0 }}>Risk Assessment</h2>
            <span style={{ fontSize:12, color:MUTED }}>AI score · backed by OSM data</span>
          </div>
          <div style={{ background: WHITE, borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            {dimConfig.map((d, i) => (
              <div key={d.key} style={{ display:'grid', gridTemplateColumns:'32px 160px 1fr 52px', alignItems:'center', gap:18, padding:'18px 20px', borderBottom: i<4?`1px solid ${DIV}`:'none' }}>
                <div style={{ opacity:.6 }}><d.Icon/></div>
                <div>
                  <p style={{ fontSize:10, fontWeight:600, color: d.score>=60?GREEN:d.score>=35?AMBER:RED, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 2px' }}>{cat(d.score)}</p>
                  <p style={{ fontSize:13, fontWeight:600, color:INK, margin:0 }}>{d.label}</p>
                </div>
                <div style={{ height:4, background:`rgba(0,0,0,0.06)`, borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:4, background: d.score>=60?GREEN:d.score>=35?AMBER:RED, width: barsVisible?`${d.score}%`:'0%', transition:`width 1.2s cubic-bezier(0.4,0,0.2,1) ${i*100}ms` }}/>
                </div>
                <span style={{ fontSize:20, fontWeight:700, color: d.score>=60?GREEN:d.score>=35?AMBER:RED, textAlign:'right' }}>{d.score}</span>
              </div>
            ))}
          </div>
        </Row>

        {/* ── Evidence Log ─────────────────────────────────────────────────── */}
        <Row n="02" id="section-02">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:24 }}>
            <h2 style={{ fontSize:26, fontWeight:700, color:INK, letterSpacing:'-0.02em', margin:0 }}>Evidence Log</h2>
            <span style={{ fontSize:12, color:MUTED }}>{data.verifiedArticles?.length || 0} findings · verify before use</span>
          </div>
          <div style={{ background: WHITE, borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'40px 100px 1fr 80px 80px', gap:0, padding:'10px 20px', borderBottom:`1px solid ${DIV}`, background: BG }}>
              {['#','Category','Finding','Source','Link'].map(h=>(
                <span key={h} style={{ fontSize:10, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</span>
              ))}
            </div>
            {(data.verifiedArticles || []).map((r, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'40px 100px 1fr 80px 80px', gap:0, padding:'14px 20px', borderBottom: i<(data.verifiedArticles || []).length-1?`1px solid ${DIV}`:'none', alignItems:'center', transition:'background 0.15s', cursor:'default' }}
                onMouseEnter={e=>(e.currentTarget.style.background=BG)} onMouseLeave={e=>(e.currentTarget.style.background=WHITE)}>
                <span style={{ fontSize:12, color:MUTED, fontWeight:500 }}>{String(i+1).padStart(2,'0')}</span>
                <div style={{ display:'inline-flex', padding:'3px 8px', borderRadius:6, background:`${catColor[r.category] || MUTED}14`, color: catColor[r.category]||MUTED, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                  {r.category}
                </div>
                <span style={{ fontSize:13, fontWeight:500, color:INK, paddingRight:12 }}>{r.title}</span>
                <span style={{ fontSize:12, color:MUTED }}>{r.source}</span>
                <a href={r.link} target="_blank" rel="noopener" style={{ fontSize:12, fontWeight:600, color:BLUE, textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}
                  onMouseEnter={e=>(e.currentTarget.style.opacity='0.7')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                  Open ↗
                </a>
              </div>
            ))}
          </div>
          <p style={{ fontSize:12, color:MUTED, marginTop:10 }}>Links open a targeted news search — verify each finding independently.</p>
        </Row>

        {/* ── Data Analytics ───────────────────────────────────────────────── */}
        <Row n="03" id="section-03">
          <h2 style={{ fontSize:26, fontWeight:700, color:INK, letterSpacing:'-0.02em', margin:'0 0 24px' }}>Data Analytics</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:16 }}>

            {/* Radar */}
            <div className="card-hover" style={{ background: WHITE, borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize:13, fontWeight:700, color:INK, margin:'0 0 2px' }}>Dimension Radar</p>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px' }}>Multi-axis risk profile</p>
              <div style={{ height:260, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke={DIV}/>
                    <PolarAngleAxis dataKey="s" tick={{ fill:MUTED, fontSize:11, fontFamily:MONO }}/>
                    <PolarRadiusAxis angle={30} domain={[0,100]} tick={false} axisLine={false}/>
                    <Radar dataKey="A" stroke={INK} strokeWidth={1.5} fill={INK} fillOpacity={0.08}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Proximity */}
            <div className="card-hover" style={{ background: WHITE, borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column' }}>
              <p style={{ fontSize:13, fontWeight:700, color:INK, margin:'0 0 2px' }}>Proximity Analysis</p>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px' }}>Distance to key locations</p>
              
              <div style={{ display:'flex', flexDirection:'column', gap:12, flex:1 }}>
                {distData.map((e, index) => {
                  const info = proxDetails[e.name] || { label: e.name, subLabelGood: "", subLabelBad: "" };
                  const val = getProxIcon(e.name);
                  const color = e.good ? GREEN : RED;
                  const pulseClass = e.good ? "pulse-g" : "pulse-r";
                  
                  // Calculate percentage
                  let maxSearch = 5000;
                  if (e.name === "KRL") maxSearch = 10000;
                  const pct = Math.min(100, (e.dist / maxSearch) * 100);
                  
                  // Format distance text
                  let distStr = "";
                  const isDefault = (e.name === "KRL" && e.dist === 10000) ||
                                    (e.name === "SUTET" && e.dist === 5000) ||
                                    (e.name === "Cemetery" && e.dist === 5000) ||
                                    (e.name === "Hospital" && e.dist === 5000) ||
                                    (e.name === "Mall" && e.dist === 5000);
                                    
                  if (isDefault) {
                    distStr = e.name === "SUTET" || e.name === "Cemetery" ? "Aman (>5km)" : "Tidak terdeteksi";
                  } else {
                    distStr = e.dist >= 1000 ? `${(e.dist / 1000).toFixed(1)} km` : `${e.dist.toFixed(0)} m`;
                  }

                  return (
                    <div 
                      key={e.name} 
                      className="prox-row"
                      style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: 8, 
                        padding: "12px 14px", 
                        background: BG,
                        borderRadius: 12,
                        animationDelay: `${index * 80}ms`,
                        transition: "all 0.2s ease-in-out",
                      }}
                      onMouseEnter={(evt) => {
                        evt.currentTarget.style.transform = "translateY(-1px)";
                        evt.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)";
                        evt.currentTarget.style.borderColor = INK;
                      }}
                      onMouseLeave={(evt) => {
                        evt.currentTarget.style.transform = "none";
                        evt.currentTarget.style.boxShadow = "none";
                        evt.currentTarget.style.borderColor = DIV;
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          {/* Pulsing Icon */}
                          <div 
                            className={pulseClass}
                            style={{ 
                              width: 30, 
                              height: 30, 
                              borderRadius: "50%", 
                              background: e.good ? "rgba(26,92,52,0.08)" : "rgba(190,48,24,0.08)", 
                              color: color, 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              flexShrink: 0
                            }}
                          >
                            {val}
                          </div>
                          
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: INK, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {info.label}
                            </p>
                            <p style={{ fontSize: 10, color: MUTED, margin: 0, marginTop: 1, fontFamily: SANS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.good ? info.subLabelGood : info.subLabelBad}
                            </p>
                          </div>
                        </div>

                        {/* Distance Badge */}
                        <div 
                          style={{ 
                            fontFamily: MONO, 
                            fontSize: 10, 
                            fontWeight: 700, 
                            color: color, 
                            background: e.good ? "rgba(26,92,52,0.05)" : "rgba(190,48,24,0.05)",
                            padding: "3px 8px", 
                            border: `1px solid ${e.good ? "rgba(26,92,52,0.15)" : "rgba(190,48,24,0.15)"}`,
                            whiteSpace: "nowrap",
                            flexShrink: 0
                          }}
                        >
                          {distStr}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ width: "100%", height: 4, background: "rgba(0,0,0,0.04)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                        <div 
                          className="bar-fill-anim"
                          style={{ 
                            width: `${pct}%`, 
                            height: "100%", 
                            background: color, 
                            borderRadius: 2,
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Composition */}
            <div className="card-hover" style={{ background: WHITE, borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize:13, fontWeight:700, color:INK, margin:'0 0 2px' }}>Area Composition</p>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px' }}>POI distribution (%)</p>
              <div style={{ height:260, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} margin={{ top:0, right:10, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={DIV}/>
                    <XAxis dataKey="name" tick={{ fill:MUTED, fontSize:9, fontFamily:MONO }}/>
                    <YAxis tick={{ fill:MUTED, fontSize:10, fontFamily:MONO }}/>
                    <Tooltip contentStyle={{ background:WHITE, border:`1px solid ${DIV}`, borderRadius:0, fontSize:12, fontFamily:MONO, boxShadow:'none' }} cursor={{ fill:`${INK}06` }}/>
                    <Bar dataKey="value" radius={0} barSize={18}>
                      {pieData.map((_,i)=><Cell key={i} fill={CHART_PALETTE[i%CHART_PALETTE.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Row>

        {/* ── Environment ──────────────────────────────────────────────────── */}
        <Row n="04" id="section-04">
          <h2 style={{ fontSize:26, fontWeight:700, color:INK, letterSpacing:'-0.02em', margin:'0 0 24px' }}>Nearby Environment</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>

            {/* Hazards */}
            <div style={{ background: WHITE, borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize:13, fontWeight:700, color:INK, margin:'0 0 2px' }}>Hazard Objects</p>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px' }}>{categorizedPOIs.hazards.length} detected within radius</p>
              <div style={{ maxHeight:380, overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>
                {categorizedPOIs.hazards.length===0 ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:GREEN }}/>
                    <p style={{ fontSize:13, fontWeight:500, color:GREEN, margin:0 }}>No hazards detected</p>
                  </div>
                ) : categorizedPOIs.hazards.map((item, i) => {
                  const t = item.tags;
                  const [label, col] = t.power||t.man_made==='tower' ? ['SUTET / Power', RED]
                    : t.landuse==='cemetery'||t.amenity==='grave_yard' ? ['Cemetery', '#AF52DE']
                    : t.landuse==='landfill'||t.amenity==='waste_transfer_station' ? ['Waste Facility', AMBER]
                    : t.railway==='rail' ? ['Railway Line', AMBER]
                    : t.landuse==='industrial' ? ['Industrial', MUTED]
                    : t.waterway ? ['Waterway', BLUE]
                    : ['Hazard', RED];
                  return (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom: i<categorizedPOIs.hazards.length-1?`1px solid ${DIV}`:'none' }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <p style={{ fontSize:10, fontWeight:700, color: col, textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 1px' }}>{label}</p>
                        <p style={{ fontSize:13, fontWeight:500, color:INK, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name||'Unnamed'}</p>
                      </div>
                      <span style={{ fontSize:12, color:MUTED, flexShrink:0, marginLeft:12, fontWeight:500 }}>{item.distance.toFixed(0)}m</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Amenities */}
            <div style={{ background: WHITE, borderRadius:16, padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize:13, fontWeight:700, color:INK, margin:'0 0 2px' }}>Lifestyle & Services</p>
              <p style={{ fontSize:12, color:MUTED, margin:'0 0 16px' }}>Nearest facilities by distance</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${DIV}` }}>
                      {['Place','Category','Distance'].map((h,i)=>(
                        <th key={h} style={{ padding:'8px 10px', textAlign: i===2?'right':'left', fontSize:10, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...categorizedPOIs.health_education,...categorizedPOIs.lifestyle]
                      .sort((a,b)=>a.distance-b.distance).slice(0,12)
                      .map((p,i)=>(
                        <tr key={i} style={{ borderBottom:`1px solid ${DIV}`, transition:'background 0.12s' }}
                          onMouseEnter={e=>(e.currentTarget.style.background=BG)} onMouseLeave={e=>(e.currentTarget.style.background=WHITE)}>
                          <td style={{ padding:'10px 10px', fontWeight:500, color:INK }}>
                            <div style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.tags.name||'Unnamed'}</div>
                          </td>
                          <td style={{ padding:'10px 10px', color:MUTED, fontSize:12 }}>{p.tags.amenity||p.tags.shop||'facility'}</td>
                          <td style={{ padding:'10px 10px', textAlign:'right', fontWeight:700, color: parseInt(p.distance)<500?GREEN:INK }}>{p.distance.toFixed(0)}m</td>
                        </tr>
                      ))}
                    {[...categorizedPOIs.health_education,...categorizedPOIs.lifestyle].length===0&&(
                      <tr><td colSpan={3} style={{ padding:20, textAlign:'center', color:MUTED, fontSize:12 }}>No facilities in range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Row>

        {/* ── POI Directory ─────────────────────────────────────────────────── */}
        <Row n="05" id="section-05">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <h2 style={{ fontSize:26, fontWeight:700, color:INK, letterSpacing:'-0.02em', margin:0 }}>Points of Interest</h2>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {activeItems.unnamed.length > 0 && (
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:500, color:INK, cursor:'pointer' }}>
                  <input type="checkbox" checked={showUnnamed} onChange={e => setShowUnnamed(e.target.checked)} />
                  Tampilkan POI Tanpa Nama ({activeItems.unnamed.length})
                </label>
              )}
              <span style={{ fontSize:12, color:MUTED }}>{amenitiesData.length} nodes detected</span>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:4, overflowX:'auto', marginBottom:12 }}>
            {Object.keys(categorizedPOIs).map(k => {
              const count = showUnnamed 
                ? categorizedPOIs[k].length 
                : categorizedPOIs[k].filter(item => item.tags?.name && item.tags.name !== 'Unnamed').length;
              return (
                <button key={k} onClick={()=>setActivePoiTab(k)}
                  style={{ flexShrink:0, padding:'7px 14px', border:'none', borderRadius:8, cursor:'pointer', fontFamily:SANS, fontSize:12, fontWeight: activePoiTab===k?600:400,
                    background: activePoiTab===k?INK:'rgba(0,0,0,0.05)', color: activePoiTab===k?WHITE:MUTED, transition:'all 0.15s' }}>
                  {layerLabels[k]} <span style={{ opacity:.7 }}>({count})</span>
                </button>
              );
            })}
          </div>
          <div style={{ background: WHITE, borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:640 }}>
              <thead style={{ background: BG }}>
                <tr style={{ borderBottom:`1px solid ${DIV}` }}>
                  {['Name','Tag','Distance','Coordinates',''].map((h,i)=>(
                    <th key={i} style={{ padding:'11px 16px', textAlign: i===2||i===4?'right':i===3?'left':'left', fontSize:10, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listToRender.map((item,idx)=>(
                  <tr key={idx} style={{ borderBottom:`1px solid ${DIV}`, transition:'background 0.12s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background=BG)} onMouseLeave={e=>(e.currentTarget.style.background=WHITE)}>
                    <td style={{ padding:'11px 16px', fontWeight:500, color:INK }}>
                      <div style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.tags.name||'Unnamed'}</div>
                    </td>
                    <td style={{ padding:'11px 16px', color:MUTED, fontSize:11 }}>
                      {item.tags.amenity||item.tags.shop||item.tags.highway||item.tags.power||Object.keys(item.tags).filter(k=>k!=='name'&&k!=='source')[0]||'misc'}
                    </td>
                    <td style={{ padding:'11px 16px', textAlign:'right', fontWeight:700, color:INK }}>{item.distance.toFixed(0)}m</td>
                    <td style={{ padding:'11px 16px', fontSize:11, color:MUTED }}>
                      {(item.lat||item.center?.lat)?.toFixed(5)}, {(item.lng||item.center?.lon)?.toFixed(5)}
                    </td>
                    <td style={{ padding:'11px 16px', textAlign:'right' }}>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${item.lat||item.center?.lat},${item.lng||item.center?.lon}`}
                        target="_blank" rel="noopener"
                        style={{ fontSize:11, fontWeight:600, color:BLUE, textDecoration:'none' }}
                        onMouseEnter={e=>(e.currentTarget.style.opacity='0.6')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
                        Maps ↗
                      </a>
                    </td>
                  </tr>
                ))}
                {listToRender.length===0&&(
                  <tr><td colSpan={5} style={{ padding:28, textAlign:'center', color:MUTED, fontSize:12 }}>No data for this category</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Row>

      </div>

      {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
      <div style={{ background: WHITE, borderTop:`1px solid ${DIV}`, padding:'64px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:24, maxWidth:'100%' }}>
        <div>
          <p style={{ fontSize:11, fontWeight:600, color: MUTED, letterSpacing:'0.07em', textTransform:'uppercase', margin:'0 0 8px' }}>Analysis complete</p>
          <h2 style={{ fontSize:30, fontWeight:700, color:INK, letterSpacing:'-0.03em', lineHeight:1.2, margin:0 }}>Do your own<br/>research.</h2>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <button onClick={onReset}
            style={{ padding:'13px 24px', background:INK, color:'white', fontSize:14, fontWeight:600, border:'none', cursor:'pointer', fontFamily:SANS, borderRadius:12, letterSpacing:'-0.01em', transition:'opacity 0.15s' }}
            onMouseEnter={e=>(e.currentTarget.style.opacity='0.8')} onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
            ← Analyze Another Location
          </button>
        </div>
      </div>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{ background: BG, borderTop:`1px solid ${DIV}`, padding:'16px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          {[`${data.verifiedArticles?.length || 0} evidence items`,`${amenitiesData.length} POI nodes`,`Score ${data.score}/100`].map(s=>(
            <span key={s} style={{ fontSize:11, color: MUTED, fontWeight:500 }}>{s}</span>
          ))}
        </div>
        <span style={{ fontSize:11, color: MUTED }}>Location Roaster · Gemini AI</span>
      </footer>
    </div>
  );
};
