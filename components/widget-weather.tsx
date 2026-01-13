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

const bgFor = (code: number) => {
  if (code === 0) return "bg-gradient-to-br from-sky-500 to-amber-300";
  if ([1, 2, 3].includes(code))
    return "bg-gradient-to-br from-slate-600 to-sky-400";
  if ([45, 48].includes(code))
    return "bg-gradient-to-br from-gray-600 to-slate-400";
  if ([51, 53, 55].includes(code))
    return "bg-gradient-to-br from-sky-700 to-blue-400";
  if ([61, 63, 65, 80, 81, 82, 66, 67].includes(code))
    return "bg-gradient-to-br from-blue-900 to-sky-500";
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return "bg-gradient-to-br from-indigo-900 to-sky-300";
  if ([95, 96, 99].includes(code))
    return "bg-gradient-to-br from-purple-900 to-slate-700";
  return "bg-gradient-to-br from-slate-700 to-slate-500";
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
    <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-white backdrop-blur">
      <span className="text-2xl">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] opacity-80">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
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
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude, longitude } = coords;

          // nice label (optional)
          try {
            const geo = await fetch(
              `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`,
            ).then((r) => r.json());
            const place = geo?.results?.[0];
            if (place?.name) {
              const region = place?.admin1 ? `, ${place.admin1}` : "";
              setLocationLabel(`${place.name}${region}`);
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

          const cw: CurrentWeather | null = data?.current_weather ?? null;
          setCurrent(cw);

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
          setForecast(days);

          // next 6 hours
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
          setHourly(hrs);

          setMeta({
            pop: pops?.[startIdx],
            humidity: hums?.[startIdx],
          });

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

  const viewMore = useMemo(
    () => (
      <div className="p-2 bg-white/30 dark:bg-black/30">
        <p className="text-xs text-center text-gray-900 dark:text-white">
          More weather{" "}
          <a href="/Weather" className="underline text-gray-900 dark:text-white">
            here
          </a>
        </p>
      </div>
    ),
    [],
  );

  if (loading) {
    return (
      <div className="max-w-md mx-auto rounded-2xl overflow-hidden bg-white shadow-lg dark:bg-brand-900">
        <div className="p-5 text-white/70">Loading weather…</div>
        {viewMore}
      </div>
    );
  }

  if (error || !current) {
    return (
      <div className="max-w-md mx-auto rounded-2xl overflow-hidden bg-white shadow-lg dark:bg-brand-900">
        <div className="p-5 text-red-300 text-center">{error || "No data"}</div>
        {viewMore}
      </div>
    );
  }

  const { description, Icon } = getWeatherInfo(current.weathercode);
  const bg = bgFor(current.weathercode);

  const hi = forecast?.[0]?.temperature_max;
  const lo = forecast?.[0]?.temperature_min;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`max-w-md mx-auto rounded-2xl overflow-hidden shadow-lg ${bg}`}
    >
      <div className="p-5 text-white">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold">{locationLabel}</div>
            <div className="text-xs opacity-80">
              {now.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="text-right text-xs opacity-85">{description}</div>
        </div>

        {/* Current */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-5xl drop-shadow">
              <Icon />
            </div>
            <div>
              <div className="text-4xl font-extrabold leading-none">
                {Math.round(cToF(current.temperature))}°
              </div>
              <div className="text-xs opacity-85">
                H {hi != null ? `${Math.round(cToF(hi))}°` : "—"} • L{" "}
                {lo != null ? `${Math.round(cToF(lo))}°` : "—"}
              </div>
            </div>
          </div>

          <div className="text-right text-xs opacity-85">
            Wind {Math.round(current.windspeed)} km/h
          </div>
        </div>

        {/* Mini stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
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
          <div className="text-sm font-semibold mb-2">Next hours</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {hourly.map((h) => {
              const { Icon: HIcon } = getWeatherInfo(h.weathercode);
              return (
                <div
                  key={h.time}
                  className="min-w-[64px] rounded-xl bg-white/15 backdrop-blur px-2 py-2 text-center"
                >
                  <div className="text-[10px] opacity-80">{fmtHour(h.time)}</div>
                  <div className="text-2xl my-1">
                    <HIcon />
                  </div>
                  <div className="text-sm font-semibold">
                    {Math.round(cToF(h.temperature))}°
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-day dropdown */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
          <button
            type="button"
            onClick={() => setDaysOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2"
            aria-expanded={daysOpen}
          >
            <div className="text-sm font-semibold">Next 5 days</div>
            <ChevronDown
              className={`h-4 w-4 opacity-90 transition-transform ${
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
                <div className="space-y-2 px-3 pb-3">
                  {forecast.map((d) => {
                    const { Icon: DIcon } = getWeatherInfo(d.weathercode);
                    return (
                      <div
                        key={d.date}
                        className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2"
                      >
                        <div className="w-10 text-sm font-semibold">
                          {fmtDay(d.date)}
                        </div>
                        <div className="text-2xl opacity-95">
                          <DIcon />
                        </div>
                        <div className="text-sm font-semibold">
                          {Math.round(cToF(d.temperature_max))}°
                          <span className="opacity-70 font-normal">
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

      {viewMore}
    </motion.div>
  );
}
