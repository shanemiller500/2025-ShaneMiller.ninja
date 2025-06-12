/* eslint-disable @next/next/no-img-element */
'use client'

import React, {
  useState,
  useEffect,
  ChangeEvent,
  FocusEvent,
} from 'react'
import { ArrowRight } from 'lucide-react'
import ResultsModal from './ResultsModal'

/* ------------------------------------------------------------------ */
/*  Minimal FullCountry shape                                         */
/* ------------------------------------------------------------------ */
export interface FullCountry {
  cca3: string
  cca2?: string
  capital?: string[]
}

/* ---------------- quick hard-coded hub map ------------------------ */
const QUICK_MAP: Record<string, string> = {
  USA: 'DEN',
  GBR: 'LHR',
  CAN: 'YYZ',
  FRA: 'CDG',
  DEU: 'FRA',
  JPN: 'NRT',
}

/* ---------------- airport dataset --------------------------------- */
type AirportRec = { iata: string; name: string; city: string; iso: string; type: string }
let airports: AirportRec[] = []
async function getAirports(): Promise<AirportRec[]> {
  if (airports.length) return airports
  const raw = await fetch(
    'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json',
  ).then((r) => r.json())
  airports = Object.values(raw) as AirportRec[]
  return airports
}

/* ---------------- helpers ----------------------------------------- */
type Cabin = 'e' | 'pe' | 'b' | 'f'
type Trip = 'round' | 'oneway'
const cabinSlug: Record<Cabin, string> = {
  e: 'economy',
  pe: 'premiumeconomy',
  b: 'business',
  f: 'first',
}
const tomorrow = (iso: string) =>
  new Date(new Date(iso).getTime() + 864e5).toISOString().slice(0, 10)

