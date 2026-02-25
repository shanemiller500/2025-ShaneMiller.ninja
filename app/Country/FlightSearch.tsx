/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Minus,
  Plane,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import ResultsModal from "./ResultsModal";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const QUICK_MAP: Record<string, string> = {
  USA: "DEN",
  GBR: "LHR",
  CAN: "YYZ",
  FRA: "CDG",
  DEU: "FRA",
  JPN: "NRT",
};

const CABIN_SLUG: Record<Cabin, string> = {
  e: "economy",
  pe: "premiumeconomy",
  b: "business",
  f: "first",
};

const CABIN_META: Record<Cabin, { title: string; sub: string; icon: string }> = {
  e:  { title: "Economy",         sub: "Best value",  icon: "🪑" },
  pe: { title: "Premium Economy", sub: "More room",   icon: "💺" },
  b:  { title: "Business",        sub: "Lie flat",    icon: "🛋️" },
  f:  { title: "First",           sub: "Luxury",      icon: "✨" },
};

const LOCAL_STORAGE_KEY         = "flightSearch:last";
const DEFAULT_DEPART_DAYS_AHEAD = 14;
const SUGGESTION_LIMIT          = 8;
const IATA_CODE_LENGTH          = 3;
const MS_PER_DAY                = 864e5;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
let airports: AirportRec[] = [];

async function getAirports(): Promise<AirportRec[]> {
  if (airports.length) return airports;
  const raw = await fetch(
    "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json",
  ).then((r) => r.json());
  airports = Object.values(raw) as AirportRec[];
  return airports;
}

