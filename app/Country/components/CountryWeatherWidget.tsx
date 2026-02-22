/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
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
import type { FullCountry, Extras } from "../lib/types";
import { cn, cToF } from "../lib/utils";

/* ── Types ──────────────────────────────────────────────────────────── */
interface ForecastDay {
  date: string;
  max: number;
  min: number;
  code: number;
}

interface ExtendedData {
  feelsLike: number | null;
  humidity: number | null;
  precip: number | null;
  forecast: ForecastDay[];
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmtDay = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });

type Scheme = "sunny" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

function weatherMeta(code: number): {
  label: string;
  Icon: React.ElementType;
  scheme: Scheme;
} {
  if (code === 0) return { label: "Clear skies", Icon: WiDaySunny, scheme: "sunny" };
  if ([1, 2, 3].includes(code)) return { label: "Partly cloudy", Icon: WiCloud, scheme: "cloudy" };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: WiFog, scheme: "fog" };
  if ([51, 53, 55].includes(code)) return { label: "Drizzle", Icon: WiSprinkle, scheme: "drizzle" };
  if ([61, 63, 65, 80, 81, 82, 66, 67].includes(code))
    return { label: "Rainy", Icon: WiRain, scheme: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Snowy", Icon: WiSnow, scheme: "snow" };
  if ([95, 96, 99].includes(code))
    return { label: "Thunderstorm", Icon: WiThunderstorm, scheme: "storm" };
  return { label: "Overcast", Icon: WiCloud, scheme: "cloudy" };
}

/* ── Color schemes ───────────────────────────────────────────────────── */
const SCHEMES: Record<
  Scheme,
  { bar: string; tint: string; badge: string; icon: string; temp: string }
> = {
  sunny: {
    bar:   "bg-gradient-to-r from-amber-400 to-orange-400",
    tint:  "from-amber-50/70 dark:from-amber-900/20",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon:  "text-amber-500 dark:text-amber-400",
    temp:  "text-amber-600 dark:text-amber-300",
  },
  cloudy: {
    bar:   "bg-gradient-to-r from-slate-400 to-gray-400",
    tint:  "from-slate-50/70 dark:from-slate-800/25",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    icon:  "text-slate-500 dark:text-slate-400",
    temp:  "text-slate-700 dark:text-slate-200",
  },
  fog: {
    bar:   "bg-gradient-to-r from-gray-400 to-slate-400",
    tint:  "from-gray-50/70 dark:from-gray-800/25",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
    icon:  "text-gray-500 dark:text-gray-400",
    temp:  "text-gray-700 dark:text-gray-200",
  },
  drizzle: {
    bar:   "bg-gradient-to-r from-sky-400 to-cyan-400",
    tint:  "from-sky-50/70 dark:from-sky-900/20",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    icon:  "text-sky-500 dark:text-sky-400",
    temp:  "text-sky-700 dark:text-sky-300",
  },
  rain: {
    bar:   "bg-gradient-to-r from-blue-500 to-indigo-500",
    tint:  "from-blue-50/70 dark:from-blue-900/20",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    icon:  "text-blue-500 dark:text-blue-400",
    temp:  "text-blue-700 dark:text-blue-300",
  },
  snow: {
    bar:   "bg-gradient-to-r from-indigo-400 to-sky-400",
    tint:  "from-indigo-50/70 dark:from-indigo-900/20",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    icon:  "text-indigo-500 dark:text-indigo-400",
    temp:  "text-indigo-700 dark:text-indigo-300",
  },
  storm: {
    bar:   "bg-gradient-to-r from-purple-600 to-violet-600",
    tint:  "from-purple-50/70 dark:from-purple-900/20",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    icon:  "text-purple-500 dark:text-purple-400",
    temp:  "text-purple-700 dark:text-purple-300",
  },
};

/* ── Sub-components ──────────────────────────────────────────────────── */
function StatPill({
  icon,
  label,
  value,
  badgeCls,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badgeCls: string;
  loading?: boolean;
}) {
  return (
    <div className={cn("rounded-xl px-2 py-2.5 flex flex-col items-center gap-1", badgeCls)}>
      <span className="text-[22px] leading-none">{icon}</span>
      <span className="text-[11px] font-bold leading-tight">
        {loading ? <span className="animate-pulse">…</span> : value}
      </span>
      <span className="text-[9px] uppercase tracking-wide opacity-60 font-semibold">{label}</span>
    </div>
  );
}

