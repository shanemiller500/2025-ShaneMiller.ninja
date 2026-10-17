/* ------------------------------------------------------------------ */
/*  Shipwrecks data: NOAA charted wrecks (baked from the nautical      */
/*  charts), named wrecks worldwide (Wikidata, baked slim — details    */
/*  load live on click), and National Marine Sanctuary boundaries.     */
/* ------------------------------------------------------------------ */

export const NOAA_WRECKS_URL = "/atlas/wrecks-noaa.json";
export const NAMED_WRECKS_URL = "/atlas/wrecks-named.json";
export const SANCTUARIES_URL = "/atlas/sanctuaries.json";

/** NOAA chart wreck categories (S-57 CATWRK). */
export const WRECK_CATS: { key: string; label: string; color: string; blurb: string }[] = [
  { key: "danger", label: "Dangerous wreck", color: "#f43f5e", blurb: "Charted as a hazard to surface navigation — close enough to the surface to hit." },
  { key: "safe", label: "Non-dangerous wreck", color: "#38bdf8", blurb: "Deep enough that it isn't a hazard to ordinary surface vessels." },
  { key: "hull", label: "Hull showing", color: "#fbbf24", blurb: "Part of the hull or superstructure sticks out of the water at chart datum." },
  { key: "mast", label: "Masts showing", color: "#f97316", blurb: "Only masts break the surface." },
  { key: "remains", label: "Scattered remains", color: "#a78bfa", blurb: "Debris spread over an area rather than an intact hull." },
];
export const wreckCat = (k: string | null) => WRECK_CATS.find((c) => c.key === k) ?? null;

/** S-57 WATLEV — where the water sits relative to the wreck. */
export const WATER_LEVEL: Record<string, string> = {
  "1": "Partly above water at high tide",
  "2": "Always above water",
  "3": "Always under water",
  "4": "Covers and uncovers with the tide",
  "5": "Awash",
  "6": "Subject to flooding",
  "7": "Floating",
};

export interface NamedWreckCols {
  id: string[];
  name: string[];
  lng: number[];
  lat: number[];
  year: (number | null)[];
}

export function namedWreckFeatures(c: NamedWreckCols): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id: i,
      properties: { id, name: c.name[i], year: c.year[i] },
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
    })),
  };
}

/* ── live details for a named wreck (Wikidata API, CORS via origin=*) ── */

export interface WreckDetails {
  label: string;
  description: string | null;
  image: string | null;
  lost: string | null;
  wiki: string | null;
}

const thumb = (file: string, w = 800) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;

export async function wreckDetails(qid: string, signal?: AbortSignal): Promise<WreckDetails | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels|descriptions|claims|sitelinks&languages=en&sitefilter=enwiki&format=json&origin=*`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const j = (await res.json()) as { entities?: Record<string, { labels?: { en?: { value: string } }; descriptions?: { en?: { value: string } }; claims?: Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]>; sitelinks?: { enwiki?: { title: string } } }> };
  const e = j.entities?.[qid];
  if (!e) return null;
  const claim = (p: string) => e.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
  const image = claim("P18");
  const lost = claim("P576") as { time?: string } | undefined;
  const t = lost?.time?.replace(/^\+/, "");
  return {
    label: e.labels?.en?.value ?? qid,
    description: e.descriptions?.en?.value ?? null,
    image: typeof image === "string" ? thumb(image) : null,
    lost: t ? (t.slice(5, 10) === "00-00" ? t.slice(0, 4) : new Date(t.slice(0, 10)).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })) : null,
    wiki: e.sitelinks?.enwiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(e.sitelinks.enwiki.title.replace(/ /g, "_"))}` : null,
  };
}

export const metresToFeet = (m: number) => Math.round(m * 3.28084);

/* ── charted wrecks worldwide (UK Hydrographic Office via EMODnet, OGL v3) ── */

export const WORLD_WRECKS_URL = "/atlas/wrecks-world.json";
export const UKHO_WFS = "https://ows.emodnet-humanactivities.eu/wfs";

export interface WorldWreckCols {
  id: string[];
  lng: number[];
  lat: number[];
  cat: (string | null)[];
  depth: (number | null)[];
  name: (string | null)[];
  year: (number | null)[];
}

/** Chart names are upper-case ("CLAN MACMILLAN") — title-case them for reading. */
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'(/])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Hms|Uss|Ss|Mv|Hmt|Rms|Sms)\b/g, (m) => m.toUpperCase());

/** One charted-wrecks layer: NOAA in U.S. waters + UKHO everywhere else (`src` tells them apart). */
export function chartedWreckFeatures(noaa: GeoJSON.FeatureCollection | null, world: WorldWreckCols | null, cats: Set<string>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of noaa?.features ?? []) if (cats.has(f.properties?.cat ?? "none")) features.push({ ...f, properties: { ...f.properties, src: "noaa" } });
  if (world)
    for (let i = 0; i < world.id.length; i++) {
      if (!cats.has(world.cat[i] ?? "none")) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [world.lng[i], world.lat[i]] },
        properties: { src: "ukho", id: world.id[i], name: world.name[i] ? titleCase(world.name[i]!) : null, cat: world.cat[i], depth: world.depth[i], year: world.year[i] },
      });
    }
  return { type: "FeatureCollection", features };
}

export interface UkhoWreck {
  name: string | null;
  type: string | null;
  flag: string | null;
  sunk: string | null;
  depth: number | null;
  waterDepth: number | null;
  length: number | null;
  tonnage: string | null;
  cargo: string | null;
  circumstances: string | null;
  comments: string | null;
  lastSeen: string | null;
}

const na = (v: unknown) => (v == null || v === "n/a" || v === "" ? null : String(v).trim());

/** The full UKHO record for one wreck, live from EMODnet (CORS open). */
export async function ukhoWreck(id: string, signal?: AbortSignal): Promise<UkhoWreck | null> {
  const q = new URLSearchParams({ service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "emodnet:wwshipwrecks", outputFormat: "application/json", count: "1", CQL_FILTER: `wreck_id='${id.replace(/\D/g, "")}'` });
  const res = await fetch(`${UKHO_WFS}?${q}`, { signal });
  if (!res.ok) return null;
  const p = ((await res.json()) as { features?: { properties: Record<string, unknown> }[] }).features?.[0]?.properties;
  if (!p) return null;
  const ds = na(p.date_sunk);
  const n = (v: unknown) => (na(v) != null && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    name: na(p.name) ? titleCase(na(p.name)!) : null,
    type: na(p.type),
    flag: na(p.flag),
    sunk: ds && /^\d{8}$/.test(ds) ? new Date(`${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : ds,
    depth: n(p.depth),
    waterDepth: n(p.water_dept),
    length: n(p.length),
    tonnage: na(p.tonnage) ? `${na(p.tonnage)}${na(p.tonnage_ty) ? ` ${na(p.tonnage_ty)}` : ""} tons` : null,
    cargo: na(p.cargo),
    circumstances: na(p.circumstan),
    comments: na(p.general_co),
    lastSeen: na(p.last_detec),
  };
}
