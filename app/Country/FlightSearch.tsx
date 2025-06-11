/* eslint-disable @next/next/no-img-element */
'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  ChangeEvent,
  FocusEvent,
} from 'react';

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
  USA: 'JFK',
  GBR: 'LHR',
  CAN: 'YYZ',
  FRA: 'CDG',
  DEU: 'FRA',
  JPN: 'NRT',
};

/* ---------------- airport dataset --------------------------------- */
type AirportRec = {
  iata: string;
  name: string;
  city: string;
  iso: string;
  type: string;
};
let airports: AirportRec[] = []; // cached after first fetch
async function getAirports(): Promise<AirportRec[]> {
  if (airports.length) return airports;
  const url =
    'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json';
  const raw = await fetch(url).then((r) => r.json());
  airports = Object.values(raw) as AirportRec[];
  return airports;
}

/* ------------------------------------------------------------------ */
type Cabin = 'e' | 'pe' | 'b' | 'f';
type Trip = 'round' | 'oneway';
const cabinSlug: Record<Cabin, string> = {
  e: 'economy',
  pe: 'premiumeconomy',
  b: 'business',
  f: 'first',
};
const yymmdd = (iso: string) => iso.replace(/-/g, '').slice(2); // 2025-07-01 → 250701
const tomorrow = (iso: string) =>
  new Date(new Date(iso).getTime() + 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10); // yyyy-mm-dd

/* ---------- tiny counter ---------- */
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
  <div className="flex justify-between rounded border p-2 text-sm">
    <span>{label}</span>
    <div className="flex gap-2">
      <button
        onClick={() => set(Math.max(min, val - 1))}
        className="rounded border px-2"
      >
        –
      </button>
      {val}
      <button onClick={() => set(val + 1)} className="rounded border px-2">
        +
      </button>
    </div>
  </div>
);

