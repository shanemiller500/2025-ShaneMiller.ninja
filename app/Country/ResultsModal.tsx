/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, Fragment, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  ChevronDown,
  ChevronUp,
  Filter as FilterIcon,
} from 'lucide-react'

/* ---------- helpers ------------------------------------------------ */
const minsToH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

const fmtTime = (iso: string) =>
  new Date(iso.replace(' ', 'T')).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const fmtDate = (iso: string) =>
  new Date(iso.replace(' ', 'T')).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

const dayOffset = (d1: string, d2: string) => {
  const a = new Date(d1.replace(' ', 'T'))
  const b = new Date(d2.replace(' ', 'T'))
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return diff === 0 ? '' : diff > 0 ? ` +${diff}d` : ` ${diff}d`
}

/* ---------- API-matching types ------------------------------------ */
interface FlightSegment {
  departure_airport: { name: string; id: string; time: string }
  arrival_airport: { name: string; id: string; time: string }
  duration: number
  airline: string
  airline_logo: string
  travel_class: string
  flight_number: string
  extensions?: string[]
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
  flights?: FlightSegment[]
  layovers?: Layover[]
  legs?: string[]
  deeplink?: string
  ai_score?: number
  ai_rank?: number
}

/* ---------- props -------------------------------------------------- */
interface Props {
  open: boolean
  setOpen: (b: boolean) => void
  loading: boolean
  photo: string | null
  flights: FlightOption[]
  from: string
  to: string
  depart: string
  ret: string
  trip: 'round' | 'oneway'
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
  /* ------------ UI + filter state -------------------------------- */
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [maxStops, setMaxStops] = useState<number>(3) // 3 = “Any”
  const [selectedAirline, setSelectedAirline] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'ai'>('price')

  /* unique airline list for filter dropdown ----------------------- */
  const airlines = useMemo(() => {
    const s = new Set<string>()
    flights.forEach((f) =>
      f.flights?.forEach((seg) => s.add(seg.airline)),
    )
    return Array.from(s).sort()
  }, [flights])

  /* filtered + sorted flight list --------------------------------- */
  const filteredFlights = useMemo(() => {
    const filterfn = (f: FlightOption) => {
      const layCnt =
        f.layovers?.length ??
        (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1)
      if (maxStops < 3 && layCnt > maxStops) return false
      if (
        selectedAirline !== 'all' &&
        !f.flights?.some((seg) => seg.airline === selectedAirline)
      )
        return false
      return true
    }
    const sortfn = (a: FlightOption, b: FlightOption) => {
      switch (sortBy) {
        case 'duration':
          return (a.total_duration ?? 1e9) - (b.total_duration ?? 1e9)
        case 'ai':
          return (b.ai_score ?? -1) - (a.ai_score ?? -1)
        case 'price':
        default:
          return (a.price ?? 1e9) - (b.price ?? 1e9)
      }
    }
    return [...flights.filter(filterfn)].sort(sortfn)
  }, [flights, maxStops, selectedAirline, sortBy])

  /* deep-links for external apps ---------------------------------- */
  const googleLink =
    trip === 'round' && ret
      ? `https://www.google.com/travel/flights?hl=en#flt=${from}.${to}.${depart}*${to}.${from}.${ret}`
      : `https://www.google.com/travel/flights?hl=en#flt=${from}.${to}.${depart}`

  const skyBase = 'https://www.skyscanner.com/transport/flights'
  const skyLink =
    trip === 'round' && ret
      ? `${skyBase}/${from}/${to}/${depart.replace(/-/g, '')}/${ret.replace(
          /-/g,
          '',
        )}`
      : `${skyBase}/${from}/${to}/${depart.replace(/-/g, '')}`

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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
            <Dialog.Panel className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-brand-900 sm:max-w-2xl lg:max-w-3xl">
              {photo && (
                <img
                  src={photo}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              )}

