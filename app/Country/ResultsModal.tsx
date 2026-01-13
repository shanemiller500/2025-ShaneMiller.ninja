/* eslint-disable @next/next/no-img-element */
"use client";

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Filter as FilterIcon,
  Sparkles,
  Clock3,
  DollarSign,
  Zap,
} from "lucide-react";

/* ---------- helpers ------------------------------------------------ */
const minsToH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

const fmtTime = (iso: string) =>
  new Date(iso.replace(" ", "T")).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const fmtDate = (iso: string) =>
  new Date(iso.replace(" ", "T")).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/* ---------- API-matching types ------------------------------------ */
interface FlightSegment {
  departure_airport: { name: string; id: string; time: string };
  arrival_airport: { name: string; id: string; time: string };
  duration: number;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  extensions?: string[];
}
interface Layover {
  duration: number;
  name: string;
  id: string;
  overnight?: boolean;
}
interface FlightOption {
  provider: string;
  price: number | null;
  total_duration?: number;
  carbon_emissions?: {
    this_flight: number;
    typical_for_this_route: number;
    difference_percent: number;
  };
  airline_logo?: string;
  flights?: FlightSegment[];
  layovers?: Layover[];
  legs?: string[];
  deeplink?: string;
  ai_score?: number;
  ai_rank?: number;
}

/* ---------- props -------------------------------------------------- */
interface Props {
  open: boolean;
  setOpen: (b: boolean) => void;
  loading: boolean;
  photo: string | null;
  flights: FlightOption[];
  from: string;
  to: string;
  depart: string;
  ret: string;
  trip: "round" | "oneway";
}

/* ---------- links -------------------------------------------------- */
const safeIata = (s: string) =>
  (s || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

function buildGoogleFlightsLink({
  from,
  to,
  depart,
  ret,
  trip,
}: {
  from: string;
  to: string;
  depart: string;
  ret?: string;
  trip: "round" | "oneway";
}) {
  const f = safeIata(from);
  const t = safeIata(to);
  const d = (depart || "").slice(0, 10);
  const r = (ret || "").slice(0, 10);
  const base = "https://www.google.com/travel/flights?hl=en#flt=";
  const hash =
    trip === "round" && r
      ? `${encodeURIComponent(`${f}.${t}.${d}*${t}.${f}.${r}`)}`
      : `${encodeURIComponent(`${f}.${t}.${d}`)}`;
  return base + hash;
}

function buildSkyscannerLink({
  from,
  to,
  depart,
  ret,
  trip,
}: {
  from: string;
  to: string;
  depart: string;
  ret?: string;
  trip: "round" | "oneway";
}) {
  const f = safeIata(from).toLowerCase();
  const t = safeIata(to).toLowerCase();
  const d = (depart || "").replace(/-/g, "");
  const r = (ret || "").replace(/-/g, "");
  const skyBase = "https://www.skyscanner.com/transport/flights";
  return trip === "round" && r ? `${skyBase}/${f}/${t}/${d}/${r}` : `${skyBase}/${f}/${t}/${d}`;
}

function buildMomondoLink({
  from,
  to,
  depart,
  ret,
  trip,
}: {
  from: string;
  to: string;
  depart: string;
  ret?: string;
  trip: "round" | "oneway";
}) {
  const f = safeIata(from);
  const t = safeIata(to);
  const d = (depart || "").slice(0, 10);
  const r = (ret || "").slice(0, 10);
  const base = "https://www.momondo.com/flight-search";
  return trip === "round" && r
    ? `${base}/${f}-${t}/${d}/${r}?sort=bestflight_a`
    : `${base}/${f}-${t}/${d}?sort=bestflight_a`;
}

/* ---------- animations -------------------------------------------- */
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.06 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 520, damping: 34 },
  },
};

const shimmer: Variants = {
  hidden: { opacity: 0.6 },
  show: { opacity: 1, transition: { duration: 0.8, repeat: Infinity, repeatType: "mirror" } },
};

function SkeletonCard() {
  return (
    <motion.div
      variants={shimmer}
      initial="hidden"
      animate="show"
      className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-brand-900"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/10" />
          <div>
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-white/10" />
            <div className="mt-2 h-2 w-40 rounded bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
        <div className="h-5 w-16 rounded bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="mt-3 h-2 w-52 rounded bg-gray-200 dark:bg-white/10" />
    </motion.div>
  );
}