/* ================================================================== */
/*  FlightSearch                                                      */
/* ================================================================== */
export default function FlightSearch({ full }: { full: FullCountry | null }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depart, setDepart] = useState('');
  const [ret, setRet] = useState('');
  const [trip, setTrip] = useState<Trip>('round');
  const [cabin, setCabin] = useState<Cabin>('e');
  const [adults, setAdults] = useState(1);
  const [seniors, setSeniors] = useState(0);
  const [kids, setKids] = useState(0);
  const [inf, setInf] = useState(0);

  /* ---------- load airports once ---------- */
  const [readyList, setReadyList] = useState(false);
  useEffect(() => {
    getAirports().then(() => setReadyList(true));
  }, []);

  /* ---------- auto-fill destination when country changes ---------- */
  useEffect(() => {
    if (!full) return;

    if (QUICK_MAP[full.cca3]) {
      setTo(QUICK_MAP[full.cca3]);
      return;
    }

    (async () => {
      const list = await getAirports();
      const iso = (full as any).cca2 || '';
      const big =
        list.find(
          (a) =>
            a.iso === iso && a.type === 'large_airport' && a.iata.length === 3
        ) ||
        list.find((a) => a.iso === iso && a.iata.length === 3);
      setTo(big?.iata || '');
    })();
  }, [full]);

  /* ---------- date logic ---------- */
  const onDepart = (d: string) => {
    setDepart(d);
    if (trip === 'round') {
      if (!ret || ret <= d) setRet(tomorrow(d));
    }
  };

  const onTripToggle = (t: Trip) => {
    setTrip(t);
    if (t === 'oneway') setRet('');
    else if (depart && (!ret || ret <= depart)) setRet(tomorrow(depart));
  };

  /* ---------- build URLs ---------- */
  const params =
    `?adults=${adults}&seniors=${seniors}&children=${kids}` +
    `&infants=${inf}&cabinclass=${cabinSlug[cabin]}`;

  const skyscanner = useMemo(() => {
    if (!from || !to || !depart) return '';
    const out = yymmdd(depart);
    const back = trip === 'round' && ret ? `/${yymmdd(ret)}` : '';
    return `https://www.skyscanner.com/transport/flights/${from}/${to}/${out}${back}/${params}`;
  }, [from, to, depart, ret, trip, params]);

  const google = useMemo(() => {
    if (!from || !to || !depart) return '';
    const seg1 = `${from}.${to}.${depart}`;
    const seg2 = trip === 'round' && ret ? `*${to}.${from}.${ret}` : '';
    return `https://www.google.com/travel/flights#flt=${seg1}${seg2}`;
  }, [from, to, depart, ret, trip]);

  const allGood =
    from.length === 3 &&
    to.length === 3 &&
    depart &&
    (trip === 'oneway' || ret);

  /* ---------- filtered suggestions ---------- */
  const suggest = (q: string) =>
    !readyList || q.length < 2
      ? []
      : airports
          .filter(
            (a) =>
              a.iata &&
              (a.iata.toLowerCase().startsWith(q.toLowerCase()) ||
                a.city?.toLowerCase().includes(q.toLowerCase()) ||
                a.name?.toLowerCase().includes(q.toLowerCase()) ||
                a.iso?.toLowerCase() === q.toLowerCase())
          )
          .slice(0, 20); // limit

  /* ================================================================= */
  if (!full) return null;

  return (
    <section className="mt-8">
      <h3 className="mb-2 font-semibold">Flight Search</h3>

      {/* trip toggle */}
      <div className="mb-4 flex gap-2">
        {(['round', 'oneway'] as Trip[]).map((t) => (
          <button
            key={t}
            onClick={() => onTripToggle(t)}
            className={`rounded px-3 py-1 ${
              trip === t
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {t === 'round' ? 'Round Trip' : 'One Way'}
          </button>
        ))}
      </div>

      {/* inputs */}
      <div className="mb-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        {/* From */}
        <input
          list="from-list"
          value={from}
          onChange={(e) => setFrom(e.target.value.toUpperCase())}
          placeholder="From – code / city"
          className="rounded border p-2"
          maxLength={3}
        />
        <datalist id="from-list">
          {suggest(from).map((a) => (
            <option
              key={a.iata}
              value={a.iata}
            >{`${a.iata} – ${a.city || a.name}`}</option>
          ))}
        </datalist>

        {/* To */}
        <input
          list="to-list"
          value={to}
          onChange={(e) => setTo(e.target.value.toUpperCase())}
          placeholder="To – code / city"
          className="rounded border p-2"
          maxLength={3}
        />
        <datalist id="to-list">
          {suggest(to).map((a) => (
            <option
              key={a.iata}
              value={a.iata}
            >{`${a.iata} – ${a.city || a.name}`}</option>
          ))}
        </datalist>

        {/* Dates */}
        <input
          type="date"
          value={depart}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onDepart(e.target.value)
          }
          onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.showPicker?.()}
          className="rounded border p-2 md:col-span-1"
        />
        {trip === 'round' && (
          <input
            type="date"
            value={ret}
            min={tomorrow(depart || new Date().toISOString().slice(0, 10))}
            onChange={(e) => setRet(e.target.value)}
            onFocus={(e) =>{
               if(!depart){
                const prev = e.target.previousElementSibling as HTMLInputElement | null;
                prev?.focus();                           // <-- cast fixes TS error
              } else {
                (e.target as HTMLInputElement).showPicker?.();
              }
            }}
            className="rounded border p-2 md:col-span-1"
          />
        )}

        {/* Cabin */}
        <select
          value={cabin}
          onChange={(e) => setCabin(e.target.value as Cabin)}
          className="rounded border p-2"
        >
          <option value="e">Economy</option>
          <option value="pe">Premium Economy</option>
          <option value="b">Business</option>
          <option value="f">First</option>
        </select>

        {/* Pax counters */}
        <Counter label="Adults" val={adults} set={setAdults} min={1} />
        <Counter label="Seniors" val={seniors} set={setSeniors} min={0} />
        <Counter label="Kids" val={kids} set={setKids} min={0} />
        <Counter label="Infants" val={inf} set={setInf} min={0} />
      </div>

      {/* search btn */}
      <a
        href={allGood ? skyscanner || google : '#'}
        target={allGood ? '_blank' : undefined}
        rel="noopener noreferrer"
        className={`flex h-12 w-full items-center justify-center rounded bg-brand-gradient
                   text-white shadow transition-opacity ${
                     allGood
                       ? 'hover:opacity-90'
                       : 'cursor-not-allowed opacity-40'
                   }`}
      >
        Search Flights →
      </a>
    </section>
  );
}
