/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
  const [expanded, setExpanded] = useState<number | null>(null)

  /* deep-links for external apps ---------------------------------- */
  const googleLink =
    trip === 'round' && ret
      ? `https://www.google.com/travel/flights?hl=en#flt=${from}.${to}.${depart}*${to}.${from}.${ret}`
      : `https://www.google.com/travel/flights?hl=en#flt=${from}.${to}.${depart}`

  const skyBase = 'https://www.skyscanner.com/transport/flights'
  const skyLink =
    trip === 'round' && ret
      ? `${skyBase}/${from}/${to}/${depart.replace(/-/g, '')}/${ret.replace(/-/g, '')}`
      : `${skyBase}/${from}/${to}/${depart.replace(/-/g, '')}`

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
              {photo && <img src={photo} alt="" className="h-40 w-full object-cover" />}

              {/* scroll-area --------------------------------------------------------- */}
              <div className="flex max-h-[calc(90vh-10rem)] flex-col overflow-y-auto p-6">
                <Dialog.Title className="mb-4 text-lg font-semibold">
                  {loading
                    ? 'Searching flights\u2026'
                    : `Found ${flights.length} option${flights.length !== 1 ? 's' : ''}`}
                </Dialog.Title>

                {!loading && flights.length === 0 && (
                  <p className="text-center text-gray-500">No flights match your query.</p>
                )}

                {/* flight cards ----------------------------------------------------- */}
                {!loading &&
                  flights.map((f, i) => {
                    const isOpen = expanded === i
                    const seg0 = f.flights?.[0]
                    const layCnt =
                      f.layovers?.length ??
                      (f.flights ? f.flights.length - 1 : (f.legs?.length ?? 1) - 1)

                    return (
                      <div
                        key={i}
                        className={`mb-4 rounded-lg border transition-all duration-300 ${
                          isOpen ? 'shadow-lg ring-2 ring-indigo-500' : 'shadow-sm'
                        }`}
                      >
                        {/* summary row */}
                        <button
                          onClick={() => setExpanded(isOpen ? null : i)}
className="flex w-full items-center justify-between
           bg-gray-100 hover:bg-gray-200         
           dark:bg-brand-950 dark:hover:bg-brand-800 
           p-4 text-left transition-colors duration-200 "                        >
                          <div className="flex items-center gap-3">
                            {f.airline_logo && (
                              <img
                                src={f.airline_logo}
                                alt=""
                                className="h-6 w-6 shrink-0 object-contain"
                              />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">{f.provider}</span>
                              {seg0 && (
                                <span className="text-xs text-gray-400">
                                  {seg0.airline}
                                  {seg0.flight_number ? ` • ${seg0.flight_number}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {f.price !== null && (
                              <span className="whitespace-nowrap text-lg font-bold text-gray-900 dark:text-white">
                                ${f.price}
                              </span>
                            )}
                            <span className="text-sm texttext-gray-900 dark:text-white">
                              {layCnt} layover{layCnt !== 1 ? 's' : ''}
                            </span>
                            {isOpen ? (
                              <ChevronUp size={18} className="text-gray-300" />
                            ) : (
                              <ChevronDown size={18} className="text-gray-300" />
                            )}
                          </div>
                        </button>

                        {/* details */}
                        <div
                          className={`overflow-hidden transition-[max-height] duration-300 ${
                            isOpen ? 'max-h-[1000px]' : 'max-h-0'
                          }`}
                        >
                          {isOpen && (
                            <div className="space-y-6 bg-white p-4 text-sm text-gray-700 dark:bg-brand-950 dark:text-gray-300 sm:px-6">
                              {f.flights ? (
                                <>
                                  {/* first flight date */}
                                  <div className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                                    {fmtDate(f.flights[0].departure_airport.time)}
                                  </div>

                                  {/* segments list */}
                                  <ul className="space-y-5">
                                    {f.flights.map((seg, j) => (
                                      <li key={j} className="flex flex-col gap-1">
                                        {/* line 1: airline + class */}
                                        <div className="flex items-center gap-2">
                                          <img
                                            src={seg.airline_logo}
                                            alt={seg.airline}
                                            className="h-5 w-5 object-contain"
                                          />
                                          <strong className="font-medium">
                                            {seg.airline} {seg.flight_number}
                                          </strong>
                                          <span className="italic text-xs">
                                            ({seg.travel_class})
                                          </span>
                                        </div>

                                        {/* line 2: city pairs */}
                                        <div className="flex flex-wrap items-center gap-x-1">
                                          <span>
                                            {seg.departure_airport.name} (
                                            {seg.departure_airport.id})
                                          </span>
                                          <span className="mx-1">→</span>
                                          <span>
                                            {seg.arrival_airport.name} ({seg.arrival_airport.id})
                                          </span>
                                        </div>

                                        {/* line 3: times */}
                                        <div className="text-xs text-gray-500">
                                          {fmtTime(seg.departure_airport.time)} →
                                          {fmtTime(seg.arrival_airport.time)}
                                          {dayOffset(
                                            seg.departure_airport.time,
                                            seg.arrival_airport.time,
                                          )}{' '}
                                          • {minsToH(seg.duration)}
                                        </div>

                                        {/* layover */}
                                        {j < f.flights!.length - 1 && f.layovers?.[j] && (
                                          <div className="mt-2 text-xs text-indigo-600">
                                            Layover in {f.layovers[j].name} –{' '}
                                            {minsToH(f.layovers[j].duration)}
                                            {f.layovers[j].overnight ? ' (overnight)' : ''}
                                          </div>
                                        )}

                                        {/* extensions */}
                                        {seg.extensions && (
                                          <ul className="list-inside list-disc text-xs">
                                            {seg.extensions.map((e, k) => (
                                              <li key={k}>{e}</li>
                                            ))}
                                          </ul>
                                        )}
                                      </li>
                                    ))}
                                  </ul>

                                  {/* summary metrics */}
                                  <div className="space-y-1 pt-1">
                                    {f.total_duration && (
                                      <div>
                                        <strong>Total duration:</strong>{' '}
                                        {minsToH(f.total_duration)}
                                      </div>
                                    )}
                                    {f.carbon_emissions && (
                                      <div>
                                        <strong>Emissions:</strong>{' '}
                                        {(f.carbon_emissions.this_flight / 1000).toFixed(1)} kg CO₂
                                      </div>
                                    )}
                                    {f.ai_score && (
                                      <div>
                                        <strong>AI score:</strong>{' '}
                                        {f.ai_score.toFixed(2)} (rank {f.ai_rank})
                                      </div>
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
                                href={
                                  f.deeplink ||
                                  'https://www.google.com/travel/flights?hl=en&nps=1'
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block font-medium text-indigo-600 hover:underline"
                              >
                                Book now →
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                {/* external search buttons ---------------------------------------- */}
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
