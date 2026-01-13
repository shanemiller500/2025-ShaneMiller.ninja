/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ArrowLeftRight,
  ChevronDown,
  Users,
  Armchair,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ResultsModal from "./ResultsModal";

/* ------------------------------------------------------------------ */
/*  Minimal FullCountry shape                                         */
/* ------------------------------------------------------------------ */
export interface FullCountry {
  cca3: string;
  cca2?: string;
  capital?: string[];
}

/* ---------------- quick hard-coded hub map ------------------------ */
const QUICK_MAP: Record<string, string> = {
  USA: "DEN",
  GBR: "LHR",
  CAN: "YYZ",
  FRA: "CDG",
  DEU: "FRA",
  JPN: "NRT",
};

/* ---------------- airport dataset --------------------------------- */
type AirportRec = {
  iata: string;
  name: string;
  city: string;
  iso: string;
  type: string;
};

let airports: AirportRec[] = [];
async function getAirports(): Promise<AirportRec[]> {
  if (airports.length) return airports;
  const raw = await fetch(
    "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json",
  ).then((r) => r.json());
  airports = Object.values(raw) as AirportRec[];
  return airports;
}

/* ---------------- helpers ----------------------------------------- */
type Cabin = "e" | "pe" | "b" | "f";
type Trip = "round" | "oneway";
const cabinSlug: Record<Cabin, string> = {
  e: "economy",
  pe: "premiumeconomy",
  b: "business",
  f: "first",
};

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number) =>
  new Date(new Date(iso).getTime() + days * 864e5).toISOString().slice(0, 10);
const tomorrow = (iso: string) => addDaysISO(iso, 1);

