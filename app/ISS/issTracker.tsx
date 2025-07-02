/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import L, { Map as LeafletMap, Marker, CircleMarker, Polyline } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import leafletTerminator from 'leaflet-terminator';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const START_CACHE_KEY = 'issTrackerStart';
const START_TTL_MS    = 20 * 60 * 1_000; // 20-minute cache

const ISS_LOGO =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/International_Space_Station.svg/512px-International_Space_Station.svg.png';
const NASA_FALLBACK =
  'https://www.nasa.gov/sites/default/files/thumbnails/image/nasa_logo.png';

const FLAG_MAP: Record<string, string> = {
  USA: 'us', RUS: 'ru', CHN: 'cn', JPN: 'jp',
  CAN: 'ca', FRA: 'fr', GBR: 'gb', IND: 'in',
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
  flights_count?: number; landings_count?: number; spacewalks_count?: number;
  time_in_space?: string; eva_time?: string; first_flight?: string; last_flight?: string;
  wiki?: string; bio?: string;
}
interface LLRes    { count: number; results: LLAstro[] }
interface Telemetry { latitude: number; longitude: number; altitude: number; velocity: number; visibility: string }
interface CachedStart { latitude: number; longitude: number; ts: number }

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const ISSTracker: React.FC = () => {
  const mapRef        = useRef<LeafletMap | null>(null);
  const issRef        = useRef<Marker | null>(null);
  const startRef      = useRef<CircleMarker | null>(null);
  const trailSegsRef  = useRef<Polyline[]>([]);
  const terminatorRef = useRef<L.GeoJSON | null>(null);
  const startSavedRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [tele, setTele]       = useState<Telemetry>({
    latitude: 0, longitude: 0, altitude: 0, velocity: 0, visibility: '—',
  });
  const [startPos,  setStartPos]  = useState<{ lat: number; lon: number } | null>(null);
  const [crewTotal, setCrewTotal] = useState<number | null>(null);
  const [spaceCrew, setSpaceCrew] = useState<LLAstro[]>([]);
  const [selected,  setSelected]  = useState<LLAstro | null>(null);

  /* ---------------- restore cached start ---------------- */
  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem(START_CACHE_KEY);
    if (raw) {
      const c: CachedStart = JSON.parse(raw);
      if (Date.now() - c.ts <= START_TTL_MS) setStartPos({ lat: c.latitude, lon: c.longitude });
      else localStorage.removeItem(START_CACHE_KEY);
    }
  }, []);

      /* close modal on Esc */
    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelected(null);
      };
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }, [selected]);

  /* ---------------- fetch crew once -------------------- */
  useEffect(() => {
    if (!mounted) return;
    fetch('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&limit=100')
      .then(r => r.json())
      .then((d: LLRes) => { setCrewTotal(d.count); setSpaceCrew(d.results); })
      .catch(() => {});
  }, [mounted]);

  /* ------------------------------------------------------------------ */
