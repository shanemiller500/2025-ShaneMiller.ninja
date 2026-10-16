/* ------------------------------------------------------------------ */
/*  USGS earthquakes — shared by the API route and the atlas pages.    */
/*  Real-time feeds: earthquake.usgs.gov/earthquakes/feed/v1.0         */
/* ------------------------------------------------------------------ */
import type { Feature, FeatureCollection, Point } from "geojson";

export type QuakeWindow = "hour" | "day" | "week" | "month";
export type QuakeMin = "all" | "2.5" | "4.5" | "significant";

export const QUAKE_WINDOWS: QuakeWindow[] = ["hour", "day", "week", "month"];
export const QUAKE_MINS: QuakeMin[] = ["all", "2.5", "4.5", "significant"];

/** The all-magnitude month feed is ~7 MB; a month of everything is too much for one map. */
export const clampQuakeMin = (window: QuakeWindow, min: QuakeMin): QuakeMin =>
  window === "month" && min === "all" ? "2.5" : min;

export const quakeFeedUrl = (window: QuakeWindow, min: QuakeMin) =>
  `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${min}_${window}.geojson`;

/** Slim properties kept for the map + list (the raw feed has ~26 fields). */
export interface QuakeProps {
  id: string;
  mag: number;
  place: string;
  time: number;
  depth: number;
  /** PAGER alert: green | yellow | orange | red */
  alert: string | null;
  tsunami: 0 | 1;
  /** "Did You Feel It?" responses */
  felt: number | null;
  sig: number;
  magType: string;
  type: string;
  url: string;
}

export type QuakeFeature = Feature<Point, QuakeProps>;

export interface QuakeFeed extends FeatureCollection<Point, QuakeProps> {
  generated: number;
  title: string;
}

/** Raw USGS feed → slim collection, largest last so big quakes draw on top. */
export function slimQuakeFeed(raw: {
  metadata?: { generated?: number; title?: string };
  features: { id: string; properties: Record<string, unknown>; geometry: Point }[];
}): QuakeFeed {
  const features: QuakeFeature[] = raw.features
    .filter((f) => f.geometry?.coordinates && f.properties?.mag != null)
    .map((f): QuakeFeature => {
      const p = f.properties;
      const [lng, lat, depth] = f.geometry.coordinates;
      return {
        type: "Feature",
        id: f.id,
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: f.id,
          mag: Math.round(Number(p.mag) * 10) / 10,
          place: String(p.place ?? "Unknown location"),
          time: Number(p.time),
          depth: Math.round(Number(depth ?? 0) * 10) / 10,
          alert: (p.alert as string) ?? null,
          tsunami: (p.tsunami ? 1 : 0) as 0 | 1,
          felt: (p.felt as number) ?? null,
          sig: Number(p.sig ?? 0),
          magType: String(p.magType ?? ""),
          type: String(p.type ?? "earthquake"),
          url: String(p.url ?? ""),
        },
      };
    })
    .sort((a, b) => a.properties.mag - b.properties.mag);
  return {
    type: "FeatureCollection",
    features,
    generated: raw.metadata?.generated ?? Date.now(),
    title: raw.metadata?.title ?? "USGS earthquakes",
  };
}

/* ── Depth colour scale (the seismology convention: shallow warm → deep cool) ── */
export const DEPTH_STOPS: { km: number; color: string; label: string }[] = [
  { km: 0, color: "#facc15", label: "0–33 km" },
  { km: 33, color: "#f97316", label: "33–70" },
  { km: 70, color: "#e11d48", label: "70–150" },
  { km: 150, color: "#a21caf", label: "150–300" },
  { km: 300, color: "#4338ca", label: "300+ km" },
];

export const depthColor = (km: number) => {
  let c = DEPTH_STOPS[0].color;
  for (const s of DEPTH_STOPS) if (km >= s.km) c = s.color;
  return c;
};

