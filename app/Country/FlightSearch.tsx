/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowLeftRight, ChevronDown } from "lucide-react";
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

const prettyAirport = (a: AirportRec) => {
  const city = a.city || a.name || "";
  const name = a.name ? ` • ${a.name}` : "";
  return `${a.iata} — ${city}${name}`;
};

const safeUpper3 = (s: string) => (s || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();

const LS_KEY = "flightSearch:last";

/* ---------- tiny counter ----------------------------------------- */
const Counter = ({
  label,
  val,
  set,
  min,
}: {
  label: string;
  val: number;
  set: (n: number) => void;
  min: number;
}) => (
  <div
    className="w-full rounded-md border border-brand-300/70 bg-white/40
              px-2 py-1.5 text-xs backdrop-blur
              dark:border-brand-700/60 dark:bg-brand-900/40
              sm:px-3 sm:text-sm"
  >
    <div className="flex items-center justify-between">
      <span className="text-brand-800 dark:text-brand-200">{label}</span>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          aria-label={`Decrease ${label}`}
          onClick={() => set(Math.max(min, val - 1))}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-400
                     text-sm leading-none text-brand-600 hover:bg-brand-100
                     dark:border-brand-600 dark:text-brand-200 dark:hover:bg-brand-800/50
                     sm:h-8 sm:w-8 sm:text-base"
          type="button"
        >
          –
        </button>

        <span className="min-w-[1.6rem] text-center font-semibold text-brand-900 dark:text-brand-100 sm:min-w-[2rem]">
          {val}
        </span>

        <button
          aria-label={`Increase ${label}`}
          onClick={() => set(val + 1)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-brand-400
                     text-sm leading-none text-brand-600 hover:bg-brand-100
                     dark:border-brand-600 dark:text-brand-200 dark:hover:bg-brand-800/50
                     sm:h-8 sm:w-8 sm:text-base"
          type="button"
        >
          +
        </button>
      </div>
    </div>
  </div>
);

/* ---------- detailed types reflecting new /api/flights output ----- */
interface FlightSegment {
  departure_airport: { name: string; id: string; time: string };
  arrival_airport: { name: string; id: string; time: string };
  duration: number;
  airplane: string;
  airline: string;
  airline_logo: string;
  travel_class: string;
  flight_number: string;
  extensions?: string[];
  legroom?: string;
  often_delayed_by_over_30_min?: boolean;
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
  type?: string;
  booking_token?: string;
  flights?: FlightSegment[];
  layovers?: Layover[];
  legs?: string[];
  deeplink?: string;
  ai_score?: number;
  ai_rank?: number;
}

/* ================================================================== */
/*  FlightSearch component                                            */
/* ================================================================== */
export default function FlightSearch({ full = null }: { full?: FullCountry | null }) {
  const API_BASE = "https://u-mail.co";

  /* ------------- form state -------------------------------------- */
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
  const [showDetails, setShowDetails] = useState(false);

  /* ------------- load airports for suggestions ------------------- */
  const [readyList, setReadyList] = useState(false);
  useEffect(() => {
    getAirports().then(() => setReadyList(true));
  }, []);

  /* ------------- restore last search ----------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s?.from === "string") setFrom(safeUpper3(s.from));
      if (typeof s?.to === "string") setTo(safeUpper3(s.to));
      if (typeof s?.trip === "string" && (s.trip === "round" || s.trip === "oneway")) setTrip(s.trip);
      if (typeof s?.cabin === "string" && ["e", "pe", "b", "f"].includes(s.cabin)) setCabin(s.cabin);
      if (typeof s?.adults === "number") setAdults(Math.max(1, s.adults));
      if (typeof s?.children === "number") setChildren(Math.max(0, s.children));
      if (typeof s?.infants === "number") setInfants(Math.max(0, s.infants));
      if (typeof s?.seniors === "number") setSeniors(Math.max(0, s.seniors));
      if (typeof s?.depart === "string") setDepart(s.depart);
      if (typeof s?.ret === "string") setRet(s.ret);
    } catch {
      /* ignore */
    }
  }, []);

  /* ------------- persist search ---------------------------------- */
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ from, to, depart, ret, trip, cabin, adults, children, infants, seniors }),
      );
    } catch {
      /* ignore */
    }
  }, [from, to, depart, ret, trip, cabin, adults, children, infants, seniors]);

  /* ------------- auto-fill “to” when country changes ------------- */
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

  /* ------------- date helpers ------------------------------------ */
  useEffect(() => {
    // auto default dates if empty
    if (!depart) {
      const d = addDaysISO(isoToday(), 14);
      setDepart(d);
      if (trip === "round") setRet(addDaysISO(d, 1));
      return;
    }
    if (trip === "round" && (!ret || ret <= depart)) setRet(tomorrow(depart));
  }, [trip]); // only run when trip toggles (keeps it from fighting your typing)

  const onDepart = (d: string) => {
    setDepart(d);
    if (trip === "round" && (!ret || ret <= d)) setRet(tomorrow(d));
  };

  const onTripToggle = (t: Trip) => {
    setTrip(t);
    if (t === "oneway") setRet("");
    else if (depart && (!ret || ret <= depart)) setRet(tomorrow(depart));
  };

  /* ------------- airport suggestions ----------------------------- */
  const suggest = (q: string) => {
    if (!readyList) return [];
    const query = (q || "").trim().toLowerCase();
    if (query.length < 2) return [];

    const out = airports
      .filter((a) => a.iata)
      .filter((a) => {
        const iata = a.iata.toLowerCase();
        const city = (a.city || "").toLowerCase();
        const name = (a.name || "").toLowerCase();
        const iso = (a.iso || "").toLowerCase();
        return (
          iata.startsWith(query) ||
          city.includes(query) ||
          name.includes(query) ||
          iso === query
        );
      })
      .slice(0, 20);

    return out;
  };

  const fromSuggestions = useMemo(() => suggest(from), [from, readyList]);
  const toSuggestions = useMemo(() => suggest(to), [to, readyList]);

  const fromSelectedLabel = useMemo(() => {
    if (!isIata(from)) return "";
    const a = airports.find((x) => x.iata?.toUpperCase() === from);
    return a ? prettyAirport(a) : "";
  }, [from, readyList]);

  const toSelectedLabel = useMemo(() => {
    if (!isIata(to)) return "";
    const a = airports.find((x) => x.iata?.toUpperCase() === to);
    return a ? prettyAirport(a) : "";
  }, [to, readyList]);

  /* ------------- modal / fetch state ----------------------------- */
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>("");

  const allGood =
    isIata(from) &&
    isIata(to) &&
    Boolean(depart) &&
    (trip === "oneway" || Boolean(ret)) &&
    (trip === "oneway" || ret > depart);

  useEffect(() => {
    // tiny inline errors (but don’t be annoying)
    if (!from && !to) {
      setFormError("");
      return;
    }
    if (from && !isIata(from)) {
      setFormError("From must be a 3-letter airport code (IATA).");
      return;
    }
    if (to && !isIata(to)) {
      setFormError("To must be a 3-letter airport code (IATA).");
      return;
    }
    if (trip === "round" && depart && ret && ret <= depart) {
      setFormError("Return date must be after departure.");
      return;
    }
    setFormError("");
  }, [from, to, trip, depart, ret]);

  /* ------------- run search -------------------------------------- */
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

      const list: FlightOption[] = Array.isArray(json) ? json : [];

      // order: AI-rank if present → price asc → provider
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

  return (
    <section
      className="mx-auto mt-8 overflow-hidden rounded-2xl bg-white/70 backdrop-blur
                 shadow-sm ring-1 ring-black/5 dark:border-brand-800/30 dark:bg-brand-950"
    >
      {/* header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-brand-900 dark:text-brand-100">
            Find a flight
          </h2>
          <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-300">
            Enter airport codes or search by city.
          </p>
        </div>

        {/* round / one-way pills */}
        <div className="inline-flex overflow-hidden rounded-lg border border-brand-200 dark:border-brand-800">
          {(["round", "oneway"] as Trip[]).map((t) => (
            <button
              key={t}
              onClick={() => onTripToggle(t)}
              type="button"
              className={`px-3 py-1 text-xs font-medium uppercase tracking-wide
                ${
                  trip === t
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-transparent text-brand-600 dark:text-brand-300 hover:bg-brand-100/40 dark:hover:bg-brand-800/40"
                }`}
            >
              {t === "round" ? "Round trip" : "One way"}
            </button>
          ))}
        </div>
      </header>

      {/* core inputs */}
      <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
        {/* FROM */}
        <label className="flex flex-col text-sm font-medium">
          <span className="mb-1 text-brand-700 dark:text-brand-300">From</span>

          <div className="relative">
            <input
              list="from-list"
              value={from}
              maxLength={3}
              onChange={(e) => setFrom(safeUpper3(e.target.value))}
              placeholder="DEN"
              inputMode="text"
              autoComplete="off"
              className="w-full rounded-md border border-brand-300 bg-transparent px-3 py-2
                         text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                         dark:border-brand-700 dark:text-brand-100 dark:placeholder-brand-500"
            />

            {/* swap button (floats between From/To on mobile too) */}
            <button
              type="button"
              onClick={swap}
              title="Swap"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full
                         border border-brand-300 bg-white/70 p-1.5 text-brand-700 shadow-sm
                         hover:bg-white hover:text-brand-900
                         dark:border-brand-700 dark:bg-brand-950/60 dark:text-brand-200 dark:hover:bg-brand-900"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          {fromSelectedLabel && (
            <span className="mt-1 text-[11px] text-brand-600 dark:text-brand-300">
              {fromSelectedLabel}
            </span>
          )}
        </label>

        <datalist id="from-list">
          {fromSuggestions.map((a) => (
            <option key={a.iata} value={a.iata}>
              {prettyAirport(a)}
            </option>
          ))}
        </datalist>

        {/* TO */}
        <label className="flex flex-col text-sm font-medium">
          <span className="mb-1 text-brand-700 dark:text-brand-300">To</span>
          <input
            list="to-list"
            value={to}
            maxLength={3}
            onChange={(e) => setTo(safeUpper3(e.target.value))}
            placeholder="LAX"
            inputMode="text"
            autoComplete="off"
            className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                       text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-brand-700 dark:text-brand-100 dark:placeholder-brand-500"
          />
          {toSelectedLabel && (
            <span className="mt-1 text-[11px] text-brand-600 dark:text-brand-300">
              {toSelectedLabel}
            </span>
          )}
        </label>

        <datalist id="to-list">
          {toSuggestions.map((a) => (
            <option key={a.iata} value={a.iata}>
              {prettyAirport(a)}
            </option>
          ))}
        </datalist>

        {/* DEPART */}
        <label className="flex flex-col text-sm font-medium">
          <span className="mb-1 text-brand-700 dark:text-brand-300">Depart</span>
          <input
            type="date"
            value={depart}
            min={isoToday()}
            onChange={(e) => onDepart(e.target.value)}
            onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
            className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                       text-brand-900 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-brand-700 dark:text-brand-100"
          />
        </label>

        {/* RETURN */}
        {trip === "round" && (
          <label className="flex flex-col text-sm font-medium">
            <span className="mb-1 text-brand-700 dark:text-brand-300">Return</span>
            <input
              type="date"
              value={ret}
              min={tomorrow(depart || isoToday())}
              onChange={(e) => setRet(e.target.value)}
              onFocus={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                         text-brand-900 focus:outline-none focus:ring-2 focus:ring-indigo-500
                         dark:border-brand-700 dark:text-brand-100"
            />
          </label>
        )}
      </div>

      {/* inline form error */}
      {formError && (
        <div className="px-6 pb-2">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
            {formError}
          </div>
        </div>
      )}

      {/* collapsible passenger / cabin panel */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex w-full items-center justify-between border-t border-brand-200 px-6 py-4
                   text-sm font-medium text-brand-700 transition hover:bg-brand-50
                   dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-800/40"
      >
        Travellers &amp; cabin
        <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} />
      </button>

      {showDetails && (
        <div className="space-y-3 border-t border-brand-100 px-6 py-4 dark:border-brand-800">
          {/* cabin select */}
          <select
            value={cabin}
            onChange={(e) => setCabin(e.target.value as Cabin)}
            className="block w-full rounded-md border border-brand-300 bg-transparent px-3 py-2 text-sm
                       text-brand-900 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-brand-700 dark:text-brand-100"
          >
            <option value="e">Economy</option>
            <option value="pe">Premium Economy</option>
            <option value="b">Business</option>
            <option value="f">First</option>
          </select>

          {/* counters */}
          <div className="grid gap-1 sm:grid-cols-1">
            <Counter label="Adults" val={adults} set={setAdults} min={1} />
            <Counter label="Children" val={children} set={setChildren} min={0} />
            <Counter label="Infants" val={infants} set={setInfants} min={0} />
            <Counter label="Seniors" val={seniors} set={setSeniors} min={0} />
          </div>
        </div>
      )}

      {/* search button */}
      <div className="border-t border-brand-100 px-6 py-5 dark:border-brand-800">
        <button
          onClick={runSearch}
          disabled={!allGood || loading}
          type="button"
          className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold
            shadow transition focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              allGood && !loading
                ? "bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500"
                : "cursor-not-allowed bg-brand-300 text-brand-600 dark:bg-brand-800/60 dark:text-brand-500"
            }`}
        >
          {loading ? (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Searching…
              </span>
            </>
          ) : (
            <>
              Search flights
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="mt-2 text-center text-[11px] text-brand-600 dark:text-brand-300">
          Tip: try <span className="font-semibold">DEN</span> →{" "}
          <span className="font-semibold">LHR</span>
        </p>
      </div>

      {/* results modal (unchanged) */}
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