const isoToday   = (): string => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso: string, days: number): string =>
  new Date(new Date(iso).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
const isIata     = (s: string): boolean => /^[A-Z]{3}$/.test((s || "").trim().toUpperCase());
const safeUpper3 = (s: string): string =>
  (s || "").replace(/[^a-zA-Z]/g, "").slice(0, IATA_CODE_LENGTH).toUpperCase();

function fmtDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  AirportTypeahead Component                                         */
/* ------------------------------------------------------------------ */
interface AirportTypeaheadProps {
  label: string;
  value: string;
  setValue: (s: string) => void;
  placeholder: string;
  allAirports: AirportRec[];
  icon?: React.ReactNode;
}

function AirportTypeahead({
  label,
  value,
  setValue,
  placeholder,
  allAirports,
  icon,
}: AirportTypeaheadProps) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef           = useRef<HTMLDivElement | null>(null);
  const inputRef          = useRef<HTMLInputElement | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => setQuery(value), [value]);

  /* Close on outside click */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* Compute fixed dropdown position so overflow-hidden parents don't clip it */
  useEffect(() => {
    if (open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 288) });
    }
  }, [open]);

  const suggestions = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (q.length < 2) return [];
    return allAirports
      .filter((a) => a.iata)
      .filter((a) => {
        const iata = a.iata.toLowerCase();
        const city = (a.city || "").toLowerCase();
        const name = (a.name || "").toLowerCase();
        const iso  = (a.iso  || "").toLowerCase();
        return iata.startsWith(q) || city.includes(q) || name.includes(q) || iso === q;
      })
      .slice(0, SUGGESTION_LIMIT);
  }, [query, allAirports]);

  const selected = useMemo(() => {
    if (!isIata(value)) return null;
    return allAirports.find((x) => x.iata?.toUpperCase() === value);
  }, [value, allAirports]);

  return (
    <div className="relative flex-1 min-w-0" ref={wrapRef}>
      <div
        className="flex items-start gap-2 cursor-text px-3 py-2.5 sm:px-4 sm:py-3 h-full"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Icon */}
        <div className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400">
          {icon ?? <Plane className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500 mb-0.5 select-none">
            {label}
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setValue("");
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-sm font-semibold text-brand-900 dark:text-white placeholder:text-brand-400 dark:placeholder:text-brand-600 focus:outline-none"
          />

          {/* City hint */}
          {selected ? (
            <div className="truncate text-[11px] font-medium text-indigo-500 dark:text-indigo-400 mt-0.5">
              {selected.name}
            </div>
          ) : (
            <div className="text-[11px] text-brand-400 dark:text-brand-500 mt-0.5">
              {isIata(value) ? value : "City or airport"}
            </div>
          )}
        </div>

        {/* Clear */}
        {value && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setValue(""); setQuery("");
            }}
            className="mt-1 shrink-0 rounded-full p-0.5 text-brand-400 hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown — portaled to body so overflow-hidden never clips it */}
      {typeof window !== "undefined" && createPortal(
        <AnimatePresence>
          {open && suggestions.length > 0 && dropPos && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
              className="overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-2xl dark:border-white/10 dark:bg-brand-900"
            >
              <div className="max-h-60 overflow-y-auto py-1">
                {suggestions.map((a) => (
                  <button
                    key={a.iata}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setValue(a.iata.toUpperCase());
                      setQuery(a.iata.toUpperCase());
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-white/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-300">
                        {a.iata.toUpperCase()}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-brand-900 dark:text-white">
                        {a.city || a.name}
                      </span>
                      <span className="block truncate text-[11px] text-brand-500 dark:text-brand-400">
                        {a.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stepper Component                                                  */
/* ------------------------------------------------------------------ */
interface StepperProps {
  label: string;
  desc: string;
  val: number;
  set: (n: number) => void;
  min: number;
}

function Stepper({ label, desc, val, set, min }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-brand-100/60 dark:border-white/5 last:border-0">
      <div>
        <div className="text-sm font-semibold text-brand-900 dark:text-white">{label}</div>
        <div className="text-[11px] text-brand-500 dark:text-brand-400">{desc}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set(Math.max(min, val - 1))}
          disabled={val <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-300/70 bg-white text-brand-700 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-30 dark:border-white/20 dark:bg-white/5 dark:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-bold text-brand-900 dark:text-white">{val}</span>
        <button
          type="button"
          onClick={() => set(val + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-300/70 bg-white text-brand-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-white/20 dark:bg-white/5 dark:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DateField Component                                                */
/* ------------------------------------------------------------------ */
interface DateFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: string;
  disabled?: boolean;
  autoOpen?: boolean;
}

function DateField({ label, value, onChange, min, disabled, autoOpen }: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Open the native date picker automatically on mount (only when no value) */
  useEffect(() => {
    if (!autoOpen || value) return;
    const t = setTimeout(() => inputRef.current?.showPicker?.(), 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3 h-full cursor-pointer ${disabled ? "opacity-40" : ""}`}
      onClick={() => !disabled && inputRef.current?.showPicker?.()}
    >
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500 mb-0.5 select-none">
          {label}
        </div>
        <div className={`text-sm font-semibold ${value ? "text-brand-900 dark:text-white" : "text-brand-400 dark:text-brand-500"}`}>
          {value ? fmtDate(value) : "Add date"}
        </div>
        <div className="text-[11px] text-brand-400 dark:text-brand-500 mt-0.5">
          {value ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric" }) : ""}
        </div>
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={min}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FlipRouteCard Component                                           */
/* ------------------------------------------------------------------ */
interface FlipRouteCardProps {
  from: string;
  setFrom: (s: string) => void;
  to: string;
  setTo: (s: string) => void;
  allAirports: AirportRec[];
  onSwap: () => void;
}

function FlipRouteCard({ from, setFrom, to, setTo, allAirports, onSwap }: FlipRouteCardProps) {
  const [face, setFace] = useState<"from" | "to">(isIata(from) ? "to" : "from");
  const flipTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromAirport = useMemo(
    () => allAirports.find((a) => a.iata?.toUpperCase() === from),
    [from, allAirports],
  );

  /* Auto-flip to "to" face 280ms after From becomes a valid IATA */
  useEffect(() => {
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    if (isIata(from) && face === "from") {
      flipTimerRef.current = setTimeout(() => setFace("to"), 280);
    }
    return () => { if (flipTimerRef.current) clearTimeout(flipTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const goBack = () => setFace("from");
  const doSwap = () => { onSwap(); setFace("from"); };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {face === "from" ? (
          <motion.div
            key="from-face"
            initial={{ opacity: 0, rotateY: -70 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 70 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <AirportTypeahead
              label="Where from?"
              value={from}
              setValue={setFrom}
              placeholder="City or airport"
              allAirports={allAirports}
              icon={<Plane className="h-4 w-4 rotate-45" />}
            />
            {/* Hint — only shown if from is set but hasn't auto-flipped yet */}
            {isIata(from) && (
              <div className="px-3 pb-2 sm:px-4">
                <button
                  type="button"
                  onClick={() => setFace("to")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                >
                  <ArrowRight className="h-3 w-3" />
                  Continue to destination
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="to-face"
            initial={{ opacity: 0, rotateY: 70 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -70 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* From chip */}
            <div className="flex items-center gap-2 px-3 pt-2.5 sm:px-4">
              <button
                type="button"
                onClick={goBack}
                title="Edit departure"
                className="flex max-w-[160px] items-center gap-1.5 truncate rounded-full border border-indigo-200/70 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <Plane className="h-3 w-3 shrink-0 rotate-45" />
                <span className="truncate">
                  {from}
                  {fromAirport?.city ? ` · ${fromAirport.city}` : ""}
                </span>
                <ArrowLeftRight className="h-3 w-3 shrink-0 opacity-50" />
              </button>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-400" />
            </div>

            {/* To typeahead */}
            <AirportTypeahead
              label="Where to?"
              value={to}
              setValue={setTo}
              placeholder="City or airport"
              allAirports={allAirports}
              icon={<Plane className="h-4 w-4" />}
            />

            {/* Swap / Edit row */}
            <div className="flex items-center gap-3 border-t border-brand-100/60 px-3 py-2 dark:border-white/5 sm:px-4">
              <button
                type="button"
                onClick={doSwap}
                className="flex items-center gap-1.5 rounded-full border border-brand-200/70 px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-brand-400 dark:hover:text-indigo-400"
              >
                <ArrowLeftRight className="h-3 w-3" />
                Swap
              </button>
              <button
                type="button"
                onClick={goBack}
                className="text-[11px] text-brand-400 transition hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
              >
                ← Edit departure
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DateStepCard Component                                            */
/* ------------------------------------------------------------------ */
interface DateStepCardProps {
  depart: string;
  onDepart: (d: string) => void;
  ret: string;
  setRet: (d: string) => void;
  trip: Trip;
  goBack?: () => void;
}

function DateStepCard({ depart, onDepart, ret, setRet, trip, goBack }: DateStepCardProps) {
  const minDepart = isoToday();
  const [phase, setPhase] = useState<"depart" | "return">(
    depart && trip === "round" ? "return" : "depart",
  );
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Auto-advance to "return" 350ms after depart is chosen (round trip) */
  useEffect(() => {
    if (stepTimer.current) clearTimeout(stepTimer.current);
    if (depart && trip === "round" && phase === "depart") {
      stepTimer.current = setTimeout(() => setPhase("return"), 350);
    }
    if (trip === "oneway") setPhase("depart");
    return () => { if (stepTimer.current) clearTimeout(stepTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart, trip]);

  const departLabel = depart ? fmtDate(depart) : "";
  const departSub   = depart
    ? new Date(depart + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
      })
    : "";
  const minReturn = addDaysISO(depart || isoToday(), 1);

  return (
    <div className="flex-1">
      <AnimatePresence mode="wait" initial={false}>
        {phase === "depart" ? (
          <motion.div
            key="depart-step"
            initial={{ opacity: 0, rotateY: -70 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: 70 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {goBack && (
              <div className="px-3 pt-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 text-[11px] text-brand-400 transition hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
                >
                  ← Edit airports
                </button>
              </div>
            )}
            <DateField
              label="Depart"
              value={depart}
              onChange={onDepart}
              min={minDepart}
              autoOpen={!depart}
            />
            {/* Nudge to add return date once depart is set */}
            {trip === "round" && depart && (
              <div className="px-3 pb-2 sm:px-4">
                <button
                  type="button"
                  onClick={() => setPhase("return")}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-500 transition hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <ArrowRight className="h-3 w-3" />
                  Add return date
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="return-step"
            initial={{ opacity: 0, rotateY: 70 }}
            animate={{ opacity: 1, rotateY: 0 }}
            exit={{ opacity: 0, rotateY: -70 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {/* Depart chip */}
            <div className="flex items-center gap-2 px-3 pt-2.5 sm:px-4">
              <button
                type="button"
                onClick={() => setPhase("depart")}
                title="Edit departure date"
                className="flex max-w-[200px] items-center gap-1.5 truncate rounded-full border border-indigo-200/70 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
              >
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {departLabel}
                  {departSub ? ` · ${departSub}` : ""}
                </span>
              </button>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-400" />
            </div>

            {/* Return date field */}
            <DateField
              label="Return"
              value={ret}
              onChange={setRet}
              min={minReturn}
            />

            {/* Edit row */}
            <div className="flex items-center gap-4 border-t border-brand-100/60 px-3 py-2 dark:border-white/5 sm:px-4">
              <button
                type="button"
                onClick={() => setPhase("depart")}
                className="text-[11px] text-brand-400 transition hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
              >
                ← Edit depart
              </button>
              {goBack && (
                <button
                  type="button"
                  onClick={goBack}
                  className="text-[11px] text-brand-400 transition hover:text-brand-600 dark:text-brand-500 dark:hover:text-brand-300"
                >
                  ← Edit airports
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/*  FlightSearch Component                                            */
/* ================================================================== */
export default function FlightSearch({ full = null }: { full?: FullCountry | null }) {
  const API_BASE = "https://u-mail.co";

  /* ── State ──────────────────────────────────────────────────────── */
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [depart,   setDepart]   = useState("");
  const [ret,      setRet]      = useState("");
  const [trip,     setTrip]     = useState<Trip>("round");
  const [cabin,    setCabin]    = useState<Cabin>("e");
  const [adults,   setAdults]   = useState(1);
  const [children, setChildren] = useState(0);
  const [infants,  setInfants]  = useState(0);
  const [seniors,  setSeniors]  = useState(0);

  const [step,          setStep]          = useState<"route" | "dates">("route");
  const [travelersOpen, setTravelersOpen] = useState(false);
  const [cabinOpen,     setCabinOpen]     = useState(false);
  const [open,          setOpen]          = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [flights,       setFlights]       = useState<any[]>([]);
  const [photo,         setPhoto]         = useState<string | null>(null);
  const [formError,     setFormError]     = useState("");
  const [allAirports,   setAllAirports]   = useState<AirportRec[]>([]);

  const cabinRef = useRef<HTMLDivElement | null>(null);

  /* ── Load airports ──────────────────────────────────────────────── */
  useEffect(() => {
    getAirports().then(setAllAirports);
  }, []);

  /* ── Restore from localStorage ──────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.from)  setFrom(safeUpper3(s.from));
      if (s?.to)    setTo(safeUpper3(s.to));
      if (s?.trip === "round" || s?.trip === "oneway") setTrip(s.trip);
      if (["e", "pe", "b", "f"].includes(s?.cabin))   setCabin(s.cabin);
      if (typeof s?.adults   === "number") setAdults(Math.max(1, s.adults));
      if (typeof s?.children === "number") setChildren(Math.max(0, s.children));
      if (typeof s?.infants  === "number") setInfants(Math.max(0, s.infants));
      if (typeof s?.seniors  === "number") setSeniors(Math.max(0, s.seniors));
      if (s?.depart) setDepart(s.depart);
      if (s?.ret)    setRet(s.ret);
    } catch {}
  }, []);

  /* ── Persist to localStorage ────────────────────────────────────── */
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ from, to, depart, ret, trip, cabin, adults, children, infants, seniors }),
      );
    } catch {}
  }, [from, to, depart, ret, trip, cabin, adults, children, infants, seniors]);

  /* ── Auto-set destination from country ──────────────────────────── */
  useEffect(() => {
    if (!full) return;
    if (QUICK_MAP[full.cca3]) { setTo(QUICK_MAP[full.cca3]); return; }
    (async () => {
      const list = await getAirports();
      const iso  = full.cca2 || "";
      const big  =
        list.find((a) => a.iso === iso && a.type === "large_airport") ||
        list.find((a) => a.iso === iso);
      setTo(big?.iata || "");
    })();
  }, [full]);

  /* ── Adjust return date when trip type changes ──────────────────── */
  useEffect(() => {
    if (trip === "round" && depart && (!ret || ret <= depart)) {
      setRet(addDaysISO(depart, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  /* ── Date handlers ──────────────────────────────────────────────── */
  const onDepart = (d: string) => {
    setDepart(d);
    if (trip === "round" && (!ret || ret <= d)) setRet(addDaysISO(d, 2));
  };

  const onTripToggle = (t: Trip) => {
    setTrip(t);
    if (t === "oneway") setRet("");
    else if (depart && (!ret || ret <= depart)) setRet(addDaysISO(depart, 2));
  };

  /* ── Close cabin dropdown on outside click ──────────────────────── */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!cabinRef.current?.contains(e.target as Node)) setCabinOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ── Lock scroll when travelers sheet open ──────────────────────── */
  useEffect(() => {
    if (typeof document === "undefined" || !travelersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [travelersOpen]);

  /* ── Derived values ─────────────────────────────────────────────── */
  const paxTotal = adults + children + infants + seniors;

  const allGood =
    isIata(from) &&
    isIata(to) &&
    Boolean(depart) &&
    (trip === "oneway" || Boolean(ret)) &&
    (trip === "oneway" || ret > depart);

  /* ── Form validation ────────────────────────────────────────────── */
  useEffect(() => {
    if (!from && !to) return setFormError("");
    if (from && !isIata(from)) return setFormError("Enter a valid 3-letter airport code (e.g. DEN)");
    if (to   && !isIata(to))   return setFormError("Enter a valid 3-letter airport code (e.g. LAX)");
    if (trip === "round" && depart && ret && ret <= depart)
      return setFormError("Return date must be after departure");
    setFormError("");
  }, [from, to, trip, depart, ret]);

  /* ── Search ─────────────────────────────────────────────────────── */
  const runSearch = async () => {
    if (!allGood || loading) return;
    setOpen(true);
    setLoading(true);
    setFlights([]);
    setPhoto(null);

    try {
      const params = new URLSearchParams({
        from, to, depart, trip,
        cabin:    CABIN_SLUG[cabin],
        adults:   adults.toString(),
        kids:     children.toString(),
        inf:      infants.toString(),
        seniors:  seniors.toString(),
        currency: "USD",
        hl:       "en",
        gl:       "us",
      });
      if (trip === "round") params.append("ret", ret);

      const res  = await fetch(`${API_BASE}/api/flightSearch?${params.toString()}`);
      const json = await res.json();
      const list: any[] = Array.isArray(json) ? json : [];

      list.sort((a, b) => {
        const ar = typeof a.ai_rank === "number" ? a.ai_rank : Infinity;
        const br = typeof b.ai_rank === "number" ? b.ai_rank : Infinity;
        if (ar !== br) return ar - br;
        const ap = typeof a.price === "number" ? a.price : Infinity;
        const bp = typeof b.price === "number" ? b.price : Infinity;
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

  const swap = () => { setFrom(to); setTo(from); };

  /* ── Step wizard: swipe to dates when both airports filled ──────── */
  useEffect(() => {
    if (isIata(from) && isIata(to)) {
      const t = setTimeout(() => setStep("dates"), 500);
      return () => clearTimeout(t);
    } else {
      setStep("route");
    }
  }, [from, to]);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Outer section ── */}
      <section className="w-full px-0 py-4 sm:px-2">

        {/* ── Section label ── */}
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 shrink-0 text-indigo-500" />
            <div>
              <div className="text-sm font-bold text-brand-700 dark:text-brand-300">Flight search</div>
              <div className="text-[10px] text-brand-400 dark:text-brand-500">Live fares · real booking links · no hidden fees</div>
            </div>
          </div>
          <AnimatePresence>
            {(from || to || step === "dates") && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={() => {
                  setFrom(""); setTo(""); setStep("route");
                  const d = addDaysISO(isoToday(), DEFAULT_DEPART_DAYS_AHEAD);
                  setDepart(d);
                  setRet(addDaysISO(d, 2));
                }}
                className="flex items-center gap-1 rounded-full border border-brand-200/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-500 transition hover:border-red-300 hover:text-red-500 dark:border-white/10 dark:bg-transparent dark:text-brand-400 dark:hover:border-red-500/50 dark:hover:text-red-400"
              >
                <X className="h-3 w-3" />
                Clear
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* Main card                                                  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-brand-200/70 bg-white shadow-lg dark:border-white/10 dark:bg-brand-900"
        >

          {/* ── Top control bar ─────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-brand-100/60 px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3 dark:border-white/5">

            {/* Trip type */}
            <div className="flex overflow-hidden rounded-full border border-brand-200/70 dark:border-white/10">
              {(["round", "oneway"] as Trip[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTripToggle(t)}
                  className={`px-3 py-1.5 text-[11px] font-bold transition ${
                    trip === t
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-brand-600 hover:bg-brand-50 dark:bg-transparent dark:text-brand-400 dark:hover:bg-white/5"
                  }`}
                >
                  {t === "round" ? "Round trip" : "One-way"}
                </button>
              ))}
            </div>

            {/* Passengers pill */}
            <button
              type="button"
              onClick={() => setTravelersOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-transparent dark:text-brand-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            >
              <Users className="h-3.5 w-3.5" />
              {paxTotal} {paxTotal === 1 ? "passenger" : "passengers"}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {/* Cabin class pill */}
            <div className="relative" ref={cabinRef}>
              <button
                type="button"
                onClick={() => setCabinOpen((p) => !p)}
                className="flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-white px-3 py-1.5 text-[11px] font-bold text-brand-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-transparent dark:text-brand-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
              >
                <span>{CABIN_META[cabin].icon}</span>
                {CABIN_META[cabin].title}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              <AnimatePresence>
                {cabinOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.13 }}
                    className="absolute left-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-2xl dark:border-white/10 dark:bg-brand-900"
                  >
                    {(Object.keys(CABIN_META) as Cabin[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCabin(c); setCabinOpen(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50 dark:hover:bg-white/5 ${
                          cabin === c ? "bg-indigo-50 dark:bg-indigo-500/10" : ""
                        }`}
                      >
                        <span className="text-lg">{CABIN_META[c].icon}</span>
                        <span>
                          <span className={`block text-sm font-semibold ${cabin === c ? "text-indigo-700 dark:text-indigo-300" : "text-brand-900 dark:text-white"}`}>
                            {CABIN_META[c].title}
                          </span>
                          <span className="text-[11px] text-brand-500 dark:text-brand-400">
                            {CABIN_META[c].sub}
                          </span>
                        </span>
                        {cabin === c && (
                          <span className="ml-auto text-indigo-600 dark:text-indigo-400">✓</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Search fields: step wizard, one panel at a time ───────── */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {step === "route" ? (
                <motion.div
                  key="route-panel"
                  initial={{ x: "-110%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-110%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <FlipRouteCard
                    from={from}
                    setFrom={setFrom}
                    to={to}
                    setTo={setTo}
                    allAirports={allAirports}
                    onSwap={swap}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="dates-panel"
                  initial={{ x: "110%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "110%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <DateStepCard
                    depart={depart}
                    onDepart={onDepart}
                    ret={ret}
                    setRet={setRet}
                    trip={trip}
                    goBack={() => setStep("route")}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Error message ────────────────────────────────────────── */}
          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-4 mb-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  {formError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Search button bar ────────────────────────────────────── */}
          <div className="flex flex-col gap-2 border-t border-brand-100/60 px-3 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
           
            <motion.button
              whileHover={allGood && !loading ? { scale: 1.03 } : {}}
              whileTap={allGood && !loading ? { scale: 0.97 } : {}}
              onClick={runSearch}
              disabled={!allGood || loading}
              type="button"
              className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold shadow-md transition sm:w-auto ${
                allGood && !loading
                  ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/25"
                  : "cursor-not-allowed bg-brand-200 text-brand-400 shadow-none dark:bg-white/10 dark:text-brand-500"
              }`}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search flights
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Route summary chip (shown when both airports selected) ── */}
        <AnimatePresence>
          {isIata(from) && isIata(to) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex flex-wrap items-center gap-2 px-1"
            >
              <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 dark:bg-indigo-500/10">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{from}</span>
                <ArrowLeftRight className="h-3 w-3 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{to}</span>
              </div>
              {depart && (
                <div className="flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 dark:bg-white/5">
                  <CalendarDays className="h-3 w-3 text-brand-500" />
                  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                    {fmtDate(depart)}{trip === "round" && ret ? ` → ${fmtDate(ret)}` : ""}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Travelers bottom sheet (mobile) / drawer                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {travelersOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center"
              >
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setTravelersOpen(false)}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />

                {/* Sheet */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 340, damping: 32 }}
                  className="relative w-full rounded-t-3xl bg-white shadow-2xl dark:bg-brand-900 sm:max-w-md sm:rounded-3xl"
                >
                  {/* Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-brand-200 dark:bg-brand-700" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-brand-100/60 px-5 pb-3 dark:border-white/5">
                    <h3 className="text-base font-bold text-brand-900 dark:text-white">
                      Passengers & cabin
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTravelersOpen(false)}
                      className="rounded-full bg-brand-100 p-1.5 text-brand-600 transition hover:bg-brand-200 dark:bg-white/10 dark:text-brand-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                    {/* Cabin */}
                    <div className="mb-5">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500">
                        Cabin class
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CABIN_META) as Cabin[]).map((c) => {
                          const active = cabin === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCabin(c)}
                              className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                                active
                                  ? "border-indigo-500 bg-indigo-600 shadow-lg shadow-indigo-500/20"
                                  : "border-brand-200/70 bg-brand-50 hover:border-indigo-300 hover:bg-white dark:border-white/10 dark:bg-white/5"
                              }`}
                            >
                              <span className="text-xl">{CABIN_META[c].icon}</span>
                              <span>
                                <span className={`block text-xs font-bold ${active ? "text-white" : "text-brand-900 dark:text-white"}`}>
                                  {CABIN_META[c].title}
                                </span>
                                <span className={`text-[10px] ${active ? "text-white/75" : "text-brand-500 dark:text-brand-400"}`}>
                                  {CABIN_META[c].sub}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Passengers */}
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-400 dark:text-brand-500">
                        Passengers
                      </p>
                      <Stepper label="Adults"   desc="Age 16+"    val={adults}   set={setAdults}   min={1} />
                      <Stepper label="Children" desc="Age 2–15"   val={children} set={setChildren} min={0} />
                      <Stepper label="Infants"  desc="Under 2"    val={infants}  set={setInfants}  min={0} />
                      <Stepper label="Seniors"  desc="Age 65+"    val={seniors}  set={setSeniors}  min={0} />
                    </div>
                  </div>

                  {/* Done button */}
                  <div className="px-5 pb-6 pt-2">
                    <button
                      type="button"
                      onClick={() => setTravelersOpen(false)}
                      className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:bg-indigo-500"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* ── Results modal ─────────────────────────────────────────────── */}
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
