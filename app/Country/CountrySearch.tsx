/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  FaGoogle,
  FaWikipediaW,
  FaTripadvisor,
  FaYoutube,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaSearch,
  FaMapMarkerAlt,
  FaUsers,
  FaRulerCombined,
  FaGlobeAmericas,
  FaLanguage,
  FaClock,
} from "react-icons/fa";

import FlightSearch from "./FlightSearch";

/* ------------------------------------------------------------------ */
/*  Lite & Full country types                                         */
/* ------------------------------------------------------------------ */
interface LiteCountry {
  cca3: string;
  name: { common: string };
  flags?: { png?: string; alt?: string };
}

export interface FullCountry extends LiteCountry {
  latlng?: [number, number];
  capital?: string[];
  tld?: string[];
  area?: number;
  population?: number;
  continents?: string[];
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { symbol: string }>;
  borders?: string[];
  timezones?: string[];
}

interface Extras {
  weather?: { temperature: number; windspeed?: number };
  fx?: number | null;
  wiki?: { extract?: string; thumbnail?: { source: string } };
  sights?: { title: string; dist: number }[];
  photos?: string[];
}

/* ---------------- constants & helpers ---------------- */
const lc = (s: string) => (s || "").toLowerCase();
const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");

const CACHE_FEATURED_KEY = "travelExplorerFeatured";
const featuredPickCount = 12;

const Spinner = () => (
  <div className="flex justify-center items-center py-10">
    <div className="h-10 w-10 animate-spin rounded-full border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300" />
  </div>
);

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clampText(s?: string, max = 340) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function getFeatured(mini: LiteCountry[]) {
  // Persist a stable “featured” set so it doesn't feel random every refresh.
  try {
    const raw = localStorage.getItem(CACHE_FEATURED_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const map = new Map(mini.map((c) => [c.cca3, c]));
      const picked = ids.map((id) => map.get(id)).filter(Boolean) as LiteCountry[];
      if (picked.length >= Math.min(featuredPickCount, mini.length)) return picked.slice(0, featuredPickCount);
    }
  } catch {
    /* ignore */
  }

  const shuffled = [...mini]
    .sort((a, b) => lc(a.name.common).localeCompare(lc(b.name.common)))
    .sort(() => Math.random() - 0.5)
    .slice(0, featuredPickCount);

  try {
    localStorage.setItem(CACHE_FEATURED_KEY, JSON.stringify(shuffled.map((c) => c.cca3)));
  } catch {
    /* ignore */
  }

  return shuffled;
}

