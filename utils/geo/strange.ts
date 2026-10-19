/* ------------------------------------------------------------------ */
/*  Strange Earth data: the baked files (scripts/atlas/build-strange)  */
/*  plus Macrostrat's "what rock is under this spot?" lookup.          */
/* ------------------------------------------------------------------ */

export const STRANGE_URL = "/atlas/strange.json";
export const IMPACTS_URL = "/atlas/impacts.json";
export const LANDFORMS_URL = "/atlas/landforms.json";

/* ── notable oddities (Wikidata) ─────────────────────────────────── */

export type StrangeCat = "arch" | "rock" | "volcanic" | "lakebed" | "geyser" | "dune" | "canyon" | "erratic";

export const STRANGE_CATS: { key: StrangeCat; label: string; color: string; blurb: string }[] = [
  { key: "arch", label: "Arches & bridges", color: "#fb923c", blurb: "Stone spans carved by water, frost and wind" },
  { key: "rock", label: "Hoodoos, buttes & rock oddities", color: "#c084fc", blurb: "Spires, mesas, inselbergs and odd rock formations" },
  { key: "volcanic", label: "Lava fields & cones", color: "#f43f5e", blurb: "Young lava, cinder cones, volcanic necks and basalt columns" },
  { key: "lakebed", label: "Dry lakes & salt flats", color: "#e2e8f0", blurb: "Beds of lakes that dried up — many left over from the Ice Age" },
  { key: "geyser", label: "Geysers", color: "#38bdf8", blurb: "Hot springs that erupt" },
  { key: "dune", label: "Dunefields", color: "#fde047", blurb: "Seas of sand — and one of gypsum" },
  { key: "canyon", label: "Slot canyons", color: "#f59e0b", blurb: "Canyons narrower than they are deep" },
  { key: "erratic", label: "Glacial erratics", color: "#a3e635", blurb: "Boulders dropped far from home by Ice Age glaciers" },
];

export const strangeCat = (k: string) => STRANGE_CATS.find((c) => c.key === k) ?? STRANGE_CATS[1];

export interface StrangeProps {
  id: string;
  name: string;
  desc: string;
  cat: StrangeCat;
  state: string | null;
  /** country (Wikidata) — places outside the U.S. have no state */
  country?: string | null;
  image: string | null;
  wiki: string | null;
}

/* ── confirmed impact structures (Earth Impact Database) ─────────── */

export interface ImpactProps {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  diameterKm: number;
  /** millions of years */
  ageMa: number;
  /** as published, with its unit, e.g. "49 ka" or "66.051 ± 0.031 Ma" */
  ageText: string;
  image: string | null;
  wiki: string | null;
  /** ring radius in px at zoom 0 (true size; added on load) */
  r0?: number;
}

export const EID_URL = "http://www.passc.net/EarthImpactDatabase/New%20website_05-2018/Index.html";

/** Crater ring colour by age: young = hot, ancient = cold. */
export const IMPACT_AGE_STOPS: [number, string, string][] = [
  [0, "#fef08a", "under 1 million years"],
  [1, "#fb7185", "1 – 66 million"],
  [66, "#e879f9", "66 – 541 million"],
  [541, "#a78bfa", "541 million – 2 billion"],
  [2000, "#818cf8", "over 2 billion"],
];

/**
 * True on-screen radius of a crater at zoom 0 (512-px world), so the ring can
 * grow 2× per zoom level. Divided by cos(lat) for the Web-Mercator stretch.
 */
export const ringRadius0 = (diameterKm: number, lat: number) =>
  ((diameterKm / 2) * 1000 * 512) / 40075016 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

/** Pretty age: 0.049 → "49,000 years", 66.05 → "66 million years", 2023 → "2.02 billion years". */
export function formatAge(ma: number): string {
  if (ma < 1) return `${Math.round(ma * 1e6).toLocaleString("en-US")} years`;
  if (ma >= 1000) return `${(ma / 1000).toFixed(ma >= 10000 ? 0 : 2).replace(/\.?0+$/, "")} billion years`;
  return `${ma >= 10 ? Math.round(ma) : +ma.toFixed(1)} million years`;
}

/* ── GNIS landforms ──────────────────────────────────────────────── */

export type LandformCls = "arch" | "pillar" | "crater" | "lava";

export const LANDFORM_CLASSES: { key: LandformCls; label: string; color: string }[] = [
  { key: "arch", label: "Arch", color: "#fdba74" },
  { key: "pillar", label: "Pillar / spire", color: "#d8b4fe" },
  { key: "crater", label: "Crater (any origin)", color: "#f9a8d4" },
  { key: "lava", label: "Lava feature", color: "#fca5a5" },
];

export interface LandformProps {
  gnis: number;
  name: string;
  cls: LandformCls;
  state: string | null;
}

export const gnisUrl = (id: number | string) => `https://edits.nationalmap.gov/apps/gaz-domestic/public/summary/${id}`;

/* ── Macrostrat: the rock under a point ──────────────────────────── */

export const MACROSTRAT_TILES = "https://tiles.macrostrat.org/carto/{z}/{x}/{y}.png";

export interface GeoUnit {
  name: string;
  strat: string;
  lith: string;
  desc: string;
  period: string;
  /** Ma */
  bAge: number;
  tAge: number;
  color: string;
  ref: string;
}

/** The most detailed mapped rock unit at a point (Macrostrat, CC-BY 4.0). Null when nothing is mapped (oceans). */
export async function geologyAt(lng: number, lat: number, signal?: AbortSignal): Promise<GeoUnit | null> {
  const res = await fetch(`https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&format=json`, { signal });
  if (!res.ok) return null;
  const j = (await res.json()) as { success?: { data?: Record<string, unknown>[] } };
  // the API lists units from the most detailed map scale down
  const u = j.success?.data?.[0];
  if (!u) return null;
  const s = (k: string) => String(u[k] ?? "").trim();
  return {
    name: s("name"),
    strat: s("strat_name"),
    lith: s("lith").replace(/^Major:\{([^}]*)\}.*$/, "$1").replace(/,/g, ", "),
    desc: s("descrip"),
    period: s("best_int_name") || [s("b_int_name"), s("t_int_name")].filter(Boolean).join(" – "),
    bAge: Number(u.b_age) || 0,
    tAge: Number(u.t_age) || 0,
    color: s("color") || "#94a3b8",
    ref: s("comments").replace(/^Original map source:\s*/i, ""),
  };
}

/* ── shared helpers ──────────────────────────────────────────────── */

/** Straight-line km between two [lng, lat] points. */
export function kmBetween(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ── Australia: Geoscience Australia's 1:1M surface geology (CC BY 4.0) ── */

/** Geology polygons coloured by age, on top of Macrostrat inside Australia. */
export const GA_GEOLOGY_TILES =
  "https://services.ga.gov.au/gis/services/GA_Surface_Geology/MapServer/WMSServer?service=WMS&version=1.3.0&request=GetMap&layers=AUS_GA_1M_GUPoly_Age&styles=&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&format=image/png&transparent=true";
export const GA_BOUNDS: [number, number, number, number] = [112, -44, 154, -9];
export const GA_ATTRIBUTION = "Geology (Australia): © Commonwealth of Australia (Geoscience Australia), CC BY 4.0";
export const GA_CITATION = { label: "Geoscience Australia — Surface Geology of Australia 1:1M", href: "https://ecat.ga.gov.au/geonetwork/srv/eng/catalog.search#/metadata/74619", license: "CC BY 4.0" };