/* ── PAGER alert levels ── */
export const PAGER_TONE: Record<string, { label: string; className: string }> = {
  green: { label: "Green", className: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300" },
  yellow: { label: "Yellow", className: "bg-yellow-400/20 text-yellow-800 ring-yellow-500/30 dark:text-yellow-200" },
  orange: { label: "Orange", className: "bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300" },
  red: { label: "Red", className: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300" },
};

/** Faulting style from the rake of a nodal plane (Aki & Richards convention). */
export function faultingStyle(rake: number): string {
  const r = ((rake + 180) % 360 + 360) % 360 - 180;
  if (r >= 45 && r <= 135) return "Reverse / thrust";
  if (r <= -45 && r >= -135) return "Normal";
  if (Math.abs(r) < 45 || Math.abs(r) > 135) return "Strike-slip";
  return "Oblique";
}

/** Details pulled from the event's product list (see /api/atlas/quake/[id]). */
export interface QuakeDetail {
  id: string;
  title: string;
  mag: number;
  magType: string;
  place: string;
  time: number;
  depth: number;
  lng: number;
  lat: number;
  url: string;
  tsunami: boolean;
  alert: string | null;
  felt: number | null;
  /** max reported intensity ("Did You Feel It?") */
  cdi: number | null;
  /** max ShakeMap intensity */
  mmi: number | null;
  status: string;
  shakemap: { image: string; legend?: string } | null;
  mechanism: { strike: number; dip: number; rake: number; style: string } | null;
  products: string[];
}

/** Roman numerals for Modified Mercalli intensity. */
export const mmiRoman = (v: number) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][Math.max(0, Math.min(11, Math.round(v) - 1))];

/* ── Historical catalog (FDSN event service) ─────────────────────── */

export const FDSN_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query";
/** USGS caps a single query at 20,000 events. */
export const FDSN_LIMIT = 20_000;

/** Split one CSV line, honouring "quoted, fields". */
function csvCells(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") out.push(cur), (cur = "");
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * FDSN CSV → slim quake features (CSV is ~5x smaller than GeoJSON, which keeps a
 * year of M4.5+ under Next's 2 MB fetch-cache limit). Sorted smallest-last-drawn.
 */
export function parseQuakeCsv(csv: string): QuakeFeature[] {
  const lines = csv.trim().split(/\r?\n/);
  const head = csvCells(lines.shift() ?? "");
  const col = (name: string) => head.indexOf(name);
  const [iTime, iLat, iLng, iDepth, iMag, iMagType, iId, iPlace, iType] = [
    "time", "latitude", "longitude", "depth", "mag", "magType", "id", "place", "type",
  ].map(col);
  const features: QuakeFeature[] = [];
  for (const line of lines) {
    const c = csvCells(line);
    const mag = parseFloat(c[iMag]);
    const lat = parseFloat(c[iLat]);
    const lng = parseFloat(c[iLng]);
    if (!Number.isFinite(mag) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const id = c[iId];
    features.push({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        id,
        mag: Math.round(mag * 10) / 10,
        place: c[iPlace] || "Unknown location",
        time: Date.parse(c[iTime]),
        depth: Math.round((parseFloat(c[iDepth]) || 0) * 10) / 10,
        alert: null,
        tsunami: 0,
        felt: null,
        sig: 0,
        magType: c[iMagType] ?? "",
        type: c[iType] ?? "earthquake",
        url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
      },
    });
  }
  return features.sort((a, b) => a.properties.mag - b.properties.mag);
}

/* ── Replay presets ── */

export type ReplayPresetKey = "week" | "month" | "year" | "decade" | "century";

export const REPLAY_PRESETS: { key: ReplayPresetKey; label: string; hint: string; days: number | null; startIso?: string; minmag: number }[] = [
  { key: "week", label: "Week", hint: "M2.5+", days: 7, minmag: 2.5 },
  { key: "month", label: "Month", hint: "M2.5+", days: 30, minmag: 2.5 },
  { key: "year", label: "Year", hint: "M4.5+", days: 365, minmag: 4.5 },
  { key: "decade", label: "Decade", hint: "M5.5+", days: 3652, minmag: 5.5 },
  { key: "century", label: "Since 1900", hint: "M7+", days: null, startIso: "1900-01-01", minmag: 7 },
];

/**
 * Aftershock zone for a mainshock: grows with rupture size (roughly 20 km at M6,
 * ~60 km at M7, ~200 km at M8, ~630 km at M9 — after Kagan 2002).
 */
export const sequenceRadiusKm = (mag: number) => Math.round(Math.min(800, Math.max(15, 20 * 10 ** (0.5 * (mag - 6)))));

/** How long to follow the sequence after the mainshock. */
export const sequenceDays = (mag: number) => (mag >= 8.5 ? 365 : mag >= 7.5 ? 120 : mag >= 6.5 ? 60 : 30);

/** Smallest aftershock worth plotting (keeps big sequences under the 20k cap). */
export const sequenceMinMag = (mag: number) => Math.max(2.5, Math.round((mag - 4) * 10) / 10);

export interface QuakeAnchor {
  id: string;
  mag: number;
  lng: number;
  lat: number;
  time: number;
  place: string;
}

/** Famous earthquakes (ids verified against the USGS catalog). */
export const FAMOUS_QUAKES: (QuakeAnchor & { name: string })[] = [
  { name: "1906 San Francisco", id: "official19060418131226300_12", mag: 7.9, lat: 37.75, lng: -122.55, time: Date.parse("1906-04-18T13:12:26.300Z"), place: "San Francisco, California" },
  { name: "1960 Chile", id: "official19600522191120_30", mag: 9.5, lat: -38.143, lng: -73.407, time: Date.parse("1960-05-22T19:11:20Z"), place: "Valdivia, Chile" },
  { name: "1964 Alaska", id: "official19640328033616_30", mag: 9.2, lat: 60.908, lng: -147.339, time: Date.parse("1964-03-28T03:36:16Z"), place: "Prince William Sound, Alaska" },
  { name: "1989 Loma Prieta", id: "nc216859", mag: 6.9, lat: 37.0362, lng: -121.8798, time: Date.parse("1989-10-18T00:04:15.190Z"), place: "Loma Prieta, California" },
  { name: "1994 Northridge", id: "ci3144585", mag: 6.7, lat: 34.213, lng: -118.537, time: Date.parse("1994-01-17T12:30:55.390Z"), place: "Northridge, California" },
  { name: "2004 Sumatra", id: "official20041226005853450_30", mag: 9.1, lat: 3.295, lng: 95.982, time: Date.parse("2004-12-26T00:58:53.450Z"), place: "Sumatra – Andaman Islands" },
  { name: "2011 Tōhoku", id: "official20110311054624120_30", mag: 9.1, lat: 38.297, lng: 142.373, time: Date.parse("2011-03-11T05:46:24.120Z"), place: "Tōhoku, Japan" },
  { name: "2015 Nepal", id: "us20002926", mag: 7.8, lat: 28.2305, lng: 84.7314, time: Date.parse("2015-04-25T06:11:25.950Z"), place: "Gorkha, Nepal" },
  { name: "2019 Ridgecrest", id: "ci38457511", mag: 7.1, lat: 35.7695, lng: -117.5993, time: Date.parse("2019-07-06T03:19:53.040Z"), place: "Ridgecrest, California" },
  { name: "2023 Türkiye", id: "us6000jllz", mag: 7.8, lat: 37.2256, lng: 37.0143, time: Date.parse("2023-02-06T01:17:34.342Z"), place: "Pazarcık, Türkiye" },
  { name: "2025 Kamchatka", id: "us6000qw60", mag: 8.8, lat: 52.4948, lng: 160.2395, time: Date.parse("2025-07-29T23:24:52.483Z"), place: "Kamchatka, Russia" },
];
