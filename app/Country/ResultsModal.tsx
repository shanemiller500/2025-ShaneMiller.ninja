/* eslint-disable @next/next/no-img-element */
"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  DollarSign,
  ExternalLink,
  Filter as FilterIcon,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SCROLL_DELAY_MS     = 70;
const SCROLL_TOP_OFFSET   = 72;
const SCROLL_BOTTOM_OFFSET = 24;
const DEFAULT_MAX_STOPS   = 3;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const minsToH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

const fmtTime = (iso: string) =>
  new Date(iso.replace(" ", "T")).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const fmtFull = (iso: string) =>
  new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const fmtShort = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface FlightSegment {
  departure_airport: { name: string; id: string; time: string };
  arrival_airport:   { name: string; id: string; time: string };
  duration:          number;
  airline:           string;
  airline_logo:      string;
  travel_class:      string;
  flight_number:     string;
  extensions?:       string[];
}
interface Layover {
  duration:   number;
  name:       string;
  id:         string;
  overnight?: boolean;
}
interface FlightOption {
  provider:          string;
  price:             number | null;
  total_duration?:   number;
  carbon_emissions?: {
    this_flight:             number;
    typical_for_this_route:  number;
    difference_percent:      number;
  };
  airline_logo?: string;
  flights?:      FlightSegment[];
  layovers?:     Layover[];
  legs?:         string[];
  deeplink?:     string;
  ai_score?:     number;
  ai_rank?:      number;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  open:    boolean;
  setOpen: (b: boolean) => void;
  loading: boolean;
  photo:   string | null;
  flights: FlightOption[];
  from:    string;
  to:      string;
  depart:  string;
  ret:     string;
  trip:    "round" | "oneway";
}

/* ------------------------------------------------------------------ */
/*  Link Builders                                                      */
/* ------------------------------------------------------------------ */
const safeIata = (s: string) =>
  (s || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

function buildGoogleFlightsLink({ from, to, depart, ret, trip }: { from: string; to: string; depart: string; ret?: string; trip: "round" | "oneway" }) {
  const f = safeIata(from);
  const t = safeIata(to);
  const d = (depart || "").slice(0, 10);
  const r = (ret   || "").slice(0, 10);
  const hash = trip === "round" && r
    ? encodeURIComponent(`${f}.${t}.${d}*${t}.${f}.${r}`)
    : encodeURIComponent(`${f}.${t}.${d}`);
  return `https://www.google.com/travel/flights?hl=en#flt=${hash}`;
}

function buildSkyscannerLink({ from, to, depart, ret, trip }: { from: string; to: string; depart: string; ret?: string; trip: "round" | "oneway" }) {
  const f = safeIata(from).toLowerCase();
  const t = safeIata(to).toLowerCase();
  const d = (depart || "").replace(/-/g, "");
  const r = (ret   || "").replace(/-/g, "");
  const base = "https://www.skyscanner.com/transport/flights";
  return trip === "round" && r ? `${base}/${f}/${t}/${d}/${r}` : `${base}/${f}/${t}/${d}`;
}

function buildMomondoLink({ from, to, depart, ret, trip }: { from: string; to: string; depart: string; ret?: string; trip: "round" | "oneway" }) {
  const f = safeIata(from);
  const t = safeIata(to);
  const d = (depart || "").slice(0, 10);
  const r = (ret   || "").slice(0, 10);
  const base = "https://www.momondo.com/flight-search";
  return trip === "round" && r
    ? `${base}/${f}-${t}/${d}/${r}?sort=bestflight_a`
    : `${base}/${f}-${t}/${d}?sort=bestflight_a`;
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.988 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring", stiffness: 480, damping: 34 },
  },
};

const shimmer: Variants = {
  hidden: { opacity: 0.55 },
  show: { opacity: 1, transition: { duration: 0.9, repeat: Infinity, repeatType: "mirror" } },
};