/* ---------- tiny counter ----------------------------------------- */
const Counter = ({
  label,
  val,
  set,
  min,
}: {
  label: string
  val: number
  set: (n: number) => void
  min: number
}) => (
  <div className="flex items-center justify-between rounded-md border border-brand-300/70
                  bg-white/40 px-3 py-1.5 text-sm backdrop-blur
                  dark:border-brand-700/60 dark:bg-brand-900/40">
    <span className="text-brand-800 dark:text-brand-200">{label}</span>

    <div className="flex items-center ">
      <button
        aria-label={`Decrease ${label}`}
        onClick={() => set(Math.max(min, val - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-400
                   text-base leading-none text-brand-600 hover:bg-brand-100
                   dark:border-brand-600 dark:text-brand-200 dark:hover:bg-brand-800/50"
      >
        –
      </button>

      <span className="w-5 text-center font-medium text-brand-900 dark:text-brand-100">
        {val}
      </span>

      <button
        aria-label={`Increase ${label}`}
        onClick={() => set(val + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-400
                   text-base leading-none text-brand-600 hover:bg-brand-100
                   dark:border-brand-600 dark:text-brand-200 dark:hover:bg-brand-800/50"
      >
        +
      </button>
    </div>
  </div>
)


/* ---------- detailed types reflecting new /api/flights output ----- */
interface FlightSegment {
  departure_airport: { name: string; id: string; time: string }
  arrival_airport: { name: string; id: string; time: string }
  duration: number
  airplane: string
  airline: string
  airline_logo: string
  travel_class: string
  flight_number: string
  extensions?: string[]
  legroom?: string
  often_delayed_by_over_30_min?: boolean
}
interface Layover {
  duration: number
  name: string
  id: string
  overnight?: boolean
}
interface FlightOption {
  provider: string
  price: number | null
  total_duration?: number
  carbon_emissions?: {
    this_flight: number
    typical_for_this_route: number
    difference_percent: number
  }
  airline_logo?: string
  type?: string
  booking_token?: string
  flights?: FlightSegment[]
  layovers?: Layover[]
  legs?: string[]
  deeplink?: string
  ai_score?: number
  ai_rank?: number
}

/* ================================================================== */
/*  FlightSearch component                                            */
/* ================================================================== */
export default function FlightSearch({ full = null }: { full?: FullCountry | null }) {
  const API_BASE = 'https://u-mail.co'

  /* ------------- form state -------------------------------------- */
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [depart, setDepart] = useState('')
  const [ret, setRet] = useState('')
  const [trip, setTrip] = useState<Trip>('round')
  const [cabin, setCabin] = useState<Cabin>('e')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [seniors, setSeniors] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  
  /* ------------- load airports for suggestions ------------------- */
  const [readyList, setReadyList] = useState(false)
  useEffect(() => {
    getAirports().then(() => setReadyList(true))
  }, [])

  /* ------------- auto-fill “to” when country changes ------------- */
  useEffect(() => {
    if (!full) return;
    
    if (QUICK_MAP[full.cca3]) {
      setTo(QUICK_MAP[full.cca3])
      return
    }
    
    ;(async () => {
      const list = await getAirports()
      const iso = full.cca2 || ''
      const big =
        list.find((a) => a.iso === iso && a.type === 'large_airport') ||
        list.find((a) => a.iso === iso)
      setTo(big?.iata || '')
    })()
  }, [full])

  /* ------------- date helpers ------------------------------------ */
  const onDepart = (d: string) => {
    setDepart(d)
    if (trip === 'round' && (!ret || ret <= d)) setRet(tomorrow(d))
  }
  const onTripToggle = (t: Trip) => {
    setTrip(t)
    if (t === 'oneway') setRet('')
    else if (depart && (!ret || ret <= depart)) setRet(tomorrow(depart))
  }

  /* ------------- airport suggestions ----------------------------- */
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
                a.iso?.toLowerCase() === q.toLowerCase()),
          )
          .slice(0, 20)

  /* ------------- modal / fetch state ----------------------------- */
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [flights, setFlights] = useState<FlightOption[]>([])
  const [photo, setPhoto] = useState<string | null>(null)

  const allGood =
    from.length === 3 && to.length === 3 && depart && (trip === 'oneway' || ret)

  /* ------------- run search -------------------------------------- */
  const runSearch = async () => {
    if (!allGood) return
    setOpen(true)
    setLoading(true)
    setFlights([])
    setPhoto(null)

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
        currency: 'USD',
        hl: 'en',
        gl: 'us',
      })
      if (trip === 'round') params.append('ret', ret)

      const res = await fetch(`${API_BASE}/api/flightSearch?${params.toString()}`)
      const json: FlightOption[] = await res.json()

      /* order: AI-rank if present → price asc → provider */
      json.sort((a, b) => {
        if (a.ai_rank && b.ai_rank) return a.ai_rank - b.ai_rank
        if (a.price !== null && b.price !== null) return a.price - b.price
        return a.provider.localeCompare(b.provider)
      })
      setFlights(json)
    } catch (e) {
      /* eslint-disable no-console */
      console.error('Flight search error:', e)
    } finally {
      setLoading(false)
    }
  }

 return (
  <section className="mx-auto mt-8 rounded bg-white/70 backdrop-blur
                      shadow-sm ring-1 ring-black/5 dark:border-brand-800/30 dark:bg-brand-950 ">
    {/* header */}
    <header className="flex items-center justify-between px-6 py-4">
      <h2 className="text-base font-semibold tracking-tight text-brand-900 dark:text-brand-100">
        Find a flight
      </h2>

      {/* round / one-way pills */}
      <div className="inline-flex overflow-hidden rounded-lg border border-brand-200 dark:border-brand-800">
        {(['round', 'oneway'] as Trip[]).map((t) => (
          <button
            key={t}
            onClick={() => onTripToggle(t)}
            className={`px-3 py-1 text-xs font-medium uppercase tracking-wide
              ${trip === t
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-transparent text-brand-600 dark:text-brand-300 hover:bg-brand-100/40 dark:hover:bg-brand-800/40'}`}
          >
            {t === 'round' ? 'Round trip' : 'One way'}
          </button>
        ))}
      </div>
    </header>

    {/* core inputs */}
    <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
      {/* FROM */}
      <label className="flex flex-col text-sm font-medium">
        <span className="mb-1 text-brand-700 dark:text-brand-300">From</span>
        <input
          list="from-list"
          value={from}
          maxLength={3}
          onChange={(e) => setFrom(e.target.value.toUpperCase())}
          placeholder="Code / city"
          className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                     text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     dark:border-brand-700 dark:text-brand-100 dark:placeholder-brand-500"
        />
      </label>
      <datalist id="from-list">
        {suggest(from).map((a) => (
          <option key={a.iata} value={a.iata}>{`${a.iata} – ${a.city || a.name}`}</option>
        ))}
      </datalist>

      {/* TO */}
      <label className="flex flex-col text-sm font-medium">
        <span className="mb-1 text-brand-700 dark:text-brand-300">To</span>
        <input
          list="to-list"
          value={to}
          maxLength={3}
          onChange={(e) => setTo(e.target.value.toUpperCase())}
          placeholder="Code / city"
          className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                     text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     dark:border-brand-700 dark:text-brand-100 dark:placeholder-brand-500"
        />
      </label>
      <datalist id="to-list">
        {suggest(to).map((a) => (
          <option key={a.iata} value={a.iata}>{`${a.iata} – ${a.city || a.name}`}</option>
        ))}
      </datalist>

      {/* DEPART */}
      <label className="flex flex-col text-sm font-medium">
        <span className="mb-1 text-brand-700 dark:text-brand-300">Depart</span>
        <input
          type="date"
          value={depart}
          onChange={(e) => onDepart(e.target.value)}
          onFocus={(e) => e.target.showPicker?.()}
          className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                     text-brand-900 focus:outline-none focus:ring-2 focus:ring-indigo-500
                     dark:border-brand-700 dark:text-brand-100"
        />
      </label>

      {/* RETURN (conditionally rendered) */}
      {trip === 'round' && (
        <label className="flex flex-col text-sm font-medium">
          <span className="mb-1 text-brand-700 dark:text-brand-300">Return</span>
          <input
            type="date"
            value={ret}
            min={tomorrow(depart || new Date().toISOString().slice(0, 10))}
            onChange={(e) => setRet(e.target.value)}
            onFocus={(e) =>
              !depart
                ? (e.target.previousElementSibling as HTMLInputElement | null)?.focus()
                : (e.target as HTMLInputElement).showPicker?.()
            }
            className="rounded-md border border-brand-300 bg-transparent px-3 py-2
                       text-brand-900 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       dark:border-brand-700 dark:text-brand-100"
          />
        </label>
      )}
    </div>

    {/* collapsible passenger / cabin panel */}
    <button
      type="button"
      onClick={() => setShowDetails(!showDetails)}
      className="flex w-full items-center justify-between border-t border-brand-200 px-6 py-4
                 text-sm font-medium text-brand-700 transition hover:bg-brand-50
                 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-800/40"
    >
      Travellers &amp; cabin
      <svg
        className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
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

        {/* counters – mobile-friendly single column */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Counter label="Adults"   val={adults}   set={setAdults}   min={1} />
          <Counter label="Children" val={children} set={setChildren} min={0} />
          <Counter label="Infants"  val={infants}  set={setInfants}  min={0} />
          <Counter label="Seniors"  val={seniors}  set={setSeniors}  min={0} />
        </div>
      </div>
    )}

    {/* search button */}
    <div className="border-t border-brand-100 px-6 py-5 dark:border-brand-800">
      <button
        onClick={runSearch}
        disabled={!allGood}
        className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold
          shadow transition focus:outline-none focus:ring-2 focus:ring-offset-2
          ${allGood
            ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500'
            : 'cursor-not-allowed bg-brand-300 text-brand-600 dark:bg-brand-800/60 dark:text-brand-500'}`}
      >
        Search flights
        <ArrowRight className="h-4 w-4" />
      </button>
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
)
}