/*  Seed trail with cached session-start position                     */
/* ------------------------------------------------------------------ */
useEffect(() => {
  if (!startPos || !mapRef.current) return;        // need both map + cached point
  if (trailSegsRef.current.length) return;         // don’t run twice

  const seg = L.polyline(
    [[startPos.lat, startPos.lon]],
    { color: '#6366f1', weight: 2, dashArray: '4 6' }
  ).addTo(mapRef.current);

  trailSegsRef.current.push(seg);                  // first segment seeded
}, [startPos]);


  /* ---------------- init map + overlays ---------------- */
  useEffect(() => {
    if (!mounted) return;

    /* --- map setup --- */
    const map = L.map('mapISS', {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 0,
      maxZoom: 18,
    }).setView([0, 0], 2);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, minZoom: 0, noWrap: false,
    }).addTo(map);

    /* --- day/night terminator --- */
    const refreshTerminator = () => {
      if (terminatorRef.current) map.removeLayer(terminatorRef.current);
      terminatorRef.current = leafletTerminator(new Date()) as L.GeoJSON;
      terminatorRef.current.setStyle({ fillColor: '#000', color: '#000', fillOpacity: 0.45, weight: 0 });
      terminatorRef.current.addTo(map);
    };
    refreshTerminator();
    const termID = setInterval(refreshTerminator, 60_000);

    /* --- ISS icon --- */
    const icon = L.icon({ iconUrl: ISS_LOGO, iconSize: [36, 36], iconAnchor: [18, 18] });

    /* helper to add trail points without “dateline jump” */
    const addTrailPoint = (lat: number, lon: number) => {
      const segs = trailSegsRef.current;
      const lastSeg = segs[segs.length - 1];
      if (!lastSeg) {
        /* first segment */
        const seg = L.polyline([[lat, lon]], { color: '#6366f1', weight: 2, dashArray: '4 6' }).addTo(map);
        segs.push(seg);
        return;
      }
      const pts = lastSeg.getLatLngs() as L.LatLng[];
      const last = pts[pts.length - 1];
      const delta = Math.abs(lon - last.lng);
      if (delta > 180) {
        /* crossed the dateline – start a new segment */
        const seg = L.polyline([[lat, lon]], { color: '#6366f1', weight: 2, dashArray: '4 6' }).addTo(map);
        segs.push(seg);
      } else {
        lastSeg.addLatLng([lat, lon]);
      }
      /* keep only recent points (optional: cap total segs) */
      if (segs.length > 8) {
        const old = segs.shift();
        old?.remove();
      }
    };

    /* --- telemetry tick --- */
    const tick = async () => {
      try {
        const d: Telemetry = await fetch('https://api.wheretheiss.at/v1/satellites/25544').then(r => r.json());
        setTele(d);
        const { latitude: lat, longitude: lon } = d;

        /* spawn / move ISS marker */
        if (!issRef.current) issRef.current = L.marker([lat, lon], { icon }).addTo(map);
        else issRef.current.setLatLng([lat, lon]);

        /* trail */
        addTrailPoint(lat, lon);

        /* smooth pan */
        map.panTo([lat, lon], { animate: true, duration: 0.75 });

        /* cache session start */
        if(!startSavedRef.current) {
          setStartPos({ lat, lon });
          localStorage.setItem(START_CACHE_KEY, JSON.stringify({ latitude: lat, longitude: lon, ts: Date.now() }));
          startSavedRef.current = true;
        }
      } catch {/* swallow */}
    };
    tick();
    const issID = setInterval(tick, 10_000);

    return () => { clearInterval(issID); clearInterval(termID); map.remove(); };
  }, [mounted]);

  /* ------------- cached session start marker ---------- */
  useEffect(() => {
    if (mapRef.current && startPos && !startRef.current) {
      startRef.current = L.circleMarker([startPos.lat, startPos.lon], {
        radius: 6, color: 'black', weight: 2, fillOpacity: 0.85,
      }).bindTooltip('Session start', { direction: 'top', offset: L.point(0, -4) }).addTo(mapRef.current);
    }
  }, [startPos]);

  if (!mounted) return null;

  /* ----------------------------------------------------------------
     UI - map container remains a circular “window”, everything else
     unchanged.  The only overlays now present on the map layer are:
       • the night-day terminator
       • the ISS dashed trail segments
  ----------------------------------------------------------------- */
  return (
    <motion.div
      className="flex flex-col gap-6 sm:gap-8 px-2 sm:px-4 pb-14 max-w-5xl mx-auto"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* hero */}
      <figure className="overflow-hidden rounded-xl shadow-lg bg-white flex items-center justify-center h-28 sm:h-32">
        <img src={ISS_LOGO} onError={e => ((e.target as HTMLImageElement).src = NASA_FALLBACK)} alt="ISS Program Logo" className="h-full object-contain" />
      </figure>

      <h1 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-900 dark:text-white">
        International&nbsp;Space&nbsp;Station&nbsp;Tracker
      </h1>

      {/* map */}
      <div id="mapISS" className="relative z-0 w-full max-w-[650px] mx-auto aspect-square rounded-full overflow-hidden shadow-lg ring-1 ring-brand-200 dark:ring-brand-800" />

      {/* telemetry */}
      <motion.div
        className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-4 rounded-lg bg-white/70 dark:bg-brand-900/70 backdrop-blur p-4 text-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
      >
        <Stat label="Latitude"   value={tele.latitude .toFixed(3)} unit="°"    />
        <Stat label="Longitude"  value={tele.longitude.toFixed(3)} unit="°"    />
        <Stat label="Altitude"   value={tele.altitude .toFixed(1)} unit="km"   />
        <Stat label="Velocity"   value={tele.velocity .toFixed(0)} unit="km/h" />
        <Stat label="Visibility" value={tele.visibility}            unit=""    />
      </motion.div>

      {/* crew cards */}
      {crewTotal !== null && (
        <motion.div
          className="rounded-lg bg-white/80 dark:bg-brand-900/80 backdrop-blur p-4 xs:p-5 sm:p-6 shadow-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        >
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-brand-900 dark:text-white">
            Humans in Space ({crewTotal})
          </h2>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(110px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
            {spaceCrew.map(a => (
              <button
                key={a.id} onClick={() => setSelected(a)}
                className="group relative rounded-lg border border-brand-200 dark:border-brand-950 bg-white dark:bg-brand-900/60 p-3 flex flex-col items-center text-center shadow-sm transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-xl focus:outline-none"
              >
                {flagUrl(a.agency?.country_code) && (
                  <img src={flagUrl(a.agency?.country_code)!} alt={a.nationality ?? ''} className="absolute top-1.5 right-1.5 h-4 w-6 rounded-sm shadow" />
                )}
                <img src={a.profile_image_thumbnail ?? 'https://via.placeholder.com/96x96.png?text=No+Image'} alt={a.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover mb-2 sm:mb-3 shadow group-hover:scale-105 transition-transform duration-200" />
                <p className="text-[13px] sm:text-sm font-semibold text-brand-900 dark:text-white line-clamp-2">{a.name}</p>
                {a.nationality && <p className="text-[11px] sm:text-xs text-brand-900 dark:text-white/80">{a.nationality}</p>}
                {a.spacecraft?.space_station?.name && <p className="text-[10px] sm:text-[11px] mt-0.5 text-brand-900 dark:text-white/60 line-clamp-2">{a.spacecraft.space_station.name}</p>}
              </button>
            ))}
            {spaceCrew.length === 0 && <p className="col-span-full text-center text-brand-900 dark:text-white">No current crew data.</p>}
          </div>
        </motion.div>
      )}

      {/* modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30 backdrop-blur-sm p-2 xs:p-4"
             onClick={() => setSelected(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
            onClick={(e) => e.stopPropagation()}  
              className="relative w-full max-w-sm xs:max-w-md sm:max-w-lg max-h-[95vh] overflow-y-auto rounded-xl bg-white dark:bg-brand-900 p-5 xs:p-6 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2 }}
            > 
            {flagUrl(selected.agency?.country_code) && <img src={flagUrl(selected.agency?.country_code)!} alt={selected.nationality ?? ''} className="h-15 w-14 rounded-sm shadow left-0" />}
              <button
                onClick={() => setSelected(null)}
                className="absolute -top-0 -right-0 h-6 w-6 rounded-full bg-brand-600 text-white text-xl leading-none flex items-center justify-center shadow-lg hover:bg-brand-950 focus:outline-none mt-2 mr-2 transition-colors duration-200"
                aria-label="Close"
              >×</button>
              <div className="flex flex-col items-center mb-6">
                <img src={selected.profile_image ?? selected.profile_image_thumbnail ?? 'https://via.placeholder.com/160x160.png?text=No+Image'} alt={selected.name} className="mx-auto mb-3 h-32 w-32 rounded-full object-cover shadow" />
                <h3 className="text-lg sm:text-xl font-bold text-brand-900 dark:text-white text-center">{selected.name}</h3>
              </div>
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <div className="text-[14px] sm:text-[15px] space-y-1 text-brand-900 dark:text-white">
                  {selected.nationality    && <Detail label="Nationality" value={selected.nationality} />}
                  {selected.date_of_birth   && <Detail label="Born"        value={selected.date_of_birth} />}
                  {selected.agency?.name    && <Detail label="Agency"      value={selected.agency.name} />}
                  {selected.spacecraft?.space_station?.name && <Detail label="Station" value={selected.spacecraft.space_station.name} />}
                  {selected.flights_count   !== undefined && <Detail label="Flights"    value={selected.flights_count} />}
                  {selected.landings_count  !== undefined && <Detail label="Landings"   value={selected.landings_count} />}
                  {selected.spacewalks_count!== undefined && <Detail label="Spacewalks" value={selected.spacewalks_count} />}
                  {selected.time_in_space   && <Detail label="Time in Space" value={selected.time_in_space} />}
                  {selected.eva_time        && <Detail label="EVA Time"      value={selected.eva_time} />}
                  {selected.first_flight    && <Detail label="First Flight"  value={selected.first_flight} />}
                  {selected.last_flight     && <Detail label="Last Flight"   value={selected.last_flight} />}
                  {selected.wiki && <p className="pt-1"><a href={selected.wiki} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-950">Wikipedia</a></p>}
                </div>
                {selected.bio && <p className="text-[13px] sm:text-sm leading-relaxed text-brand-900 dark:text-white/80 whitespace-pre-line">{selected.bio}</p>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ---------------- tiny presenters -------------------- */
interface StatProps { label: string; value: string; unit: string }
const Stat: React.FC<StatProps> = ({ label, value, unit }) => (
  <div className="flex flex-col items-start">
    <span className="text-[10px] xs:text-[11px] uppercase tracking-wide text-brand-900 dark:text-white">{label}</span>
    <span className="text-base xs:text-lg font-semibold text-brand-900 dark:text-white">
      {value}{unit && <span className="text-xs font-normal pl-0.5">{unit}</span>}
    </span>
  </div>
);

const Detail: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <p><strong>{label}:</strong> {value}</p>
);

export default ISSTracker;
