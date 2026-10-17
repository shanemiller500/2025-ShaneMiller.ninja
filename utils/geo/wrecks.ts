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
