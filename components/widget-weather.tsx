"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WiDaySunny,
  WiCloud,
  WiFog,
  WiSprinkle,
  WiRain,
  WiSnow,
  WiThunderstorm,
  WiStrongWind,
  WiHumidity,
  WiRaindrops,
} from "react-icons/wi";
import { ChevronDown } from "lucide-react";

type CurrentWeather = {
  temperature: number; // °C
  windspeed: number; // km/h
  winddirection: number; // degrees
  weathercode: number;
  time: string; // ISO
};

type ForecastDay = {
  date: string; // YYYY-MM-DD
  temperature_max: number; // °C
  temperature_min: number; // °C
  weathercode: number;
};

type HourPoint = {
  time: string; // ISO
  temperature: number; // °C
  weathercode: number;
  pop?: number; // %
};

/* ------------------------------------------------------------------ */
/*  Cache (5-hour TTL)                                                  */
/* ------------------------------------------------------------------ */
const WEATHER_CACHE_KEY = "widgetWeatherCache_v2";
const WEATHER_CACHE_TTL = 5 * 60 * 60 * 1000;

interface WeatherCacheEntry {
  ts: number;
  locationLabel: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
  hourly: HourPoint[];
  meta: { humidity?: number; pop?: number };
}

function readWeatherCache(): WeatherCacheEntry | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const entry: WeatherCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > WEATHER_CACHE_TTL) return null;
    return entry;
  } catch {
    return null;
  }
}

function writeWeatherCache(entry: Omit<WeatherCacheEntry, "ts">) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ...entry, ts: Date.now() }));
  } catch {
    /* localStorage unavailable */
  }
}

const cToF = (c: number) => c * 1.8 + 32;
const fmtHour = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
const fmtDay = (dateString: string) =>
  new Date(dateString + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
  });

const getWeatherInfo = (code: number) => {
  if (code === 0) return { description: "Clear", Icon: WiDaySunny };
  if ([1, 2, 3].includes(code)) return { description: "Cloudy", Icon: WiCloud };
  if ([45, 48].includes(code)) return { description: "Fog", Icon: WiFog };
  if ([51, 53, 55].includes(code))
    return { description: "Drizzle", Icon: WiSprinkle };
  if ([61, 63, 65, 80, 81, 82].includes(code))
    return { description: "Rain", Icon: WiRain };
  if ([66, 67].includes(code))
    return { description: "Freezing Rain", Icon: WiRain };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { description: "Snow", Icon: WiSnow };
  if ([95, 96, 99].includes(code))
    return { description: "Storm", Icon: WiThunderstorm };
  return { description: "Weather", Icon: WiDaySunny };
};

/** Soft condition-tinted wash + icon color — keeps the card light */
const toneFor = (code: number) => {
  if (code === 0)
    return { wash: "from-amber-50 dark:from-amber-400/[0.06]", icon: "text-amber-400" };
  if ([45, 48].includes(code))
    return { wash: "from-slate-100 dark:from-white/[0.04]", icon: "text-slate-400" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { wash: "from-indigo-50 dark:from-indigo-400/[0.06]", icon: "text-indigo-300" };
  if ([95, 96, 99].includes(code))
    return { wash: "from-violet-50 dark:from-violet-400/[0.06]", icon: "text-violet-400" };
  return { wash: "from-sky-50 dark:from-sky-400/[0.06]", icon: "text-sky-400" };
};

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-slate-50 px-2 py-1.5 dark:bg-white/[0.04]">
      <span className="text-xl text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] text-slate-400 dark:text-slate-500">{label}</div>
        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{value}</div>
      </div>
    </div>
  );
}

