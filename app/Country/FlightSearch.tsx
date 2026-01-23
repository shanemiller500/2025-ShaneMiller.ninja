/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowLeftRight, ChevronDown, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ResultsModal from "./ResultsModal";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface FullCountry {
  cca3: string;
  cca2?: string;
  capital?: string[];
}

type AirportRec = {
  iata: string;
  name: string;
  city: string;
  iso: string;
  type: string;
};

type Cabin = "e" | "pe" | "b" | "f";
type Trip = "round" | "oneway";

/* ---------------- Constants ---------------------------------------- */
const QUICK_MAP: Record<string, string> = {
  USA: "DEN",
  GBR: "LHR",
  CAN: "YYZ",
  FRA: "CDG",
  DEU: "FRA",
  JPN: "NRT",
};

const cabinSlug: Record<Cabin, string> = {
  e: "economy",
  pe: "premiumeconomy",
  b: "business",
  f: "first",
};

const cabinMeta: Record<Cabin, { title: string; sub: string }> = {
  e: { title: "Economy", sub: "Best value" },
  pe: { title: "Premium", sub: "More room" },
  b: { title: "Business", sub: "Lie flat" },
  f: { title: "First", sub: "Luxury" },
};

const LS_KEY = "flightSearch:last";

/* ---------------- Helpers ------------------------------------------ */
let airports: AirportRec[] = [];

