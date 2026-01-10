/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { getBackgroundImage, getWeatherIcon } from './weatherHelpers'
import { fetchLocationName } from './api'
import { Location, WeatherData } from './types'

import LoadingSpinner from './LoadingSpinner'
import WeatherSlider from './WeatherSlider'
import ToggleSwitch from './ToggleSwitch'
import LeafletMap from './LeafletMap'
import HourlyWeatherChart from './HourlyWeatherChart'
// If you use this table anywhere, keep the import ready:
// import HourlyWeatherTable from './HourlyWeatherTable'

const WeatherMap = dynamic(() => import('./weatherMap'), { ssr: false })

/* -------------------- Icons -------------------- */
const SunriseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 0l3-3m-3 3l-3-3M5.5 14h13" />
  </svg>
)

const SunsetIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22v-4m0 0l3 3m-3-3l-3 3M18.5 10H5.5" />
  </svg>
)

/* -------------------- Helpers -------------------- */
function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ')
}

function fmtTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return value
  }
}

function fmtDateTime(d: Date) {
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
}

const WeatherPage: React.FC = () => {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [backgroundImage, setBackgroundImage] = useState<string>('')
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C')

  const [showWeatherMap, setShowWeatherMap] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => setMounted(true), [])

  // Leaflet marker icon merge (client-only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet')
      const markerIconUrl = require('leaflet/dist/images/marker-icon.png')
      const markerShadowUrl = require('leaflet/dist/images/marker-shadow.png')
      L.Icon.Default.mergeOptions({
        iconUrl: markerIconUrl,
        shadowUrl: markerShadowUrl,
        responsive: true,
        maintainAspectRatio: false,
      })
    }
  }, [])

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Background image based on current weather
  useEffect(() => {
    if (weatherData?.current_weather) {
      const bg = getBackgroundImage(weatherData.current_weather.weathercode)
      setBackgroundImage(bg)
    }
  }, [weatherData])

  // Get user location on load
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        const locationData = await fetchLocationName(latitude, longitude)
        setSelectedLocation(locationData)
        fetchWeatherData(latitude, longitude)
      },
      (err) => {
        console.error(err)
        setError('Geolocation permission denied. Please search for a location.')
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!searchTerm.trim()) return
    setError('')
    setSearchOpen(true)

    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm.trim())}`
      )
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error(err)
      setError('Error fetching location data')
    }
  }

  const fetchWeatherData = async (latitude: number, longitude: number) => {
    setLoading(true)
    setWeatherData(null)
    setBackgroundImage('')
    const startTime = Date.now()

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&hourly=temperature_2m,precipitation,snowfall,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,lightning_potential` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,weathercode` +
          `&current_weather=true&timezone=auto`,
        { cache: 'no-store' }
      )
      const data = await res.json()

      // tiny minimum spinner time for polish
      const elapsed = Date.now() - startTime
      const wait = Math.max(0, 700 - elapsed)
      if (wait) await new Promise((r) => setTimeout(r, wait))

      setWeatherData(data)
    } catch (err) {
      console.error(err)
      setError('Error fetching weather data')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location)
    setSearchResults([])
    setSearchOpen(false)
    setSearchTerm(location.name)
    setWeatherData(null)
    setBackgroundImage('')
    fetchWeatherData(location.latitude, location.longitude)
  }

  const convertTemperature = (temp: number): string => {
    if (tempUnit === 'C') return `${temp}°C`
    return `${(temp * 9) / 5 + 32}`.includes('.')
      ? `${((temp * 9) / 5 + 32).toFixed(1)}°F`
      : `${(temp * 9) / 5 + 32}°F`
  }

  const heroTitle = useMemo(() => {
    const name = selectedLocation?.name ? selectedLocation.name : 'Weather'
    const country = selectedLocation?.country ? `, ${selectedLocation.country}` : ''
    return `${name}${country}`
  }, [selectedLocation])

  // current wind gust
  const windGust = useMemo(() => {
    if (weatherData?.hourly?.time && weatherData?.current_weather) {
      const currentTimeISO = (weatherData.current_weather as any).time
      const idx = weatherData.hourly.time.indexOf(currentTimeISO)
      if (idx !== -1) return weatherData.hourly.wind_gusts_10m?.[idx] ?? null
    }
    return null
  }, [weatherData])

  return (
    <div
      className="relative min-h-screen text-gray-900"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/45" />

      {!mounted ? (
        <div style={{ minHeight: '100vh' }} />
      ) : (
        <div className="relative z-10">
          {/* Top bar */}
          <header className="sticky top-0 z-30 border-b border-white/10 bg-black/30 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                      Weather
                      <span className="ml-2 inline-block rounded-full bg-white/10 px-2 py-1 align-middle text-xs font-semibold text-white/90">
                        Live
                      </span>
                    </h1>
                    <p className="mt-1 text-xs font-semibold text-white/70">{fmtDateTime(currentTime)}</p>
                  </div>

                  <div className="mt-1 flex items-center gap-3 md:hidden">
                    <ToggleSwitch
                      isOn={tempUnit === 'F'}
                      onToggle={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                    />
                  </div>
                </div>

                {/* Search + Actions */}
                <div className="flex w-full flex-col gap-3 md:max-w-[560px] md:flex-row md:items-center md:justify-end">
                  <form onSubmit={handleSearch} className="relative flex w-full">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setSearchOpen(true)
                      }}
                      onFocus={() => setSearchOpen(true)}
                      placeholder="Search city, state, country…"
                      className="w-full rounded-l-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white placeholder:text-white/50 outline-none
                                 focus:border-white/30 focus:bg-white/15"
                    />
                    <button
                      type="submit"
                      className="rounded-r-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-bold text-white hover:opacity-95"
                    >
                      Search
                    </button>

                    {/* dropdown */}
                    {searchOpen && searchResults.length > 0 && (
                      <div className="absolute left-0 top-[54px] z-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl">
                        <div className="max-h-[320px] overflow-y-auto">
                          {searchResults.map((result) => (
                            <button
                              key={result.id || `${result.name}-${result.latitude}-${result.longitude}`}
                              type="button"
                              onClick={() => handleSelectLocation(result)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-white/90 hover:bg-white/10"
                            >
                              <span className="font-semibold">
                                {result.name}
                                {result.country ? `, ${result.country}` : ''}
                              </span>
                              <span className="text-xs font-semibold text-white/50">
                                {result.latitude.toFixed(2)}, {result.longitude.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </form>

                  <div className="hidden items-center gap-3 md:flex">
                    <ToggleSwitch
                      isOn={tempUnit === 'F'}
                      onToggle={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
                    />

                    <button
                      onClick={() => setShowWeatherMap(true)}
                      className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
                      type="button"
                    >
                      Map
                    </button>
                  </div>

                  <div className="md:hidden">
                    <button
                      onClick={() => setShowWeatherMap(true)}
                      className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"
                      type="button"
                    >
                      Open Weather Map
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                  {error}
                </div>
              )}
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6">
            {/* loading state */}
            {loading && (
              <div className="mb-5 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white/80">
                Loading weather…
              </div>
            )}

            {/* Main content */}
            {weatherData && selectedLocation && (
              <div className="grid grid-cols-1 gap-6">
                {/* Hero Card */}
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">{heroTitle}</h2>
                            <p className="mt-1 text-sm font-semibold text-white/70">
                              Updated: {(weatherData.current_weather as any)?.time ? fmtTime((weatherData.current_weather as any).time) : '—'}
                            </p>
                          </div>

                          {/* Big icon */}
                          {weatherData.current_weather && (
                            <div className="text-5xl text-white">
                              {getWeatherIcon(weatherData.current_weather.weathercode, 64)}
                            </div>
                          )}
                        </div>

                        {/* Main stats row */}
                        {weatherData.current_weather && (
                          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="text-xs font-bold text-white/60">Temp</div>
                              <div className="mt-1 text-xl font-extrabold text-white">
                                {convertTemperature(weatherData.current_weather.temperature)}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-white/60">Feels like: —</div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="text-xs font-bold text-white/60">Wind</div>
                              <div className="mt-1 text-xl font-extrabold text-white">
                                {weatherData.current_weather.windspeed} km/h
                              </div>
                              <div className="mt-1 text-xs font-semibold text-white/60">
                                Gust: {windGust ?? '—'}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="text-xs font-bold text-white/60">Sunrise</div>
                              <div className="mt-2 flex items-center gap-2 text-white">
                                <SunriseIcon className="h-5 w-5 text-yellow-300" />
                                <span className="text-sm font-extrabold">
                                  {weatherData.daily?.sunrise?.[0] ? fmtTime(weatherData.daily.sunrise[0]) : '—'}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="text-xs font-bold text-white/60">Sunset</div>
                              <div className="mt-2 flex items-center gap-2 text-white">
                                <SunsetIcon className="h-5 w-5 text-orange-300" />
                                <span className="text-sm font-extrabold">
                                  {weatherData.daily?.sunset?.[0] ? fmtTime(weatherData.daily.sunset[0]) : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 text-xs font-semibold text-white/60">
                          Tip: Swipe charts, tap forecast cards, and open the map for radar layers.
                        </div>
                      </div>

                      {/* mini map */}
                      {selectedLocation && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="h-56 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 md:w-[360px]"
                        >
                          <LeafletMap location={selectedLocation} />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full bg-white/10" />

                  {/* Chart + Forecast */}
                  <div className="p-5 sm:p-6">
                    {weatherData.hourly?.time && (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <HourlyWeatherChart hourly={weatherData.hourly as any} tempUnit={tempUnit} />
                      </div>
                    )}

                    {weatherData.daily?.time && (
                      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-end justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-extrabold text-white">7-Day Forecast</h3>
                            <p className="mt-1 text-xs font-semibold text-white/60">Swipe on mobile • Dots for paging</p>
                          </div>
                        </div>
                        <WeatherSlider daily={weatherData.daily} tempUnit={tempUnit} />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </main>

          {loading && <LoadingSpinner />}
        </div>
      )}

      {/* WeatherMap Modal */}
      {showWeatherMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative h-full w-full">
            <div className="absolute left-0 top-0 z-10 flex w-full items-center justify-between gap-2 p-3">
              <div className="rounded-2xl border border-white/10 bg-black/50 px-4 py-2 text-sm font-bold text-white backdrop-blur-xl">
                Interactive Weather Map
              </div>
              <button
                onClick={() => setShowWeatherMap(false)}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white hover:opacity-95"
              >
                Close
              </button>
            </div>
            <WeatherMap onClose={() => setShowWeatherMap(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default WeatherPage
