/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L, { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import leafletTerminator from "leaflet-terminator";
import { motion } from "framer-motion";
import { Crosshair, ExternalLink, Gauge, Globe2, MapPin, Moon, Mountain, Orbit, Rocket, Satellite, Sun, Timer, Users } from "lucide-react";

import { DashboardShell, type DashboardTab } from "@/components/ui/dashboard-shell";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/segmented";
import { IconBadge } from "@/components/ui/icon-badge";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const ISS_API = "https://api.wheretheiss.at/v1/satellites/25544";
const CREW_API = "https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=100";
const ORBIT_MINUTES = 92.68;
const TRAIL = "#818cf8", FUTURE = "#34d399";

const FLAG_MAP: Record<string, string> = { USA: "us", RUS: "ru", CHN: "cn", JPN: "jp", CAN: "ca", FRA: "fr", GBR: "gb", IND: "in", ITA: "it", DEU: "de", ARE: "ae", DNK: "dk", ESP: "es", SWE: "se" };
const flagUrl = (cc?: string | null) => (cc && FLAG_MAP[cc] ? `https://flagcdn.com/48x36/${FLAG_MAP[cc]}.png` : null);
const placeholderAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%231e1b4b'/%3E%3Ctext x='50%25' y='56%25' font-size='64' text-anchor='middle'%3E%F0%9F%A7%91%E2%80%8D%F0%9F%9A%80%3C/text%3E%3C/svg%3E";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface Astronaut {
  id: number;
  name: string;
  nationality?: string;
  profile_image?: string | null;
  profile_image_thumbnail?: string | null;
  date_of_birth?: string;
  agency?: { name?: string; abbrev?: string; country_code?: string } | null;
  spacecraft?: { space_station?: { name?: string } | null } | null;
  flights_count?: number;
  spacewalks_count?: number;
  time_in_space?: string;
  eva_time?: string;
  wiki?: string;
  bio?: string;
}
interface Telemetry {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  footprint?: number;
  timestamp?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmt = (n: number, digits = 0) => (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");
// ISO 8601 durations like "P1Y2M3DT4H5M6S" → "1y 2mo 3d 4h"
function duration(iso?: string) {
  if (!iso) return null;
  const m = iso.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!m) return iso;
  const parts = [[m[1], "y"], [m[2], "mo"], [m[3], "d"], [m[4], "h"], [m[5], "m"]].filter(([v]) => v && v !== "0").slice(0, 3);
  return parts.length ? parts.map(([v, u]) => `${v}${u}`).join(" ") : "—";
}
// Split a lat/lon path wherever it crosses the date line so lines don't streak across the map.
function splitAtDateline(points: [number, number][]) {
  const segments: [number, number][][] = [];
  for (const p of points) {
    const seg = segments[segments.length - 1];
    if (!seg || Math.abs(p[1] - seg[seg.length - 1][1]) > 180) segments.push([p]);
    else seg.push(p);
  }
  return segments;
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */
type TabKey = "live" | "crew";
const TABS: DashboardTab<TabKey>[] = [
  { key: "live", label: "Live orbit", hint: "Updates every 5s", icon: <Satellite className="h-4 w-4" /> },
  { key: "crew", label: "Humans in space", hint: "Who's up there", icon: <Users className="h-4 w-4" /> },
];

/* ------------------------------------------------------------------ */
/*  ISSTracker                                                         */
/* ------------------------------------------------------------------ */
export default function ISSTracker() {
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [crew, setCrew] = useState<Astronaut[] | null>(null);
  const [selected, setSelected] = useState<Astronaut | null>(null);
  const mapApi = useRef<{ invalidate: () => void } | null>(null);

  useEffect(() => {
    fetch(CREW_API)
      .then((r) => r.json())
      .then((d: { results?: Astronaut[] }) => setCrew(Array.isArray(d.results) ? d.results : []))
      .catch(() => setCrew([]));
  }, []);

  // "Currently over…": country, sea or ocean under the station, every 30s.
  const lastLookup = useRef(0);
  useEffect(() => {
    if (!tele || Date.now() - lastLookup.current < 30_000) return;
    lastLookup.current = Date.now();
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${tele.latitude}&longitude=${tele.longitude}&localityLanguage=en`)
      .then((r) => r.json())
      .then((d) => {
        const water = (d?.localityInfo?.informative || []).find((i: { description?: string }) => /ocean|sea|gulf|bay/i.test(i.description || ""));
        setOver(d?.countryName ? [d.principalSubdivision, d.countryName].filter(Boolean).join(", ") : water?.name || d?.locality || "Open ocean");
      })
      .catch(() => {});
  }, [tele]);

  const panels: Record<TabKey, () => React.ReactNode> = {
    live: () => <LivePanel tele={tele} over={over} onTele={setTele} registerMap={(api) => (mapApi.current = api)} />,
    crew: () => <CrewPanel crew={crew} onSelect={setSelected} />,
  };

  return (
    <>
      <DashboardShell
        id="iss"
        path="~/iss"
        liveLabel="in orbit"
        title="International Space Station"
        description={<>A football field of science flying 400 km up at 27,600 km/h, lapping the planet every {ORBIT_MINUTES.toFixed(0)} minutes. Live position, where it&apos;s headed next, day and night, and the people on board.</>}
        tabs={TABS}
        renderPanel={(key) => panels[key]()}
        onTabChange={(key) => key === "live" && window.setTimeout(() => mapApi.current?.invalidate(), 60)}
      />
      <AstronautModal astronaut={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Live panel: map + telemetry                                        */
/* ------------------------------------------------------------------ */
function LivePanel({ tele, over, onTele, registerMap }: {
  tele: Telemetry | null;
  over: string | null;
  onTele: (t: Telemetry) => void;
  registerMap: (api: { invalidate: () => void }) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const trail = useRef<[number, number][]>([]);
  const trailLines = useRef<Polyline[]>([]);
  const futureLines = useRef<Polyline[]>([]);
  const [follow, setFollow] = useState<"follow" | "free">("follow");
  const followRef = useRef(follow);
  followRef.current = follow;

  const drawLines = useCallback((store: React.MutableRefObject<Polyline[]>, points: [number, number][], color: string, dashed: boolean) => {
    const m = map.current; if (!m) return;
    store.current.forEach((line) => line.remove());
    store.current = splitAtDateline(points).map((seg) =>
      L.polyline(seg, { color, weight: dashed ? 2 : 3, opacity: dashed ? 0.8 : 0.95, dashArray: dashed ? "6 8" : undefined, className: dashed ? "iss-future" : "iss-trail" }).addTo(m));
  }, []);

  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: false, worldCopyJump: true, minZoom: 1, maxZoom: 8 }).setView([0, 0], 2);
    map.current = m;
    registerMap({ invalidate: () => m.invalidateSize() });
    // Free OpenStreetMap tiles, no API key needed.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    L.control.attribution({ position: "bottomright", prefix: false }).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors').addTo(m);
    m.on("dragstart", () => setFollow("free"));

    let terminator: L.GeoJSON | null = null;
    const drawTerminator = () => {
      try {
        terminator?.remove();
        terminator = (leafletTerminator(new Date()) as L.GeoJSON).addTo(m);
        terminator.setStyle({ fillColor: "#000", color: "#000", fillOpacity: 0.28, weight: 0 });
      } catch { /* ignore */ }
    };
    drawTerminator();

    const icon = L.divIcon({
      className: "",
      iconSize: [72, 72],
      iconAnchor: [36, 36],
      html: `<div class="iss-marker"><span class="iss-pulse"></span><span class="iss-pulse iss-pulse-2"></span><img src="/images/iss.svg" alt="ISS" /></div>`,
    });

    const tick = async () => {
      try {
        const d: Telemetry = await fetch(ISS_API).then((r) => r.json());
        if (!Number.isFinite(d.latitude)) return;
        onTele(d);
        const at: [number, number] = [d.latitude, d.longitude];
        if (!marker.current) marker.current = L.marker(at, { icon, zIndexOffset: 1000 }).addTo(m);
        else marker.current.setLatLng(at);
        trail.current = [...trail.current, at].slice(-400);
        drawLines(trailLines, trail.current, TRAIL, false);
        if (followRef.current === "follow") m.panTo(at, { animate: true, duration: 0.8 });
      } catch { /* try again next tick */ }
    };
    // The next orbit: 30 predicted positions, three minutes apart.
    const predict = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const batches = [0, 1, 2].map((b) => Array.from({ length: 10 }, (_, i) => now + (b * 10 + i + 1) * 180).join(","));
        const results = await Promise.all(batches.map((ts) => fetch(`${ISS_API}/positions?timestamps=${ts}&units=kilometers`).then((r) => r.json())));
        const points = results.flat().filter((p: Telemetry) => Number.isFinite(p?.latitude)).map((p: Telemetry) => [p.latitude, p.longitude] as [number, number]);
        drawLines(futureLines, points, FUTURE, true);
      } catch { /* optional */ }
    };

    tick(); predict();
    const tickId = window.setInterval(tick, 5_000);
    const predictId = window.setInterval(predict, 10 * 60_000);
    const termId = window.setInterval(drawTerminator, 60_000);
    return () => {
      window.clearInterval(tickId); window.clearInterval(predictId); window.clearInterval(termId);
      m.remove(); map.current = null; marker.current = null; trailLines.current = []; futureLines.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (follow === "follow" && tele && map.current) map.current.panTo([tele.latitude, tele.longitude], { animate: true, duration: 0.8 });
  }, [follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const daylight = tele?.visibility === "daylight";
  const kmh = tele?.velocity ?? NaN;
  const brisSyd = Number.isFinite(kmh) && kmh > 0 ? (730 / kmh) * 60 : NaN;

  return (
    <div className="p-4 sm:p-6">
      {/* Map, framed in stars */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-[#05060d] p-1.5 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.55)] dark:border-white/[0.08]">
        <div aria-hidden className="iss-stars pointer-events-none absolute inset-0 opacity-80" />
        <div className="relative h-[360px] overflow-hidden rounded-[20px] sm:h-[480px]">
          <div ref={mapEl} className="absolute inset-0 z-0 bg-[#0b0d17]" />

          <div className="pointer-events-none absolute left-3 top-3 z-[500] flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-slate-950/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-200 backdrop-blur">
              {daylight ? <Sun className="h-3 w-3 text-amber-300" /> : <Moon className="h-3 w-3 text-indigo-300" />}
              {tele ? (daylight ? "In sunlight" : "In Earth's shadow") : "Acquiring signal…"}
            </span>
          </div>

          {/* Currently over */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] flex flex-wrap items-end justify-between gap-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/75 px-3.5 py-2.5 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Currently over</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Globe2 className="h-3.5 w-3.5 text-indigo-300" />{over || "Locating…"}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/75 px-3.5 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-300 backdrop-blur">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full" style={{ background: TRAIL }} />Path so far</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded-full border-t-2 border-dashed" style={{ borderColor: FUTURE }} />Next orbit</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented id="issFollow" ariaLabel="Map camera" value={follow} onChange={setFollow}
          options={[{ key: "follow", label: <><Crosshair className="h-3 w-3" />Follow ISS</> }, { key: "free", label: <><MapPin className="h-3 w-3" />Free roam</> }]} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {tele?.timestamp ? `Last fix ${new Date(tele.timestamp * 1000).toLocaleTimeString()}` : "Waiting for first fix"}
        </span>
      </div>

      {/* Telemetry */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Gauge} tone="rose" label="Speed" value={fmt(kmh)} unit="km/h" note={Number.isFinite(brisSyd) ? `Brisbane → Sydney in ${brisSyd.toFixed(1)} min` : undefined} />
        <StatTile icon={Mountain} tone="sky" label="Altitude" value={fmt(tele?.altitude ?? NaN, 1)} unit="km" note="About 45× higher than a jet" />
        <StatTile icon={Globe2} tone="indigo" label="Latitude" value={fmt(tele?.latitude ?? NaN, 3)} unit="°" note={tele ? (tele.latitude >= 0 ? "Northern hemisphere" : "Southern hemisphere") : undefined} />
        <StatTile icon={Globe2} tone="violet" label="Longitude" value={fmt(tele?.longitude ?? NaN, 3)} unit="°" note={tele ? (tele.longitude >= 0 ? "Eastern hemisphere" : "Western hemisphere") : undefined} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FactTile icon={Orbit} title={`${ORBIT_MINUTES} min`} text="One lap of Earth. That's about 15.5 orbits, and 16 sunrises, every day." />
        <FactTile icon={Timer} title={`${fmt((kmh || 27_600) / 3600, 1)} km/s`} text="Fast enough to cross Australia in about 8 minutes." />
        <FactTile icon={Rocket} title={tele?.footprint ? `${fmt(tele.footprint)} km` : "≈ 4,500 km"} text="Width of the patch of Earth that can see the station right now." />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Crew panel                                                         */
/* ------------------------------------------------------------------ */
function CrewPanel({ crew, onSelect }: { crew: Astronaut[] | null; onSelect: (a: Astronaut) => void }) {
  const stations = useMemo(() => {
    const groups = new Map<string, Astronaut[]>();
    for (const a of [...(crew || [])].sort((x, y) => x.name.localeCompare(y.name))) {
      const key = a.spacecraft?.space_station?.name || "In orbit";
      groups.set(key, [...(groups.get(key) || []), a]);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [crew]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={Users} tone="indigo" size="lg" label="Crew" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Humans off the planet right now</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {crew ? `${crew.length} people · ${stations.length} station${stations.length === 1 ? "" : "s"}` : "Counting heads…"}
            </p>
          </div>
        </div>
        {crew && <span className="font-aspekta text-5xl font-[650] tabular-nums tracking-tight text-indigo-500">{crew.length}</span>}
      </div>

      {!crew && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />)}</div>}
      {crew && !crew.length && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center font-mono text-xs text-slate-400 dark:border-white/10">Crew data is unavailable right now.</p>}

      {stations.map(([station, people]) => (
        <section key={station} className="mb-8 last:mb-0">
          <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            {station} · {people.length} aboard
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {people.map((a, i) => (
              <motion.button
                key={a.id}
                type="button"
                onClick={() => onSelect(a)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-left outline-none transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-18px_rgba(79,70,229,0.55)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.02]"
              >
                <div className="iss-stars relative h-24 bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950">
                  {flagUrl(a.agency?.country_code) && <img src={flagUrl(a.agency?.country_code)!} alt="" className="absolute right-2.5 top-2.5 h-3.5 w-5 rounded-sm ring-1 ring-white/20" loading="lazy" />}
                </div>
                <img
                  src={a.profile_image_thumbnail || a.profile_image || placeholderAvatar}
                  alt={a.name}
                  loading="lazy"
                  onError={(e) => ((e.currentTarget.src = placeholderAvatar), undefined)}
                  className="relative -mt-10 ml-3.5 h-20 w-20 rounded-2xl object-cover ring-4 ring-white transition-transform duration-300 group-hover:scale-105 dark:ring-[#1a1a1d]"
                />
                <div className="p-3.5 pt-2">
                  <p className="font-semibold leading-snug text-slate-900 line-clamp-2 dark:text-white">{a.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{a.agency?.abbrev || a.agency?.name || a.nationality || "—"}</p>
                  {a.time_in_space && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400"><span className="text-indigo-500">●</span> {duration(a.time_in_space)} in space</p>}
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Astronaut modal                                                    */
/* ------------------------------------------------------------------ */
function AstronautModal({ astronaut: a, onClose }: { astronaut: Astronaut | null; onClose: () => void }) {
  return (
    <Modal open={!!a} onClose={onClose} labelledBy="astro-name" size="lg" accent="#818cf8">
      {a && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="iss-stars relative h-32 bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 sm:h-40">
            <div aria-hidden className="absolute -bottom-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-[50%] bg-gradient-to-t from-sky-500/40 via-indigo-500/20 to-transparent blur-sm" />
          </div>
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-wrap items-end gap-4">
              <img src={a.profile_image || a.profile_image_thumbnail || placeholderAvatar} alt={a.name}
                onError={(e) => ((e.currentTarget.src = placeholderAvatar), undefined)}
                className="relative h-28 w-28 rounded-3xl object-cover ring-4 ring-white shadow-xl dark:ring-[#1a1a1d]" />
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <h2 id="astro-name" className="font-aspekta text-2xl font-[650] tracking-tight text-slate-900 dark:text-white sm:text-3xl">{a.name}</h2>
                  {flagUrl(a.agency?.country_code) && <img src={flagUrl(a.agency?.country_code)!} alt={a.nationality || ""} className="h-4 w-6 rounded-sm ring-1 ring-black/10" />}
                </div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {[a.agency?.name, a.spacecraft?.space_station?.name].filter(Boolean).join(" · ") || a.nationality}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Time in space" value={duration(a.time_in_space)} />
              <Fact label="Flights" value={a.flights_count} />
              <Fact label="Spacewalks" value={a.spacewalks_count} />
              <Fact label="Spacewalk time" value={duration(a.eva_time)} />
              <Fact label="Nationality" value={a.nationality} />
              <Fact label="Born" value={a.date_of_birth && new Date(a.date_of_birth).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} />
              <Fact label="Agency" value={a.agency?.abbrev || a.agency?.name} />
              <Fact label="Station" value={a.spacecraft?.space_station?.name} />
            </div>

            {a.bio && (
              <div className="mt-6">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Mission log</p>
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{a.bio}</p>
              </div>
            )}

            {a.wiki && (
              <a href={a.wiki} target="_blank" rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600">
                Read more on Wikipedia <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function StatTile({ icon, tone, label, value, unit, note }: { icon: typeof Gauge; tone: "rose" | "sky" | "indigo" | "violet"; label: string; value: string; unit: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
        <IconBadge icon={icon} tone={tone} size="sm" />
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}<span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </p>
      {note && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  );
}

function FactTile({ icon: Icon, title, text }: { icon: typeof Gauge; title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] to-transparent p-4">
      <Icon className="absolute -right-3 -top-3 h-16 w-16 text-indigo-500/10" aria-hidden />
      <p className="font-aspekta text-xl font-[650] tracking-tight text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value ?? "—"}</p>
    </div>
  );
}
