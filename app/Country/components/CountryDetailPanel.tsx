/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBook,
  FaCalendarAlt,
  FaCamera,
  FaChevronDown,
  FaChevronUp,
  FaClock,
  FaExchangeAlt,
  FaGlobeAmericas,
  FaGoogle,
  FaLanguage,
  FaMap,
  FaMapMarkerAlt,
  FaPhone,
  FaRulerCombined,
  FaSuitcase,
  FaThermometerHalf,
  FaTripadvisor,
  FaUsers,
  FaWikipediaW,
  FaYoutube,
} from "react-icons/fa";

import { trackEvent } from "@/utils/mixpanel";
import type { FullCountry, Extras, LiteCountry } from "../lib/types";
import type { DetailTab } from "../lib/constants";
import { TOP_SIGHTS_LIMIT, TRAVEL_TIPS } from "../lib/constants";
import { cn, clampText, cToF, fmt, getBestTime, getLocalTime, getPackList } from "../lib/utils";
import StatPill from "./StatPill";
import ActionLink from "./ActionLink";
import Spinner from "./Spinner";
import CountryLightbox from "./CountryLightbox";

interface CountryDetailPanelProps {
  full: FullCountry | null;
  extras: Extras | null;
  loadingDetails: boolean;
  mapURL: string;
  mini: LiteCountry[];
  reducedMotion: boolean;
  onPickCountry: (cca3: string) => void;
  useCelsius: boolean;
}