/* ================================================================== */
/*  Component                                                         */
/* ================================================================== */
export default function CountrySearch() {
  const [mini, setMini] = useState<LiteCountry[]>([]);
  const [initial, setInit] = useState(true);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<LiteCountry[]>([]);

  const [full, setFull] = useState<FullCountry | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [mapURL, setMapURL] = useState("");

  /* ---- lightbox state ---- */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const photos: string[] = extras?.photos ?? [];

  /* ---- sticky header focus (keyboard) ---- */
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* ---- swipe for lightbox ---- */
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    touchStartX.current = null;
    if (sx == null || ex == null || !viewerOpen) return;
    const dx = ex - sx;
    if (Math.abs(dx) < 45) return;
    if (dx > 0) prevImg();
    else nextImg();
  };

  /* ---------------------------------------------------------------- */
  /*  Fetch the lite list on mount                                    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("https://restcountries.com/v3.1/all?fields=name,flags,cca3");
        const js = await res.json();
        if (Array.isArray(js)) setMini(js);
      } finally {
        setInit(false);
      }
    })();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Lightbox keyboard + body scroll lock                             */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!viewerOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevImg();
      else if (e.key === "ArrowRight") nextImg();
      else if (e.key === "Escape") closeViewer();
    };

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, photos.length]);

  /* ---------------------------------------------------------------- */
  /*  Search derived (suggestions)                                     */
  /* ---------------------------------------------------------------- */
  const suggestions = useMemo(() => {
    const t = lc(q.trim());
    if (!t) return [];
    return mini
      .filter((c) => lc(c.name.common).includes(t))
      .slice(0, 8);
  }, [q, mini]);

  const featured = useMemo(() => {
    if (!mini.length) return [];
    return getFeatured(mini);
  }, [mini]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                        */
  /* ---------------------------------------------------------------- */
  const runSearch = useCallback(() => {
    const t = q.trim();
    if (!t) {
      setResults([]);
      return;
    }
    const hits = mini.filter((c) => lc(c.name.common).includes(lc(t)));
    setResults(hits);
    // keep query so user can refine; feels nicer than clearing
    // setQ("");
    if (hits[0]) loadDetails(hits[0].cca3);
  }, [q, mini]);

  const pickCountry = useCallback(
    (cca3: string) => {
      loadDetails(cca3);
      setResults([]);
      // mobile-friendly “jump to detail”
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mini],
  );

  const loadDetails = useCallback(async (cca3: string) => {
    setLoadingDetails(true);
    setExtras(null);

    try {
      const fullData: FullCountry = (
        await fetch(`https://restcountries.com/v3.1/alpha/${cca3}`).then((r) => r.json())
      )[0];

      setFull(fullData);

      /* Map */
      if (fullData.latlng?.length === 2) {
        const [lat, lng] = fullData.latlng;
        setMapURL(`https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`);
      } else {
        setMapURL("");
      }

      /* Extra data */
      const [weather, fx, wiki, geo, pics] = await Promise.all([
        fullData.latlng
          ? fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${fullData.latlng[0]}&longitude=${fullData.latlng[1]}&current_weather=true`,
            )
              .then((r) => r.json())
              .then((j) =>
                j?.current_weather
                  ? { temperature: j.current_weather.temperature, windspeed: j.current_weather.windspeed }
                  : undefined,
              )
          : undefined,

        (() => {
          const code = fullData.currencies ? Object.keys(fullData.currencies)[0] : "USD";
          return fetch(`https://api.exchangerate.host/latest?base=${code}&symbols=USD`)
            .then((r) => r.json())
            .then((j) => j?.rates?.USD ?? null)
            .catch(() => null);
        })(),

        fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(fullData.name.common)}`,
        )
          .then((r) => r.json())
          .catch(() => ({})),

        fullData.latlng
          ? fetch(
              `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${fullData.latlng[0]}|${fullData.latlng[1]}&format=json&origin=*`,
            )
              .then((r) => r.json())
              .then((j) => j?.query?.geosearch)
              .catch(() => [])
          : undefined,

        fetch(`https://u-mail.co/api/photo?tags=${encodeURIComponent(fullData.name.common)}&limit=8`)
          .then((r) => r.json())
          .catch(() => []),
      ]);

      setExtras({
        weather,
        fx,
        wiki,
        sights: geo?.map((g: any) => ({ title: g.title, dist: g.dist })) ?? [],
        photos: Array.isArray(pics) ? pics : [],
      });
    } catch (err) {
      console.error("loadDetails error:", err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Derived values                                                  */
  /* ---------------------------------------------------------------- */
  const neighbors = useMemo(() => mini.filter((c) => full?.borders?.includes(c.cca3)), [full, mini]);

  const topSights = useMemo(() => {
    const s = extras?.sights ?? [];
    return [...s].sort((a, b) => a.dist - b.dist).slice(0, 6);
  }, [extras]);

  const closeViewer = () => setViewerOpen(false);
  const prevImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const nextImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((i) => (i + 1) % photos.length);
  }, [photos.length]);

  /* ---------------------------------------------------------------- */
  /*  UI pieces                                                       */
  /* ---------------------------------------------------------------- */
  const CountryTile = ({
    c,
    onClick,
  }: {
    c: LiteCountry;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10",
        "bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md transition",
        "h-24 sm:h-28",
      )}
      style={{
        backgroundImage: c.flags?.png ? `url(${c.flags.png})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      title={c.name.common}
    >
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/20 transition" />
      <div className="absolute inset-0 flex items-end p-3">
        <div className="w-full">
          <div className="text-sm font-extrabold text-white drop-shadow line-clamp-1">
            {c.name.common}
          </div>
        </div>
      </div>
    </button>
  );

  const Pill = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900/40 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
          {label}
        </div>
      </div>
      <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white line-clamp-1">
        {value}
      </div>
    </div>
  );

  const ActionLink = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
  }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold",
        "border border-black/10 dark:border-white/10",
        "bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]",
        "text-gray-900 dark:text-white shadow-sm transition",
      )}
    >
      <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>
      {label}
    </a>
  );

  /* ================================================================= */
  /*  RENDER                                                           */
  /* ================================================================= */
  return (
    <div
      ref={rootRef}
      className={cn(
        "min-h-screen p-4 sm:p-6",
        "bg-gradient-to-br from-indigo-50 to-purple-100",
        "dark:from-brand-900 dark:to-brand-900",
        "text-gray-900 dark:text-gray-100",
      )}
    >
      {/* ---------------- Sticky header ---------------- */}
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-4 bg-gradient-to-b from-indigo-50/90 to-transparent dark:from-brand-900/90 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-center text-2xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            🌍 Travel Explorer
          </h1>

          {/* Search */}
          <div className="mt-4 relative mx-auto max-w-xl">
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] shadow-sm px-3 py-2">
              <FaSearch className="text-gray-500 dark:text-white/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search a country…"
                className="flex-1 bg-transparent outline-none text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-white/40"
              />
              <button
                onClick={runSearch}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold px-4 py-2 transition"
                type="button"
              >
                Go
              </button>
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.cca3}
                    type="button"
                    onClick={() => {
                      setQ("");
                      pickCountry(s.cca3);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition flex items-center justify-between"
                  >
                    <span className="font-semibold text-gray-900 dark:text-white">{s.name.common}</span>
                    <span className="text-xs text-gray-500 dark:text-white/50">Open</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        {/* ---------------- Featured / results tiles ---------------- */}
        {initial ? (
          <Spinner />
        ) : (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                {results.length ? `Results (${results.length})` : "Featured"}
              </div>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => setResults([])}
                  className="text-xs font-extrabold text-indigo-700 dark:text-indigo-200 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(results.length ? results : featured).map((c) => (
                <CountryTile key={c.cca3} c={c} onClick={() => pickCountry(c.cca3)} />
              ))}
            </div>
          </div>
        )}

        {/* ---------------- Detail panel ---------------- */}
        {full && (
          <div className="mt-8 rounded-3xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-brand-900/55 backdrop-blur shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-7 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-4">
                {full.flags?.png && (
                  <img
                    src={full.flags.png}
                    alt={full.flags.alt || `Flag of ${full.name.common}`}
                    className="w-14 h-10 sm:w-16 sm:h-12 object-cover rounded-lg shadow ring-1 ring-black/10"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-3xl font-extrabold text-gray-900 dark:text-white line-clamp-1">
                    {full.name.common}
                  </h2>
                  <div className="mt-1 text-xs text-gray-600 dark:text-white/60">
                    {full.continents?.join(", ") || "—"}
                    {full.subregion ? ` • ${full.subregion}` : ""}
                  </div>
                </div>

                {/* Tiny “status” on the right */}
                <div className="ml-auto hidden sm:flex items-center gap-2">
                  {extras?.weather?.temperature != null && (
                    <span className="rounded-full px-3 py-1 text-xs font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-1 ring-indigo-500/20">
                      {Math.round(extras.weather.temperature)}°C
                    </span>
                  )}
                  {extras?.fx != null && (
                    <span className="rounded-full px-3 py-1 text-xs font-extrabold bg-black/[0.04] dark:bg-white/[0.08] text-gray-800 dark:text-white ring-1 ring-black/5 dark:ring-white/10">
                      FX→USD: {extras.fx.toFixed(3)}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionLink
                  href={`https://news.google.com/search?q=${encodeURIComponent(full.name.common + " travel")}`}
                  icon={<FaGoogle />}
                  label="News"
                />
                <ActionLink
                  href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(full.name.common)}`}
                  icon={<FaWikipediaW />}
                  label="Wikivoyage"
                />
                <ActionLink
                  href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(full.name.common)}`}
                  icon={<FaTripadvisor />}
                  label="Tripadvisor"
                />
                <ActionLink
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(full.name.common + " travel guide")}`}
                  icon={<FaYoutube />}
                  label="YouTube"
                />
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-7">
              {loadingDetails && !extras ? (
                <Spinner />
              ) : (
                <>
                  {/* Map */}
                  {mapURL && (
                    <div className="rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
                      <iframe
                        src={mapURL}
                        height={320}
                        className="w-full"
                        loading="lazy"
                        title={`${full.name.common} map`}
                      />
                    </div>
                  )}

                  {/* Photos */}
                  {photos.length > 0 && (
                    <div className="mt-5">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                        Photos
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                        {photos.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setViewerIdx(i);
                              setViewerOpen(true);
                            }}
                            className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-sm"
                            title="Open photo"
                          >
                            <img src={p} alt="Gallery" className="h-full w-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick facts (clean + compact) */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Pill
                      icon={<FaMapMarkerAlt />}
                      label="Capital"
                      value={full.capital?.[0] ?? "—"}
                    />
                    <Pill
                      icon={<FaUsers />}
                      label="Population"
                      value={fmt(full.population)}
                    />
                    <Pill
                      icon={<FaRulerCombined />}
                      label="Area"
                      value={full.area != null ? `${fmt(full.area)} km²` : "—"}
                    />
                    <Pill
                      icon={<FaGlobeAmericas />}
                      label="Currency"
                      value={
                        full.currencies
                          ? Object.keys(full.currencies)[0] +
                            (Object.values(full.currencies)[0]?.symbol
                              ? ` (${Object.values(full.currencies)[0].symbol})`
                              : "")
                          : "—"
                      }
                    />
                    <Pill
                      icon={<FaLanguage />}
                      label="Languages"
                      value={full.languages ? Object.values(full.languages).slice(0, 3).join(", ") : "—"}
                    />
                    <Pill
                      icon={<FaClock />}
                      label="Timezones"
                      value={full.timezones?.slice(0, 2).join(", ") ?? "—"}
                    />
                    <Pill
                      icon={<span className="font-extrabold">⛅</span>}
                      label="Weather"
                      value={extras?.weather?.temperature != null ? `${Math.round(extras.weather.temperature)}°C` : "—"}
                    />
                    <Pill
                      icon={<span className="font-extrabold">💱</span>}
                      label="FX → USD"
                      value={extras?.fx != null ? `${extras.fx.toFixed(4)}` : "—"}
                    />
                  </div>

                  {/* Neighbors */}
                  {neighbors.length > 0 && (
                    <div className="mt-7">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                        Neighbors
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                        {neighbors.map((n) => (
                          <button
                            key={n.cca3}
                            type="button"
                            onClick={() => pickCountry(n.cca3)}
                            className="relative w-28 h-16 flex-shrink-0 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 shadow-sm"
                            style={{
                              backgroundImage: n.flags?.png ? `url(${n.flags.png})` : undefined,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                            title={n.name.common}
                          >
                            <div className="absolute inset-0 bg-black/25" />
                            <div className="absolute bottom-1 left-0 right-0 text-center text-[11px] font-extrabold text-white drop-shadow line-clamp-1 px-2">
                              {n.name.common}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top sights (compact chips, not wordy cards) */}
                  {topSights.length > 0 && (
                    <div className="mt-7">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                        Places nearby
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {topSights.map((s, i) => (
                          <a
                            key={i}
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold",
                              "border border-black/10 dark:border-white/10",
                              "bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]",
                              "shadow-sm transition",
                            )}
                            title="Open in Google Maps"
                          >
                            <span className="text-indigo-600 dark:text-indigo-300">📍</span>
                            <span className="max-w-[220px] truncate">{s.title}</span>
                            <span className="text-gray-500 dark:text-white/50">
                              {(s.dist / 1000).toFixed(1)}km
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wiki summary (short + clean) */}
                  {extras?.wiki?.extract && (
                    <div className="mt-7 rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-5">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                        Quick read
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-white/80">
                        {clampText(extras.wiki.extract, 420)}
                      </p>
                    </div>
                  )}

                  {/* Flight search */}
                  <div className="mt-8">
                    <FlightSearch full={full} />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Image Lightbox ---------------- */}
      {viewerOpen && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* close */}
          <button
            onClick={closeViewer}
            className="absolute right-4 top-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-xl"
            type="button"
            aria-label="Close"
          >
            <FaTimes />
          </button>

          {/* prev / next (bigger hit targets for mobile) */}
          <button
            onClick={prevImg}
            className="absolute left-3 sm:left-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-2xl"
            type="button"
            aria-label="Previous"
          >
            <FaChevronLeft />
          </button>
          <button
            onClick={nextImg}
            className="absolute right-3 sm:right-6 h-12 w-12 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-2xl"
            type="button"
            aria-label="Next"
          >
            <FaChevronRight />
          </button>

          {/* image */}
          <img
            src={photos[viewerIdx]}
            alt="Large"
            className="max-h-[82svh] max-w-[92vw] rounded-2xl shadow-2xl"
            onClick={nextImg} // tap to advance
          />

          {/* index pill */}
          <div className="absolute bottom-5 rounded-full bg-white/10 text-white text-xs font-extrabold px-4 py-2">
            {viewerIdx + 1} / {photos.length}
            <span className="ml-2 text-white/70 font-bold hidden sm:inline">Swipe or use arrows</span>
          </div>
        </div>
      )}
    </div>
  );
}