export default function WidgetWeather() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locationLabel, setLocationLabel] = useState("Your Location");
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [hourly, setHourly] = useState<HourPoint[]>([]);
  const [meta, setMeta] = useState<{ humidity?: number; pop?: number }>({});

  const [now, setNow] = useState(() => new Date());

  // dropdown state (declared here so it never breaks hook order)
  const [daysOpen, setDaysOpen] = useState(false);


  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Serve from cache when fresh — instant, no network needed
    const cached = readWeatherCache();
    if (cached) {
      setLocationLabel(cached.locationLabel);
      setCurrent(cached.current);
      setForecast(cached.forecast);
      setHourly(cached.hourly);
      setMeta(cached.meta);
      setLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude, longitude } = coords;

          let label = "Your Location";
          try {
            const geoRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (geoRes.ok) {
              const geo = await geoRes.json();
              const city = geo?.city || geo?.locality;
              const region = geo?.principalSubdivision;
              if (city) label = region ? `${city}, ${region}` : city;
            }
          } catch {
            /* ignore */
          }

          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
              `&current_weather=true` +
              `&hourly=temperature_2m,weathercode,precipitation_probability,relativehumidity_2m` +
              `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
              `&timezone=auto`,
          );
          const data = await res.json();

          const cw: CurrentWeather = data?.current_weather ?? null;

          const todayStr = new Date().toISOString().split("T")[0];
          const days: ForecastDay[] = (data?.daily?.time || [])
            .map((date: string, idx: number) => ({ date, idx }))
            .filter((d: any) => d.date >= todayStr)
            .slice(0, 5)
            .map((d: any) => ({
              date: d.date,
              temperature_max: data.daily.temperature_2m_max[d.idx],
              temperature_min: data.daily.temperature_2m_min[d.idx],
              weathercode: data.daily.weathercode[d.idx],
            }));

          const times: string[] = data?.hourly?.time || [];
          const temps: number[] = data?.hourly?.temperature_2m || [];
          const codes: number[] = data?.hourly?.weathercode || [];
          const pops: number[] = data?.hourly?.precipitation_probability || [];
          const hums: number[] = data?.hourly?.relativehumidity_2m || [];

          const nowMs = Date.now();
          let startIdx = 0;
          for (let i = 0; i < times.length; i++) {
            if (new Date(times[i]).getTime() >= nowMs) {
              startIdx = i;
              break;
            }
          }

          const hrs: HourPoint[] = [];
          for (let i = startIdx; i < Math.min(startIdx + 6, times.length); i++) {
            hrs.push({
              time: times[i],
              temperature: temps[i],
              weathercode: codes[i],
              pop: pops?.[i],
            });
          }

          const metaObj = { pop: pops?.[startIdx], humidity: hums?.[startIdx] };

          // Persist to cache (5-hour TTL)
          writeWeatherCache({ locationLabel: label, current: cw, forecast: days, hourly: hrs, meta: metaObj });

          setLocationLabel(label);
          setCurrent(cw);
          setForecast(days);
          setHourly(hrs);
          setMeta(metaObj);
          setLoading(false);
        } catch (e) {
          console.error(e);
          setError("Failed to fetch weather");
          setLoading(false);
        }
      },
      () => {
        setError("Unable to retrieve location");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  // const viewMore = useMemo(
  //   () => (
  //     <div className="p-2 bg-white/30 dark:bg-black/30">
  //       <p className="text-xs text-center text-gray-900 dark:text-white">
  //         More weather{" "}
  //         <a href="/Weather" className="underline text-gray-900 dark:text-white">
  //           here
  //         </a>
  //       </p>
  //     </div>
  //   ),
  //   [],
  // );

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="p-5">
          {/* Location + time */}
          <div className="flex items-start justify-between mb-1">
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-3 w-14 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
            </div>
            <div className="h-3 w-16 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
          </div>

          {/* Temp + icon */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="space-y-2">
                <div className="h-10 w-20 rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
                <div className="h-2.5 w-16 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-20 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
          </div>

          {/* Mini stats */}
          <div className="mt-3 grid grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
            ))}
          </div>

          {/* Hourly bars */}
          <div className="mt-3 space-y-2">
            <div className="h-3.5 w-20 rounded-full bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex-1 h-[84px] rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          </div>

          {/* Spinner + label */}
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400 dark:text-white/50">
            <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-white/20 border-t-gray-500 dark:border-t-white/60 animate-spin" />
            <span className="text-xs font-medium">Detecting location…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !current) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="p-5 text-sm text-slate-400 text-center">{error || "No data"}</div>
        {/* {viewMore} */}
      </div>
    );
  }

  const { description, Icon } = getWeatherInfo(current.weathercode);
  const tone = toneFor(current.weathercode);

  const hi = forecast?.[0]?.temperature_max;
  const lo = forecast?.[0]?.temperature_min;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl overflow-hidden border border-slate-200/70 bg-white bg-gradient-to-b ${tone.wash} to-white to-60% shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.03] dark:to-transparent`}
    >
      <div className="p-4 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] font-semibold">{locationLabel}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
              {now.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/70 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10">{description}</div>
        </div>

        {/* Current */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`text-5xl ${tone.icon}`}>
              <Icon />
            </div>
            <div>
              <div className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
                {Math.round(cToF(current.temperature))}°
              </div>
              <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                H {hi != null ? `${Math.round(cToF(hi))}°` : "—"} • L{" "}
                {lo != null ? `${Math.round(cToF(lo))}°` : "—"}
              </div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 dark:text-slate-500">
            Wind {Math.round(current.windspeed)} km/h
          </div>
        </div>

        {/* Mini stats */}
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          <MiniStat
            icon={<WiRaindrops />}
            label="Precip"
            value={
              meta.pop != null && Number.isFinite(meta.pop)
                ? `${Math.round(meta.pop)}%`
                : "—"
            }
          />
          <MiniStat
            icon={<WiHumidity />}
            label="Humidity"
            value={
              meta.humidity != null && Number.isFinite(meta.humidity)
                ? `${Math.round(meta.humidity)}%`
                : "—"
            }
          />
          <MiniStat
            icon={<WiStrongWind />}
            label="Dir"
            value={`${Math.round(current.winddirection)}°`}
          />
        </div>

        {/* Hourly */}
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Next hours</div>
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {hourly.map((h) => {
              const { Icon: HIcon } = getWeatherInfo(h.weathercode);
              return (
                <div
                  key={h.time}
                  className="min-w-[52px] flex-1 rounded-xl px-1.5 py-2 text-center transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{fmtHour(h.time)}</div>
                  <div className="text-2xl my-1 text-slate-400 dark:text-slate-500">
                    <HIcon />
                  </div>
                  <div className="text-[13px] font-semibold tabular-nums">
                    {Math.round(cToF(h.temperature))}°
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-day dropdown */}
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setDaysOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            aria-expanded={daysOpen}
          >
            <div className="text-xs font-medium">5-day forecast</div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                daysOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {daysOpen && (
              <motion.div
                key="days"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 px-1.5 pb-1.5">
                  {forecast.map((d) => {
                    const { Icon: DIcon } = getWeatherInfo(d.weathercode);
                    return (
                      <div
                        key={d.date}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <div className="w-10 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {fmtDay(d.date)}
                        </div>
                        <div className="text-xl text-slate-400 dark:text-slate-500">
                          <DIcon />
                        </div>
                        <div className="text-[13px] font-semibold tabular-nums">
                          {Math.round(cToF(d.temperature_max))}°
                          <span className="text-slate-400 font-normal">
                            {" "}
                            / {Math.round(cToF(d.temperature_min))}°
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* {viewMore} */}
    </motion.div>
  );
}
