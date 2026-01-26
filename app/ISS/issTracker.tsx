/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import L, { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import leafletTerminator from "leaflet-terminator";
import { AnimatePresence, motion } from "framer-motion";

import { issColors } from "@/utils/colors";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const START_CACHE_KEY = "issTrackerStart";
const START_TTL_MS = 20 * 60 * 1_000; // 20-minute cache

const ISS_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/International_Space_Station.svg/512px-International_Space_Station.svg.png";
const NASA_FALLBACK =
  "https://www.nasa.gov/sites/default/files/thumbnails/image/nasa_logo.png";

const FLAG_MAP: Record<string, string> = {
  USA: "us",
  RUS: "ru",
  CHN: "cn",
  JPN: "jp",
  CAN: "ca",
  FRA: "fr",
  GBR: "gb",
  IND: "in",
};
const flagUrl = (cc?: string | null) =>
  cc && FLAG_MAP[cc] ? `https://flagcdn.com/48x36/${FLAG_MAP[cc]}.png` : null;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface LLAstro {
  id: number;
  name: string;
  nationality?: string;
  profile_image?: string | null;
  profile_image_thumbnail?: string | null;
  date_of_birth?: string;
  agency?: { name?: string; country_code?: string } | null;
  spacecraft?: { space_station?: { name?: string } | null } | null;
  flights_count?: number;
  landings_count?: number;
  spacewalks_count?: number;
  time_in_space?: string;
  eva_time?: string;
  first_flight?: string;
  last_flight?: string;
  wiki?: string;
  bio?: string;
}
interface LLRes {
  count: number;
  results: LLAstro[];
}
interface Telemetry {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
}
interface CachedStart {
  latitude: number;
  longitude: number;
  ts: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const niceNum = (n: number, digits = 2) =>
  Number.isFinite(n) ? n.toFixed(digits) : "—";

const placeholderAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23eef2ff'/%3E%3Ctext x='50%25' y='54%25' font-family='Arial' font-size='18' text-anchor='middle' fill='%234c1d95'%3ENo%20Image%3C/text%3E%3C/svg%3E";

/* ------------------------------------------------------------------ */
/*  ISSTracker Component                                               */
/* ------------------------------------------------------------------ */
const ISSTracker: React.FC = () => {
  const mapRef = useRef<LeafletMap | null>(null);
  const issRef = useRef<Marker | null>(null);
  const trailSegsRef = useRef<Polyline[]>([]);
  const terminatorRef = useRef<L.GeoJSON | null>(null);

  const startSavedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  const [tele, setTele] = useState<Telemetry>({
    latitude: 0,
    longitude: 0,
    altitude: 0,
    velocity: 0,
    visibility: "—",
  });

  const [startPos, setStartPos] = useState<{ lat: number; lon: number } | null>(
    null,
  );

  const [crewTotal, setCrewTotal] = useState<number | null>(null);
  const [spaceCrew, setSpaceCrew] = useState<LLAstro[]>([]);
  const [selected, setSelected] = useState<LLAstro | null>(null);

  /* ---------------- restore cached start ---------------- */
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(START_CACHE_KEY);
      if (raw) {
        const c: CachedStart = JSON.parse(raw);
        if (Date.now() - c.ts <= START_TTL_MS) {
          setStartPos({ lat: c.latitude, lon: c.longitude });
        } else {
          localStorage.removeItem(START_CACHE_KEY);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------- close modal on Esc + lock body scroll ----------- */
  useEffect(() => {
    if (!selected) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };

    // lock page scroll behind the modal (mobile-friendly)
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [selected]);

  /* ---------------- fetch crew once -------------------- */
  useEffect(() => {
    if (!mounted) return;
    fetch("https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=100")
      .then((r) => r.json())
      .then((d: LLRes) => {
        setCrewTotal(d.count);
        setSpaceCrew(d.results);
      })
      .catch(() => {});
  }, [mounted]);

  /* ------------------------------------------------------------------ */
  /*  Init map + overlays                                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!mounted) return;

    // Avoid double-init in dev/hot reload
    if (mapRef.current) return;

    const map = L.map("mapISS", {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 0,
      maxZoom: 18,
      inertia: true,
    }).setView([0, 0], 2);

    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      minZoom: 0,
      noWrap: false,
    }).addTo(map);

    // Light, top-right zoom control (nice on mobile)
    L.control
      .zoom({
        position: "topright",
      })
      .addTo(map);

    // day/night terminator
    const refreshTerminator = () => {
      try {
        if (terminatorRef.current) map.removeLayer(terminatorRef.current);
        terminatorRef.current = leafletTerminator(new Date()) as L.GeoJSON;
        terminatorRef.current.setStyle({
          fillColor: issColors.terminator,
          color: issColors.terminator,
          fillOpacity: 0.42,
          weight: 0,
        });
        terminatorRef.current.addTo(map);
      } catch {
        /* ignore */
      }
    };

    refreshTerminator();
    const termID = window.setInterval(refreshTerminator, 60_000);

    // ISS icon
    const icon = L.icon({
      iconUrl: ISS_LOGO,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: "iss-icon",
    });

    // helper: add trail point without dateline jump
    const addTrailPoint = (lat: number, lon: number) => {
      const segs = trailSegsRef.current;
      const lastSeg = segs[segs.length - 1];

      if (!lastSeg) {
        const seg = L.polyline([[lat, lon]], {
          color: issColors.trail,
          weight: 2,
          dashArray: "4 6",
        }).addTo(map);
        segs.push(seg);
        return;
      }

      const pts = lastSeg.getLatLngs() as L.LatLng[];
      const last = pts[pts.length - 1];
      const delta = Math.abs(lon - last.lng);

      if (delta > 180) {
        const seg = L.polyline([[lat, lon]], {
          color: issColors.trail,
          weight: 2,
          dashArray: "4 6",
        }).addTo(map);
        segs.push(seg);
      } else {
        lastSeg.addLatLng([lat, lon]);
      }

      // keep trail tidy
      if (segs.length > 10) {
        const old = segs.shift();
        old?.remove();
      }
    };

    // If we already had a cached start, seed a tiny first segment
    if (startPos) {
      const seg = L.polyline([[startPos.lat, startPos.lon]], {
        color: issColors.trail,
        weight: 2,
        dashArray: "4 6",
      }).addTo(map);
      trailSegsRef.current.push(seg);
    }

    const tick = async () => {
      try {
        const d: Telemetry = await fetch(
          "https://api.wheretheiss.at/v1/satellites/25544",
        ).then((r) => r.json());

        setTele(d);
        const lat = d.latitude;
        const lon = d.longitude;

        // marker
        if (!issRef.current) {
          issRef.current = L.marker([lat, lon], { icon }).addTo(map);
        } else {
          issRef.current.setLatLng([lat, lon]);
        }

        // trail
        addTrailPoint(lat, lon);

        // smoother pan (less nausea on phones)
        map.panTo([lat, lon], { animate: true, duration: 0.65 });

        // save session start (once)
        if (!startSavedRef.current) {
          setStartPos({ lat, lon });
          try {
            localStorage.setItem(
              START_CACHE_KEY,
              JSON.stringify({ latitude: lat, longitude: lon, ts: Date.now() }),
            );
          } catch {
            /* ignore */
          }
          startSavedRef.current = true;
        }
      } catch {
        /* swallow */
      }
    };

    tick();
    const issID = window.setInterval(tick, 10_000);

    return () => {
      window.clearInterval(issID);
      window.clearInterval(termID);
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      issRef.current = null;
      terminatorRef.current = null;
      trailSegsRef.current = [];
    };
    // IMPORTANT: don't include startPos here or it can re-init map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ------------- cached session start marker + label ---------- */
  useEffect(() => {
    if (!mapRef.current || !startPos) return;

    // render start as a tiny ring (better looking than default tooltip-only)
    const m = L.circleMarker([startPos.lat, startPos.lon], {
      radius: 6,
      color: issColors.startMarker.stroke,
      weight: 2,
      fillColor: issColors.startMarker.fill,
      fillOpacity: 0.9,
    })
      .bindTooltip("Session start", {
        direction: "top",
        offset: L.point(0, -6),
        opacity: 0.9,
      })
      .addTo(mapRef.current);

    return () => {
      try {
        m.remove();
      } catch {
        /* ignore */
      }
    };
  }, [startPos]);

  const crewSorted = useMemo(() => {
    // stable-ish ordering: station name then name
    return [...spaceCrew].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [spaceCrew]);

  if (!mounted) return null;

  return (
    <motion.div
      className="mx-auto max-w-5xl px-3 sm:px-4 pb-14 flex flex-col gap-5 sm:gap-7"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* Header / hero */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-brand-900/60 backdrop-blur shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center gap-3">

          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-brand-900 dark:text-white">
              International Space Station
            </h1>
            <p className="text-xs sm:text-sm text-brand-900/70 dark:text-white/70">
              A live view of the International Space Station using real-time position and crew data
              from public ISS tracking APIs. It shows orbit path, day/night coverage, and current
              crew status in a simple, readable way.
            </p>
          </div>
        </div>

        {/* Map: on mobile use a rounded-2xl “window” (circle is cute but wastes space) */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <div
            className={cn(
              "relative w-full mx-auto overflow-hidden shadow-md ring-1",
              "ring-brand-200 dark:ring-brand-800 bg-black/[0.02] dark:bg-white/[0.04]",
              "rounded-2xl", // ✅ better mobile UX than perfect circle
              "h-[320px] sm:h-[420px]",
            )}
          >
            <div id="mapISS" className="absolute inset-0 z-0" />

            {/* Top-left floating “ISS Live” chip */}
            <div className="absolute left-3 top-3 z-[500]">
              <div className="rounded-full bg-white/80 dark:bg-brand-900/70 backdrop-blur px-3 py-1.5 text-[11px] font-extrabold text-brand-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                🛰️ Live
              </div>
            </div>

            {/* Bottom overlay: 2 key stats (keeps UI clean) */}
            <div className="absolute left-3 right-3 bottom-3 z-[500]">
              <div className="grid grid-cols-2 gap-2">
                <MiniPill label="Altitude" value={`${niceNum(tele.altitude, 1)} km`} />
                <MiniPill label="Speed" value={`${niceNum(tele.velocity, 0)} km/h`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry (compact, not noisy) */}
      <motion.div
        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/75 dark:bg-brand-900/60 backdrop-blur shadow-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm sm:text-base font-extrabold text-brand-900 dark:text-white">
              Telemetry
            </h2>
            <div className="text-[11px] text-brand-900/60 dark:text-white/60">
              Visibility: <span className="font-bold">{tele.visibility}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Latitude" value={niceNum(tele.latitude, 3)} unit="°" />
            <Stat label="Longitude" value={niceNum(tele.longitude, 3)} unit="°" />
            <Stat label="Altitude" value={niceNum(tele.altitude, 1)} unit="km" />
            <Stat label="Velocity" value={niceNum(tele.velocity, 0)} unit="km/h" />
          </div>
        </div>
      </motion.div>

      {/* Crew */}
      {crewTotal !== null && (
        <motion.div
          className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-brand-900/60 backdrop-blur shadow-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm sm:text-base font-extrabold text-brand-900 dark:text-white">
                Humans in Space
              </h2>
              <span className="rounded-full px-3 py-1 text-[11px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-1 ring-indigo-500/20">
                {crewTotal}
              </span>
            </div>

            <div className="mt-4 grid gap-3 grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5">
              {crewSorted.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={cn(
                    "relative rounded-2xl border border-black/10 dark:border-white/10",
                    "bg-white dark:bg-brand-900/40 shadow-sm hover:shadow-md transition",
                    "p-3 flex flex-col items-center text-center",
                    "active:scale-[0.98]",
                  )}
                  type="button"
                >
                  {flagUrl(a.agency?.country_code) && (
                    <img
                      src={flagUrl(a.agency?.country_code)!}
                      alt={a.nationality ?? ""}
                      className="absolute top-2 right-2 h-4 w-6 rounded shadow ring-1 ring-black/10"
                      loading="lazy"
                    />
                  )}

                  <img
                    src={a.profile_image_thumbnail ?? placeholderAvatar}
                    alt={a.name}
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover shadow ring-1 ring-black/5 dark:ring-white/10"
                    loading="lazy"
                    onError={(e) => (((e.target as HTMLImageElement).src = placeholderAvatar), void 0)}
                  />

                  <div className="mt-2 text-[12px] sm:text-[13px] font-extrabold text-brand-900 dark:text-white line-clamp-2">
                    {a.name}
                  </div>

                  {a.nationality && (
                    <div className="mt-0.5 text-[11px] text-brand-900/70 dark:text-white/70 line-clamp-1">
                      {a.nationality}
                    </div>
                  )}
                </button>
              ))}

              {crewSorted.length === 0 && (
                <p className="col-span-full text-center text-sm text-brand-900 dark:text-white">
                  No current crew data.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
            onClick={() => setSelected(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "relative w-full sm:max-w-lg",
                "rounded-t-3xl sm:rounded-3xl",
                "bg-white dark:bg-brand-900",
                "shadow-2xl border border-black/10 dark:border-white/10",
                "max-h-[92svh] overflow-hidden flex flex-col",
              )}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* header */}
              <div className="px-5 pt-5 pb-4 border-b border-black/10 dark:border-white/10 relative">
                <button
                  onClick={() => setSelected(null)}
                  className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-brand-900 dark:text-white flex items-center justify-center text-2xl leading-none hover:bg-black/[0.07] dark:hover:bg-white/[0.12] transition"
                  aria-label="Close"
                  type="button"
                >
                  ×
                </button>

                <div className="flex items-center gap-3">
                  <img
                    src={selected.profile_image ?? selected.profile_image_thumbnail ?? placeholderAvatar}
                    alt={selected.name}
                    className="h-14 w-14 rounded-full object-cover shadow ring-1 ring-black/5 dark:ring-white/10"
                    onError={(e) => (((e.target as HTMLImageElement).src = placeholderAvatar), void 0)}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-extrabold text-brand-900 dark:text-white truncate">
                        {selected.name}
                      </h3>
                      {flagUrl(selected.agency?.country_code) && (
                        <img
                          src={flagUrl(selected.agency?.country_code)!}
                          alt={selected.nationality ?? ""}
                          className="h-4 w-6 rounded shadow ring-1 ring-black/10"
                        />
                      )}
                    </div>
                    <div className="text-[12px] text-brand-900/70 dark:text-white/70">
                      {(selected.agency?.name || selected.nationality || "—") as string}
                    </div>
                  </div>
                </div>
              </div>

              {/* content (scroll) */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoPill label="Nationality" value={selected.nationality} />
                  <InfoPill label="Born" value={selected.date_of_birth} />
                  <InfoPill label="Agency" value={selected.agency?.name} />
                  <InfoPill label="Station" value={selected.spacecraft?.space_station?.name} />
                  <InfoPill label="Flights" value={selected.flights_count} />
                  <InfoPill label="Spacewalks" value={selected.spacewalks_count} />
                  <InfoPill label="Time in Space" value={selected.time_in_space} />
                  <InfoPill label="EVA Time" value={selected.eva_time} />
                </div>

                {selected.bio && (
                  <div className="mt-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-4">
                    <div className="text-[12px] font-extrabold text-brand-900 dark:text-white mb-2">
                      Bio
                    </div>
                    <p className="text-[13px] leading-relaxed text-brand-900/80 dark:text-white/80 whitespace-pre-line">
                      {selected.bio}
                    </p>
                  </div>
                )}

                {selected.wiki && (
                  <a
                    href={selected.wiki}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-indigo-600/10 text-indigo-700 dark:text-indigo-200 font-extrabold py-3 text-sm hover:bg-indigo-600/15 transition"
                  >
                    Open Wikipedia
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-3 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] py-3 text-sm font-extrabold text-brand-900 dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  UI Components                                                      */
/* ------------------------------------------------------------------ */
interface StatProps {
  label: string;
  value: string;
  unit?: string;
}

const Stat = ({ label, value, unit }: StatProps) => (
  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900/40 px-3 py-3 shadow-sm">
    <div className="text-[10px] uppercase tracking-wide text-brand-900/70 dark:text-white/60 font-extrabold">
      {label}
    </div>
    <div className="mt-1 text-base font-extrabold text-brand-900 dark:text-white">
      {value}
      {unit ? <span className="text-xs font-bold pl-1 opacity-80">{unit}</span> : null}
    </div>
  </div>
);

interface MiniPillProps {
  label: string;
  value: string;
}

const MiniPill = ({ label, value }: MiniPillProps) => (
  <div className="rounded-2xl bg-white/85 dark:bg-brand-900/70 backdrop-blur px-3 py-2 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
    <div className="text-[10px] font-extrabold uppercase tracking-wide text-brand-900/70 dark:text-white/70">
      {label}
    </div>
    <div className="text-[13px] font-extrabold text-brand-900 dark:text-white">{value}</div>
  </div>
);

interface InfoPillProps {
  label: string;
  value: string | number | null | undefined;
}

const InfoPill = ({ label, value }: InfoPillProps) => (
  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900/40 px-4 py-3">
    <div className="text-[10px] font-extrabold uppercase tracking-wide text-brand-900/70 dark:text-white/60">
      {label}
    </div>
    <div className="mt-1 text-[13px] font-bold text-brand-900 dark:text-white">
      {value ?? "—"}
    </div>
  </div>
);

export default ISSTracker;