              {/* scroll-area ----------------------------------------------------- */}
              <div className="flex max-h-[calc(90vh-10rem)] flex-col overflow-y-auto p-6">
                <Dialog.Title className="mb-4 text-lg font-semibold">
                  {loading
                    ? 'Searching flights…'
                    : `Found ${filteredFlights.length} option${
                        filteredFlights.length !== 1 ? 's' : ''
                      }`}
                </Dialog.Title>

                {/* quick filter toggle ---------------------------------------- */}
                {!loading && flights.length > 0 && (
                  <button
                    onClick={() => setFiltersOpen((p) => !p)}
                    className="mb-4 flex items-center gap-2 self-start rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-brand-950 dark:text-gray-300 dark:hover:bg-brand-800"
                  >
                    <FilterIcon size={16} />
                    Filters
                    {filtersOpen ? (
                      <ChevronUp size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </button>
                )}

                {/* filter panel ----------------------------------------------- */}
                {filtersOpen && !loading && (
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {/* max stops */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold">
                        Max stops
                      </label>
                      <select
                        value={maxStops}
                        onChange={(e) => setMaxStops(+e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-brand-800 dark:bg-brand-950"
                      >
                        <option value={0}>Non-stop</option>
                        <option value={1}>1 stop</option>
                        <option value={2}>2 stops</option>
                        <option value={3}>Any</option>
                      </select>
                    </div>

                    {/* airline */}
                    <div className="col-span-1 sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold">
                        Airline
                      </label>
                      <select
                        value={selectedAirline}
                        onChange={(e) => setSelectedAirline(e.target.value)}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-brand-800 dark:bg-brand-950"
                      >
                        <option value="all">All airlines</option>
                        {airlines.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* sort */}
                    <div>
                      <label className="mb-1 block text-xs font-semibold">
                        Sort by
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(e.target.value as typeof sortBy)
                        }
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-brand-800 dark:bg-brand-950"
                      >
                        <option value="price">Price</option>
                        <option value="duration">Duration</option>
                        <option value="ai">AI rank</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* empty state -------------------------------------------------- */}
                {!loading && filteredFlights.length === 0 && (
                  <p className="text-center text-gray-500">
                    No flights match your filters.
                  </p>
                )}

                {/* flight cards ------------------------------------------------- */}
                {!loading &&
                  filteredFlights.map((f, i) => {
                    const isOpen = expanded === i
                    const seg0 = f.flights?.[0]
                    const layCnt =
                      f.layovers?.length ??
                      (f.flights
                        ? f.flights.length - 1
                        : (f.legs?.length ?? 1) - 1)

                    return (
                      <div
                        key={i}
                        className={`mb-4 rounded-lg border transition-all duration-300 ${
                          isOpen
                            ? 'shadow-lg ring-2 ring-indigo-500'
                            : 'shadow-sm'
                        }`}
                      >
                        {/* summary row */}
                        <button
                          onClick={() => setExpanded(isOpen ? null : i)}
                          className="flex w-full items-center justify-between bg-gray-100 p-4 text-left transition-colors duration-200 hover:bg-gray-200 dark:bg-brand-950 dark:hover:bg-brand-800"
                        >
                          {/* airline + provider */}
                          <div className="flex items-center gap-3">
                            {f.airline_logo && (
                              <img
                                src={f.airline_logo}
                                alt=""
                                className="h-6 w-6 shrink-0 object-contain"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {f.provider}
                              </span>
                              {seg0 && (
                                <span className="text-xs text-gray-400">
                                  {seg0.airline}
                                  {seg0.flight_number
                                    ? ` • ${seg0.flight_number}`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* price + duration + stops */}
                          <div className="flex items-center gap-4">
                            {f.price !== null && (
                              <span className="whitespace-nowrap text-lg font-bold text-gray-900 dark:text-white">
                                ${f.price}
                              </span>
                            )}

                            {f.total_duration && (
                              <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                {minsToH(f.total_duration)}
                              </span>
                            )}

                            <span className="text-sm text-gray-900 dark:text-white">
                              {layCnt} stop{layCnt !== 1 && 's'}
                            </span>

                            {isOpen ? (
                              <ChevronUp
                                size={18}
                                className="text-gray-300"
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                                className="text-gray-300"
                              />
                            )}
                          </div>
                        </button>

                        {/* details */}
                        <div
                          className={`overflow-hidden transition-[max-height] duration-300 ${
                            isOpen ? 'max-h-[1000px]' : 'max-h-0'
                          }`}
                        >
                          {/* details – clean mobile-friendly timeline -------------------------------- */}
{isOpen && (
  <div className="space-y-6 bg-white p-6 pb-8 text-sm leading-relaxed dark:bg-brand-950 dark:text-gray-300">
    {f.flights ? (
      <>
        {/* travel date */}
        <div className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
          {fmtDate(f.flights[0].departure_airport.time)}
        </div>

        {/* flight segments */}
        <ol className="relative border-s-2 border-indigo-300 pl-7 dark:border-indigo-600">
          {f.flights.map((seg, j) => (
            <li key={j} className="relative mb-8 last:mb-0">
              {/* dot with airline logo */}
              <div className="absolute -start-[1.625rem] top-1.5 flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white shadow ring-2 ring-indigo-500 dark:bg-brand-900">
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

              {/* segment header */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {seg.departure_airport.id} → {seg.arrival_airport.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {seg.airline} {seg.flight_number} · {seg.travel_class}
                  </p>
                </div>

                <p className="flex items-center gap-1 text-xs text-gray-600 sm:gap-2">
                  {fmtTime(seg.departure_airport.time)}
                  <span className="hidden sm:inline">→</span>
                  <span className="sm:hidden">⟶</span>
                  {fmtTime(seg.arrival_airport.time)}
                  <span className="hidden sm:inline">
                    · {minsToH(seg.duration)}
                  </span>
                </p>
              </div>

              {/* full airport names */}
              <p className="mt-1 text-xs text-gray-400">
                {seg.departure_airport.name} › {seg.arrival_airport.name}
              </p>

              {/* layover */}
              {j < (f.flights?.length ?? 0) - 1 && f.layovers?.[j] && (
                <div className="mt-4 ms-4  border-indigo-200 ps-4 text-s text-indigo-600 dark:border-indigo-700 text-center">
                  Layover&nbsp;in&nbsp;{f.layovers[j].name}&nbsp;&middot;&nbsp;
                  {minsToH(f.layovers[j].duration)}
                  {f.layovers[j].overnight && ' (overnight)'}
                </div>
              )}
            </li>
          ))}
        </ol>

        {/* trip summary */}
        <div className="mt-4 space-y-1 text-sm">
          {f.total_duration && (
            <p>
              <strong>Total:</strong> {minsToH(f.total_duration)}
            </p>
          )}
          {f.carbon_emissions && (
            <p>
              <strong>Emissions:</strong>{' '}
              {(f.carbon_emissions.this_flight / 1000).toFixed(1)} kg CO₂
            </p>
          )}
          {f.ai_score && (
            <p>
              <strong>AI score:</strong> {f.ai_score.toFixed(2)} (rank {f.ai_rank})
            </p>
          )}
        </div>
      </>
    ) : (
      /* barebones list */
      <ul className="list-inside list-disc space-y-1">
        {(f.legs || []).map((l, k) => (
          <li key={k}>{l}</li>
        ))}
      </ul>
    )}

    {/* provider link */}
    <a
      href={f.deeplink || 'https://www.google.com/travel/flights?hl=en&nps=1'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:opacity-90"
    >
      Book now →
    </a>
  </div>
)}

                        </div>
                      </div>
                    )
                  })}

                {/* external search buttons -------------------------------- */}
                {!loading && (
                  <div className="mt-6 flex flex-col gap-2 text-center text-sm sm:flex-row sm:justify-center">
                    <a
                      href={googleLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:opacity-90"
                    >
                      Open in Google Flights
                    </a>
                    <a
                      href={skyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-sky-600 px-4 py-2 font-medium text-white shadow hover:opacity-90"
                    >
                      Open in Skyscanner
                    </a>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