export default function CountryDetailPanel({
  full,
  extras,
  loadingDetails,
  mapURL,
  mini,
  reducedMotion,
  onPickCountry,
  useCelsius,
}: CountryDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [packExpanded, setPackExpanded] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [localTime, setLocalTime] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [mapActivated, setMapActivated] = useState(false);

  const photos: string[] = extras?.photos ?? [];

  // Reset local state when country changes
  useEffect(() => {
    if (full) { setActiveTab("overview"); setPackExpanded(false); setLangOpen(false); setMapActivated(false); }
  }, [full?.cca3]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local time ticker
  useEffect(() => {
    if (!full?.timezones?.[0]) { setLocalTime(""); return; }
    const tick = () => setLocalTime(getLocalTime(full.timezones) ?? "");
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [full?.timezones]);

  // Derived
  const neighbors = useMemo(
    () => mini.filter((c) => full?.borders?.includes(c.cca3)),
    [full, mini],
  );

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

  const bestTime = useMemo(() => getBestTime(full?.latlng?.[0]), [full?.latlng]);

  const travelTips = useMemo(() => {
    const cont = full?.continents?.[0] ?? "";
    return TRAVEL_TIPS[cont] ?? TRAVEL_TIPS.default;
  }, [full?.continents]);

  const packList = useMemo(
    () => getPackList(extras?.weather?.temperature),
    [extras?.weather?.temperature],
  );

  const callingCode = useMemo(() => {
    if (!full?.idd?.root) return null;
    const suffix = full.idd.suffixes?.[0] ?? "";
    return `${full.idd.root}${suffix}`;
  }, [full]);

  const langList = useMemo(
    () => (full?.languages ? Object.values(full.languages) : []),
    [full?.languages],
  );

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Empty state */}
        {!full && !loadingDetails && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-5 shadow-sm text-indigo-500 dark:text-indigo-400">
              <FaGlobeAmericas className="text-4xl" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white/80">Pick a Destination</h2>
            <p className="mt-2 text-sm text-gray-400 dark:text-white/40 max-w-xs">
              Select any country to explore weather, currency, photos, places to visit, and book flights.
            </p>
          </motion.div>
        )}

        {/* Loading stub (before first full data) */}
        {loadingDetails && !full && (
          <motion.div key="loading-stub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Spinner label="Loading destination…" />
          </motion.div>
        )}

        {/* Detail card */}
        {full && (
          <motion.div
            key={full.cca3}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-brand-900/60 backdrop-blur-sm shadow-sm overflow-hidden"
          >
            {/* ── Hero header ── */}
            <div className="relative">
              {(extras?.wiki?.thumbnail?.source || full.flags?.png) && (
                <div className="relative h-44 sm:h-56 overflow-hidden">
                  <img
                    src={extras?.wiki?.thumbnail?.source || full.flags?.png}
                    alt={full.name.common}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 flex items-end gap-3">
                    {full.flags?.png && (
                      <img
                        src={full.flags.png}
                        alt={full.flags.alt || `Flag of ${full.name.common}`}
                        className="w-12 h-8 sm:w-16 sm:h-11 object-cover rounded-lg shadow-lg ring-2 ring-white/30 flex-shrink-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-md line-clamp-1">
                        {full.name.common}
                      </h2>
                      <p className="text-xs text-white/70 mt-0.5">
                        {full.continents?.join(", ")}
                        {full.subregion ? ` · ${full.subregion}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback header (no image) */}
              {!extras?.wiki?.thumbnail?.source && !full.flags?.png && (
                <div className="p-5 sm:p-6 border-b border-black/10 dark:border-white/10 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-500 dark:text-indigo-400 flex-shrink-0">
                    <FaGlobeAmericas className="text-3xl" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold">{full.name.common}</h2>
                    <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
                      {full.continents?.join(", ")}{full.subregion ? ` · ${full.subregion}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Status chips ── */}
            <div className="px-4 sm:px-6 py-3 border-b border-black/5 dark:border-white/[0.06] flex flex-wrap gap-2">
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5", bestTime.classes)}>
                <FaCalendarAlt className="text-[10px]" />{bestTime.label}
              </span>
              {localTime && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 inline-flex items-center gap-1.5">
                  <FaClock className="text-[10px]" />{localTime} local
                </span>
              )}
              {extras?.weather?.temperature != null && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 inline-flex items-center gap-1.5">
                  <FaThermometerHalf className="text-[10px]" />
                  {useCelsius
                    ? `${Math.round(extras.weather.temperature)}°C`
                    : `${cToF(Math.round(extras.weather.temperature))}°F`}
                  {extras.weather.windspeed != null ? ` · ${extras.weather.windspeed} km/h` : ""}
                </span>
              )}
              {extras?.fx != null && full?.currencies && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 inline-flex items-center gap-1.5">
                  <FaExchangeAlt className="text-[10px]" />1 {Object.keys(full.currencies)[0]} = ${extras.fx.toFixed(3)} USD
                </span>
              )}
              {callingCode && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-white/60 inline-flex items-center gap-1.5">
                  <FaPhone className="text-[10px]" />{callingCode}
                </span>
              )}
              {loadingDetails && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-400 dark:bg-white/[0.05] dark:text-white/40 animate-pulse">
                  Updating…
                </span>
              )}
            </div>

            {/* ── Tab bar ── */}
            <div className="px-4 sm:px-6 pt-4 pb-2">
              <div className="flex gap-1 rounded-2xl bg-black/5 dark:bg-white/[0.05] p-1">
                {([
                  { id: "overview", label: "Overview" },
                  { id: "photos", label: photos.length ? `Photos (${photos.length})` : "Photos" },
                ] as { id: DetailTab; label: string }[]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition whitespace-nowrap",
                      activeTab === tab.id
                        ? "bg-white dark:bg-white/15 shadow-sm text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab content ── */}
            <div className="px-4 sm:px-6 pb-6 pt-2">
              <AnimatePresence mode="wait">

                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    {mapURL && (
                      <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-sm relative">
                        {/* Smaller height on mobile so it doesn't dominate the screen */}
                        <iframe
                          src={mapURL}
                          className="w-full block h-[175px] sm:h-[230px]"
                          loading="lazy"
                          title={`${full.name.common} map`}
                        />
                        {/* Mobile scroll-guard: tap to activate map so it doesn't hijack page scroll */}
                        {!mapActivated && (
                          <div
                            className="absolute inset-0 lg:hidden flex items-end justify-center pb-3 cursor-pointer"
                            onClick={() => setMapActivated(true)}
                          >
                            <span className="bg-black/55 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none">
                              Tap to interact with map
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <StatPill icon={<FaMapMarkerAlt />} label="Capital"    value={full.capital?.[0] ?? "—"} />
                      <StatPill icon={<FaUsers />}        label="Population" value={fmt(full.population)} />
                      <StatPill icon={<FaRulerCombined />} label="Area"      value={full.area != null ? `${fmt(full.area)} km²` : "—"} />
                      <StatPill icon={<FaGlobeAmericas />} label="Currency"  value={currencyLabel} />
                      {langList.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setLangOpen((o) => !o)}
                          className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-indigo-500 dark:text-indigo-400 text-sm"><FaLanguage /></span>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40 flex-1">Languages</div>
                            {langOpen
                              ? <FaChevronUp className="text-indigo-400 dark:text-indigo-500 text-[8px]" />
                              : <FaChevronDown className="text-gray-300 dark:text-white/25 text-[8px]" />}
                          </div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                            {langList[0]} <span className="text-indigo-500 dark:text-indigo-400 font-semibold">+{langList.length - 1}</span>
                          </div>
                        </button>
                      ) : (
                        <StatPill icon={<FaLanguage />} label="Languages" value={langList[0] ?? "—"} />
                      )}
                      <StatPill icon={<FaClock />}        label="Timezone"   value={full.timezones?.[0] ?? "—"} />
                      {full.tld?.[0] && <StatPill icon={<FaGlobeAmericas />} label="Domain" value={full.tld[0]} />}
                      {full.borders?.length ? <StatPill icon={<FaMap />} label="Borders" value={`${full.borders.length} countries`} /> : null}
                    </div>

                    <AnimatePresence>
                      {langOpen && langList.length > 1 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800/30 bg-indigo-50/60 dark:bg-indigo-900/15 px-4 py-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2.5">
                              All Languages · {langList.length}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {langList.map((lang) => (
                                <span
                                  key={lang}
                                  className="rounded-full px-2.5 py-1 text-xs font-semibold bg-white dark:bg-white/10 border border-indigo-200 dark:border-indigo-700/50 text-gray-700 dark:text-white/80"
                                >
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex flex-wrap gap-2">
                      <ActionLink href={`https://en.wikivoyage.org/wiki/${encodeURIComponent(full.name.common)}`}                                              icon={<FaWikipediaW />} label="Wikivoyage" />
                      <ActionLink href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(full.name.common)}`}                                       icon={<FaTripadvisor />} label="Tripadvisor" />
                      <ActionLink href={`https://www.youtube.com/results?search_query=${encodeURIComponent(full.name.common + " travel guide")}`}              icon={<FaYoutube />} label="YouTube" />
                      <ActionLink href={`https://news.google.com/search?q=${encodeURIComponent(full.name.common + " travel")}`}                               icon={<FaGoogle />} label="News" />
                      <ActionLink href={`https://www.lonelyplanet.com/${encodeURIComponent(full.name.common.toLowerCase().replace(/ /g, "-"))}`}               icon={<FaBook />} label="Lonely Planet" />
                    </div>

                    {extras?.wiki?.extract && (
                      <div className="rounded-2xl bg-brand-101 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">About</div>
                        <p className="text-sm leading-relaxed text-gray-700 dark:text-white/80">{clampText(extras.wiki.extract)}</p>
                      </div>
                    )}

                    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-2.5">Travel Tips</div>
                      <ul className="space-y-2">
                        {travelTips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-white/80">
                            <span className="text-amber-500 mt-px shrink-0 font-bold">›</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Pack list (collapsible) */}
                    <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPackExpanded((p) => !p)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] transition text-left"
                      >
                        <div className="flex items-center gap-2">
                          <FaSuitcase className="text-gray-500 dark:text-white/50 text-sm" />
                          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">What to pack</span>
                          {extras?.weather?.temperature != null && (
                            <span className="text-xs text-gray-400 dark:text-white/40">
                              based on {useCelsius
                                ? `${Math.round(extras.weather.temperature)}°C`
                                : `${cToF(Math.round(extras.weather.temperature))}°F`}
                            </span>
                          )}
                        </div>
                        {packExpanded
                          ? <FaChevronUp className="text-gray-400 dark:text-white/40 text-xs" />
                          : <FaChevronDown className="text-gray-400 dark:text-white/40 text-xs" />}
                      </button>
                      <AnimatePresence>
                        {packExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t border-black/5 dark:border-white/[0.05]">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {packList.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-white/80">
                                    <span className="w-4 h-4 rounded border-2 border-gray-300 dark:border-white/20 flex-shrink-0" />
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Neighboring countries */}
                    {neighbors.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2.5">Neighboring countries</div>
                        <div className="flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}>
                          {neighbors.map((n) => (
                            <motion.button
                              key={n.cca3}
                              type="button"
                              onClick={() => onPickCountry(n.cca3)}
                              whileHover={reducedMotion ? {} : { scale: 1.05 }}
                              whileTap={reducedMotion ? {} : { scale: 0.97 }}
                              className="relative w-24 h-14 flex-shrink-0 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition"
                              style={{
                                backgroundImage: n.flags?.png ? `url(${n.flags.png})` : undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                              title={n.name.common}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                              <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] font-bold text-white drop-shadow line-clamp-1 px-1.5">
                                {n.name.common}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nearby sights */}
                    {topSights.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/40 mb-2.5">Points of interest</div>
                        <div className="flex flex-wrap gap-2">
                          {topSights.map((s, i) => (
                            <a
                              key={i}
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.title)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                                "border border-black/10 dark:border-white/10",
                                "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]",
                                "shadow-sm transition",
                              )}
                            >
                              <FaMapMarkerAlt className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                              <span className="max-w-[180px] truncate">{s.title}</span>
                              <span className="text-gray-400 dark:text-white/30">{(s.dist / 1000).toFixed(0)} km</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* PHOTOS */}
                {activeTab === "photos" && (
                  <motion.div
                    key="photos"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {photos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FaCamera className="text-4xl mb-3 text-gray-300 dark:text-white/20" />
                        <div className="text-sm font-medium text-gray-400 dark:text-white/40">No photos available for this destination</div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 dark:text-white/40 mb-3">Tap any photo to open full view · Swipe inside</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {photos.map((p, i) => (
                            <motion.button
                              key={i}
                              type="button"
                              onClick={() => {
                                setViewerIdx(i);
                                setViewerOpen(true);
                                trackEvent("Country Photo Opened", { country: full.name.common, idx: i });
                              }}
                              whileHover={reducedMotion ? {} : { scale: 1.02 }}
                              whileTap={reducedMotion ? {} : { scale: 0.98 }}
                              className="relative aspect-video overflow-hidden rounded-2xl group shadow-sm hover:shadow-md transition"
                            >
                              <img
                                src={p}
                                alt={`${full.name.common} photo ${i + 1}`}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const parent = e.currentTarget.closest("button") as HTMLElement | null;
                                  if (parent) parent.style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-white text-xs font-semibold">View</div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox — rendered here so it owns viewer state */}
      <CountryLightbox
        open={viewerOpen}
        photos={photos}
        viewerIdx={viewerIdx}
        setViewerIdx={setViewerIdx}
        onClose={() => setViewerOpen(false)}
        countryName={full?.name.common}
        flagPng={full?.flags?.png}
      />
    </>
  );
}