/* ================================================================== */
export default function ResultsModal({
  open,
  setOpen,
  loading,
  photo,
  flights,
  from,
  to,
  depart,
  ret,
  trip,
}: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxStops, setMaxStops] = useState<number>(3); // 3 = Any
  const [selectedAirline, setSelectedAirline] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"price" | "duration" | "ai">("price");

  // makes “appear” animation replay whenever a new result set arrives
  const [animKey, setAnimKey] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setExpanded(null);
    setFiltersOpen(false);
  }, [open]);

  useEffect(() => {
    // re-run list enter when flight count changes (and not loading)
    if (!loading) setAnimKey((k) => k + 1);
  }, [loading, flights.length]);

  /* unique airline list for filter dropdown ----------------------- */
  const airlines = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => f.flights?.forEach((seg) => s.add(seg.airline)));
    return Array.from(s).sort();
  }, [flights]);

  /* filtered + sorted flight list --------------------------------- */
  const filteredFlights = useMemo(() => {
    const filterfn = (f: FlightOption) => {
      const layCnt =
        f.layovers?.length ??
        (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1);
      if (maxStops < 3 && layCnt > maxStops) return false;

      if (
        selectedAirline !== "all" &&
        !f.flights?.some((seg) => seg.airline === selectedAirline)
      )
        return false;

      return true;
    };

    const sortfn = (a: FlightOption, b: FlightOption) => {
      switch (sortBy) {
        case "duration":
          return (a.total_duration ?? 1e9) - (b.total_duration ?? 1e9);
        case "ai":
          return (b.ai_score ?? -1) - (a.ai_score ?? -1);
        case "price":
        default:
          return (a.price ?? 1e9) - (b.price ?? 1e9);
      }
    };

    return [...flights.filter(filterfn)].sort(sortfn);
  }, [flights, maxStops, selectedAirline, sortBy]);

  const googleLink = useMemo(
    () => buildGoogleFlightsLink({ from, to, depart, ret, trip }),
    [from, to, depart, ret, trip],
  );
  const skyLink = useMemo(
    () => buildSkyscannerLink({ from, to, depart, ret, trip }),
    [from, to, depart, ret, trip],
  );
  const momondoLink = useMemo(
    () => buildMomondoLink({ from, to, depart, ret, trip }),
    [from, to, depart, ret, trip],
  );

  const toggleCard = (i: number) => {
    setExpanded((prev) => (prev === i ? null : i));

    window.setTimeout(() => {
      const el = cardRefs.current[i];
      const scroller = listRef.current;
      if (!el || !scroller) return;

      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (r.top < s.top + 120 || r.bottom > s.bottom - 24) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 70);
  };

  const quickChip = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold transition
     ${
       active
         ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
         : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-white/10 dark:bg-brand-900 dark:text-white dark:hover:bg-white/5"
     }`;

  /* ---------------------------------------------------------------- */
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog onClose={setOpen} className="relative z-50">
        {/* dim background */}
        <Transition.Child
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" />
        </Transition.Child>

        {/* centered modal */}
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-6">
          <Transition.Child
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-brand-900 sm:max-w-2xl lg:max-w-3xl">
              {photo && <img src={photo} alt="" className="h-44 w-full object-cover" />}

              {/* scroll area */}
              <div 
                ref={listRef}
                className="max-h-[calc(92vh-11rem)] overflow-y-auto"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {/* sticky header */}
                <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/92 px-6 py-4 backdrop-blur-[40px] dark:border-white/10 dark:bg-brand-900/92">
                  <div className="flex items-center justify-between gap-3">
                    <Dialog.Title className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {loading
                        ? "Searching flights…"
                        : `Found ${filteredFlights.length} option${
                            filteredFlights.length !== 1 ? "s" : ""
                          }`}
                    </Dialog.Title>

                    {!loading && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-700 dark:bg-white/10 dark:text-indigo-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        ready to book
                      </div>
                    )}
                  </div>

                  {/* quick sort chips (feels like google/momondo) */}
                  {!loading && flights.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSortBy("ai")}
                        className={quickChip(sortBy === "ai")}
                        title="Best picks"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Best
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy("price")}
                        className={quickChip(sortBy === "price")}
                        title="Lowest price"
                      >
                        <DollarSign className="h-3.5 w-3.5" />
                        Cheapest
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy("duration")}
                        className={quickChip(sortBy === "duration")}
                        title="Shortest duration"
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Fastest
                      </button>

                      <div className="ml-auto flex flex-wrap gap-2">
                        <a
                          href={googleLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white shadow hover:opacity-90"
                        >
                          Google Flights
                        </a>
                        <a
                          href={momondoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-2xl bg-gray-900 px-3 py-2 text-xs font-extrabold text-white shadow hover:opacity-90 dark:bg-white/10"
                        >
                          Momondo
                        </a>
                        <a
                          href={skyLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-2xl bg-sky-600 px-3 py-2 text-xs font-extrabold text-white shadow hover:opacity-90"
                        >
                          Skyscanner
                        </a>
                      </div>
                    </div>
                  )}

                  {/* filter toggle */}
                  {!loading && flights.length > 0 && (
                    <button
                      onClick={() => setFiltersOpen((p) => !p)}
                      className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-3 py-2 text-sm font-extrabold text-gray-700 hover:bg-gray-200 dark:bg-brand-900 dark:text-gray-200 dark:hover:bg-brand-800"
                      type="button"
                    >
                      <FilterIcon size={16} />
                      Filters
                      {filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}

                  {/* filter panel */}
                  <AnimatePresence initial={false}>
                    {filtersOpen && !loading && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 28 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-gray-700 dark:text-gray-200">
                              Max stops
                            </label>
                            <select
                              value={maxStops}
                              onChange={(e) => setMaxStops(+e.target.value)}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-2 py-2 text-sm font-semibold dark:border-brand-800 dark:bg-brand-900"
                            >
                              <option value={0}>Non-stop</option>
                              <option value={1}>1 stop</option>
                              <option value={2}>2 stops</option>
                              <option value={3}>Any</option>
                            </select>
                          </div>

                          <div className="col-span-1 sm:col-span-2">
                            <label className="mb-1 block text-xs font-extrabold text-gray-700 dark:text-gray-200">
                              Airline
                            </label>
                            <select
                              value={selectedAirline}
                              onChange={(e) => setSelectedAirline(e.target.value)}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-2 py-2 text-sm font-semibold dark:border-brand-800 dark:bg-brand-900"
                            >
                              <option value="all">All airlines</option>
                              {airlines.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-extrabold text-gray-700 dark:text-gray-200">
                              Sort
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="w-full rounded-2xl border border-gray-300 bg-white px-2 py-2 text-sm font-semibold dark:border-brand-800 dark:bg-brand-900"
                            >
                              <option value="price">Price</option>
                              <option value="duration">Duration</option>
                              <option value="ai">AI rank</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* body */}
                <div className="p-6">
                  {/* loading skeletons */}
                  {loading && (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonCard key={i} />
                      ))}
                    </div>
                  )}

                  {/* empty */}
                  {!loading && filteredFlights.length === 0 && (
                    <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm dark:border-white/10 dark:bg-brand-900 dark:text-gray-300">
                      No flights match your filters.
                    </div>
                  )}

                  {/* APPEARING LIST (this is the magic) */}
                  {!loading && filteredFlights.length > 0 && (
                    <motion.div
                      key={animKey}
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-4"
                    >
                      {filteredFlights.map((f, i) => {
                        const isOpen = expanded === i;
                        const seg0 = f.flights?.[0];
                        const layCnt =
                          f.layovers?.length ??
                          (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1);

                        return (
                          <motion.div
                            key={i}
                            variants={cardVariants}
                            layout
                            transition={{ type: "spring", stiffness: 260, damping: 28 }}
                            ref={(el) => {
                              cardRefs.current[i] = el;
                            }}
                            className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition
                              dark:bg-brand-900 dark:border-white/10
                              ${
                                isOpen
                                  ? "border-indigo-300 shadow-xl ring-1 ring-indigo-400/30"
                                  : "border-gray-200 hover:shadow-lg"
                              }`}
                          >
                            {/* summary row */}
                            <button
                              onClick={() => toggleCard(i)}
                              className="flex w-full items-center justify-between bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100 dark:bg-brand-900 dark:hover:bg-brand-800"
                              type="button"
                            >
                              <div className="flex items-center gap-3">
                                {f.airline_logo && (
                                  <div className="h-9 w-9 overflow-hidden rounded-full bg-white shadow ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
                                    <img
                                      src={f.airline_logo}
                                      alt=""
                                      className="h-full w-full object-contain p-1.5"
                                    />
                                  </div>
                                )}

                                <div className="flex flex-col">
                                  <span className="font-extrabold text-gray-900 dark:text-white">
                                    {f.provider}
                                  </span>
                                  {seg0 && (
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                                      {seg0.airline}
                                      {seg0.flight_number ? ` • ${seg0.flight_number}` : ""}
                                      {seg0.travel_class ? ` • ${seg0.travel_class}` : ""}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                {typeof f.price === "number" && (
                                  <span className="whitespace-nowrap text-lg font-extrabold text-gray-900 dark:text-white">
                                    ${f.price}
                                  </span>
                                )}

                                {f.total_duration != null && (
                                  <span className="hidden whitespace-nowrap text-xs font-extrabold text-gray-600 dark:text-gray-300 sm:inline">
                                    {minsToH(f.total_duration)}
                                  </span>
                                )}

                                <span className="whitespace-nowrap text-sm font-extrabold text-gray-900 dark:text-white">
                                  {layCnt} stop{layCnt !== 1 && "s"}
                                </span>

                                {isOpen ? (
                                  <ChevronUp size={18} className="text-gray-400" />
                                ) : (
                                  <ChevronDown size={18} className="text-gray-400" />
                                )}
                              </div>
                            </button>

                            {/* details */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                                  className="space-y-6 bg-white p-6 pb-8 text-sm leading-relaxed dark:bg-brand-900 dark:text-gray-300"
                                >
                                  {f.flights ? (
                                    <>
                                      <div className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300">
                                        {fmtDate(f.flights[0].departure_airport.time)}
                                      </div>

                                      <ol className="relative border-s-2 border-indigo-300 pl-7 dark:border-indigo-600">
                                        {f.flights.map((seg, j) => (
                                          <li key={j} className="relative mb-8 last:mb-0">
                                            <div className="absolute -start-[1.625rem] top-1.5 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-2 ring-indigo-500 dark:bg-brand-900">
                                              {seg.airline_logo ? (
                                                <img
                                                  src={seg.airline_logo}
                                                  alt={seg.airline}
                                                  className="h-full w-full object-contain"
                                                />
                                              ) : (
                                                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                              )}
                                            </div>

                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                              <div>
                                                <p className="font-extrabold text-gray-900 dark:text-white">
                                                  {seg.departure_airport.id} → {seg.arrival_airport.id}
                                                </p>
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                  {seg.airline} {seg.flight_number}
                                                </p>
                                              </div>

                                              <p className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                                                {fmtTime(seg.departure_airport.time)} →{" "}
                                                {fmtTime(seg.arrival_airport.time)}
                                                <span className="hidden sm:inline">
                                                  {" "}
                                                  · {minsToH(seg.duration)}
                                                </span>
                                              </p>
                                            </div>

                                            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                              {seg.departure_airport.name} › {seg.arrival_airport.name}
                                            </p>

                                            {j < (f.flights?.length ?? 0) - 1 && f.layovers?.[j] && (
                                              <div className="mt-4 ms-4 rounded-2xl bg-indigo-50 px-4 py-2 text-center text-xs font-extrabold text-indigo-700 dark:bg-white/5 dark:text-indigo-300">
                                                Layover in {f.layovers[j].name} ·{" "}
                                                {minsToH(f.layovers[j].duration)}
                                                {f.layovers[j].overnight ? " (overnight)" : ""}
                                              </div>
                                            )}
                                          </li>
                                        ))}
                                      </ol>

                                      <div className="mt-4 space-y-1 text-sm">
                                        {f.total_duration != null && (
                                          <p>
                                            <strong>Total:</strong> {minsToH(f.total_duration)}
                                          </p>
                                        )}
                                        {f.carbon_emissions && (
                                          <p>
                                            <strong>Emissions:</strong>{" "}
                                            {(f.carbon_emissions.this_flight / 1000).toFixed(1)} kg CO₂
                                          </p>
                                        )}
                                        {typeof f.ai_score === "number" && (
                                          <p>
                                            <strong>AI score:</strong> {f.ai_score.toFixed(2)}
                                            {typeof f.ai_rank === "number" ? ` (rank ${f.ai_rank})` : ""}
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <ul className="list-inside list-disc space-y-1">
                                      {(f.legs || []).map((l, k) => (
                                        <li key={k}>{l}</li>
                                      ))}
                                    </ul>
                                  )}

                                  <motion.a
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    href={f.deeplink || googleLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-3 font-extrabold text-white shadow-lg hover:opacity-95"
                                  >
                                    Book now →
                                  </motion.a>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* close */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpen(false)}
                    className="mt-6 w-full rounded-2xl bg-gray-100 px-4 py-3 text-sm font-extrabold text-gray-800 hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    type="button"
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