function SkeletonPulse({ className }: { className: string }) {
  return <div className={cn("rounded-lg bg-gray-200 dark:bg-white/10 animate-pulse", className)} />;
}

/* ── Props ───────────────────────────────────────────────────────────── */
interface CountryWeatherWidgetProps {
  full: FullCountry | null;
  extras: Extras | null;
  loadingDetails: boolean;
  useCelsius: boolean;
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function CountryWeatherWidget({
  full,
  extras,
  loadingDetails,
  useCelsius,
}: CountryWeatherWidgetProps) {
  const [extended, setExtended] = useState<ExtendedData | null>(null);
  const [fetchingExt, setFetchingExt] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /* Fetch feels-like, humidity, precip + 5-day forecast */
  useEffect(() => {
    abortRef.current?.abort();
    setExtended(null);
    if (!full?.latlng) return;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFetchingExt(true);

    const [lat, lng] = full.latlng;
    (async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${lat}&longitude=${lng}` +
            `&hourly=apparent_temperature,relativehumidity_2m,precipitation_probability` +
            `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
            `&timezone=auto&forecast_days=5`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        if (ctrl.signal.aborted) return;

        /* Find current hour index */
        const nowMs = Date.now();
        const times: string[] = data?.hourly?.time ?? [];
        let hi = 0;
        for (let i = 0; i < times.length; i++) {
          if (new Date(times[i]).getTime() >= nowMs) {
            hi = i;
            break;
          }
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const forecast: ForecastDay[] = (data?.daily?.time ?? [])
          .map((date: string, idx: number) => ({
            date,
            max: data.daily.temperature_2m_max[idx],
            min: data.daily.temperature_2m_min[idx],
            code: data.daily.weathercode[idx],
          }))
          .filter((d: ForecastDay) => d.date >= todayStr)
          .slice(0, 5);

        setExtended({
          feelsLike: data?.hourly?.apparent_temperature?.[hi] ?? null,
          humidity: data?.hourly?.relativehumidity_2m?.[hi] ?? null,
          precip: data?.hourly?.precipitation_probability?.[hi] ?? null,
          forecast,
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("CountryWeatherWidget fetch error:", e);
      } finally {
        if (!ctrl.signal.aborted) setFetchingExt(false);
      }
    })();

    return () => ctrl.abort();
  }, [full?.cca3]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Empty state ── */
  if (!full && !loadingDetails) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-6 flex flex-col items-center justify-center gap-2.5 text-center">
        <WiDaySunny className="text-5xl text-gray-200 dark:text-white/15" />
        <p className="text-xs text-gray-400 dark:text-white/35 font-medium">
          Select a country to see its weather
        </p>
      </div>
    );
  }

  /* ── Loading skeleton ── */
  if (loadingDetails && !full) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] overflow-hidden">
        <div className="h-1 w-full bg-gray-200 dark:bg-white/10 animate-pulse" />
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SkeletonPulse className="h-4 w-32" />
            <SkeletonPulse className="h-5 w-12" />
          </div>
          <div className="flex items-center gap-4">
            <SkeletonPulse className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <SkeletonPulse className="h-9 w-24" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <SkeletonPulse key={i} className="h-14" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!full) return null;

  const weather = extras?.weather;

  /* Weather data isn't ready yet */
  if (!weather) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-4 flex items-center gap-3">
        <div className="h-4 w-4 rounded-full border-2 border-indigo-400/40 border-t-indigo-500 animate-spin flex-shrink-0" />
        <span className="text-xs text-gray-400 dark:text-white/40">Loading weather…</span>
      </div>
    );
  }

  const { label, Icon, scheme } = weatherMeta(weather.weathercode ?? 0);
  const s = SCHEMES[scheme];
  const tempC = Math.round(weather.temperature);
  const temp = useCelsius ? tempC : cToF(tempC);
  const feelsLikeC = extended?.feelsLike != null ? Math.round(extended.feelsLike) : null;
  const feelsLike = feelsLikeC != null ? (useCelsius ? feelsLikeC : cToF(feelsLikeC)) : null;
  const unit = useCelsius ? "°C" : "°F";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={full.cca3}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className={cn(
          "rounded-2xl overflow-hidden",
          "border border-black/10 dark:border-white/10",
          "bg-gradient-to-b to-white dark:to-brand-900/80 shadow-sm",
          s.tint,
        )}
      >
        {/* ── Accent top bar ── */}
        <div className={cn("h-1.5 w-full", s.bar)} />

        <div className="p-4 sm:p-5 space-y-4">
          {/* ── Header: flag + country + LIVE badge ── */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {full.flags?.png && (
                <img
                  src={full.flags.png}
                  alt=""
                  className="w-7 h-[18px] object-cover rounded shadow-sm flex-shrink-0 ring-1 ring-black/10"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate leading-tight">
                  {full.name.common}
                </div>
                {full.capital?.[0] && (
                  <div className="text-[10px] text-gray-400 dark:text-white/40 truncate leading-tight">
                    {full.capital[0]}
                  </div>
                )}
              </div>
            </div>
            <span
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5",
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                s.badge,
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              LIVE
            </span>
          </div>

          {/* ── Hero: big icon + temperature + condition ── */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={cn("text-[80px] sm:text-[88px] leading-none flex-shrink-0 -ml-2 -mb-1", s.icon)}>
              <Icon />
            </div>
            <div className="min-w-0">
              <div className={cn("flex items-start leading-none", s.temp)}>
                <span className="text-5xl sm:text-6xl font-black tracking-tight">{temp}</span>
                <span className="text-xl font-bold mt-1 ml-0.5 opacity-70">{unit}</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 dark:text-white/80 mt-1">
                {label}
              </div>
              <div className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                {feelsLike != null
                  ? `Feels like ${feelsLike}${unit}`
                  : fetchingExt
                    ? "Fetching details…"
                    : null}
              </div>
            </div>
          </div>

          {/* ── Stats: wind · humidity · precip ── */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <StatPill
              icon={<WiStrongWind />}
              label="Wind"
              value={weather.windspeed != null ? `${Math.round(weather.windspeed)} km/h` : "—"}
              badgeCls={s.badge}
            />
            <StatPill
              icon={<WiHumidity />}
              label="Humidity"
              value={extended?.humidity != null ? `${Math.round(extended.humidity)}%` : "—"}
              badgeCls={s.badge}
              loading={fetchingExt && !extended}
            />
            <StatPill
              icon={<WiRaindrops />}
              label="Precip"
              value={extended?.precip != null ? `${Math.round(extended.precip)}%` : "—"}
              badgeCls={s.badge}
              loading={fetchingExt && !extended}
            />
          </div>

          {/* ── 5-day forecast ── */}
          {extended?.forecast && extended.forecast.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/40">
                  5-Day Forecast
                </div>
                <div className="flex-1 h-px bg-black/5 dark:bg-white/[0.07]" />
              </div>
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                {extended.forecast.map((d) => {
                  const { Icon: DIcon, scheme: dScheme } = weatherMeta(d.code);
                  const ds = SCHEMES[dScheme];
                  return (
                    <div
                      key={d.date}
                      className="flex flex-col items-center gap-0.5 rounded-xl bg-white/60 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] py-2 px-1"
                    >
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-white/50">
                        {fmtDay(d.date)}
                      </span>
                      <span className={cn("text-2xl leading-tight", ds.icon)}>
                        <DIcon />
                      </span>
                      <span className="text-[11px] font-bold text-gray-800 dark:text-white/90">
                        {useCelsius ? Math.round(d.max) : cToF(Math.round(d.max))}°
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-white/40">
                        {useCelsius ? Math.round(d.min) : cToF(Math.round(d.min))}°
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : fetchingExt ? (
            /* Skeleton for forecast while fetching */
            <div className="space-y-2">
              <SkeletonPulse className="h-3 w-28" />
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <SkeletonPulse key={i} className="h-[72px]" />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
