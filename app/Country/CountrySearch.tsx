/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlane, FaRandom, FaSearch, FaTimes } from "react-icons/fa";

import { trackEvent } from "@/utils/mixpanel";
import { SUGGESTIONS_LIMIT } from "./lib/constants";
import type { RegionId } from "./lib/constants";
import type { LiteCountry } from "./lib/types";
import { lc, getFeatured, cn } from "./lib/utils";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useCountryDetails } from "./hooks/useCountryDetails";
import FlightSearch from "./FlightSearch";
import CountryTile from "./components/CountryTile";
import CountryDetailPanel from "./components/CountryDetailPanel";
import CountryWeatherWidget from "./components/CountryWeatherWidget";
import Spinner from "./components/Spinner";

export default function CountrySearch() {
  const [mini, setMini] = useState<LiteCountry[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LiteCountry[]>([]);
  const [activeRegion] = useState<RegionId>("all");

  const [useCelsius, setUseCelsius] = useState(true);

  // Read persisted preference after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try { if (localStorage.getItem("tempUnit") === "F") setUseCelsius(false); } catch {}
  }, []);

  const toggleUnit = useCallback(() => {
    setUseCelsius((prev) => {
      const next = !prev;
      try { localStorage.setItem("tempUnit", next ? "C" : "F"); } catch {}
      return next;
    });
  }, []);

  const detailRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { full, extras, loadingDetails, loadDetails } = useCountryDetails();

  // Fetch lite country list on mount
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,flags,cca3,continents",
          { signal: ctrl.signal },
        );
        const js = await res.json();
        if (Array.isArray(js)) setMini(js);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        setInitialLoad(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // Derived
  const suggestions = useMemo(() => {
    const t = lc(q.trim());
    if (!t) return [];
    return mini.filter((c) => lc(c.name.common).includes(t)).slice(0, SUGGESTIONS_LIMIT);
  }, [q, mini]);

  const featured = useMemo(() => {
    if (!mini.length) return [];
    return getFeatured(mini);
  }, [mini]);

  const displayList = useMemo(() => {
    const base = results.length ? results : featured;
    if (activeRegion === "all") return base;
    return base.filter((c) =>
      c.continents?.some((cont) => cont.toLowerCase().includes(activeRegion.toLowerCase()))
    );
  }, [results, featured, activeRegion]);

  // Handlers
  const runSearch = useCallback(() => {
    const t = q.trim();
    if (!t) { setResults([]); return; }
    const hits = mini.filter((c) => lc(c.name.common).includes(lc(t)));
    setResults(hits);
    trackEvent("Country Search Run", { q: t, hits: hits.length });
    if (hits[0]) loadDetails(hits[0].cca3);
  }, [q, mini, loadDetails]);

  const pickCountry = useCallback(
    (cca3: string) => {
      loadDetails(cca3);
      setResults([]);
      setQ("");
      trackEvent("Country Picked", { cca3 });
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }, 80);
    },
    [loadDetails, reducedMotion],
  );

  const pickRandom = useCallback(() => {
    if (!mini.length) return;
    const pick = mini[Math.floor(Math.random() * mini.length)];
    pickCountry(pick.cca3);
    trackEvent("Country Random Pick", { cca3: pick.cca3 });
  }, [mini, pickCountry]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50/40 to-amber-50/30 dark:from-brand-900 dark:via-brand-900 dark:to-brand-900 text-gray-900 dark:text-gray-100">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 border-b border-black/5 dark:border-white/[0.06] bg-white/80 dark:bg-brand-900/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">

            {/* Brand */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm text-white">
                <FaPlane className="text-sm" />
              </div>
              <div className="leading-none">
                <div className="text-sm font-extrabold text-gray-900 dark:text-white">Travel</div>
                <div className="text-[10px] text-gray-400 dark:text-white/40">Explorer</div>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 relative">
              <form
                onSubmit={(e) => { e.preventDefault(); runSearch(); }}
                className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/[0.06] shadow-sm px-3 py-2"
              >
                <FaSearch className="shrink-0 text-gray-400 dark:text-white/40 text-sm" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Search any country…"
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  className="w-full bg-transparent outline-none text-sm placeholder:text-gray-400 dark:placeholder:text-white/40"
                />
                {q.trim() && (
                  <button
                    type="button"
                    onClick={() => { setQ(""); setResults([]); }}
                    className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition"
                    aria-label="Clear"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                )}
                <button
                  type="submit"
                  className="shrink-0 rounded-xl h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
                >
                  Go
                </button>
              </form>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 mt-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-xl overflow-hidden z-50"
                  >
                    <div className="max-h-60 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                      {suggestions.map((s) => (
                        <button
                          key={s.cca3}
                          type="button"
                          onClick={() => { setQ(""); pickCountry(s.cca3); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-white/[0.05] transition flex items-center gap-3"
                        >
                          {s.flags?.png && (
                            <img src={s.flags.png} alt="" className="w-7 h-5 object-cover rounded shadow-sm" referrerPolicy="no-referrer" />
                          )}
                          <span className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{s.name.common}</span>
                          {s.continents?.[0] && (
                            <span className="text-xs text-gray-400 dark:text-white/40">{s.continents[0]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* °C / °F toggle */}
            <button
              type="button"
              onClick={toggleUnit}
              className="shrink-0 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-white/[0.06] shadow-sm h-[38px] px-1 flex items-center gap-0.5 text-xs font-bold overflow-hidden"
              title="Toggle temperature unit"
            >
              <span className={`rounded-xl px-2.5 py-1.5 transition-colors ${useCelsius ? "bg-indigo-600 text-white" : "text-gray-500 dark:text-white/50"}`}>
                °C
              </span>
              <span className={`rounded-xl px-2.5 py-1.5 transition-colors ${!useCelsius ? "bg-indigo-600 text-white" : "text-gray-500 dark:text-white/50"}`}>
                °F
              </span>
            </button>

            {/* Random country */}
            <motion.button
              type="button"
              onClick={pickRandom}
              disabled={!mini.length}
              whileHover={reducedMotion ? {} : { scale: 1.05 }}
              whileTap={reducedMotion ? {} : { scale: 0.95 }}
              className={cn(
                "shrink-0 rounded-2xl border border-black/10 dark:border-white/10",
                "bg-white/90 dark:bg-white/[0.06] shadow-sm",
                "h-[38px] px-3 flex items-center gap-1.5",
                "text-xs font-semibold text-gray-700 dark:text-white/80",
                "hover:bg-white dark:hover:bg-white/[0.10] transition",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
              title="Explore a random country"
            >
              <FaRandom className="text-indigo-500 dark:text-indigo-400" />
              <span className="hidden sm:inline">Surprise me</span>
            </motion.button>

          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-6">
        {initialLoad ? (
          <Spinner label="Loading countries…" />
        ) : (
          <div className="space-y-5">

            {/* ── Country tiles — full width at top ── */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-xs font-semibold text-gray-500 dark:text-white/40">
                  {results.length
                    ? `${displayList.length} result${displayList.length !== 1 ? "s" : ""}`
                    : "Featured destinations"}
                </div>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setResults([]); setQ(""); }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
              {displayList.length === 0 ? (
                <div className="text-center py-10 text-gray-400 dark:text-white/30 text-sm">
                  No countries found — try a different search
                </div>
              ) : (
                <div
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[240px] overflow-y-auto"
                  style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
                >
                  {displayList.map((c) => (
                    <CountryTile
                      key={c.cca3}
                      c={c}
                      selected={full?.cca3 === c.cca3}
                      onClick={() => pickCountry(c.cca3)}
                      reducedMotion={reducedMotion}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Results area: weather + detail + flights ── */}
            <div ref={detailRef} className="scroll-mt-20 space-y-4">



              {/* Main detail panel */}
              <CountryDetailPanel
                full={full}
                extras={extras}
                loadingDetails={loadingDetails}
                mini={mini}
                reducedMotion={reducedMotion}
                onPickCountry={pickCountry}
                useCelsius={useCelsius}
              />

                            {/* Weather widget — at the top of results */}
              <CountryWeatherWidget
                full={full}
                extras={extras}
                loadingDetails={loadingDetails}
                useCelsius={useCelsius}
              />

              {/* Flight search */}
              <AnimatePresence>
                {full && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <FlightSearch full={full} />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
