/* eslint-disable @next/next/no-img-element */
"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudSun, Compass, Globe2, Plane, Search, Shuffle, X } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { Segmented } from "@/components/ui/segmented";
import { IconBadge } from "@/components/ui/icon-badge";
import { SUGGESTIONS_LIMIT } from "./lib/constants";
import type { LiteCountry } from "./lib/types";
import { lc, getFeatured } from "./lib/utils";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useCountryDetails } from "./hooks/useCountryDetails";
import FlightSearch from "./FlightSearch";
import CountryTile from "./components/CountryTile";
import CountryDetailPanel from "./components/CountryDetailPanel";
import CountryWeatherWidget from "./components/CountryWeatherWidget";
import Spinner from "./components/Spinner";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "explore" | "weather" | "flights";
const TABS: DashboardTab<TabKey>[] = [
  { key: "explore", label: "Explore", hint: "250 countries", icon: <Compass className="h-4 w-4" /> },
  { key: "weather", label: "Weather", hint: "7-day outlook", icon: <CloudSun className="h-4 w-4" /> },
  { key: "flights", label: "Flights", hint: "Real prices", icon: <Plane className="h-4 w-4" /> },
];

export default function CountrySearch() {
  const [mini, setMini] = useState<LiteCountry[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LiteCountry[]>([]);
  const [unit, setUnit] = useState<"C" | "F">("C");

  // Read the saved unit after mount (avoids a hydration mismatch)
  useEffect(() => {
    try { if (localStorage.getItem("tempUnit") === "F") setUnit("F"); } catch { /* ignore */ }
  }, []);
  const changeUnit = useCallback((next: "C" | "F") => {
    setUnit(next);
    try { localStorage.setItem("tempUnit", next); } catch { /* ignore */ }
  }, []);
  const useCelsius = unit === "C";

  const detailRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { full, extras, loadingDetails, loadDetails } = useCountryDetails();

  // Lite country list on mount
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/countries", { signal: ctrl.signal });
        if (!res.ok) throw new Error("unavailable");
        const js = await res.json();
        if (!Array.isArray(js)) throw new Error("unavailable");
        setMini(js);
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") setLoadError("Country data is temporarily unavailable. Please try again shortly.");
      } finally {
        setInitialLoad(false);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const suggestions = useMemo(() => {
    const t = lc(q.trim());
    return t ? mini.filter((c) => lc(c.name.common).includes(t)).slice(0, SUGGESTIONS_LIMIT) : [];
  }, [q, mini]);
  const featured = useMemo(() => (mini.length ? getFeatured(mini) : []), [mini]);
  const displayList = results.length ? results : featured;

  const runSearch = useCallback(() => {
    const t = q.trim();
    if (!t) { setResults([]); return; }
    const hits = mini.filter((c) => lc(c.name.common).includes(lc(t)));
    setResults(hits);
    trackEvent("Country Search Run", { q: t, hits: hits.length });
    if (hits[0]) loadDetails(hits[0].cca3);
  }, [q, mini, loadDetails]);

  const pickCountry = useCallback((cca3: string) => {
    loadDetails(cca3);
    setResults([]);
    setQ("");
    trackEvent("Country Picked", { cca3 });
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }), 80);
  }, [loadDetails, reducedMotion]);

  const pickRandom = useCallback(() => {
    if (!mini.length) return;
    const pick = mini[Math.floor(Math.random() * mini.length)];
    pickCountry(pick.cca3);
    trackEvent("Country Random Pick", { cca3: pick.cca3 });
  }, [mini, pickCountry]);

  // Shown on the Weather and Flights tabs so it's clear which country they're for.
  const currentBanner = full ? (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3">
      {full.flags?.png && <img src={full.flags.png} alt="" referrerPolicy="no-referrer" className="h-7 w-10 rounded-md object-cover ring-1 ring-black/10" />}
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-300">Showing</p>
        <p className="truncate font-semibold text-slate-900 dark:text-white">{full.name.common}</p>
      </div>
      <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-slate-400 sm:block">Change it on the Explore tab</span>
    </div>
  ) : null;

  const pickFirst = (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-white/10">
      <IconBadge icon={Globe2} tone="indigo" size="lg" />
      <p className="font-semibold text-slate-900 dark:text-white">Pick a country first</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Choose one on the Explore tab, or roll the dice.</p>
      <button type="button" onClick={pickRandom} disabled={!mini.length}
        className="mt-1 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600 disabled:opacity-40">
        <Shuffle className="h-4 w-4" aria-hidden />Surprise me
      </button>
    </div>
  );

  const panels: Record<TabKey, () => ReactNode> = {
    explore: () => (
      <div>
        {/* Toolbar: search, units, surprise */}
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/[0.08] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <form onSubmit={(e) => { e.preventDefault(); runSearch(); }}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] dark:border-white/10 dark:bg-white/[0.04]">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any country…" type="search" inputMode="search" autoComplete="off"
                  aria-label="Search countries" className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
                {q.trim() && (
                  <button type="button" onClick={() => { setQ(""); setResults([]); }} aria-label="Clear search" className="rounded-lg p-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="submit" className="h-8 shrink-0 rounded-xl bg-indigo-500 px-4 text-xs font-semibold text-white transition hover:bg-indigo-600">Go</button>
              </form>

              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
                    className="absolute inset-x-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#1a1a1d]">
                    <div className="max-h-64 overflow-y-auto py-1">
                      {suggestions.map((s) => (
                        <button key={s.cca3} type="button" onClick={() => pickCountry(s.cca3)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-indigo-50 dark:hover:bg-white/[0.05]">
                          {s.flags?.png && <img src={s.flags.png} alt="" className="h-5 w-7 rounded object-cover ring-1 ring-black/10" referrerPolicy="no-referrer" />}
                          <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">{s.name.common}</span>
                          {s.continents?.[0] && <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{s.continents[0]}</span>}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Segmented id="countryUnit" ariaLabel="Temperature unit" value={unit} onChange={changeUnit}
              options={[{ key: "C", label: "°C" }, { key: "F", label: "°F" }]} />
            <button type="button" onClick={pickRandom} disabled={!mini.length}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
              <Shuffle className="h-3.5 w-3.5 text-indigo-500" aria-hidden />Surprise me
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {initialLoad ? <Spinner label="Loading countries…" /> : <>
            {loadError && <div role="alert" className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{loadError}</div>}

            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {results.length ? `${displayList.length} result${displayList.length === 1 ? "" : "s"}` : "Featured destinations"}
              </h3>
              {results.length > 0 && (
                <button type="button" onClick={() => { setResults([]); setQ(""); }} className="font-mono text-[10px] uppercase tracking-wider text-indigo-500 hover:underline">Clear search</button>
              )}
            </div>
            {displayList.length === 0
              ? <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center font-mono text-xs text-slate-400 dark:border-white/10">No countries found. Try a different search.</p>
              : <div className="grid max-h-[272px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-4 md:grid-cols-6">
                  {displayList.map((c) => <CountryTile key={c.cca3} c={c} selected={full?.cca3 === c.cca3} onClick={() => pickCountry(c.cca3)} reducedMotion={reducedMotion} />)}
                </div>}

            <div ref={detailRef} className="mt-6 scroll-mt-24">
              <CountryDetailPanel full={full} extras={extras} loadingDetails={loadingDetails} mini={mini} reducedMotion={reducedMotion} onPickCountry={pickCountry} useCelsius={useCelsius} />
            </div>
          </>}
        </div>
      </div>
    ),
    weather: () => (
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-end">
          <Segmented id="countryUnitWx" ariaLabel="Temperature unit" value={unit} onChange={changeUnit} options={[{ key: "C", label: "°C" }, { key: "F", label: "°F" }]} />
        </div>
        {full ? <>{currentBanner}<CountryWeatherWidget full={full} extras={extras} loadingDetails={loadingDetails} useCelsius={useCelsius} /></> : pickFirst}
      </div>
    ),
    flights: () => (
      <div className="p-4 sm:p-6">
        {currentBanner}
        <FlightSearch full={full} />
      </div>
    ),
  };

  return (
    <DashboardShell
      id="country"
      path="~/country"
      liveLabel="live data"
      title="Country Explorer"
      description="Search any country for the essentials, local time, photos, sights and a 7-day forecast, then find real flights and booking links with no hidden fees."
      tabs={TABS}
      renderPanel={(key) => panels[key]()}
      onTabChange={(key) => trackEvent("Country Tab Click", { tab: key })}
    />
  );
}
