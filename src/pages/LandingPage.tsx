import React, { useState, useEffect } from "react";
import { searchNominatim } from "../lib/osmapi";
import { LocationResult } from "../types";
import Map, { Marker } from "react-map-gl/maplibre";
import { Search, X, ArrowRight, Move, ZoomIn, MousePointerClick } from "lucide-react";
import { IconLogo } from "../components/BrutalistIcons";

interface LandingPageProps {
  onLocationSelected: (loc: LocationResult) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLocationSelected }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  const [viewState, setViewState] = useState({
    longitude: 106.8456,
    latitude: -6.2088,
    zoom: 11,
  });

  const [pinLocation, setPinLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 800);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const fetch = async () => {
      if (debouncedQuery.length > 3 && !selectedResult) {
        try {
          const data = await searchNominatim(debouncedQuery);
          setResults(Array.isArray(data) ? data.slice(0, 5) : []);
        } catch {
          setResults([]);
        }
      } else if (debouncedQuery.length <= 3) {
        setResults([]);
      }
    };
    fetch();
  }, [debouncedQuery, selectedResult]);



  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (selectedResult) setSelectedResult(null);
  };

  const handleSelectArea = (result: any) => {
    setSelectedResult(result);
    setViewState(prev => ({
      ...prev,
      longitude: parseFloat(result.lon),
      latitude: parseFloat(result.lat),
      zoom: 15,
    }));
    setPinLocation([parseFloat(result.lat), parseFloat(result.lon)]);
    setQuery(result.display_name);
    setResults([]);
  };

  const handleMapClick = (e: any) => {
    if (selectedResult) {
      setPinLocation([e.lngLat.lat, e.lngLat.lng]);
    }
  };

  const handleStartRoast = () => {
    if (!pinLocation || !selectedResult) return;
    onLocationSelected({
      lat: pinLocation[0],
      lng: pinLocation[1],
      displayName: selectedResult.display_name,
    });
  };

  const handleReset = () => {
    setSelectedResult(null);
    setPinLocation(null);
    setQuery("");
  };
  return (
    <div className="h-screen w-screen bg-[#F5F5F7] overflow-hidden relative">

      {/* ── Fullscreen Map ── */}
      <div className="absolute inset-0">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onClick={handleMapClick}
          interactive={true}
        >
          {pinLocation && (
            <Marker longitude={pinLocation[1]} latitude={pinLocation[0]} anchor="center">
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{ width: 36, height: 36, background: "rgba(0,122,255,0.18)" }}
                />
                <div
                  className="rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    background: "#007AFF",
                    border: "2.5px solid white",
                    boxShadow: "0 2px 10px rgba(0,122,255,0.45)",
                  }}
                />
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {/* ── Bottom gradient overlay (landing only) ── */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10 transition-opacity duration-700"
        style={{
          height: "420px",
          opacity: selectedResult ? 0 : 1,
          background: "linear-gradient(to top, #F5F5F7 0%, rgba(245,245,247,0.75) 50%, transparent 100%)",
        }}
      />

      {/* ── Left gradient overlay (landing only) ── */}
      <div
        className="absolute left-0 inset-y-0 pointer-events-none z-10 transition-opacity duration-700 hidden md:block"
        style={{
          width: "600px",
          opacity: selectedResult ? 0 : 1,
          background: "linear-gradient(to right, #F5F5F7 0%, rgba(245,245,247,0.9) 40%, rgba(245,245,247,0.7) 70%, transparent 100%)",
        }}
      />

      {/* ── UI Layer ── */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">

        {/* Header pill */}
        <header className="w-full p-5 md:p-6 flex items-center z-50 pointer-events-auto">
          <div
            className="flex items-center gap-2.5 rounded-full px-4 py-2 shadow-sm"
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ width: 22, height: 22 }} className="flex items-center justify-center">
              <IconLogo />
            </div>
            <span className="text-sm font-semibold text-slate-800 tracking-tight">Location Roaster</span>
            <span className="text-sm text-slate-400 font-normal hidden sm:inline">· AI Property Risk</span>
          </div>
        </header>

        {/* Search bar — top-left, disappears on select */}
        <div
          className="absolute z-40 w-full max-w-sm pointer-events-auto transition-all duration-500"
          style={{
            top: "80px",
            left: "24px",
            opacity: selectedResult ? 0 : 1,
            transform: selectedResult ? "translateY(-12px)" : "translateY(0)",
            pointerEvents: selectedResult ? "none" : "auto",
          }}
        >
          <div
            className="relative flex items-center px-4 py-3 rounded-2xl transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.07)",
            }}
          >
            <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
            <input
              type="text"
              placeholder="Cari area, kelurahan, kecamatan..."
              value={query}
              onChange={handleSearch}
              className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder-slate-400 outline-none font-medium"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); }}
                className="ml-2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                style={{ background: "rgba(0,0,0,0.06)" }}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {results.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
              style={{
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.10)",
              }}
            >
              <ul className="py-2">
                {results.map((r, i) => (
                  <li
                    key={i}
                    onClick={() => handleSelectArea(r)}
                    className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-0"
                  >
                    <span className="text-sm font-semibold text-slate-800">{r.display_name.split(",")[0]}</span>
                    <span className="text-xs text-slate-400 truncate">{r.display_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Hero content — bottom-left, landing state ── */}
        <div
          className="absolute left-0 bottom-0 p-6 md:p-10 max-w-xl pointer-events-none transition-all duration-700"
          style={{
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            opacity: selectedResult ? 0 : 1,
            transform: selectedResult ? "translateY(24px)" : "translateY(0)",
            pointerEvents: selectedResult ? "none" : "auto",
          }}
        >
          {/* Title & description */}
          <div className="mb-5 pointer-events-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50/70 border border-blue-100 mb-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
              <span className="text-[10px] font-bold text-[#007AFF] tracking-wider uppercase">
                Location Roaster
              </span>
            </div>
            <h1
              className="font-bold text-slate-900 tracking-tight leading-tight mb-4"
              style={{ fontSize: "clamp(2.1rem, 4.2vw, 3.25rem)" }}
            >
              Katanya 5 Menit Ke Tol?<br />Cek Dulu Biar Gak Dongkol.
            </h1>
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-lg">
              Jangan gampang percaya jargon "Bebas Banjir", "Green Living", atau "Akses Eksklusif" di brosur marketing. AI kami langsung memindai data spasial riil OpenStreetMap untuk membedah fakta lapangan—mulai dari banjir tahunan, tiang SUTET gaib, stasiun KRL yang ternyata jauh, hingga kemacetan parah di depan gerbang. Cepat, tajam, dan tanpa filter sebelum kamu terikat cicilan KPR 30 tahun.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-5 pointer-events-auto">
            {[
              { icon: "🌊", label: "Banjir & Bencana" },
              { icon: "🔪", label: "Kriminalitas" },
              { icon: "🚗", label: "Kemacetan" },
              { icon: "⚡", label: "SUTET & Polusi" },
              { icon: "🚇", label: "Akses Transit" },
            ].map(f => (
              <div
                key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-600 font-medium"
                style={{
                  background: "rgba(255,255,255,0.65)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.55)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                }}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          {/* How-to steps */}
          <div
            className="flex items-center gap-3 mb-5 pointer-events-auto px-4 py-2.5 rounded-full w-fit"
            style={{
              background: "rgba(255,255,255,0.5)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            {[
              { n: "1", text: "Cari area" },
              { n: "2", text: "Klik peta" },
              { n: "3", text: "Lihat hasilnya" },
            ].map((step, i, arr) => (
              <React.Fragment key={step.n}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                    style={{ fontSize: "9px", background: "#007AFF" }}
                  >
                    {step.n}
                  </span>
                  <span className="text-xs text-slate-600 font-medium whitespace-nowrap">{step.text}</span>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* CTA hint */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs text-slate-500 font-medium"
              style={{
                background: "rgba(255,255,255,0.45)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <svg
                className="w-3 h-3 animate-bounce text-[#007AFF]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Ketik nama area di kiri atas untuk mulai
            </div>
          </div>
        </div>

        {/* ── Pin placement card — after area selected ── */}
        {selectedResult && (
          <div
            className="absolute z-30 pointer-events-auto"
            style={{ top: "88px", left: "24px" }}
          >
            <div
              className="w-72 rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.88)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.65)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)",
              }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                    Sesuaikan Titik Lokasi
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Zoom & geser peta, klik untuk pindahkan pin
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full transition-colors ml-3"
                  style={{ background: "rgba(0,0,0,0.05)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Map control hints — always visible */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { Icon: Move, label: "Drag\nGeser peta", highlight: false },
                  { Icon: ZoomIn, label: "Scroll\nZoom in/out", highlight: false },
                  { Icon: MousePointerClick, label: "Klik\nPindah pin", highlight: true },
                ].map(({ Icon, label, highlight }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center"
                    style={{
                      background: highlight ? "rgba(0,122,255,0.08)" : "rgba(0,0,0,0.04)",
                    }}
                  >
                    <Icon size={13} strokeWidth={2} style={{ color: "#007AFF" }} />
                    <span
                      className="font-medium leading-tight whitespace-pre-line"
                      style={{ fontSize: "9px", color: highlight ? "#007AFF" : "#86868B" }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coordinates */}
              {pinLocation ? (
                <div
                  className="px-4 py-2.5 rounded-xl text-center mb-3"
                  style={{ background: "rgba(0,122,255,0.07)" }}
                >
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5 uppercase tracking-widest">Koordinat terpilih</p>
                  <p className="text-sm font-semibold" style={{ color: "#007AFF" }}>
                    {pinLocation[0].toFixed(5)}, {pinLocation[1].toFixed(5)}
                  </p>
                </div>
              ) : (
                <div
                  className="px-4 py-2.5 rounded-xl text-center mb-3 animate-pulse"
                  style={{ background: "rgba(0,0,0,0.04)" }}
                >
                  <p className="text-sm text-slate-400 font-medium">Menunggu klik di peta...</p>
                </div>
              )}

              {/* CTA */}
              {pinLocation && (
                <button
                  onClick={handleStartRoast}
                  className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "#1D1D1F",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                  }}
                >
                  Roast Lokasi Ini
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleReset}
                className="mt-2 w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors text-center"
              >
                Batalkan
              </button>
            </div>
          </div>
        )}



      </div>
    </div>
  );
};
