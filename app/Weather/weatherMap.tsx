// app/Weather/weatherMap.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* eslint-disable @next/next/no-img-element */

interface City {
  name: string;
  lat: number;
  lon: number;
}

interface SidebarData {
  name: string;
  weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
    time?: string;
  };
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    weathercode: number[];
    temperature_2m: number[];
  };
  lat: number;
  lon: number;
}

const initialCities: City[] = [
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", lat: 41.8781, lon: -87.6298 },
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
  { name: "Phoenix", lat: 33.4484, lon: -112.074 },
  { name: "Philadelphia", lat: 39.9526, lon: -75.1652 },
  { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "San Diego", lat: 32.7157, lon: -117.1611 },
  { name: "Dallas", lat: 32.7767, lon: -96.797 },
  { name: "San Jose", lat: 37.3382, lon: -121.8863 },
  { name: "Austin", lat: 30.2672, lon: -97.7431 },
  { name: "Jacksonville", lat: 30.3322, lon: -81.6557 },
  { name: "Fort Worth", lat: 32.7555, lon: -97.3308 },
  { name: "Columbus", lat: 39.9612, lon: -82.9988 },
  { name: "San Francisco", lat: 37.7749, lon: -122.4194 },
  { name: "Charlotte", lat: 35.2271, lon: -80.8431 },
  { name: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { name: "Seattle", lat: 47.6062, lon: -122.3321 },
  { name: "Denver", lat: 39.7392, lon: -104.9903 },
  { name: "Washington", lat: 38.9072, lon: -77.0369 },
  { name: "Boston", lat: 42.3601, lon: -71.0589 },
  { name: "El Paso", lat: 31.7619, lon: -106.485 },
  { name: "Detroit", lat: 42.3314, lon: -83.0458 },
  { name: "Nashville", lat: 36.1627, lon: -86.7816 },
  { name: "Portland", lat: 45.5122, lon: -122.6587 },
  { name: "Memphis", lat: 35.1495, lon: -90.049 },
  { name: "Oklahoma City", lat: 35.4676, lon: -97.5164 },
  { name: "Las Vegas", lat: 36.1699, lon: -115.1398 },
  { name: "Louisville", lat: 38.2527, lon: -85.7585 },
  { name: "Baltimore", lat: 39.2904, lon: -76.6122 },
];

const weatherDescriptions: Record<string, string> = {
  clear: "Clear Sky",
  partly: "Partly Cloudy",
  overcast: "Overcast",
  fog: "Foggy",
  drizzle: "Drizzle",
  rain: "Rain",
  snow: "Snow",
  thunder: "Thunderstorm",
};

const cardBgMapping: Record<string, string> = {
  clear: "from-yellow-200/80 to-orange-200/60",
  partly: "from-sky-200/80 to-indigo-200/50",
  overcast: "from-slate-300/80 to-slate-400/60",
  fog: "from-slate-200/80 to-slate-300/60",
  drizzle: "from-cyan-200/80 to-sky-300/60",
  rain: "from-sky-300/80 to-blue-400/60",
  snow: "from-slate-100/80 to-sky-200/60",
  thunder: "from-purple-400/80 to-slate-600/60",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ✅ Fix the “previous day” bug for YYYY-MM-DD date strings
function safeLocalDateFromYMD(ymd: string) {
  // lock to local midday so UTC conversion won’t shift to the previous day
  return new Date(`${ymd}T12:00:00`);
}

// ---- Open-Meteo protection: queue + retry + cache (fixes 429) ----
const OM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OM_MAX_CONCURRENCY = 2;

type OmCacheEntry = { ts: number; data: any };

function omCacheKey(lat: number, lon: number) {
  return `om:${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readOmCache(lat: number, lon: number): any | null {
  try {
    const raw = localStorage.getItem(omCacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OmCacheEntry;
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > OM_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeOmCache(lat: number, lon: number, data: any) {
  try {
    const entry: OmCacheEntry = { ts: Date.now(), data };
    localStorage.setItem(omCacheKey(lat, lon), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Simple queue with max concurrency
function createFetchQueue(max: number) {
  let active = 0;
  const q: Array<() => void> = [];

  const runNext = () => {
    if (active >= max) return;
    const job = q.shift();
    if (!job) return;
    active++;
    job();
  };

  return async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      q.push(async () => {
        try {
          const out = await fn();
          resolve(out);
        } catch (e) {
          reject(e);
        } finally {
          active--;
          runNext();
        }
      });
      runNext();
    });
  };
}

/** ✅ Props so `<WeatherMap onClose={...} />` works */
type WeatherMapProps = {
  onClose: () => void;
};

const WeatherMap: React.FC<WeatherMapProps> = ({ onClose }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const loadedCityNamesRef = useRef<Set<string>>(new Set());

  const [currentUnit, setCurrentUnit] = useState<"C" | "F">("C");
  const [sidebarData, setSidebarData] = useState<SidebarData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [baseLayer, setBaseLayer] = useState<"light" | "dark">("light");
  const omQueueRef = useRef<ReturnType<typeof createFetchQueue> | null>(null);

  const filters = useMemo(
    () => ["all", "clear", "partly", "overcast", "fog", "drizzle", "rain", "snow", "thunder"],
    []
  );

  const convertTemp = (tempC: number): string =>
    currentUnit === "C" ? tempC.toFixed(1) : ((tempC * 9) / 5 + 32).toFixed(1);

  const mapWeatherCodeToCondition = (code: number): string => {
    if (code === 0) return "clear";
    if (code >= 1 && code <= 2) return "partly";
    if (code === 3) return "overcast";
    if ([45, 48].includes(code)) return "fog";
    if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([95, 96, 99].includes(code)) return "thunder";
    return "clear";
  };

  const iconSvg = (condition: string, tempLabel: string) => {
    const emoji =
      condition === "clear"
        ? "☀️"
        : condition === "partly"
        ? "⛅"
        : condition === "overcast"
        ? "☁️"
        : condition === "fog"
        ? "🌫️"
        : condition === "drizzle"
        ? "🌦️"
        : condition === "rain"
        ? "🌧️"
        : condition === "snow"
        ? "❄️"
        : condition === "thunder"
        ? "⛈️"
        : "☀️";

    return `
      <div class="wm-pin">
        <div class="wm-pin-emoji">${emoji}</div>
        <div class="wm-pin-temp">${tempLabel}°</div>
      </div>
    `;
  };

  const buildPopupHtml = (name: string, weather: SidebarData["weather"]) => {
    const cond = mapWeatherCodeToCondition(weather.weathercode);
    const t = convertTemp(weather.temperature);
    return `
      <div class="wm-popup">
        <div class="wm-popup-title">${name}</div>
        <div class="wm-popup-row">
          <span class="wm-pill">${weatherDescriptions[cond] ?? "Weather"}</span>
          <span class="wm-pill">${t}°${currentUnit}</span>
          <span class="wm-pill">💨 ${weather.windspeed} km/h</span>
        </div>
        <div class="wm-popup-sub">Tap marker for full forecast</div>
      </div>
    `;
  };

  const updateAllMarkerPopups = () => {
    markersRef.current.forEach((m: any) => {
      const payload = m.__wm_payload as SidebarData | undefined;
      if (!payload) return;

      const cond = mapWeatherCodeToCondition(payload.weather.weathercode);
      const tempLabel = convertTemp(payload.weather.temperature);
      const customIcon = L.divIcon({
        html: iconSvg(cond, tempLabel),
        className: "wm-icon",
        iconSize: [52, 52],
        iconAnchor: [26, 44],
        popupAnchor: [0, -38],
      });
      m.setIcon(customIcon);
      m.setPopupContent(buildPopupHtml(payload.name, payload.weather));
    });
  };

  const addCityMarker = async (name: string, lat: number, lon: number, autoOpen = false) => {
    if (!mapRef.current) return;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
      `&hourly=temperature_2m,weathercode` +
      `&forecast_days=7&timezone=auto`;

    try {
      // ✅ 1) cache first
      const cached = typeof window !== "undefined" ? readOmCache(lat, lon) : null;
      let data = cached;

      if (!data) {
        const run = async () => {
          let attempt = 0;
          while (true) {
            const res = await fetch(url);

            if (res.ok) {
              const json = await res.json();
              if (typeof window !== "undefined") writeOmCache(lat, lon, json);
              return json;
            }

            if (res.status === 429 && attempt < 4) {
              attempt++;
              const wait = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
              await sleep(wait);
              continue;
            }

            throw new Error(`Open-Meteo ${res.status}`);
          }
        };

        if (!omQueueRef.current) omQueueRef.current = createFetchQueue(OM_MAX_CONCURRENCY);
        data = await omQueueRef.current(run);
      }

      const weather = data.current_weather;
      const daily = data.daily;
      const hourly = data.hourly;

      const condition = mapWeatherCodeToCondition(weather.weathercode);
      const tempLabel = convertTemp(weather.temperature);

      const customIcon = L.divIcon({
        html: iconSvg(condition, tempLabel),
        className: "wm-icon",
        iconSize: [52, 52],
        iconAnchor: [26, 44],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(mapRef.current);

      const payload: SidebarData = { name, weather, daily, hourly, lat, lon };

      (marker as any).__wm_condition = condition;
      (marker as any).__wm_cityName = name;
      (marker as any).__wm_payload = payload;

      marker.bindPopup(buildPopupHtml(name, weather), { closeButton: true });
      marker.on("click", () => setSidebarData(payload));

      markersRef.current.push(marker);

      if (activeFilter !== "all" && condition !== activeFilter) {
        mapRef.current.removeLayer(marker);
      }

      if (autoOpen) {
        marker.openPopup();
        marker.fire("click");
      }
    } catch (err: any) {
      console.error(`Error fetching weather for ${name}:`, err);
      setToast(`Weather failed for ${name}`);
      setTimeout(() => setToast(null), 2200);
    }
  };

  const filterMarkers = (condition: string) => {
    setActiveFilter(condition);
    if (!mapRef.current) return;

    markersRef.current.forEach((marker: any) => {
      const cond = marker.__wm_condition;
      const shouldShow = condition === "all" || cond === condition;

      const has = mapRef.current!.hasLayer(marker);
      if (shouldShow && !has) marker.addTo(mapRef.current!);
      if (!shouldShow && has) mapRef.current!.removeLayer(marker);
    });
  };

  const setTiles = (mode: "light" | "dark") => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer: any) => {
      if (layer && typeof layer.setUrl === "function") {
        mapRef.current?.removeLayer(layer);
      }
    });

    const url =
      mode === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attr =
      mode === "dark"
        ? "&copy; OpenStreetMap contributors &copy; CARTO"
        : "&copy; OpenStreetMap contributors";

    L.tileLayer(url, {
      maxZoom: 19,
      noWrap: true,
      attribution: attr,
    }).addTo(mapRef.current);

    setBaseLayer(mode);
  };

  const loadMoreCities = async () => {
    if (!mapRef.current) return;

    const bounds = mapRef.current.getBounds();
    const viewbox = [bounds.getWest(), bounds.getNorth(), bounds.getEast(), bounds.getSouth()].join(",");

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=12&bounded=1&viewbox=${viewbox}&q=city`;

    setToast("Loading more cities…");
    setTimeout(() => setToast(null), 1200);

    try {
      const res = await fetch(nominatimUrl);
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();

      for (const result of data) {
        if (result.class === "place" && ["city", "town", "village"].includes(result.type)) {
          const cityName = String(result.display_name || "").split(",")[0];
          if (!cityName) continue;

          const key = cityName.toLowerCase();
          if (loadedCityNamesRef.current.has(key)) continue;

          loadedCityNamesRef.current.add(key);
          await addCityMarker(cityName, parseFloat(result.lat), parseFloat(result.lon));
        }
      }
    } catch (err) {
      console.error("Error loading more cities:", err);
      setToast("Load more failed");
      setTimeout(() => setToast(null), 2000);
    }
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearchLoading(true);

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;

    try {
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const result = data[0];
        const cityName = String(result.display_name || "").split(",")[0] || q;
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        mapRef.current?.setView([lat, lon], clamp(8, 4, 12));

        const key = cityName.toLowerCase();
        if (!loadedCityNamesRef.current.has(key)) {
          loadedCityNamesRef.current.add(key);
          await addCityMarker(cityName, lat, lon, true);
        } else {
          const marker: any = markersRef.current.find((m: any) => m.__wm_cityName?.toLowerCase() === key);
          if (marker) {
            marker.openPopup();
            marker.fire("click");
          } else {
            await addCityMarker(cityName, lat, lon, true);
          }
        }
      } else {
        setToast("No results");
        setTimeout(() => setToast(null), 1600);
      }
    } catch (err) {
      console.error("Search error:", err);
      setToast("Search failed");
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setToast("Geolocation not available");
      setTimeout(() => setToast(null), 1600);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        mapRef.current?.setView([lat, lon], 9);

        const name = "My Location";
        const key = name.toLowerCase();

        if (!loadedCityNamesRef.current.has(key)) {
          loadedCityNamesRef.current.add(key);
          await addCityMarker(name, lat, lon, true);
        } else {
          setToast("Already pinned");
          setTimeout(() => setToast(null), 1200);
        }
      },
      () => {
        setToast("Location denied");
        setTimeout(() => setToast(null), 1600);
      },
      { enableHighAccuracy: false, timeout: 7000 }
    );
  };

  const toggleTemp = () => setCurrentUnit((prev) => (prev === "C" ? "F" : "C"));

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      maxBounds: L.latLngBounds([-85, -180], [85, 180]),
      maxBoundsViscosity: 1.0,
      zoomControl: false,
    }).setView([39.8283, -98.5795], 4);

    if (!omQueueRef.current) omQueueRef.current = createFetchQueue(OM_MAX_CONCURRENCY);

    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      noWrap: true,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapRef.current);

    initialCities.forEach((city) => {
      loadedCityNamesRef.current.add(city.name.toLowerCase());
      addCityMarker(city.name, city.lat, city.lon);
    });
  }, []);

  // ESC closes the whole map modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    updateAllMarkerPopups();
  }, [currentUnit]);

  useEffect(() => {
    filterMarkers(activeFilter);
  }, [activeFilter]);

  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const closeSidebar = () => setSidebarData(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {/* ✅ click backdrop closes map */}
      <button
        type="button"
        aria-label="Close map"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div className="relative h-[92vh] w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        {/* styles */}
        <style>{`
          .wm-topbar {
            backdrop-filter: blur(12px);
            background: linear-gradient(135deg, rgba(15,23,42,.72), rgba(30,41,59,.55));
            border-bottom: 1px solid rgba(255,255,255,.08);
          }

          .wm-icon { background: transparent; border: none; }
          .wm-pin {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.86);
            border: 1px solid rgba(255,255,255,.14);
            box-shadow: 0 10px 24px rgba(0,0,0,.35);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transform: translateY(-2px);
          }
          .wm-pin-emoji { font-size: 18px; line-height: 18px; margin-bottom: 4px; }
          .wm-pin-temp {
            font-size: 11px;
            font-weight: 800;
            color: rgba(255,255,255,.92);
            letter-spacing: .2px;
          }

          .wm-popup { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI; }
          .wm-popup-title { font-weight: 900; font-size: 14px; margin-bottom: 6px; color: #0f172a; }
          .wm-popup-row { display: flex; gap: 6px; flex-wrap: wrap; }
          .wm-pill {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(15,23,42,.08);
            color: rgba(15,23,42,.85);
          }
          .wm-popup-sub { margin-top: 6px; font-size: 11px; color: rgba(15,23,42,.65); }

          .leaflet-popup-content-wrapper { border-radius: 14px; }
          .leaflet-popup-content { margin: 12px 14px; }

          .wm-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
          .wm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 999px; }
          .wm-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.06); border-radius: 999px; }
        `}</style>

        {/* Top bar */}
        <div className="wm-topbar absolute left-0 top-0 z-[3000] flex w-full flex-wrap items-center gap-2 px-3 py-2">
          <div className="mr-1 flex items-center gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
              Weather Map
            </div>

            {/* ✅ visible close button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/15 px-3 py-1 text-xs font-black text-white hover:bg-white/25"
              title="Close map"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => setTiles(baseLayer === "light" ? "dark" : "light")}
              className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/15"
              title="Toggle map style"
            >
              {baseLayer === "light" ? "Dark map" : "Light map"}
            </button>

            <button
              type="button"
              onClick={handleLocateMe}
              className="rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/15"
              title="Jump to your location"
            >
              Locate me
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search a place…"
                className="w-[210px] rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white placeholder:text-white/60 outline-none focus:bg-white/15"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-2 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            >
              {searchLoading ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadMoreCities}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
            >
              Load more
            </button>

            <button
              type="button"
              onClick={toggleTemp}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-extrabold text-white hover:bg-white/15"
              title="Toggle °C/°F"
            >
              °{currentUnit}
            </button>

            <div className="hidden items-center gap-1 sm:flex">
              {filters.map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => filterMarkers(cond)}
                  className={`rounded-full px-3 py-2 text-xs font-extrabold transition ${
                    activeFilter === cond
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  {cond === "all" ? "All" : cond}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainerRef} className="absolute left-0 right-0 top-12 bottom-0" />

        {/* Small-screen filters row */}
        <div className="absolute left-0 right-0 top-12 z-[2500] block bg-transparent px-3 pt-2 sm:hidden">
          <div className="wm-scroll flex gap-2 overflow-x-auto pb-2">
            {filters.map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => filterMarkers(cond)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${
                  activeFilter === cond
                    ? "bg-slate-900 text-white"
                    : "bg-white/90 text-slate-900"
                }`}
              >
                {cond === "all" ? "All" : cond}
              </button>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-[4000] -translate-x-1/2 rounded-2xl bg-slate-900/90 px-4 py-2 text-xs font-bold text-white shadow-xl">
            {toast}
          </div>
        )}

        {/* Forecast panel (desktop drawer / mobile sheet) */}
        {sidebarData && (
          <>
            <div
              className="absolute inset-0 z-[3400] bg-black/40"
              onClick={closeSidebar}
            />

            <div className="absolute z-[3500] w-full sm:w-[420px] sm:right-3 sm:top-16 sm:bottom-3 bottom-0 left-0 sm:left-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-white">{sidebarData.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                      {weatherDescriptions[mapWeatherCodeToCondition(sidebarData.weather.weathercode)] || "Weather"}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                      {convertTemp(sidebarData.weather.temperature)}°{currentUnit}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white">
                      💨 {sidebarData.weather.windspeed} km/h
                    </span>
                  </div>
                </div>

                <button
                  onClick={closeSidebar}
                  className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white hover:bg-white/15"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-white/90">
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">Coordinates</div>
                  <div className="font-bold">
                    {sidebarData.lat.toFixed(2)}, {sidebarData.lon.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-white/60">Sun</div>
                  <div className="font-bold">
                    {sidebarData.daily?.sunrise?.[0] ? `↑ ${formatTime(sidebarData.daily.sunrise[0])}` : "—"}{" "}
                    {sidebarData.daily?.sunset?.[0] ? `↓ ${formatTime(sidebarData.daily.sunset[0])}` : ""}
                  </div>
                </div>
              </div>

              {/* 7-day forecast */}
              <div className="mt-4">
                <div className="mb-2 text-sm font-extrabold text-white">7-Day Forecast</div>
                <div className="wm-scroll flex gap-2 overflow-x-auto pb-2">
                  {sidebarData.daily.time.map((t, i) => {
                    const cond = mapWeatherCodeToCondition(sidebarData.daily.weathercode[i]);
                    const bg = cardBgMapping[cond] || "from-white/10 to-white/5";
                    const min = sidebarData.daily.temperature_2m_min[i];
                    const max = sidebarData.daily.temperature_2m_max[i];

                    const dateObj = safeLocalDateFromYMD(t);
                    const day = dateObj.toLocaleDateString(undefined, { weekday: "short" });
                    const md = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });

                    return (
                      <div
                        key={`${t}-${i}`}
                        className={`min-w-[128px] rounded-2xl bg-gradient-to-br ${bg} p-3 text-white shadow`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black">{day}</div>
                          <div className="text-[11px] font-bold text-white/80">{md}</div>
                        </div>
                        <div className="mt-2 text-2xl">
                          {cond === "clear"
                            ? "☀️"
                            : cond === "partly"
                            ? "⛅"
                            : cond === "overcast"
                            ? "☁️"
                            : cond === "fog"
                            ? "🌫️"
                            : cond === "drizzle"
                            ? "🌦️"
                            : cond === "rain"
                            ? "🌧️"
                            : cond === "snow"
                            ? "❄️"
                            : "⛈️"}
                        </div>
                        <div className="mt-2 text-xs font-bold">
                          {convertTemp(min)}° → {convertTemp(max)}°
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-white/80">
                          {weatherDescriptions[cond] ?? "Weather"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Next 24 hours */}
              <div className="mt-4">
                <div className="mb-2 text-sm font-extrabold text-white">Next 24 Hours</div>
                <div className="wm-scroll flex gap-2 overflow-x-auto pb-2">
                  {sidebarData.hourly.time.map((time, i) => {
                    const hourTime = new Date(time);
                    const now = new Date();
                    const diffHours = (hourTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                    if (diffHours < 0 || diffHours > 24) return null;

                    const cond = mapWeatherCodeToCondition(sidebarData.hourly.weathercode[i]);
                    const bg = cardBgMapping[cond] || "from-white/10 to-white/5";
                    const temp = sidebarData.hourly.temperature_2m[i];
                    const hourLabel = hourTime.toLocaleTimeString([], { hour: "numeric" });

                    return (
                      <div
                        key={`${time}-${i}`}
                        className={`min-w-[104px] rounded-2xl bg-gradient-to-br ${bg} p-3 text-white shadow`}
                      >
                        <div className="text-xs font-black">{hourLabel}</div>
                        <div className="mt-2 text-2xl">
                          {cond === "clear"
                            ? "☀️"
                            : cond === "partly"
                            ? "⛅"
                            : cond === "overcast"
                            ? "☁️"
                            : cond === "fog"
                            ? "🌫️"
                            : cond === "drizzle"
                            ? "🌦️"
                            : cond === "rain"
                            ? "🌧️"
                            : cond === "snow"
                            ? "❄️"
                            : "⛈️"}
                        </div>
                        <div className="mt-2 text-xs font-bold">{convertTemp(temp)}°</div>
                        <div className="mt-1 text-[11px] font-semibold text-white/80">
                          {weatherDescriptions[cond] ?? "Weather"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={closeSidebar}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-sm font-extrabold text-white hover:opacity-95"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WeatherMap;