/* ------------------------------------------------------------------ */
/*  SkeletonCard                                                       */
/* ------------------------------------------------------------------ */
function SkeletonCard() {
  return (
    <motion.div
      variants={shimmer}
      initial="hidden"
      animate="show"
      className="rounded-2xl border border-brand-200/70 bg-white p-4 dark:border-white/10 dark:bg-brand-900/60"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-white/10" />
          <div>
            <div className="h-3 w-28 rounded-full bg-brand-100 dark:bg-white/10" />
            <div className="mt-2 h-2 w-36 rounded-full bg-brand-100 dark:bg-white/10" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-full bg-brand-100 dark:bg-white/10" />
      </div>
      <div className="mt-3 h-2 w-48 rounded-full bg-brand-100 dark:bg-white/10" />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  ResultsModal                                                       */
/* ------------------------------------------------------------------ */
export default function ResultsModal({
  open, setOpen, loading, photo, flights, from, to, depart, ret, trip,
}: Props) {
  const [expanded,       setExpanded]       = useState<number | null>(null);
  const [filtersOpen,    setFiltersOpen]    = useState(false);
  const [maxStops,       setMaxStops]       = useState<number>(DEFAULT_MAX_STOPS);
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [sortBy,         setSortBy]         = useState<"price" | "duration" | "ai">("price");
  const [animKey,        setAnimKey]        = useState(0);

  const listRef  = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setExpanded(null);
    setFiltersOpen(false);
  }, [open]);

  useEffect(() => {
    if (!loading) setAnimKey((k) => k + 1);
  }, [loading, flights.length]);

  const airlines = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => f.flights?.forEach((seg) => s.add(seg.airline)));
    return Array.from(s).sort();
  }, [flights]);

  const filteredFlights = useMemo(() => {
    const filterfn = (f: FlightOption) => {
      const layCnt =
        f.layovers?.length ??
        (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1);
      if (maxStops < DEFAULT_MAX_STOPS && layCnt > maxStops) return false;
      if (selectedAirline !== "all" && !f.flights?.some((seg) => seg.airline === selectedAirline))
        return false;
      return true;
    };

    const sortfn = (a: FlightOption, b: FlightOption) => {
      switch (sortBy) {
        case "duration": return (a.total_duration ?? 1e9) - (b.total_duration ?? 1e9);
        case "ai":       return (b.ai_score ?? -1) - (a.ai_score ?? -1);
        default:         return (a.price ?? 1e9) - (b.price ?? 1e9);
      }
    };

    return [...flights.filter(filterfn)].sort(sortfn);
  }, [flights, maxStops, selectedAirline, sortBy]);

  const googleLink  = useMemo(() => buildGoogleFlightsLink({ from, to, depart, ret, trip }), [from, to, depart, ret, trip]);
  const skyLink     = useMemo(() => buildSkyscannerLink({ from, to, depart, ret, trip }), [from, to, depart, ret, trip]);
  const momondoLink = useMemo(() => buildMomondoLink({ from, to, depart, ret, trip }), [from, to, depart, ret, trip]);

  const toggleCard = (i: number) => {
    setExpanded((prev) => (prev === i ? null : i));
    window.setTimeout(() => {
      const el = cardRefs.current[i];
      const scroller = listRef.current;
      if (!el || !scroller) return;
      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (r.top < s.top + SCROLL_TOP_OFFSET || r.bottom > s.bottom - SCROLL_BOTTOM_OFFSET) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, SCROLL_DELAY_MS);
  };

  const sortChip = (active: boolean) =>
    `inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition
     ${active
       ? "border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
       : "border-brand-200/70 bg-white text-brand-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-transparent dark:text-brand-300 dark:hover:text-indigo-400"}`;

  /* ── Render ── */
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={setOpen} className="relative z-50">

        {/* Backdrop */}
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        {/* Mobile: bottom sheet. Desktop: centered dialog. */}
        <div className="fixed inset-x-0 bottom-0 flex sm:inset-0 sm:items-center sm:justify-center sm:p-4">
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-8 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-8 sm:scale-95"
          >
            <DialogPanel className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-brand-900 sm:max-w-2xl sm:rounded-3xl">

              {/* ── SLIM STICKY HEADER ──────────────────────────────── */}
              <div className="sticky top-0 z-20 border-b border-brand-100/60 bg-white/95 backdrop-blur-xl dark:border-white/5 dark:bg-brand-900/95">

                {/* Drag handle (mobile only) */}
                <div className="flex justify-center pt-2 sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-brand-200 dark:bg-brand-700" />
                </div>

                {/* Route + close row */}
                <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="text-[13px] font-extrabold text-brand-900 dark:text-white">
                      {from || "—"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <span className="text-[13px] font-extrabold text-brand-900 dark:text-white">
                      {to || "—"}
                    </span>
                    {depart && (
                      <span className="ml-1 hidden text-xs text-brand-400 dark:text-brand-500 sm:inline">
                        · {fmtShort(depart)}
                        {trip === "round" && ret ? ` – ${fmtShort(ret)}` : ""}
                      </span>
                    )}
                    {loading && (
                      <span className="ml-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600 dark:border-indigo-700 dark:border-t-indigo-400" />
                    )}
                  </div>

                  {/* Edit search */}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="hidden shrink-0 items-center gap-1.5 rounded-full border border-brand-200/70 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-brand-400 dark:hover:text-indigo-400 sm:inline-flex"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Edit search
                  </button>

                  {/* X close */}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 transition hover:bg-brand-200 dark:bg-white/10 dark:text-brand-300 dark:hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── SCROLLABLE BODY ─────────────────────────────────── */}
              <div
                ref={listRef}
                className="max-h-[calc(88vh-52px)] overflow-y-auto sm:max-h-[calc(88vh-52px)]"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {photo && <img src={photo} alt="" className="h-40 w-full object-cover" />}

                {/* Controls bar */}
                <div className="border-b border-brand-100/60 px-4 py-3 dark:border-white/5 sm:px-5">

                  {/* Status row */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {loading ? (
                        <p className="text-xs font-semibold text-brand-500 dark:text-brand-400">
                          Searching for the best fares…
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-brand-900 dark:text-white">
                            {filteredFlights.length} flight{filteredFlights.length !== 1 ? "s" : ""} found
                          </p>
                          {!loading && flights.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                              <Sparkles className="h-3 w-3" />
                              ready to book
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Edit search — mobile only (desktop version is in header) */}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-200/70 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-brand-400 dark:hover:text-indigo-400 sm:hidden"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Edit search
                    </button>
                  </div>

                  {/* Dates strip — mobile */}
                  {depart && (
                    <p className="mb-3 text-xs text-brand-400 dark:text-brand-500 sm:hidden">
                      {fmtShort(depart)}
                      {trip === "round" && ret ? ` – ${fmtShort(ret)}` : ""}
                    </p>
                  )}

                  {/* Sort chips + booking links in a single horizontally-scrollable row */}
                  {!loading && flights.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <button type="button" onClick={() => setSortBy("ai")}       className={sortChip(sortBy === "ai")}>
                        <Zap      className="h-3 w-3" /> Best
                      </button>
                      <button type="button" onClick={() => setSortBy("price")}    className={sortChip(sortBy === "price")}>
                        <DollarSign className="h-3 w-3" /> Cheapest
                      </button>
                      <button type="button" onClick={() => setSortBy("duration")} className={sortChip(sortBy === "duration")}>
                        <Clock3 className="h-3 w-3" /> Fastest
                      </button>

                      {/* Divider */}
                      <div className="mx-1 h-5 w-px shrink-0 bg-brand-200/70 dark:bg-white/10" />

                      {/* Booking site links */}
                      <a href={googleLink}  target="_blank" rel="noopener noreferrer"
                         className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-500/25 transition hover:bg-indigo-500">
                        <ExternalLink className="h-3 w-3" /> Google
                      </a>
                      <a href={skyLink}     target="_blank" rel="noopener noreferrer"
                         className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500">
                        <ExternalLink className="h-3 w-3" /> Skyscanner
                      </a>
                      <a href={momondoLink} target="_blank" rel="noopener noreferrer"
                         className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 dark:bg-white/10 dark:hover:bg-white/20">
                        <ExternalLink className="h-3 w-3" /> Momondo
                      </a>
                    </div>
                  )}

                  {/* Filter toggle */}
                  {!loading && flights.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((p) => !p)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-brand-400 dark:hover:text-indigo-400"
                    >
                      <FilterIcon className="h-3 w-3" />
                      Filters
                      {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}

                  {/* Filter panel */}
                  <AnimatePresence initial={false}>
                    {filtersOpen && !loading && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {/* Max stops */}
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500">
                              Stops
                            </label>
                            <select
                              value={maxStops}
                              onChange={(e) => setMaxStops(+e.target.value)}
                              className="w-full rounded-xl border border-brand-200/70 bg-white px-2 py-1.5 text-xs font-semibold text-brand-900 dark:border-white/10 dark:bg-brand-900 dark:text-white"
                            >
                              <option value={0}>Non-stop</option>
                              <option value={1}>1 stop</option>
                              <option value={2}>2 stops</option>
                              <option value={DEFAULT_MAX_STOPS}>Any</option>
                            </select>
                          </div>

                          {/* Airline */}
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500">
                              Airline
                            </label>
                            <select
                              value={selectedAirline}
                              onChange={(e) => setSelectedAirline(e.target.value)}
                              className="w-full rounded-xl border border-brand-200/70 bg-white px-2 py-1.5 text-xs font-semibold text-brand-900 dark:border-white/10 dark:bg-brand-900 dark:text-white"
                            >
                              <option value="all">All</option>
                              {airlines.map((a) => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </select>
                          </div>

                          {/* Sort (mirrors the chips) */}
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500">
                              Sort
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as "price" | "duration" | "ai")}
                              className="w-full rounded-xl border border-brand-200/70 bg-white px-2 py-1.5 text-xs font-semibold text-brand-900 dark:border-white/10 dark:bg-brand-900 dark:text-white"
                            >
                              <option value="price">Cheapest</option>
                              <option value="duration">Fastest</option>
                              <option value="ai">Best</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Flight list ──────────────────────────────────── */}
                <div className="space-y-3 p-3 sm:p-4">

                  {/* Loading skeletons */}
                  {loading && (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonCard key={i} />
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {!loading && filteredFlights.length === 0 && (
                    <div className="rounded-2xl border border-brand-200/70 bg-white px-6 py-10 text-center dark:border-white/10 dark:bg-brand-900/40">
                      <p className="text-sm font-semibold text-brand-500 dark:text-brand-400">
                        No flights match your filters.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setMaxStops(DEFAULT_MAX_STOPS); setSelectedAirline("all"); }}
                        className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}

                  {/* Flight cards */}
                  {!loading && filteredFlights.length > 0 && (
                    <motion.div
                      key={animKey}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {filteredFlights.map((f, i) => {
                        const isOpen = expanded === i;
                        const seg0   = f.flights?.[0];
                        const layCnt =
                          f.layovers?.length ??
                          (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1);

                        return (
                          <motion.div
                            key={i}
                            variants={cardVariants}
                            layout
                            transition={{ type: "spring", stiffness: 260, damping: 28 }}
                            ref={(el) => { cardRefs.current[i] = el; }}
                            className={`overflow-hidden rounded-2xl border transition
                              ${isOpen
                                ? "border-indigo-300 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-400/20 dark:border-indigo-500/50"
                                : "border-brand-200/70 hover:border-brand-300 hover:shadow-md dark:border-white/10 dark:hover:border-white/20"
                              } bg-white dark:bg-brand-900`}
                          >
                            {/* Summary row — tap to expand */}
                            <button
                              type="button"
                              onClick={() => toggleCard(i)}
                              className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-brand-50/50 dark:hover:bg-white/3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                {/* Airline logo */}
                                {f.airline_logo ? (
                                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-200/70 dark:bg-white/10 dark:ring-white/10">
                                    <img src={f.airline_logo} alt="" className="h-full w-full object-contain p-1.5" />
                                  </div>
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-300">
                                      {(f.provider || "?").slice(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-brand-900 dark:text-white">
                                    {f.provider}
                                  </p>
                                  {seg0 && (
                                    <p className="truncate text-[11px] text-brand-500 dark:text-brand-400">
                                      {seg0.airline}
                                      {seg0.flight_number ? ` · ${seg0.flight_number}` : ""}
                                      {seg0.travel_class  ? ` · ${seg0.travel_class}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="ml-2 flex shrink-0 items-center gap-3">
                                {/* Duration — hidden on very small */}
                                {f.total_duration != null && (
                                  <span className="hidden text-xs font-semibold text-brand-500 dark:text-brand-400 xs:inline">
                                    {minsToH(f.total_duration)}
                                  </span>
                                )}

                                {/* Stops badge */}
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold
                                  ${layCnt === 0
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                    : "bg-brand-100 text-brand-600 dark:bg-white/10 dark:text-brand-300"
                                  }`}>
                                  {layCnt === 0 ? "Direct" : `${layCnt} stop${layCnt !== 1 ? "s" : ""}`}
                                </span>

                                {/* Price */}
                                {typeof f.price === "number" && (
                                  <span className="text-base font-extrabold text-brand-900 dark:text-white">
                                    ${f.price}
                                  </span>
                                )}

                                {isOpen
                                  ? <ChevronUp   className="h-4 w-4 text-brand-400" />
                                  : <ChevronDown className="h-4 w-4 text-brand-400" />
                                }
                              </div>
                            </button>

                            {/* Expanded details */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                  className="border-t border-brand-100/60 bg-brand-50/30 px-4 pb-5 pt-4 text-sm dark:border-white/5 dark:bg-white/2"
                                >
                                  {f.flights ? (
                                    <>
                                      {/* Date header */}
                                      <p className="mb-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                        {fmtFull(f.flights[0].departure_airport.time)}
                                      </p>

                                      {/* Flight segments */}
                                      <ol className="relative border-l-2 border-indigo-200 pl-6 dark:border-indigo-500/40">
                                        {f.flights.map((seg, j) => (
                                          <li key={j} className="relative mb-7 last:mb-0">
                                            {/* Timeline dot */}
                                            <div className="absolute -left-[1.5625rem] top-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-indigo-400 dark:bg-brand-900 dark:ring-indigo-500">
                                              {seg.airline_logo ? (
                                                <img src={seg.airline_logo} alt={seg.airline} className="h-full w-full object-contain" />
                                              ) : (
                                                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                              )}
                                            </div>

                                            {/* Segment info */}
                                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between">
                                              <div>
                                                <p className="text-sm font-bold text-brand-900 dark:text-white">
                                                  {seg.departure_airport.id} → {seg.arrival_airport.id}
                                                </p>
                                                <p className="text-[11px] text-brand-500 dark:text-brand-400">
                                                  {seg.airline} {seg.flight_number}
                                                  {seg.travel_class ? ` · ${seg.travel_class}` : ""}
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className="text-xs font-bold text-brand-900 dark:text-white">
                                                  {fmtTime(seg.departure_airport.time)} → {fmtTime(seg.arrival_airport.time)}
                                                </p>
                                                <p className="text-[11px] text-brand-500 dark:text-brand-400">
                                                  {minsToH(seg.duration)}
                                                </p>
                                              </div>
                                            </div>

                                            <p className="mt-0.5 text-[11px] text-brand-400 dark:text-brand-500">
                                              {seg.departure_airport.name} › {seg.arrival_airport.name}
                                            </p>

                                            {/* Layover */}
                                            {j < (f.flights?.length ?? 0) - 1 && f.layovers?.[j] && (
                                              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                                Layover · {f.layovers[j].name} · {minsToH(f.layovers[j].duration)}
                                                {f.layovers[j].overnight ? " · overnight" : ""}
                                              </div>
                                            )}
                                          </li>
                                        ))}
                                      </ol>

                                      {/* Stats row */}
                                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-500 dark:text-brand-400">
                                        {f.total_duration != null && (
                                          <span><strong className="text-brand-700 dark:text-brand-300">Total</strong> {minsToH(f.total_duration)}</span>
                                        )}
                                        {f.carbon_emissions && (
                                          <span><strong className="text-brand-700 dark:text-brand-300">CO₂</strong> {(f.carbon_emissions.this_flight / 1000).toFixed(1)} kg</span>
                                        )}
                                        {typeof f.ai_score === "number" && (
                                          <span><strong className="text-brand-700 dark:text-brand-300">AI score</strong> {f.ai_score.toFixed(1)}{typeof f.ai_rank === "number" ? ` · rank #${f.ai_rank}` : ""}</span>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <ul className="list-inside list-disc space-y-1 text-brand-600 dark:text-brand-300">
                                      {(f.legs || []).map((l, k) => <li key={k}>{l}</li>)}
                                    </ul>
                                  )}

                                  {/* Book CTA */}
                                  <motion.a
                                    whileHover={{ scale: 1.015 }}
                                    whileTap={{ scale: 0.985 }}
                                    href={f.deeplink || googleLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-95"
                                  >
                                    Book now
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </motion.a>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Bottom edit search (when results loaded) */}
                  {!loading && filteredFlights.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-200/70 py-3 text-sm font-semibold text-brand-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-brand-400 dark:hover:text-indigo-400"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Edit search
                    </button>
                  )}

                  {/* Safe-area bottom spacing for mobile */}
                  <div className="h-4 sm:h-0" />
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>

      </Dialog>
    </Transition>
  );
}