const isIata = (s: string) => /^[A-Z]{3}$/.test((s || "").trim().toUpperCase());
const safeUpper3 = (s: string) =>
  (s || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();

const prettyAirport = (a: AirportRec) => {
  const city = a.city || a.name || "";
  const name = a.name ? ` • ${a.name}` : "";
  return `${a.iata} — ${city}${name}`;
};

const LS_KEY = "flightSearch:last";

/* ---------- typeahead input -------------------------------------- */
function AirportTypeahead({
  label,
  value,
  setValue,
  placeholder,
  airportsReady,
  allAirports,
  rightAccessory,
}: {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder: string;
  airportsReady: boolean;
  allAirports: AirportRec[];
  rightAccessory?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    if (!airportsReady) return [];
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
      .slice(0, 14);
  }, [query, airportsReady, allAirports]);

  const selectedLabel = useMemo(() => {
    if (!isIata(value)) return "";
    const a = allAirports.find((x) => x.iata?.toUpperCase() === value);
    return a ? prettyAirport(a) : "";
  }, [value, allAirports]);

  return (
    <div className="flex flex-col" ref={wrapRef}>
      <span className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
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
          inputMode="text"
          className="
            w-full rounded-xl border border-brand-300/80 bg-white/70
            px-3 py-2.5 pr-12 text-sm text-brand-900 shadow-sm backdrop-blur
            focus:outline-none focus:ring-2 focus:ring-indigo-500
            dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100
          "
        />

        {rightAccessory && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {rightAccessory}
          </div>
        )}

        <AnimatePresence>
          {open && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              className="
                absolute z-30 mt-2 w-full overflow-hidden rounded-2xl
                border border-gray-200 bg-white shadow-xl
                dark:border-white/10 dark:bg-brand-900
              "
            >
              <div
                className="
                  max-h-[52vh] overflow-y-auto overscroll-contain
                  [scrollbar-width:none] [-ms-overflow-style:none]
                "
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {suggestions.map((a) => (
                  <button
                    key={a.iata}
                    type="button"
                    onClick={() => {
                      setValue(a.iata.toUpperCase());
                      setQuery(a.iata.toUpperCase());
                      setOpen(false);
                    }}
                    className="
                      flex w-full items-start gap-3 px-3 py-3 text-left
                      hover:bg-gray-50 active:bg-gray-100
                      dark:hover:bg-white/5 dark:active:bg-white/10
                    "
                  >
                    <span className="mt-[2px] inline-flex min-w-[44px] justify-center rounded-lg bg-indigo-600 px-2 py-1 text-xs font-extrabold text-white">
                      {a.iata.toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                        {a.city || a.name || a.iata}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
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

      {selectedLabel && (
        <span className="mt-1 text-[11px] text-brand-600 dark:text-brand-300">
          {selectedLabel}
        </span>
      )}
    </div>
  );
}

/* ---------- premium counter -------------------------------------- */
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
    <div className="rounded-2xl border border-brand-200/70 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-brand-900/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-brand-900 dark:text-white">
            {label}
          </div>
          <div className="text-xs text-brand-600 dark:text-brand-300">{desc}</div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => set(Math.max(min, val - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-300 bg-white text-brand-800 shadow-sm hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100 dark:hover:bg-white/5"
            aria-label={`Decrease ${label}`}
          >
            –
          </motion.button>

          <motion.div
            key={val}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="min-w-[2.5rem] text-center text-base font-extrabold text-brand-900 dark:text-white"
          >
            {val}
          </motion.div>

          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => set(val + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-300 bg-white text-brand-800 shadow-sm hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-100 dark:hover:bg-white/5"
            aria-label={`Increase ${label}`}
          >
            +
          </motion.button>
        </div>
      </div>
    </div>
  );
}

const cabinMeta: Record<Cabin, { title: string; sub: string }> = {
  e: { title: "Economy", sub: "Best value" },
  pe: { title: "Premium", sub: "More room" },
  b: { title: "Business", sub: "Lounge life" },
  f: { title: "First", sub: "Top shelf" },
};

const cabinPillClass = (active: boolean) =>
  `group relative w-full rounded-2xl border p-3 text-left transition
   ${
     active
       ? "border-indigo-500 bg-indigo-600 text-white shadow-md"
       : "border-brand-200/70 bg-white/70 text-brand-900 shadow-sm hover:shadow-md hover:bg-white dark:border-white/10 dark:bg-brand-900/40 dark:text-white"
   }`;

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

  // desktop travellers accordion
  const [showDetails, setShowDetails] = useState(false);

  // mobile travellers sheet
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  // mobile form accordion (inline, NOT overlay)
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  // track mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setIsMobile(mq.matches);

    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  const [readyList, setReadyList] = useState(false);
  useEffect(() => {
    getAirports().then(() => setReadyList(true));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      if (typeof s?.from === "string") setFrom(safeUpper3(s.from));
      if (typeof s?.to === "string") setTo(safeUpper3(s.to));
      if (typeof s?.trip === "string" && (s.trip === "round" || s.trip === "oneway"))
        setTrip(s.trip);
      if (typeof s?.cabin === "string" && ["e", "pe", "b", "f"].includes(s.cabin))
        setCabin(s.cabin);
      if (typeof s?.adults === "number") setAdults(Math.max(1, s.adults));
      if (typeof s?.children === "number") setChildren(Math.max(0, s.children));
      if (typeof s?.infants === "number") setInfants(Math.max(0, s.infants));
      if (typeof s?.seniors === "number") setSeniors(Math.max(0, s.seniors));
      if (typeof s?.depart === "string") setDepart(s.depart);
      if (typeof s?.ret === "string") setRet(s.ret);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          from,
          to,
          depart,
          ret,
          trip,
          cabin,
          adults,
          children,
          infants,
          seniors,
        }),
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

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<any[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>("");

  const paxTotal = adults + children + infants + seniors;

  const allGood =
    isIata(from) &&
    isIata(to) &&
    Boolean(depart) &&
    (trip === "oneway" || Boolean(ret)) &&
    (trip === "oneway" || ret > depart);

  useEffect(() => {
    if (!from && !to) return setFormError("");
    if (from && !isIata(from)) return setFormError("From must be a 3-letter airport code (IATA).");
    if (to && !isIata(to)) return setFormError("To must be a 3-letter airport code (IATA).");
    if (trip === "round" && depart && ret && ret <= depart)
      return setFormError("Return date must be after departure.");
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

  const summary = useMemo(() => {
    const tripLabel = trip === "round" ? "Round trip" : "One way";
    const cabinLabel = cabinMeta[cabin].title;
    return `${paxTotal} traveller${paxTotal !== 1 ? "s" : ""} · ${cabinLabel} · ${tripLabel}`;
  }, [paxTotal, cabin, trip]);

  // leaving mobile -> close mobile-only UI
  useEffect(() => {
    if (!isMobile) {
      setMobileFormOpen(false);
      setMobileDetailsOpen(false);
    }
  }, [isMobile]);

  // ✅ IMPORTANT: only lock scroll for the OVERLAY sheet (mobileDetailsOpen).
  // DO NOT lock scroll for the inline accordion (mobileFormOpen).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!(isMobile && mobileDetailsOpen)) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, mobileDetailsOpen]);

  const SearchBlock = (
    <div className="border-t border-brand-100 px-5 py-6 dark:border-white/10 sm:px-6">
      <motion.button
        whileHover={allGood && !loading ? { scale: 1.01 } : {}}
        whileTap={allGood && !loading ? { scale: 0.985 } : {}}
        onClick={runSearch}
        disabled={!allGood || loading}
        type="button"
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold
          shadow-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            allGood && !loading
              ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-500 focus:ring-indigo-500"
              : "cursor-not-allowed bg-brand-300 text-brand-600 dark:bg-brand-800/60 dark:text-brand-500"
          }`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Searching…
          </span>
        ) : (
          <>
            Search flights
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </motion.button>

      <p className="mt-3 text-center text-[11px] text-brand-600 dark:text-brand-300">
        Tip: try <span className="font-extrabold">DEN</span> →{" "}
        <span className="font-extrabold">LHR</span>
      </p>
    </div>
  );

  const DesktopInputs = (
    <div className="grid gap-4 px-5 pb-6 sm:grid-cols-2 sm:px-6">
      <AirportTypeahead
        label="From"
        value={from}
        setValue={setFrom}
        placeholder="DEN or Denver"
        airportsReady={readyList}
        allAirports={airports}
        rightAccessory={
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={swap}
            title="Swap"
            className="rounded-full border border-brand-300 bg-white/70 p-2 text-brand-700 shadow-sm
                       hover:bg-white hover:text-brand-900
                       dark:border-brand-700 dark:bg-brand-900/60 dark:text-brand-200 dark:hover:bg-brand-900"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </motion.button>
        }
      />

      <AirportTypeahead
        label="To"
        value={to}
        setValue={setTo}
        placeholder="LAX or Los Angeles"
        airportsReady={readyList}
        allAirports={airports}
      />

      <label className="flex flex-col">
        <span className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
          Depart
        </span>
        <input
          type="date"
          value={depart}
          min={isoToday()}
          onChange={(e) => onDepart(e.target.value)}
          onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
          className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2.5 text-sm text-brand-900 shadow-sm backdrop-blur
                     focus:outline-none focus:ring-2 focus:ring-indigo-500
                     dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
        />
      </label>

      {trip === "round" && (
        <label className="flex flex-col">
          <span className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
            Return
          </span>
          <input
            type="date"
            value={ret}
            min={tomorrow(depart || isoToday())}
            onChange={(e) => setRet(e.target.value)}
            onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
            className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2.5 text-sm text-brand-900 shadow-sm backdrop-blur
                       focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
          />
        </label>
      )}
    </div>
  );

  return (
    <section
      className="
        relative mx-auto mt-8 overflow-hidden rounded-3xl
        bg-white/70 backdrop-blur
        shadow-sm ring-1 ring-black/5
        dark:border-brand-800/30 dark:bg-brand-900
      "
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl" />

      {/* header */}
      <header className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-brand-900 dark:text-white">
            Search for a flight
          </h2>

          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-white/60 px-3 py-1 text-[11px] font-semibold text-brand-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-200">
            <Users className="h-3.5 w-3.5" />
            {summary}
          </div>
        </div>

        {/* round / one-way pills */}
        <div className="inline-flex overflow-hidden rounded-2xl border border-brand-200/70 bg-white/50 shadow-sm backdrop-blur dark:border-white/10 dark:bg-brand-900/40">
          {(["round", "oneway"] as Trip[]).map((t) => (
            <button
              key={t}
              onClick={() => onTripToggle(t)}
              type="button"
              className={`px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide transition
                ${
                  trip === t
                    ? "bg-indigo-600 text-white"
                    : "text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-white/5"
                }`}
            >
              {t === "round" ? "Round" : "One-way"}
            </button>
          ))}
        </div>
      </header>

      {/* ============================= */}
      {/* MOBILE: accordion form (<sm)  */}
      {/* ============================= */}
      <div className="sm:hidden border-t border-brand-200/70 dark:border-white/10">
        <button
          type="button"
          onClick={() => setMobileFormOpen((p) => !p)}
          className="flex w-full items-center justify-between px-5 py-4
                     text-sm font-extrabold text-brand-800 transition hover:bg-brand-50
                     dark:text-brand-200 dark:hover:bg-white/5"
        >
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-[11px] font-extrabold text-brand-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
              ✈
            </span>
            Flight details
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${mobileFormOpen ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {mobileFormOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="overflow-hidden"
            >
              {/* inputs */}
              <div className="grid gap-4 px-5 pb-5">
                <AirportTypeahead
                  label="From"
                  value={from}
                  setValue={setFrom}
                  placeholder="DEN or Denver"
                  airportsReady={readyList}
                  allAirports={airports}
                  rightAccessory={
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={swap}
                      title="Swap"
                      className="rounded-full border border-brand-300 bg-white/70 p-2 text-brand-700 shadow-sm
                                 hover:bg-white hover:text-brand-900
                                 dark:border-brand-700 dark:bg-brand-900/60 dark:text-brand-200 dark:hover:bg-brand-900"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </motion.button>
                  }
                />

                <AirportTypeahead
                  label="To"
                  value={to}
                  setValue={setTo}
                  placeholder="LAX or Los Angeles"
                  airportsReady={readyList}
                  allAirports={airports}
                />

                <label className="flex flex-col">
                  <span className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                    Depart
                  </span>
                  <input
                    type="date"
                    value={depart}
                    min={isoToday()}
                    onChange={(e) => onDepart(e.target.value)}
                    onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2.5 text-sm text-brand-900 shadow-sm backdrop-blur
                               focus:outline-none focus:ring-2 focus:ring-indigo-500
                               dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
                  />
                </label>

                {trip === "round" && (
                  <label className="flex flex-col">
                    <span className="mb-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
                      Return
                    </span>
                    <input
                      type="date"
                      value={ret}
                      min={tomorrow(depart || isoToday())}
                      onChange={(e) => setRet(e.target.value)}
                      onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="rounded-xl border border-brand-300/80 bg-white/70 px-3 py-2.5 text-sm text-brand-900 shadow-sm backdrop-blur
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                 dark:border-brand-700/70 dark:bg-brand-900/60 dark:text-brand-100"
                    />
                  </label>
                )}
              </div>

              {/* error */}
              <AnimatePresence>
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="px-5 pb-4"
                  >
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                      {formError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* travellers button (opens sheet) */}
              <button
                type="button"
                onClick={() => setMobileDetailsOpen(true)}
                className="flex w-full items-center justify-between border-t border-brand-200/70 px-5 py-4
                           text-sm font-extrabold text-brand-800 transition hover:bg-brand-50
                           dark:border-white/10 dark:text-brand-200 dark:hover:bg-white/5"
              >
                <span className="inline-flex items-center gap-2">
                  <Armchair className="h-4 w-4" />
                  Travellers &amp; cabin
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* ✅ Search button + tip INSIDE mobile accordion */}
              {SearchBlock}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================= */}
      {/* DESKTOP: normal layout (sm+)  */}
      {/* ============================= */}
      <div className="hidden sm:block">
        {DesktopInputs}

        <AnimatePresence>
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="px-5 pb-2 sm:px-6"
            >
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                {formError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Travellers & cabin (desktop accordion) */}
        <button
          type="button"
          onClick={() => setShowDetails((p) => !p)}
          className="flex w-full items-center justify-between border-t border-brand-200/70 px-5 py-4
                     text-sm font-extrabold text-brand-800 transition hover:bg-brand-50
                     dark:border-white/10 dark:text-brand-200 dark:hover:bg-white/5 sm:px-6"
        >
          <span className="inline-flex items-center gap-2">
            <Armchair className="h-4 w-4" />
            Travellers &amp; cabin
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="overflow-hidden border-t border-brand-100 dark:border-white/10"
            >
              <div className="space-y-4 px-6 py-5">
                {/* cabin cards */}
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                    Cabin
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {(Object.keys(cabinMeta) as Cabin[]).map((c) => {
                      const active = cabin === c;
                      return (
                        <motion.button
                          key={c}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => setCabin(c)}
                          className={cabinPillClass(active)}
                        >
                          <div className="text-sm font-extrabold">{cabinMeta[c].title}</div>
                          <div
                            className={`text-xs font-semibold ${
                              active ? "text-white/85" : "text-brand-600 dark:text-brand-300"
                            }`}
                          >
                            {cabinMeta[c].sub}
                          </div>

                          {!active && (
                            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* travellers */}
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                    Travellers
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Stepper label="Adults" desc="Age 16+" val={adults} set={setAdults} min={1} />
                    <Stepper label="Children" desc="Age 2–15" val={children} set={setChildren} min={0} />
                    <Stepper label="Infants" desc="Under 2" val={infants} set={setInfants} min={0} />
                    <Stepper label="Seniors" desc="Flexible fares" val={seniors} set={setSeniors} min={0} />
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-200/60 bg-white/60 p-3 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-200">
                  You’ll see real booking links in the results. No spam, no weird redirects.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✅ Desktop search button (only desktop) */}
        {SearchBlock}
      </div>

      {/* ============================= */}
      {/* MOBILE: Travellers sheet      */}
      {/* ============================= */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isMobile && mobileDetailsOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="sm:hidden fixed inset-0 z-[9999]"
              >
                {/* backdrop */}
                <motion.button
                  type="button"
                  aria-label="Close travellers and cabin"
                  onClick={() => setMobileDetailsOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* sheet */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-black/10
                             bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-brand-900/95"
                >
                  <div className="px-5 pt-3 pb-4 border-b border-black/5 dark:border-white/10">
                    <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/15" />
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-brand-900 dark:text-white">
                        Travellers &amp; cabin
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileDetailsOpen(false)}
                        className="rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-extrabold text-brand-900 shadow-sm
                                   hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  <div
                    className="max-h-[70vh] overflow-y-auto overscroll-contain px-5 py-5"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div>
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                        Cabin
                      </div>
                      <div className="grid gap-2 grid-cols-2">
                        {(Object.keys(cabinMeta) as Cabin[]).map((c) => {
                          const active = cabin === c;
                          return (
                            <motion.button
                              key={c}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => setCabin(c)}
                              className={cabinPillClass(active)}
                            >
                              <div className="text-sm font-extrabold">{cabinMeta[c].title}</div>
                              <div
                                className={`text-xs font-semibold ${
                                  active ? "text-white/85" : "text-brand-600 dark:text-brand-300"
                                }`}
                              >
                                {cabinMeta[c].sub}
                              </div>
                              {!active && (
                                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                        Travellers
                      </div>
                      <div className="grid gap-2">
                        <Stepper label="Adults" desc="Age 16+" val={adults} set={setAdults} min={1} />
                        <Stepper label="Children" desc="Age 2–15" val={children} set={setChildren} min={0} />
                        <Stepper label="Infants" desc="Under 2" val={infants} set={setInfants} min={0} />
                        <Stepper label="Seniors" desc="Flexible fares" val={seniors} set={setSeniors} min={0} />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-brand-200/60 bg-white/60 p-3 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-brand-900/40 dark:text-brand-200">
                      You’ll see real booking links in the results. No spam, no weird redirects.
                    </div>

                    <div className="h-6" />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* results modal */}
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
    </section>
  );
}
