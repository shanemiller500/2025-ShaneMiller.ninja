/* ------------------------------------------------------------------ */
/*  Volcanoes — Smithsonian Global Volcanism Program (Holocene list)   */
/*  joined with USGS HANS aviation colour codes for U.S. volcanoes.    */
/* ------------------------------------------------------------------ */
import type { FeatureCollection, Point } from "geojson";

export const GVP_WFS =
  "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json";

/** Smithsonian's ongoing eruptions (the "continuing" flag on its eruption list). */
export const GVP_CONTINUING =
  "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeName=GVP-VOTW:E3WebApp_Eruptions1960&propertyName=VolcanoNumber,StartDate&CQL_FILTER=ContinuingEruption='True'";

/** Volcano filter in the layer panel — "erupting" is the default. */
export type VolcanoFilter = "erupting" | "recent" | "usgs" | "all";

export const VOLCANO_FILTERS: { key: VolcanoFilter; label: string; title: string }[] = [
  { key: "erupting", label: "Erupting", title: "Erupting now (Smithsonian) or USGS orange/red" },
  { key: "recent", label: "Since 2000", title: "Erupted since 2000" },
  { key: "usgs", label: "USGS", title: "U.S. volcanoes USGS monitors" },
  { key: "all", label: "All", title: "Every volcano active in the last ~12,000 years" },
];

export function volcanoMatches(p: VolcanoProps, f: VolcanoFilter) {
  if (f === "all") return true;
  if (f === "usgs") return p.code != null;
  if (f === "recent") return p.erupting || (p.lastEruption ?? -1e9) >= 2000;
  return p.erupting || p.rank >= 3;
}

export const HANS_MONITORED = "https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes";
export const HANS_ELEVATED = "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes";

/** Aviation colour code: GREEN | YELLOW | ORANGE | RED (USGS-monitored volcanoes only). */
export type ColorCode = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface VolcanoProps {
  vnum: number;
  name: string;
  type: string;
  /** negative = BCE; null = unknown */
  lastEruption: number | null;
  country: string;
  elevation: number | null;
  /** USGS colour code when the volcano is USGS-monitored */
  code: ColorCode | null;
  /** USGS alert level: NORMAL | ADVISORY | WATCH | WARNING */
  level: string | null;
  /** 0 none, 1 green, 2 yellow, 3 orange, 4 red — for map styling */
  rank: number;
  /** On Smithsonian's list of eruptions happening now */
  erupting: boolean;
  /** Start of the ongoing eruption (YYYYMMDD) */
  eruptingSince: string | null;
}

export type VolcanoCollection = FeatureCollection<Point, VolcanoProps>;

export interface VolcanoDetail extends VolcanoProps {
  lng: number;
  lat: number;
  landform: string;
  region: string;
  subregion: string;
  summary: string;
  tectonic: string;
  rock: string;
  photo: { url: string; caption: string; credit: string } | null;
  notice: { url: string; sent: string; observatory: string } | null;
}

export const CODE_RANK: Record<ColorCode, number> = { GREEN: 1, YELLOW: 2, ORANGE: 3, RED: 4 };

export const CODE_STYLE: Record<ColorCode, { dot: string; className: string }> = {
  GREEN: { dot: "#10b981", className: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300" },
  YELLOW: { dot: "#eab308", className: "bg-yellow-400/20 text-yellow-800 ring-yellow-500/30 dark:text-yellow-200" },
  ORANGE: { dot: "#f97316", className: "bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300" },
  RED: { dot: "#e11d48", className: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300" },
};

/** "1980 CE" / "8300 BCE" / "Unknown" */
export const eruptionYear = (y: number | null) => (y == null ? "Unknown" : y < 0 ? `${-y} BCE` : `${y} CE`);
