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
  <div className="flex justify-between rounded border p-2 text-sm">
    <span>{label}</span>
    <div className="flex gap-2">
      <button onClick={() => set(Math.max(min, val - 1))} className="rounded border px-2">
        –
      </button>
      {val}
      <button onClick={() => set(val + 1)} className="rounded border px-2">
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
  const API_BASE = 'http://localhost:3002' //'https://u-mail.co'

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
    <section className="mt-8 bg-white dark:bg-brand-950 p-6 rounded shadow-md">
      <h3 className="mb-2 font-semibold">Flight Search</h3>

      {/* trip toggle */}
      <div className="mb-4 flex gap-2">
        {(['round', 'oneway'] as Trip[]).map((t) => (
          <button
            key={t}
            onClick={() => onTripToggle(t)}
            className={`rounded px-3 py-1 ${
              trip === t ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {t === 'round' ? 'Round Trip' : 'One Way'}
          </button>
        ))}
      </div>

      {/* inputs */}
      <div className="mb-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2 text-black">
        <input
          list="from-list"
          value={from}
          maxLength={3}
          onChange={(e) => setFrom(e.target.value.toUpperCase())}
          placeholder="From – code / city"
          className="rounded border p-2"
        />
        <datalist id="from-list">
          {suggest(from).map((a) => (
            <option key={a.iata} value={a.iata}>
              {`${a.iata} – ${a.city || a.name}`}
            </option>
          ))}
        </datalist>

        <input
          list="to-list"
          value={to}
          maxLength={3}
          onChange={(e) => setTo(e.target.value.toUpperCase())}
          placeholder="To – code / city"
          className="rounded border p-2"
        />
        <datalist id="to-list">
          {suggest(to).map((a) => (
            <option key={a.iata} value={a.iata}>
              {`${a.iata} – ${a.city || a.name}`}
            </option>
          ))}
        </datalist>

        <input
          type="date"
          value={depart}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onDepart(e.target.value)}
          onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.showPicker?.()}
          className="rounded border p-2"
        />
        {trip === 'round' && (
          <input
            type="date"
            value={ret}
            min={tomorrow(depart || new Date().toISOString().slice(0, 10))}
            onChange={(e) => setRet(e.target.value)}
            onFocus={(e) => {
              if (!depart) {
                (e.target.previousElementSibling as HTMLInputElement | null)?.focus()
              } else {
                (e.target as HTMLInputElement).showPicker?.()
              }
            }}
            className="rounded border p-2"
          />
        )}

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

        <Counter  label="Adults" val={adults} set={setAdults} min={1} />
        <Counter label="Children" val={children} set={setChildren} min={0} />
        <Counter label="Infants" val={infants} set={setInfants} min={0} />
        <Counter label="Seniors" val={seniors} set={setSeniors} min={0} />
      </div>

      {/* search button */}
      <button
        onClick={runSearch}
        disabled={!allGood}
        className={`flex h-12 w-full items-center justify-center rounded bg-indigo-600 text-white shadow ${
          allGood ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'
        }`}
      >
        Search Flights <ArrowRight className="ml-2 h-4 w-4" />
      </button>

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
  )
}
