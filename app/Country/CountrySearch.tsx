/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaGlobeAmericas,
  FaGoogle,
  FaLanguage,
  FaMapMarkerAlt,
  FaRulerCombined,
  FaSearch,
  FaTimes,
  FaTripadvisor,
  FaUsers,
  FaWikipediaW,
  FaYoutube,
} from "react-icons/fa";

import FlightSearch from "./FlightSearch";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_FEATURED_KEY = "travelExplorerFeatured";
const FEATURED_PICK_COUNT = 12;
const DEFAULT_CLAMP_LENGTH = 340;
const WIKI_CLAMP_LENGTH = 460;
const SWIPE_THRESHOLD_PX = 45;
const TOP_SIGHTS_LIMIT = 6;
const SUGGESTIONS_LIMIT = 8;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const lc = (s: string) => (s || "").toLowerCase();
const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function clampText(s?: string, max = DEFAULT_CLAMP_LENGTH): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function getFeatured(mini: LiteCountry[]): LiteCountry[] {
  try {
    const raw = localStorage.getItem(CACHE_FEATURED_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const map = new Map(mini.map((c) => [c.cca3, c]));
      const picked = ids.map((id) => map.get(id)).filter(Boolean) as LiteCountry[];
      if (picked.length >= Math.min(FEATURED_PICK_COUNT, mini.length)) {
        return picked.slice(0, FEATURED_PICK_COUNT);
      }
    }
  } catch {
    /* localStorage unavailable */
  }

  const shuffled = [...mini]
    .sort((a, b) => lc(a.name.common).localeCompare(lc(b.name.common)))
    .sort(() => Math.random() - 0.5)
    .slice(0, FEATURED_PICK_COUNT);

  try {
    localStorage.setItem(CACHE_FEATURED_KEY, JSON.stringify(shuffled.map((c) => c.cca3)));
  } catch {
    /* localStorage unavailable */
  }

  return shuffled;
}

interface SpinnerProps {
  label?: string;
}