async function getAirports(): Promise<AirportRec[]> {
  if (airports.length) return airports;
  const raw = await fetch(
    "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json",
  ).then((r) => r.json());
  airports = Object.values(raw) as AirportRec[];
  return airports;
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 864e5).toISOString().slice(0, 10);
const tomorrow = (iso: string) => addDaysISO(iso, 1);
const isIata = (s: string) => /^[A-Z]{3}$/.test((s || "").trim().toUpperCase());
const safeUpper3 = (s: string) =>
  (s || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();

/* ---------- Airport Typeahead -------------------------------------- */
function AirportTypeahead({
  label,
  value,
  setValue,
  placeholder,
  allAirports,
  showSwap,
  onSwap,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder: string;
  allAirports: AirportRec[];
  showSwap?: boolean;
  onSwap?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (q.length < 2) return [];

    return allAirports
      .filter((a) => a.iata)
      .filter((a) => {
        const iata = a.iata.toLowerCase();
        const city = (a.city || "").toLowerCase();
        const name = (a.name || "").toLowerCase();
        const iso = (a.iso || "").toLowerCase();
        return (
          iata.startsWith(q) ||
          city.includes(q) ||
          name.includes(q) ||
          iso === q
        );
      })
      .slice(0, 10);
  }, [query, allAirports]);

  const selected = useMemo(() => {
    if (!isIata(value)) return null;
    return allAirports.find((x) => x.iata?.toUpperCase() === value);
  }, [value, allAirports]);

  return (
    <div className="relative flex flex-col" ref={wrapRef}>
      <span className="mb-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
        {label}
      </span>

      <div className="relative">
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            const maybe = safeUpper3(next);
            if (maybe.length === 3) setValue(maybe);
            else setValue("");
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="
            w-full rounded-xl border border-brand-300/80 bg-white/70
            px-3 py-2 text-sm text-brand-900 shadow-sm backdrop-blur
            focus:outline-none focus:ring-2 focus:ring-indigo-500
            dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100
          "
        />

        {showSwap && onSwap && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onSwap}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-brand-300 bg-white/70 p-1.5 text-brand-700 shadow-sm hover:bg-white dark:border-brand-700 dark:bg-brand-900/60 dark:text-brand-200"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </motion.button>
        )}

        <AnimatePresence>
          {open && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-brand-900"
            >
              <div className="max-h-[50vh] overflow-y-auto">
                {suggestions.map((a) => (
                  <button
                    key={a.iata}
                    type="button"
                    onClick={() => {
                      setValue(a.iata.toUpperCase());
                      setQuery(a.iata.toUpperCase());
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 border-b border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
                  >
                    <span className="inline-flex min-w-[36px] justify-center rounded-lg bg-indigo-600 px-1.5 py-0.5 text-xs font-extrabold text-white">
                      {a.iata.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-gray-900 dark:text-white">
                        {a.city || a.name}
                      </span>
                      <span className="block truncate text-[10px] text-gray-500 dark:text-gray-400">
                        {a.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selected && (
        <span className="mt-0.5 text-[10px] text-brand-600 dark:text-brand-400">
          {selected.city}
        </span>
      )}
    </div>
  );
}

/* ---------- Stepper -------------------------------------- */
function Stepper({
  label,
  desc,
  val,
  set,
  min,
}: {
  label: string;
  desc: string;
  val: number;
  set: (n: number) => void;
  min: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-brand-200/70 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-brand-900/40">
      <div className="min-w-0 pr-3">
        <div className="text-xs font-semibold text-brand-900 dark:text-white">{label}</div>
        <div className="text-[10px] text-brand-600 dark:text-brand-400">{desc}</div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => set(Math.max(min, val - 1))}
          disabled={val <= min}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-300 bg-white text-brand-800 hover:bg-brand-50 disabled:opacity-40 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
        >
          –
        </button>

        <span className="min-w-[1.5rem] text-center text-sm font-extrabold text-brand-900 dark:text-white">
          {val}
        </span>

        <button
          type="button"
          onClick={() => set(val + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-300 bg-white text-brand-800 hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100"
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FlightSearch component                                            */
/* ================================================================== */
export default function FlightSearch({ full = null }: { full?: FullCountry | null }) {
  const API_BASE = "https://u-mail.co";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");
  const [trip, setTrip] = useState<Trip>("round");
  const [cabin, setCabin] = useState<Cabin>("e");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [seniors, setSeniors] = useState(0);

  const [travelersOpen, setTravelersOpen] = useState(false);
  const [readyList, setReadyList] = useState(false);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<any[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    getAirports().then(() => setReadyList(true));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.from) setFrom(safeUpper3(s.from));
      if (s?.to) setTo(safeUpper3(s.to));
      if (s?.trip === "round" || s?.trip === "oneway") setTrip(s.trip);
      if (["e", "pe", "b", "f"].includes(s?.cabin)) setCabin(s.cabin);
      if (typeof s?.adults === "number") setAdults(Math.max(1, s.adults));
      if (typeof s?.children === "number") setChildren(Math.max(0, s.children));
      if (typeof s?.infants === "number") setInfants(Math.max(0, s.infants));
      if (typeof s?.seniors === "number") setSeniors(Math.max(0, s.seniors));
      if (s?.depart) setDepart(s.depart);
      if (s?.ret) setRet(s.ret);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ from, to, depart, ret, trip, cabin, adults, children, infants, seniors }),
      );
    } catch {}
  }, [from, to, depart, ret, trip, cabin, adults, children, infants, seniors]);

  useEffect(() => {
    if (!full) return;
    if (QUICK_MAP[full.cca3]) {
      setTo(QUICK_MAP[full.cca3]);
      return;
    }
    (async () => {
      const list = await getAirports();
      const iso = full.cca2 || "";
      const big =
        list.find((a) => a.iso === iso && a.type === "large_airport") ||
        list.find((a) => a.iso === iso);
      setTo(big?.iata || "");
    })();
  }, [full]);

  useEffect(() => {
    if (!depart) {
      const d = addDaysISO(isoToday(), 14);
      setDepart(d);
      if (trip === "round") setRet(addDaysISO(d, 1));
      return;
    }
    if (trip === "round" && (!ret || ret <= depart)) setRet(tomorrow(depart));
  }, [trip]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDepart = (d: string) => {
    setDepart(d);
    if (trip === "round" && (!ret || ret <= d)) setRet(tomorrow(d));
  };

  const onTripToggle = (t: Trip) => {
    setTrip(t);
    if (t === "oneway") setRet("");
    else if (depart && (!ret || ret <= depart)) setRet(tomorrow(depart));
  };

  const paxTotal = adults + children + infants + seniors;

  const allGood =
    isIata(from) &&
    isIata(to) &&
    Boolean(depart) &&
    (trip === "oneway" || Boolean(ret)) &&
    (trip === "oneway" || ret > depart);

  useEffect(() => {
    if (!from && !to) return setFormError("");
    if (from && !isIata(from)) return setFormError("Enter valid 3-letter airport (e.g., DEN)");
    if (to && !isIata(to)) return setFormError("Enter valid 3-letter airport (e.g., LAX)");
    if (trip === "round" && depart && ret && ret <= depart)
      return setFormError("Return must be after departure");
    setFormError("");
  }, [from, to, trip, depart, ret]);

  const runSearch = async () => {
    if (!allGood || loading) return;

    setOpen(true);
    setLoading(true);
    setFlights([]);
    setPhoto(null);

    try {
      const params = new URLSearchParams({
        from,
        to,
        depart,
        trip,
        cabin: cabinSlug[cabin],
        adults: adults.toString(),
        kids: children.toString(),
        inf: infants.toString(),
        seniors: seniors.toString(),
        currency: "USD",
        hl: "en",
        gl: "us",
      });
      if (trip === "round") params.append("ret", ret);

      const res = await fetch(`${API_BASE}/api/flightSearch?${params.toString()}`);
      const json = await res.json();
      const list: any[] = Array.isArray(json) ? json : [];

      list.sort((a, b) => {
        const ar = typeof a.ai_rank === "number" ? a.ai_rank : Number.POSITIVE_INFINITY;
        const br = typeof b.ai_rank === "number" ? b.ai_rank : Number.POSITIVE_INFINITY;
        if (ar !== br) return ar - br;
        const ap = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
        const bp = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;
        if (ap !== bp) return ap - bp;
        return String(a.provider || "").localeCompare(String(b.provider || ""));
      });

      setFlights(list);
    } catch (e) {
      console.error("Flight search error:", e);
    } finally {
      setLoading(false);
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  useEffect(() => {
    if (typeof document === "undefined" || !travelersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [travelersOpen]);

  const summary = `${paxTotal} traveller${paxTotal !== 1 ? "s" : ""} · ${cabinMeta[cabin].title}`;

  return (
    <>
      <section className="relative mx-auto max-w-lg px-3 py-4">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-[420px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-brand-900 dark:ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-brand-100 px-4 py-3 dark:border-white/10">
            <div>
              <h2 className="text-sm font-extrabold text-brand-900 dark:text-white">
                Search flights
              </h2>
              <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                <Users className="h-3 w-3" />
                {summary}
              </div>
            </div>

            <div className="flex shrink-0 overflow-hidden rounded-xl border border-brand-200/70 bg-white/50 dark:border-white/10 dark:bg-brand-900/40">
              {(["round", "oneway"] as Trip[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onTripToggle(t)}
                  type="button"
                  className={`px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide transition ${
                    trip === t
                      ? "bg-indigo-600 text-white"
                      : "text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-white/5"
                  }`}
                >
                  {t === "round" ? "Round" : "One-way"}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3 p-4">
            <AirportTypeahead
              label="From"
              value={from}
              setValue={setFrom}
              placeholder="DEN or Denver"
              allAirports={airports}
              showSwap
              onSwap={swap}
            />

            <AirportTypeahead
              label="To"
              value={to}
              setValue={setTo}
              placeholder="LAX or Los Angeles"
              allAirports={airports}
            />

            <div className={`grid gap-3 ${trip === "round" ? "grid-cols-2" : ""}`}>
              <label className="flex flex-col">
                <span className="mb-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                  Depart
                </span>
                <input
                  type="date"
                  value={depart}
                  min={isoToday()}
                  onChange={(e) => onDepart(e.target.value)}
                  onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2 text-sm text-brand-900 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
                />
              </label>

              {trip === "round" && (
                <label className="flex flex-col">
                  <span className="mb-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                    Return
                  </span>
                  <input
                    type="date"
                    value={ret}
                    min={tomorrow(depart || isoToday())}
                    onChange={(e) => setRet(e.target.value)}
                    onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2 text-sm text-brand-900 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
                  />
                </label>
              )}
            </div>

            <AnimatePresence>
              {formError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                >
                  {formError}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => setTravelersOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-brand-200/70 bg-white/60 px-3 py-2.5 text-left transition hover:bg-brand-50 dark:border-white/10 dark:bg-brand-900/40 dark:hover:bg-white/5"
            >
              <span className="text-xs font-semibold text-brand-800 dark:text-brand-200">
                Travellers & cabin
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
            </button>

            <motion.button
              whileHover={allGood && !loading ? { scale: 1.01 } : {}}
              whileTap={allGood && !loading ? { scale: 0.99 } : {}}
              onClick={runSearch}
              disabled={!allGood || loading}
              type="button"
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold shadow-lg transition ${
                allGood && !loading
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-500"
                  : "cursor-not-allowed bg-brand-300 text-brand-600 dark:bg-brand-800/60 dark:text-brand-500"
              }`}
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Searching…
                </>
              ) : (
                <>
                  Search flights
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </motion.button>

            <p className="text-center text-[10px] text-brand-600 dark:text-brand-400">
              Real booking links • No spam
            </p>
          </div>
        </motion.div>
      </section>

      {/* Travelers Sheet */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {travelersOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-end"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setTravelersOpen(false)}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="relative w-full rounded-t-2xl bg-white/95 shadow-2xl backdrop-blur dark:bg-brand-900/95"
                >
                  <div className="px-4 pb-3 pt-2">
                    <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-800">
                      <div className="text-sm font-extrabold text-brand-900 dark:text-white">
                        Travellers & cabin
                      </div>
                      <button
                        type="button"
                        onClick={() => setTravelersOpen(false)}
                        className="rounded-lg bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-900 dark:bg-white/10 dark:text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
                    <div className="mb-3">
                      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        Cabin
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(cabinMeta) as Cabin[]).map((c) => {
                          const active = cabin === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCabin(c)}
                              className={`rounded-xl border p-2.5 text-left transition ${
                                active
                                  ? "border-indigo-600 bg-indigo-600 shadow-lg"
                                  : "border-brand-200/70 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-brand-900/40"
                              }`}
                            >
                              <div className={`text-xs font-extrabold ${active ? "text-white" : "text-brand-900 dark:text-white"}`}>
                                {cabinMeta[c].title}
                              </div>
                              <div className={`text-[10px] ${active ? "text-white/85" : "text-brand-600 dark:text-brand-400"}`}>
                                {cabinMeta[c].sub}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        Travellers
                      </div>
                      <div className="space-y-2">
                        <Stepper label="Adults" desc="16+" val={adults} set={setAdults} min={1} />
                        <Stepper label="Children" desc="2–15" val={children} set={setChildren} min={0} />
                        <Stepper label="Infants" desc="Under 2" val={infants} set={setInfants} min={0} />
                        <Stepper label="Seniors" desc="65+" val={seniors} set={setSeniors} min={0} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <ResultsModal
        open={open}
        setOpen={setOpen}
        loading={loading}
        photo={photo}
        flights={flights}
        from={from}
        to={to}
        depart={depart}
        ret={ret}
        trip={trip}
      />
    </>
  );
}