const Spinner = ({ label = "Loading…" }: SpinnerProps) => (
  <div className="flex justify-center items-center py-10">
    <div className="flex items-center gap-3 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] px-5 py-2 shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-t-4 border-b-4 border-indigo-500 dark:border-indigo-300" />
      <div className="text-sm font-extrabold text-gray-800 dark:text-white/80">{label}</div>
    </div>
  </div>
);

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
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

  /* ---- image viewer ---- */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const photos: string[] = extras?.photos ?? [];

  /* ---- swipe for lightbox ---- */
  const touchStartX = useRef<number | null>(null);

  /* ---- request control ---- */
  const detailsAbort = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const reducedMotion = usePrefersReducedMotion();

  /* ---------------------------------------------------------------- */
  /*  Page view                                                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    trackEvent("Country Page Viewed", { page: "Country" });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Fetch the lite list on mount                                    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("https://restcountries.com/v3.1/all?fields=name,flags,cca3", {
          signal: ctrl.signal,
        });
        const js = await res.json();
        if (Array.isArray(js)) setMini(js);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        setInit(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Lightbox keyboard + body scroll lock                             */
  /* ---------------------------------------------------------------- */
  const closeViewer = useCallback(() => setViewerOpen(false), []);
  const prevImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);
  const nextImg = useCallback(() => {
    if (!photos.length) return;
    setViewerIdx((i) => (i + 1) % photos.length);
  }, [photos.length]);

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
  }, [viewerOpen, prevImg, nextImg, closeViewer]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = touchStartX.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    touchStartX.current = null;
    if (sx == null || ex == null || !viewerOpen) return;
    const dx = ex - sx;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx > 0) prevImg();
    else nextImg();
  };

  /* ---------------------------------------------------------------- */
  /*  Search derived (suggestions)                                     */
  /* ---------------------------------------------------------------- */
  const suggestions = useMemo(() => {
    const t = lc(q.trim());
    if (!t) return [];
    return mini.filter((c) => lc(c.name.common).includes(t)).slice(0, SUGGESTIONS_LIMIT);
  }, [q, mini]);

  const featured = useMemo(() => {
    if (!mini.length) return [];
    return getFeatured(mini);
  }, [mini]);

  /* ---------------------------------------------------------------- */
  /*  Details loader                                                   */
  /* ---------------------------------------------------------------- */
  const loadDetails = useCallback(async (cca3: string) => {
    // cancel previous
    detailsAbort.current?.abort();
    const ctrl = new AbortController();
    detailsAbort.current = ctrl;

    setLoadingDetails(true);
    setExtras(null);

    // seq guard (prevents older requests overwriting newer)
    const seq = ++requestSeq.current;

    try {
      trackEvent("Country Details Load Start", { cca3 });

      const fullData: FullCountry = (
        await fetch(`https://restcountries.com/v3.1/alpha/${cca3}`, { signal: ctrl.signal }).then(
          (r) => r.json(),
        )
      )[0];

      if (ctrl.signal.aborted || requestSeq.current !== seq) return;

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
              { signal: ctrl.signal },
            )
              .then((r) => r.json())
              .then((j) =>
                j?.current_weather
                  ? { temperature: j.current_weather.temperature, windspeed: j.current_weather.windspeed }
                  : undefined,
              )
              .catch(() => undefined)
          : undefined,

        (() => {
          const code = fullData.currencies ? Object.keys(fullData.currencies)[0] : "USD";
          return fetch(`https://api.exchangerate.host/latest?base=${code}&symbols=USD`, {
            signal: ctrl.signal,
          })
            .then((r) => r.json())
            .then((j) => j?.rates?.USD ?? null)
            .catch(() => null);
        })(),

        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(fullData.name.common)}`, {
          signal: ctrl.signal,
        })
          .then((r) => r.json())
          .catch(() => ({})),

        fullData.latlng
          ? fetch(
              `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gsradius=20000&gslimit=8&gscoord=${fullData.latlng[0]}|${fullData.latlng[1]}&format=json&origin=*`,
              { signal: ctrl.signal },
            )
              .then((r) => r.json())
              .then((j) => j?.query?.geosearch)
              .catch(() => [])
          : undefined,

        fetch(`https://u-mail.co/api/photo?tags=${encodeURIComponent(fullData.name.common)}&limit=10`, {
          signal: ctrl.signal,
        })
          .then((r) => r.json())
          .catch(() => []),
      ]);

      if (ctrl.signal.aborted || requestSeq.current !== seq) return;

      setExtras({
        weather,
        fx,
        wiki,
        sights: geo?.map((g: any) => ({ title: g.title, dist: g.dist })) ?? [],
        photos: Array.isArray(pics) ? pics : [],
      });

      trackEvent("Country Details Load Success", { cca3 });
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("loadDetails error:", err);
      trackEvent("Country Details Load Fail", { cca3, error: String(err?.message || err) });
    } finally {
      if (!ctrl.signal.aborted && requestSeq.current === seq) setLoadingDetails(false);
    }
  }, []);

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
    trackEvent("Country Search Run", { q: t, hits: hits.length });
    if (hits[0]) loadDetails(hits[0].cca3);
  }, [q, mini, loadDetails]);

  const pickCountry = useCallback(
    (cca3: string) => {
      loadDetails(cca3);
      setResults([]);
      // mobile-friendly “jump to detail”
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      trackEvent("Country Picked", { cca3 });
    },
    [loadDetails, reducedMotion],
  );

  /* ---------------------------------------------------------------- */
  /*  Derived values                                                  */
  /* ---------------------------------------------------------------- */
  const neighbors = useMemo(() => mini.filter((c) => full?.borders?.includes(c.cca3)), [full, mini]);

  const topSights = useMemo(() => {
    const s = extras?.sights ?? [];
    return [...s].sort((a, b) => a.dist - b.dist).slice(0, TOP_SIGHTS_LIMIT);
  }, [extras]);

  const currencyLabel = useMemo(() => {
    if (!full?.currencies) return "—";
    const code = Object.keys(full.currencies)[0];
    const sym = (full.currencies as any)?.[code]?.symbol;
    return sym ? `${code} (${sym})` : code;
  }, [full]);

  /* ---------------------------------------------------------------- */
  /*  UI Components                                                    */
  /* ---------------------------------------------------------------- */
  interface CountryTileProps {
    c: LiteCountry;
    onClick: () => void;
  }

  const CountryTile = ({ c, onClick }: CountryTileProps) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-3xl",
        "border border-black/10 dark:border-white/10",
        "bg-white/70 dark:bg-white/[0.06] shadow-sm hover:shadow-md transition",
        "h-24 sm:h-28",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
      )}
      style={{
        backgroundImage: c.flags?.png ? `url(${c.flags.png})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      title={c.name.common}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10 group-hover:from-black/70 transition" />
      <div className="absolute inset-0 flex items-end p-3">
        <div className="w-full">
          <div className="text-sm font-extrabold text-white drop-shadow line-clamp-1">{c.name.common}</div>
        </div>
      </div>
    </button>
  );

  interface PillProps {
    icon: React.ReactNode;
    label: string;
    value: string;
  }

  const Pill = ({ icon, label, value }: PillProps) => (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-brand-900/40 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
          {label}
        </div>
      </div>
      <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-white line-clamp-1">{value}</div>
    </div>
  );

  interface ActionLinkProps {
    href: string;
    icon: React.ReactNode;
    label: string;
  }

  const ActionLink = ({ href, icon, label }: ActionLinkProps) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold",
        "border border-black/10 dark:border-white/10",
        "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]",
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
    className={cn(
      "min-h-screen p-4 sm:p-6",
      "bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50",
      "dark:from-brand-900 dark:via-brand-900 dark:to-brand-900",
      "text-gray-900 dark:text-gray-100",
    )}
  >


    {/* ---------------- Sticky header ---------------- */}
    <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-4 bg-gradient-to-b from-indigo-50/95 via-indigo-50/70 to-transparent dark:from-brand-900/95 dark:via-brand-900/70 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        {/* Header card */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 sm:p-6 shadow-sm">
          {/* soft blobs */}
          <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
            <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Travel Explorer
              </h1>

             <p className="mt-2 max-w-2xl text-sm sm:text-base text-gray-600 dark:text-white/70">
  A country search tool that pulls core facts from REST Countries, then layers on weather (Open-Meteo),
  FX (exchangerate.host), Wikipedia summaries, and curated photos from the Unsplash and Pexels APIs.
  It’s built to keep a lot of info readable without turning into a wall of text.
</p>
            </div>
          </div>
        </div>

        {/* Search (mobile-friendly) */}
        <div className="mt-4 relative mx-auto max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
            className={cn(
              "flex items-center gap-2",
              "rounded-full border border-black/10 dark:border-white/10",
              "bg-white/90 dark:bg-white/[0.06] shadow-sm",
              "px-3 py-2 sm:px-4 sm:py-3",
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FaSearch className="shrink-0 text-gray-500 dark:text-white/50" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Search a country…"
                type="search"
                inputMode="search"
                autoComplete="off"
                className={cn(
                  "w-full bg-transparent outline-none",
                  "text-sm sm:text-base",
                  "placeholder:text-gray-400 dark:placeholder:text-white/40",
                )}
              />
            </div>

            {q.trim() ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className={cn(
                  "shrink-0 rounded-full",
                  "h-10 w-10 sm:h-11 sm:w-11",
                  "grid place-items-center",
                  "text-gray-700 dark:text-white/70",
                  "hover:bg-black/[0.04] dark:hover:bg-white/[0.08]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                )}
                aria-label="Clear"
                title="Clear"
              >
                ✕
              </button>
            ) : null}

            <button
              onClick={runSearch}
              className={cn(
                "shrink-0 rounded-full",
                "h-10 sm:h-11",
                "px-4 sm:px-5",
                "bg-indigo-600 hover:bg-indigo-700 text-white",
                "text-xs sm:text-sm font-extrabold",
                "transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              )}
              type="submit"
            >
              Go
            </button>
          </form>

          {/* Suggestions dropdown (mobile-safe) */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
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
                    <span className="font-extrabold text-gray-900 dark:text-white">{s.name.common}</span>
                    <span className="text-xs text-gray-500 dark:text-white/50">Open</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="mx-auto max-w-5xl">
      {/* ---------------- Featured / results tiles ---------------- */}
      {initial ? (
        <Spinner label="Loading countries…" />
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
        <div className="mt-8 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/90 dark:bg-brand-900/55 backdrop-blur shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 sm:p-7 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-4">
              {full.flags?.png && (
                <div className="relative">
                  <img
                    src={full.flags.png}
                    alt={full.flags.alt || `Flag of ${full.name.common}`}
                    className="w-14 h-10 sm:w-16 sm:h-12 object-cover rounded-xl shadow ring-1 ring-black/10"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="pointer-events-none absolute -inset-3 -z-10 rounded-2xl bg-indigo-500/10 blur-xl" />
                </div>
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

              {/* Tiny “status” */}
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

            {loadingDetails ? (
              <div className="mt-4">
                <Spinner label="Loading details…" />
              </div>
            ) : null}
          </div>

          {/* Body */}
          <div className="p-5 sm:p-7">
            {/* Map */}
            {mapURL && (
              <div className="rounded-[28px] overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
                <iframe src={mapURL} height={320} className="w-full" loading="lazy" title={`${full.name.common} map`} />
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                    Photos
                  </div>
                  <div className="text-xs font-bold text-gray-500 dark:text-white/45">Tap to open • Swipe inside</div>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setViewerIdx(i);
                        setViewerOpen(true);
                        trackEvent("Country Photo Opened", { country: full.name.common, idx: i });
                      }}
                      className={cn(
                        "relative h-20 w-32 sm:h-24 sm:w-40 flex-shrink-0 overflow-hidden rounded-3xl",
                        "border border-black/10 dark:border-white/10 shadow-sm",
                        "bg-black/[0.03] dark:bg-white/[0.06]",
                      )}
                      title="Open photo"
                    >
                      <img
                        src={p}
                        alt="Gallery"
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick facts */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Pill icon={<FaMapMarkerAlt />} label="Capital" value={full.capital?.[0] ?? "—"} />
              <Pill icon={<FaUsers />} label="Population" value={fmt(full.population)} />
              <Pill icon={<FaRulerCombined />} label="Area" value={full.area != null ? `${fmt(full.area)} km²` : "—"} />
              <Pill icon={<FaGlobeAmericas />} label="Currency" value={currencyLabel} />
              <Pill
                icon={<FaLanguage />}
                label="Languages"
                value={full.languages ? Object.values(full.languages).slice(0, 3).join(", ") : "—"}
              />
              <Pill icon={<FaClock />} label="Timezones" value={full.timezones?.slice(0, 2).join(", ") ?? "—"} />
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
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch" }}>
                  {neighbors.map((n) => (
                    <button
                      key={n.cca3}
                      type="button"
                      onClick={() => pickCountry(n.cca3)}
                      className="relative w-28 h-16 flex-shrink-0 overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 shadow-sm"
                      style={{
                        backgroundImage: n.flags?.png ? `url(${n.flags.png})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                      title={n.name.common}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
                      <div className="absolute bottom-1 left-0 right-0 text-center text-[11px] font-extrabold text-white drop-shadow line-clamp-1 px-2">
                        {n.name.common}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top sights */}
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
                        "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]",
                        "shadow-sm transition",
                      )}
                      title="Open in Google Maps"
                    >
                      <span className="text-indigo-600 dark:text-indigo-300">📍</span>
                      <span className="max-w-[220px] truncate">{s.title}</span>
                      <span className="text-gray-500 dark:text-white/50">{(s.dist / 1000).toFixed(1)}km</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Wiki summary */}
            {extras?.wiki?.extract && (
              <div className="mt-7 rounded-[28px] border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-5">
                <div className="text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
                  Quick read
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-white/80">
                  {clampText(extras.wiki.extract, WIKI_CLAMP_LENGTH)}
                </p>
              </div>
            )}

            {/* Flight search */}
            <div className="mt-8">
              <FlightSearch full={full} />
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ---------------- Image Lightbox ---------------- */}
    {viewerOpen && photos.length > 0 && (
      <div
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={closeViewer}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* close */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeViewer();
          }}
          className="absolute right-3 top-3 sm:right-5 sm:top-5 h-11 w-11 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-xl"
          type="button"
          aria-label="Close"
        >
          <FaTimes />
        </button>

        {/* stage */}
        <div className="min-h-[100svh] w-full flex items-center justify-center px-3 py-3">
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* prev / next (big targets) */}
            <button
              onClick={prevImg}
              className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-2xl"
              type="button"
              aria-label="Previous"
            >
              <FaChevronLeft />
            </button>
            <button
              onClick={nextImg}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center text-2xl"
              type="button"
              aria-label="Next"
            >
              <FaChevronRight />
            </button>

            <img
              src={photos[viewerIdx]}
              alt="Large"
              className="mx-auto max-h-[82svh] max-w-[92vw] rounded-3xl shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={nextImg} // tap to advance
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />

            {/* index pill */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-full bg-white/10 text-white text-xs font-extrabold px-4 py-2">
                {viewerIdx + 1} / {photos.length}
                <span className="ml-2 text-white/70 font-bold hidden sm:inline">Swipe or use arrows</span>
              </div>
            </div>

            {/* dots */}
            <div className="mt-3 flex justify-center gap-2">
              {photos.slice(0, 10).map((_, i) => {
                const active = i === viewerIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewerIdx(i)}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition",
                      active ? "bg-white" : "bg-white/30 hover:bg-white/50",
                    )}
                    aria-label={`Go to image ${i + 1}`}
                  />
                );
              })}
              {photos.length > 10 ? (
                <span className="text-white/50 text-xs font-extrabold px-2">+{photos.length - 10}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

}
